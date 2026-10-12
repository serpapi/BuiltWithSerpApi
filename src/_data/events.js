const projects = require("./projects.json");
const { projectEvents } = require("../_lib/taxonomy");

module.exports = [...new Set(projects.flatMap(projectEvents))]
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
