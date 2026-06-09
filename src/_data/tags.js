const projects = require("./projects.json");

module.exports = [...new Set(projects.flatMap((project) => project.tags || []))]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
