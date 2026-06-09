# Contributing

Thanks for helping improve #BuiltWithSerpApi.

For project submissions, the preferred path is to open an issue:

https://github.com/serpapi/builtwithserpapi/issues/new?template=add-project.yml

Maintainers can then verify links and add the project to the feed.

## Project Data

Projects live in `src/_data/projects.json`. Each project supports:

```json
{
  "name": "Search Radar",
  "description": "A product-monitoring app that tracks SERP shifts across markets.",
  "author": "Jane Doe",
  "dateAdded": "2026-06-09",
  "githubUrl": "https://github.com/example/search-radar",
  "hostedUrl": "https://search-radar.example.com",
  "featured": false,
  "links": [
    {
      "label": "Case study",
      "url": "https://example.com/case-study"
    }
  ],
  "tags": ["monitoring", "analytics"],
  "apis": ["Google Search API", "Google News API"]
}
```

Required fields:

- `name`
- `description`
- `author`
- `dateAdded`
- `githubUrl`
- `tags`
- `apis`

Optional fields:

- `hostedUrl`
- `featured`
- `links`

Before adding a `githubUrl` or `hostedUrl`, verify that it is publicly reachable. Do not add local-only preview URLs such as `localhost` or `127.0.0.1`.

Use `YYYY-MM-DD` for `dateAdded`. Maintainers should set it to the date the project is added to the site.

## Run Locally

```bash
npm install
npm run dev
```

The development server runs Eleventy with watch mode.

## Build

```bash
npm run build
```

The generated static site is written to `_site/`.

## Deploy

The site deploys to GitHub Pages through `.github/workflows/pages.yml`.

The workflow:

- Installs dependencies with `npm ci`
- Runs `npm run build`
- Uploads `_site` as the Pages artifact
- Deploys using GitHub Actions

In the GitHub repository settings, Pages should be configured to use GitHub Actions.
