import pluginRss from "@11ty/eleventy-plugin-rss";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss);

  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });

  // Used by feed.njk so the RSS <updated> timestamp is always valid,
  // even before any posts exist.
  eleventyConfig.addGlobalData("buildTime", () => new Date());

  eleventyConfig.addFilter("readableDate", (dateObj) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj),
  );

  eleventyConfig.addFilter("isoDate", (dateObj) =>
    new Date(dateObj).toISOString(),
  );

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
