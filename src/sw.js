// Offline-support service worker (guntherjh/guntherjh.github.io#5).
// Lives at src/sw.js, not alongside the rest of the browser JS in
// src/js/, so it passthrough-copies straight to /sw.js at the site root —
// a service worker's default scope is the directory it's served from, and
// GitHub Pages has no way to widen that via a Service-Worker-Allowed
// header (a static host, no custom response headers), so it has to be
// served from the root to cover the whole site.

// Replaced with this build's ISO timestamp by eleventy.config.js's
// eleventy.after hook (see the comment there) — never actually shipped
// literally. Kept as a plain string constant, not Nunjucks templating,
// so this file stays ordinary browser JS that Biome lints and formats
// like every other file in src/js/, rather than escaping tooling coverage
// the way .njk templates already do.
const CACHE_VERSION = "__CACHE_VERSION__";
// servive workers are unique to specific origins so the cache name
// really just needs to be unique per build of this site, which
// CACHE_VERSION provides
const CACHE_NAME = `site-cache-${CACHE_VERSION}`;

// The app shell — fetched eagerly on install so a visitor who only ever
// loads one page still has the rest of the "core" site available offline,
// not just whatever they happened to browse to. Individual blog posts
// aren't listed here (unknown at authoring time); those get covered by
// the runtime caching in the fetch handler below the first time they're
// visited.
const PRECACHE_URLS = [
	"/",
	"/about/",
	"/resume/",
	"/blog/",
	"/css/style.css",
	"/js/theme-toggle.js",
	"/js/nav-toggle.js",
	"/js/about-sections.js",
	"/js/resume-sections.js",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
	);
	// Activates this version immediately rather than waiting for every open
	// tab of the old version to close — a stale Snapshot-style widget or a
	// day-old blog post being visible for one extra reload isn't a real
	// cost here, and the alternative (waiting) means visitors updating from
	// an old cache take much longer to get new content.
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	// Purges every cache from a previous CACHE_VERSION — this is what
	// actually makes the version bump meaningful; without it, old Cache
	// Storage entries would just accumulate forever instead of being
	// invalidated by a new deploy.
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	// Never cache cross-origin requests (nothing today makes any, but this
	// keeps a future third-party request — an API call, a font CDN — from
	// silently ending up in this site's own cache).
	if (new URL(event.request.url).origin !== self.location.origin) return;

	// Network-first, falling back to cache: prioritizes freshness for a
	// content site where pages do change, while still caching every
	// successful response as it's seen — so any page a visitor actually
	// loads becomes available offline afterward, on top of the precached
	// core above (see CODING_STANDARDS.md's Offline support entry for why
	// this was chosen over cache-first/stale-while-revalidate).
	const networkFetch = fetch(event.request);

	event.respondWith(networkFetch.catch(() => caches.match(event.request)));

	// A separate event.waitUntil() for the cache write, not just chained
	// off the promise passed to respondWith() above — respondWith()'s
	// promise settles as soon as a response is available, and the browser
	// is free to kill the worker right after that, which would abort an
	// un-awaited cache.put() mid-write (a well-known service worker
	// pitfall). This keeps the worker alive until the write actually
	// finishes.
	event.waitUntil(
		networkFetch
			.then((response) => {
				if (!response.ok) return;
				return caches
					.open(CACHE_NAME)
					.then((cache) => cache.put(event.request, response.clone()));
			})
			.catch(() => {
				// Network failure already handled by respondWith's own
				// .catch() above — nothing left to cache.
			}),
	);
});
