function projectEvents(project) {
  return [...new Set(project.events || [])];
}

function projectTags(project) {
  return project.tags || [];
}

module.exports = { projectEvents, projectTags };
