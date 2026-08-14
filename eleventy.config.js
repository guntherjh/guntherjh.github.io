import { readFileSync, writeFileSync } from "node:fs";
import pluginRss from "@11ty/eleventy-plugin-rss";

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

	eleventyConfig.addFilter("isoDate", (dateObj) =>
		new Date(dateObj).toISOString(),
	);

	// Strava reports distance in meters (src/_data/strava.json); named here
	// rather than inlining the 1609.34 conversion factor at each call site.
	eleventyConfig.addFilter("metersToMiles", (meters) => meters / 1609.34);

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
