import { readFileSync, writeFileSync } from "node:fs";
import pluginRss from "@11ty/eleventy-plugin-rss";

// Lighthouse widget color-coding/trend (guntherjh/guntherjh.github.io#71):
// pure functions, exported alongside the default Eleventy config so they're
// independently unit-testable (see eleventy.config.test.mjs), then wired
// in below as Nunjucks filters for src/about.njk to use directly.

// Lighthouse's own category-score thresholds (0-100) — the same ones its
// own report UI colors green/orange/red.
export function scoreLevel(score) {
	if (score >= 90) return "good";
	if (score >= 50) return "average";
	return "poor";
}

// Google's documented Core Web Vitals thresholds for LCP/CLS, plus
// Lighthouse's own TBT scoring thresholds (TBT is a lab proxy, not a true
// CWV, but Lighthouse scores it the same three-tier way).
const METRIC_THRESHOLDS = {
	lcp: { good: 2500, average: 4000 },
	cls: { good: 0.1, average: 0.25 },
	tbt: { good: 200, average: 600 },
};

// value first, metricKey second — matches Nunjucks filter-call order
// ({{ value | metricLevel("lcp") }} invokes metricLevel(value, "lcp")).
export function metricLevel(value, metricKey) {
	const thresholds = METRIC_THRESHOLDS[metricKey];
	if (!thresholds) return null;
	if (value <= thresholds.good) return "good";
	if (value <= thresholds.average) return "average";
	return "poor";
}

const LEVEL_RANK = { poor: 0, average: 1, good: 2 };

// Compares the classified level (scoreLevel/metricLevel's "good"/"average"/
// "poor" output — not the raw value) of the current run against the
// previous one in the Lighthouse Snapshot's history (see CONTEXT.md's
// Lighthouse Snapshot entry). Deliberately level-based, not a raw delta:
// real production runs show the same metric swinging by noise alone as
// much as a genuine regression would (e.g. Performance 100→85→88 or TBT
// 0ms→509ms between consecutive audits, from lab/network variance, not a
// real change — see ADR 0006 and guntherjh/guntherjh.github.io#71's review)
// — comparing levels instead means only an actual tier change is reported,
// not every run's jitter. This also means a single `outcome`/`direction`
// works for every column without a higherIsBetter flag: scoreLevel and
// metricLevel already classify "good" as the best tier regardless of
// whether a higher or lower raw number gets you there. Returns null when
// there's no previous run to compare against (e.g. the very first audit).
export function trend(currentLevel, previousLevel) {
	if (previousLevel === undefined || previousLevel === null) return null;
	if (currentLevel === previousLevel)
		return { direction: "flat", outcome: "flat" };

	const outcome =
		LEVEL_RANK[currentLevel] > LEVEL_RANK[previousLevel]
			? "improved"
			: "regressed";
	return { direction: outcome === "improved" ? "up" : "down", outcome };
}

// Human-readable tier name for a scoreLevel/metricLevel value — "average"
// is Lighthouse's own "needs improvement" band, spelled out here so the
// trend toggletip reads in plain language.
const LEVEL_LABEL = {
	good: "good",
	average: "needs improvement",
	poor: "poor",
};

// Builds the sentence shown in a trend arrow's toggletip (see ADR 0007):
// self-contained and framed by tier, so it never contradicts the arrow —
// the arrow tracks tier changes, not raw deltas, so "88 (good)" after
// "100 (good)" is deliberately reported as no tier change. Takes already-
// formatted display strings (e.g. "1.9s", "509ms", "95") and an already-
// formatted previous-audit date, so this stays free of unit/date logic.
// Returns "" for a flat or absent trend — those arrows aren't toggletips.
export function trendDetail({
	label,
	currentDisplay,
	currentLevel,
	previousDisplay,
	previousLevel,
	previousDate,
}) {
	const change = trend(currentLevel, previousLevel);
	if (!change || change.outcome === "flat") return "";

	return (
		`${label} ${currentDisplay} (${LEVEL_LABEL[currentLevel]}). ` +
		`Previous audit ${previousDate}: ${previousDisplay} ` +
		`(${LEVEL_LABEL[previousLevel]}). Tier ${change.outcome}.`
	);
}

export default function (eleventyConfig) {
	eleventyConfig.addPlugin(pluginRss);

	eleventyConfig.addPassthroughCopy("src/css");
	eleventyConfig.addPassthroughCopy("src/js");
	eleventyConfig.addPassthroughCopy("src/icons");
	eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
	eleventyConfig.addPassthroughCopy({
		"src/manifest.webmanifest": "manifest.webmanifest",
	});
	// src/sw.js lives outside src/js/ and copies straight to the site root
	// — see the comment atop that file for why a service worker has to be
	// served from "/" on GitHub Pages.
	eleventyConfig.addPassthroughCopy({ "src/sw.js": "sw.js" });

	// Stamps /sw.js's cache name with this build's timestamp — see the
	// CACHE_VERSION comment in src/sw.js. A plain post-build string
	// replace (not Nunjucks templating) so sw.js stays ordinary browser JS
	// that Biome lints/formats like the rest of src/js/, rather than
	// escaping tooling coverage the way .njk templates already do.
	// Runs after passthrough copy (part of the same build), so _site/sw.js
	// already exists by the time this fires.
	eleventyConfig.on("eleventy.after", ({ dir }) => {
		const swPath = `${dir.output}/sw.js`;
		const sw = readFileSync(swPath, "utf8");
		// Fails the build rather than silently shipping a literal
		// "__CACHE_VERSION__" forever — a typo'd or removed placeholder
		// would otherwise quietly break cache invalidation on every future
		// deploy with no build-time signal that anything was wrong.
		if (!sw.includes("__CACHE_VERSION__")) {
			throw new Error(
				`${swPath} is missing the __CACHE_VERSION__ placeholder — cache versioning would silently stop working.`,
			);
		}
		writeFileSync(
			swPath,
			sw.replace("__CACHE_VERSION__", new Date().toISOString()),
		);
	});

	// Used by feed.njk so the RSS <updated> timestamp is always valid,
	// even before any posts exist.
	eleventyConfig.addGlobalData("buildTime", () => new Date());

	// new Date(dateObj) rather than using dateObj directly — accepts a
	// string (e.g. JSON data like src/_data/lighthouse.json's capturedAt)
	// as well as an already-parsed Date (e.g. buildTime, post front
	// matter dates), same coercion isoDate below already relies on.
	eleventyConfig.addFilter("readableDate", (dateObj) =>
		new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		}).format(new Date(dateObj)),
	);

	eleventyConfig.addFilter("copyrightDate", (dateObj) =>
		new Intl.DateTimeFormat("en-US", {
			year: "numeric",
		}).format(new Date(dateObj)),
	);

	eleventyConfig.addFilter("isoDate", (dateObj) =>
		new Date(dateObj).toISOString(),
	);

	// Strava reports distance in meters (src/_data/strava.json); named here
	// rather than inlining the 1609.34 conversion factor at each call site.
	eleventyConfig.addFilter("metersToMiles", (meters) => meters / 1609.34);

	// Lighthouse widget color-coding/trend (guntherjh/guntherjh.github.io#71)
	// — see the pure functions above for the actual logic.
	eleventyConfig.addFilter("scoreLevel", scoreLevel);
	eleventyConfig.addFilter("metricLevel", metricLevel);
	eleventyConfig.addFilter("trend", trend);
	eleventyConfig.addFilter("trendDetail", trendDetail);

	return {
		dir: {
			input: "src",
			output: "_site",
			includes: "_includes",
			data: "_data",
		},
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
	};
}
