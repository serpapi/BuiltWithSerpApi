#!/usr/bin/env node

import { readFile, writeFile, appendFile } from "node:fs/promises";
import process from "node:process";

const PROJECTS_PATH = new URL("../src/_data/projects.json", import.meta.url);
const VALID_SCOPES = new Set(["featured", "all"]);

const scope = readOption("scope", process.env.PROJECT_LINK_SCOPE || "all");
const timeoutSeconds = readNumber(
  readOption("timeout-seconds", readOption("timeout", process.env.PROJECT_LINK_TIMEOUT_SECONDS || "20")),
  20
);
const timeoutMs = Math.max(1, timeoutSeconds) * 1000;
const concurrency = Math.min(
  10,
  Math.max(1, readNumber(readOption("concurrency", process.env.PROJECT_LINK_CONCURRENCY || "5"), 5))
);
const failOnInvalid = readBoolean(process.env.PROJECT_LINK_FAIL_ON_INVALID, true);
const reportPath = process.env.PROJECT_LINK_REPORT || "project-link-report.md";

if (!VALID_SCOPES.has(scope)) {
  console.error(`Invalid scope "${scope}". Use "featured" or "all".`);
  process.exit(2);
}

const projects = JSON.parse(await readFile(PROJECTS_PATH, "utf8"));
const selectedProjects = scope === "all"
  ? projects
  : projects.filter((project) => project.featured);
const checks = selectedProjects.flatMap(buildChecks);
const results = await mapLimit(checks, concurrency, (check) => checkLink(check, timeoutMs));
const report = renderReport({
  scope,
  timeoutSeconds,
  selectedProjects,
  results
});

await writeFile(reportPath, report);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
}

console.log(report);

if (results.some((result) => result.outcome === "failed") && failOnInvalid) {
  process.exitCode = 1;
}

function buildChecks(project) {
  const checksForProject = [
    {
      project,
      type: "source",
      label: "Source repository",
      url: project.githubUrl,
      required: true
    },
    {
      project,
      type: "deployed",
      label: "Deployed app",
      url: project.hostedUrl,
      required: false
    }
  ];

  for (const link of project.links || []) {
    checksForProject.push({
      project,
      type: "extra",
      label: link.label || "Additional link",
      url: link.url,
      required: false
    });
  }

  return checksForProject;
}

async function checkLink(check, timeout) {
  const baseResult = {
    project: check.project.name,
    type: check.type,
    label: check.label,
    url: check.url || "",
    finalUrl: "",
    status: "",
    outcome: "failed",
    detail: ""
  };

  if (!check.url) {
    return {
      ...baseResult,
      outcome: check.required ? "failed" : "skipped",
      detail: check.required ? "Missing required URL" : "No URL provided"
    };
  }

  const validationError = validateUrl(check.url);
  if (validationError) {
    return {
      ...baseResult,
      detail: validationError
    };
  }

  if (isStreamlitAppUrl(check.url)) {
    return checkStreamlitLink(baseResult, timeout);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(check.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "BuiltWithSerpApi-link-checker (+https://github.com/serpapi/BuiltWithSerpApi)"
      }
    });

    if (response.body) {
      await response.body.cancel().catch(() => {});
    }

    const ok = response.status >= 200 && response.status < 400;
    return {
      ...baseResult,
      finalUrl: response.url || check.url,
      status: String(response.status),
      outcome: ok ? "ok" : "failed",
      detail: ok ? "Reachable" : `HTTP ${response.status}`
    };
  } catch (error) {
    const causeCode = error.cause?.code ? ` (${error.cause.code})` : "";
    const detail = error.name === "AbortError"
      ? `Timed out after ${timeout / 1000}s`
      : `${error.message || error.name}${causeCode}`;

    return {
      ...baseResult,
      detail
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkStreamlitLink(baseResult, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(baseResult.url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "BuiltWithSerpApi-link-checker (+https://github.com/serpapi/BuiltWithSerpApi)"
      }
    });

    if (response.body) {
      await response.body.cancel().catch(() => {});
    }

    const ok = response.status >= 200 && response.status < 400;
    return {
      ...baseResult,
      finalUrl: response.url || baseResult.url,
      status: String(response.status),
      outcome: ok ? "ok" : "failed",
      detail: ok ? streamlitDetail(response) : `HTTP ${response.status}`
    };
  } catch (error) {
    const causeCode = error.cause?.code ? ` (${error.cause.code})` : "";
    const detail = error.name === "AbortError"
      ? `Timed out after ${timeout / 1000}s`
      : `${error.message || error.name}${causeCode}`;

    return {
      ...baseResult,
      detail
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function streamlitDetail(response) {
  if (response.status >= 300) {
    const location = response.headers.get("location");
    if (!location) return "Streamlit Cloud responded with redirect";

    try {
      const redirectUrl = new URL(location, response.url);
      const hostname = redirectUrl.hostname.toLowerCase();
      if (hostname === "share.streamlit.io") {
        return "Streamlit Cloud responded with wake/auth redirect";
      }
      if (hostname.endsWith(".streamlit.app")) {
        return "Streamlit Cloud responded with app redirect";
      }
    } catch {
      return "Streamlit Cloud responded with redirect";
    }

    return "Streamlit Cloud responded with redirect";
  }

  return "Reachable";
}

function validateUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return "Invalid URL";
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return "URL must use http or https";
  }

  if (url.username || url.password) {
    return "URL must not include credentials";
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return "Local or private preview URL";
  }

  return "";
}

function isStreamlitAppUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().endsWith(".streamlit.app");
  } catch {
    return false;
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function renderReport({ scope: checkedScope, timeoutSeconds: seconds, selectedProjects: projectSet, results: linkResults }) {
  const ok = linkResults.filter((result) => result.outcome === "ok");
  const failed = linkResults.filter((result) => result.outcome === "failed");
  const failedSource = failed.filter((result) => result.type === "source");
  const failedDeployed = failed.filter((result) => result.type === "deployed");
  const failedExtra = failed.filter((result) => result.type === "extra");
  const skipped = linkResults.filter((result) => result.outcome === "skipped");

  const lines = [
    "# Project Link Check",
    "",
    `- Scope: \`${checkedScope}\``,
    `- Projects checked: ${projectSet.length}`,
    `- Links reachable: ${ok.length}`,
    `- Links dead or invalid: ${failed.length}`,
    `- Source repositories dead or invalid: ${failedSource.length}`,
    `- Deployed links dead or invalid: ${failedDeployed.length}`,
    `- Additional links dead or invalid: ${failedExtra.length}`,
    `- Links skipped: ${skipped.length}`,
    `- Timeout per link: ${seconds}s`,
    `- Checked at: ${new Date().toISOString()}`,
    "",
    failed.length === 0 ? "## Result: passed" : "## Result: failed",
    ""
  ];

  lines.push("### Dead or Invalid Source Repositories", "");
  lines.push(...renderTable(failedSource));
  lines.push("");

  lines.push("### Dead or Invalid Deployed Links", "");
  lines.push(...renderTable(failedDeployed));
  lines.push("");

  if (failedExtra.length > 0) {
    lines.push("### Dead or Invalid Additional Links", "");
    lines.push(...renderTable(failedExtra));
    lines.push("");
  }

  if (skipped.length > 0) {
    lines.push("### Skipped Links", "");
    lines.push(...renderTable(skipped));
    lines.push("");
  }

  lines.push("### Checked Links", "");
  lines.push(...renderTable(ok));
  lines.push("");

  return lines.join("\n");
}

function renderTable(rows) {
  if (rows.length === 0) return ["None."];

  return [
    "| Project | Type | URL | Status | Detail |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => [
      md(row.project),
      md(row.label),
      row.url ? mdLink(row.url) : "",
      md(row.status || row.outcome),
      md(row.detail)
    ].join(" | "))
  ];
}

function md(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|");
}

function mdLink(url) {
  const label = url.length > 80 ? `${url.slice(0, 77)}...` : url;
  return `[${md(label)}](${url})`;
}

function readOption(name, fallback) {
  const args = process.argv.slice(2);
  const equalsPrefix = `--${name}=`;
  const withEquals = args.find((arg) => arg.startsWith(equalsPrefix));
  if (withEquals) return withEquals.slice(equalsPrefix.length);

  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) return args[index + 1];

  return fallback;
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes)$/i.test(String(value));
}
