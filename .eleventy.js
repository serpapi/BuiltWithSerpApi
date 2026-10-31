module.exports = function (eleventyConfig) {
  const { projectEvents, projectTags } = require("./src/_lib/taxonomy");
  eleventyConfig.addWatchTarget("./src/_lib/");
  eleventyConfig.addFilter("projectEvents", projectEvents);
  eleventyConfig.addFilter("projectTags", projectTags);
  eleventyConfig.addFilter("projectsByEvent", (projects, event) => projects.filter((project) => projectEvents(project).includes(event)));
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  const lucide = require("lucide-static");
  // GitHub brand icon retained from Lucide 0.468.0; see assets/licenses/lucide-github.txt.
  // Source: https://github.com/lucide-icons/lucide/blob/0.468.0/icons/github.svg
  const githubIcon = require("node:fs").readFileSync(require("node:path").join(__dirname, "src/_includes/icons/github.svg"), "utf8");
  eleventyConfig.addWatchTarget("./src/_includes/icons/");
  const icons = {
    calendar: lucide.CalendarDays,
    add: lucide.Plus,
    api: lucide.Braces,
    bolt: lucide.Zap,
    book: lucide.BookOpen,
    code: lucide.CodeXml,
    docs: lucide.BookOpen,
    details: lucide.FileText,
    feed: lucide.LayoutGrid,
    filter: lucide.SlidersHorizontal,
    globe: lucide.Globe,
    github: githubIcon,
    hub: lucide.Network,
    idea: lucide.Lightbulb,
    link: lucide.Link,
    open: lucide.ExternalLink,
    search: lucide.Search,
    send: lucide.Send,
    sort: lucide.ArrowDownWideNarrow,
    star: lucide.Star,
    tag: lucide.Tag,
    close: lucide.X
  };
  eleventyConfig.addPassthroughCopy({ "node_modules/lucide-static/LICENSE": "assets/licenses/lucide.txt" });
  eleventyConfig.addShortcode("icon", function (name) {
    if (!icons[name]) throw new Error(`Unknown icon: ${name}`);
    return icons[name].trim()
      .replace("<svg", '<svg aria-hidden="true" focusable="false"')
      .replace('class="lucide ', `class="icon icon-${name} lucide `);
  });

  eleventyConfig.addFilter("projectPermalink", function (project) {
    return `/projects/${project.slug || slugify(project.name)}/`;
  });

  eleventyConfig.addFilter("readableDate", function (value) {
    if (!value) return "";

    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  });

  eleventyConfig.addFilter("encodeFacetValues", function (values) {
    return encodeURIComponent(JSON.stringify(values || []));
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

  eleventyConfig.addFilter("sortProjectsNewest", function (projects) {
    return sortProjectsByDate(projects, "desc");
  });

  eleventyConfig.addFilter("sortProjectsOldest", function (projects) {
    return sortProjectsByDate(projects, "asc");
  });

  eleventyConfig.addFilter("relatedProjectCount", function (projects, key, field) {
    return projects.filter((project) => (project[field] || []).includes(key)).length;
  });

  eleventyConfig.addFilter("absoluteUrl", function (value, baseUrl) {
    return absoluteUrl(value, baseUrl);
  });

  eleventyConfig.addFilter("maxDateAdded", function (projects, key, field) {
    const matchingProjects = key && field
      ? projects.filter((project) => (project[field] || []).includes(key))
      : projects;

    return matchingProjects
      .map((project) => project.dateAdded)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  });

  eleventyConfig.addFilter("seoJsonLd", function (page, site, projects, title, description, projectEntry) {
    const baseUrl = process.env.SITE_BASE_URL || site.baseUrl;
    const rootUrl = absoluteUrl("/", baseUrl);
    const canonicalUrl = absoluteUrl(page.url || "/", baseUrl);
    const logoUrl = absoluteUrl(site.logo || site.ogImage, baseUrl);
    const pageTitle = title || site.name;
    const pageDescription = description || site.description;
    const latestDate = projectEntry?.dateAdded || projects
      .map((project) => project.dateAdded)
      .filter(Boolean)
      .sort()
      .at(-1);

    const graph = [
      {
        "@type": "Organization",
        "@id": `${rootUrl}#organization`,
        name: site.organizationName || "SerpApi",
        url: site.organizationUrl || site.url,
        logo: {
          "@type": "ImageObject",
          url: logoUrl
        },
        sameAs: [
          site.github
        ].filter(Boolean)
      },
      {
        "@type": "WebSite",
        "@id": `${rootUrl}#website`,
        name: site.name,
        url: rootUrl,
        description: site.description,
        publisher: {
          "@id": `${rootUrl}#organization`
        }
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: pageTitle,
        description: pageDescription,
        isPartOf: {
          "@id": `${rootUrl}#website`
        },
        dateModified: latestDate
      }
    ];

    if (projectEntry) {
      const projectId = `${canonicalUrl}#project`;
      graph[2].mainEntity = {
        "@id": projectId
      };
      graph.push({
        "@type": "CreativeWork",
        "@id": projectId,
        name: projectEntry.name,
        description: projectEntry.description,
        url: canonicalUrl,
        author: {
          "@type": projectEntry.author && /team/i.test(projectEntry.author) ? "Organization" : "Person",
          name: projectEntry.author
        },
        keywords: [...(projectEntry.tags || []), ...(projectEntry.apis || [])].join(", "),
        codeRepository: projectEntry.githubUrl,
        sameAs: [
          projectEntry.hostedUrl,
          projectEntry.githubUrl,
          ...(projectEntry.links || []).map((link) => link.url)
        ].filter(Boolean)
      });
    }

    if (isHomeUrl(canonicalUrl, rootUrl)) {
      graph.push({
        "@type": "ItemList",
        "@id": `${canonicalUrl}#project-list`,
        name: "#BuiltWithSerpApi project feed",
        description: site.description,
        numberOfItems: projects.length,
        itemListElement: projects.map((project, index) => {
          const projectPageUrl = absoluteUrl(`/projects/${project.slug || slugify(project.name)}/`, baseUrl);

          return {
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "CreativeWork",
              "@id": `${projectPageUrl}#project`,
              name: project.name,
              description: project.description,
              url: projectPageUrl,
              author: {
                "@type": project.author && /team/i.test(project.author) ? "Organization" : "Person",
                name: project.author
              },
              datePublished: project.dateAdded,
              keywords: [...(project.tags || []), ...(project.apis || [])].join(", "),
              codeRepository: project.githubUrl,
              sameAs: [project.hostedUrl, project.githubUrl].filter(Boolean)
            }
          };
        })
      });
    }

    return JSON.stringify({
      "@context": "https://schema.org",
      "@graph": graph
    }, null, 2).replace(/</g, "\\u003c");
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

function sortProjectsByDate(projects, direction) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...(projects || [])].sort((a, b) => {
    const dateCompare = String(a.dateAdded || "").localeCompare(String(b.dateAdded || ""));
    if (dateCompare !== 0) return dateCompare * multiplier;

    return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base"
    });
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";

  const rawValue = String(value);
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  if (!baseUrl) return rawValue;

  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const basePath = base.pathname.replace(/\/+$/g, "");

  if (rawValue.startsWith("/") && basePath && (rawValue === basePath || rawValue.startsWith(`${basePath}/`))) {
    base.pathname = rawValue;
    return base.href;
  }

  return new URL(rawValue.replace(/^\/+/g, ""), base).href;
}

function isHomeUrl(canonicalUrl, rootUrl) {
  return canonicalUrl.replace(/\/+$/g, "") === rootUrl.replace(/\/+$/g, "");
}
