module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.addShortcode("icon", function (name) {
    const paths = {
      add: '<path d="M12 5v14M5 12h14"/>',
      api: '<path d="M6 8h4M6 16h4M14 7l3 5-3 5M3 6v12a2 2 0 0 0 2 2h4M21 6v12a2 2 0 0 1-2 2h-4"/>',
      bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8z"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4v15.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5"/>',
      code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 4l-4 16"/>',
      docs: '<path d="M8 3h8l4 4v16H8z"/><path d="M16 3v5h5M12 13h5M12 17h5"/>',
      feed: '<path d="M5 5h14M5 12h14M5 19h10"/><path d="M3 5h.01M3 12h.01M3 19h.01"/>',
      github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.1-.3-3.7 1.4a12.8 12.8 0 0 0-6.7 0C6.6.3 5.5.6 5.5.6a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 4 7.8c0 5.2 3.1 6.4 6.1 6.7a3.4 3.4 0 0 0-.9 2.6V22"/>',
      globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/>',
      hub: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.6 10.5 5.8-3M8.6 13.5l5.8 3"/>',
      idea: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.7-1.5 2.5h-4c0-.8-.6-1.8-1.5-2.5z"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
      open: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/><path d="M19 13v6H5V5h6"/>',
      rocket: '<path d="M4.5 16.5c-1 1-1.5 3-1.5 4.5 1.5 0 3.5-.5 4.5-1.5"/><path d="M9 15 5 11l4-2 6-6c2.5-.7 4.8-.4 6 1.2 1.6 1.2 1.9 3.5 1.2 6l-6 6-2 4-4-4z"/><path d="M15 9h.01"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
      send: '<path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/>',
      spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17z"/>',
      star: '<path d="m12 2.5 3 6.1 6.7 1-4.8 4.7 1.1 6.7-6-3.2-6 3.2 1.1-6.7-4.8-4.7 6.7-1 3-6.1z"/>',
      tag: '<path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V3h9.8L20 10.2a2 2 0 0 1 0 2.8z"/><path d="M7.5 7.5h.01"/>',
      verified: '<path d="m9 12 2 2 4-5"/><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z"/>'
    };

    return `<svg class="icon icon-${name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.spark}</svg>`;
  });

  eleventyConfig.addFilter("projectUrl", function (project) {
    return project.hostedUrl || project.githubUrl || "#";
  });

  eleventyConfig.addFilter("domain", function (url) {
    if (!url) return "";

    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  });

  eleventyConfig.addFilter("slug", function (value) {
    return slugify(value);
  });

  eleventyConfig.addFilter("allTags", function (projects) {
    return uniqueSorted(projects.flatMap((project) => project.tags || []));
  });

  eleventyConfig.addFilter("allApis", function (projects) {
    return uniqueSorted(projects.flatMap((project) => project.apis || []));
  });

  eleventyConfig.addFilter("projectsByTag", function (projects, tag) {
    return projects.filter((project) => (project.tags || []).includes(tag));
  });

  eleventyConfig.addFilter("projectsByApi", function (projects, api) {
    return projects.filter((project) => (project.apis || []).includes(api));
  });

  eleventyConfig.addFilter("relatedProjectCount", function (projects, key, field) {
    return projects.filter((project) => (project[field] || []).includes(key)).length;
  });

  return {
    pathPrefix: process.env.ELEVENTY_PATH_PREFIX || "/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
