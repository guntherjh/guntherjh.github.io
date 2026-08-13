import pluginRss from "@11ty/eleventy-plugin-rss";

export default function (eleventyConfig) {
	eleventyConfig.addPlugin(pluginRss);

	eleventyConfig.addPassthroughCopy("src/css");
	eleventyConfig.addPassthroughCopy("src/js");
	eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });

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
