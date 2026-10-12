const eventTags = require("../_data/eventTags.json");
const eventNames = new Set(eventTags.map((tag) => tag.toLowerCase()));

function isEventTag(tag) {
  return eventNames.has(String(tag).trim().toLowerCase());
}

function projectEvents(project) {
  return [...new Set([...(project.events || []), ...(project.tags || []).filter(isEventTag)])];
}

function projectTags(project) {
  const events = new Set(projectEvents(project));
  return (project.tags || []).filter((tag) => !events.has(tag));
}

module.exports = { isEventTag, projectEvents, projectTags };
