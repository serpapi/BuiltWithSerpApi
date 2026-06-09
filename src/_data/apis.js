const projects = require("./projects.json");

module.exports = [...new Set(projects.flatMap((project) => project.apis || []))]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
