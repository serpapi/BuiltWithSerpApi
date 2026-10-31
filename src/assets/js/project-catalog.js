(() => {
  const feed = document.querySelector("[data-project-feed]");
  const toolbar = document.querySelector(".catalog-toolbar");
  const siteHeader = document.querySelector(".site-header");
  const searchInput = document.querySelector("[data-search-input]");
  const searchClear = document.querySelector("[data-search-clear]");
  const select = document.querySelector("[data-project-sort]");
  const filterDetails = document.querySelector("[data-filter-disclosure]");
  const filterCount = document.querySelector("[data-filter-count]");
  const resultCount = document.querySelector("[data-project-result-count]");
  const emptyState = document.querySelector("[data-filter-empty-state]");
  const pagination = document.querySelector("[data-feed-pagination]");
  const visibleCount = document.querySelector("[data-project-visible-count]");
  const pageButtons = document.querySelector("[data-project-pages]");
  const previousButton = document.querySelector("[data-page-previous]");
  const nextButton = document.querySelector("[data-page-next]");
  const pageSize = 50;
  let currentPage = 1;
  const tagForm = document.querySelector("[data-tag-filter-form]");
  const tagInput = document.querySelector("[data-tag-filter-input]");
  const tagOptions = document.querySelector("[data-tag-options]");
  const tagError = document.querySelector("[data-tag-filter-error]");
  const selectedTagList = document.querySelector("[data-selected-tags]");
  const eventInputs = Array.from(document.querySelectorAll("[data-event-filter]"));
  const apiInputs = Array.from(document.querySelectorAll("[data-api-filter]"));
  const clearButtons = Array.from(document.querySelectorAll("[data-filter-clear]"));
  const closeButton = document.querySelector("[data-filter-close]");
  if (!feed || !select || !filterDetails || !tagForm || !tagInput || !tagOptions || !selectedTagList) return;

  const projects = Array.from(feed.querySelectorAll('[data-feed-item="project"]'));
  const promoPool = document.querySelector('[data-promo-pool]');
  const promoOrder = promoPool ? Array.from(promoPool.content.children) : [];
  const promoSlots = [4, 16, 32];
  // Shuffle once per load, then rotate three different resources through each page.
  for (let index = promoOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [promoOrder[index], promoOrder[swapIndex]] = [promoOrder[swapIndex], promoOrder[index]];
  }
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });
  const originalOrder = new Map(projects.map((node, index) => [node, index]));
  const availableTags = new Map(Array.from(tagOptions.options).map((option) => (
    [option.value.toLocaleLowerCase(), option.value]
  )));
  const selectedTags = new Set();
  const selectedApis = new Set();
  const selectedEvents = new Set();
  const facets = new Map(projects.map((project) => [project, {
    events: new Set(JSON.parse(decodeURIComponent(project.dataset.projectEvents || "%5B%5D"))),
    tags: new Set(JSON.parse(decodeURIComponent(project.dataset.projectTags || "%5B%5D"))),
    apis: new Set(JSON.parse(decodeURIComponent(project.dataset.projectApis || "%5B%5D")))
  }]));
  const normalizeSearch = (value) => value.toLocaleLowerCase().replace(/[-_]+/g, " ");
  const searchIndex = new Map(projects.map((project) => [project, normalizeSearch([
    project.dataset.projectSearch,
    ...facets.get(project).tags,
    ...facets.get(project).events,
    ...facets.get(project).apis
  ].join(" "))]));
  let searchTerms = [];
  let randomOrder = [...projects];

  const compareTitle = (a, b) => collator.compare(a.dataset.projectTitle || "", b.dataset.projectTitle || "");
  const compareOriginal = (a, b) => (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0);

  const shuffleRandomOrder = () => {
    randomOrder = [...projects];
    for (let index = randomOrder.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [randomOrder[index], randomOrder[swapIndex]] = [randomOrder[swapIndex], randomOrder[index]];
    }
  };

  const sortedOrders = {
    newest: [...projects].sort((a, b) => (
      (b.dataset.projectDate || "").localeCompare(a.dataset.projectDate || "") ||
      compareTitle(a, b) || compareOriginal(a, b)
    )),
    oldest: [...projects].sort((a, b) => (
      (a.dataset.projectDate || "").localeCompare(b.dataset.projectDate || "") ||
      compareTitle(a, b)
    ))
  };
  const sortedProjects = (mode) => mode === "random" ? randomOrder : sortedOrders[mode];

  const hasActiveFilters = () => searchTerms.length > 0 || selectedTags.size > 0 || selectedApis.size > 0 || selectedEvents.size > 0;

  const projectMatchesFilters = (project) => {
    const projectFacets = facets.get(project);
    const matchesTags = selectedTags.size === 0 || [...selectedTags].some((tag) => projectFacets.tags.has(tag));
    const matchesApis = selectedApis.size === 0 || [...selectedApis].some((api) => projectFacets.apis.has(api));
    const matchesEvents = selectedEvents.size === 0 || [...selectedEvents].some((event) => projectFacets.events.has(event));
    return matchesTags && matchesApis && matchesEvents && searchTerms.every((term) => searchIndex.get(project).includes(term));
  };

  const renderSelectedTags = () => {
    const fragment = document.createDocumentFragment();

    selectedTags.forEach((tag) => {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const remove = document.createElement("span");
      button.type = "button";
      button.className = "selected-tag";
      button.dataset.removeTag = tag;
      button.setAttribute("aria-label", `Remove ${tag} tag`);
      label.textContent = tag;
      remove.textContent = "×";
      remove.setAttribute("aria-hidden", "true");
      button.append(label, remove);
      fragment.appendChild(button);
    });

    selectedTagList.replaceChildren(fragment);
    selectedTagList.hidden = selectedTags.size === 0;
  };

  const renderFilterCount = () => {
    const count = selectedTags.size + selectedApis.size + selectedEvents.size;
    filterCount.textContent = String(count);
    filterCount.hidden = count === 0;
    filterDetails.classList.toggle("has-filters", count > 0);
  };

  const renderPagination = (total, pageCount, startIndex, displayedCount) => {
    pagination.hidden = pageCount <= 1;
    visibleCount.textContent = total
      ? `${startIndex + 1}–${startIndex + displayedCount} of ${total} projects`
      : "0 projects";
    previousButton.disabled = currentPage === 1;
    previousButton.dataset.page = currentPage - 1;
    nextButton.disabled = currentPage === pageCount;
    nextButton.dataset.page = currentPage + 1;

    let numbers;
    if (pageCount <= 7) {
      numbers = Array.from({ length: pageCount }, (_, index) => index + 1);
    } else if (currentPage <= 3) {
      numbers = [1, 2, 3, 4, pageCount];
    } else if (currentPage >= pageCount - 2) {
      numbers = [1, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
    } else {
      numbers = [1, currentPage - 1, currentPage, currentPage + 1, pageCount];
    }
    const fragment = document.createDocumentFragment();
    numbers.forEach((number, index) => {
      if (index && number - numbers[index - 1] > 1) {
        const gap = document.createElement("span");
        gap.textContent = "…";
        gap.setAttribute("aria-hidden", "true");
        fragment.appendChild(gap);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.page = number;
      button.textContent = number;
      button.setAttribute("aria-label", `Page ${number}`);
      if (number === currentPage) button.setAttribute("aria-current", "page");
      fragment.appendChild(button);
    });
    pageButtons.replaceChildren(fragment);
  };

  const renderFeed = (scrollToResults = true, resetPage = true) => {
    if (resetPage) currentPage = 1;
    let scrollTop = window.scrollY;
    if (scrollToResults) {
      const resultsTop = Math.max(0, feed.getBoundingClientRect().top + window.scrollY -
        siteHeader.getBoundingClientRect().height - toolbar.offsetHeight - 16);
      scrollTop = Math.min(scrollTop, resultsTop);
    }
    const filteredProjects = sortedProjects(select.value).filter(projectMatchesFilters);
    const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const startIndex = (currentPage - 1) * pageSize;
    const displayedProjects = filteredProjects.slice(startIndex, startIndex + pageSize);
    const filtering = hasActiveFilters();
    const nextItems = [];
    displayedProjects.forEach((project, index) => {
      nextItems.push(project);
      const promoSlot = promoSlots.indexOf(index + 1);
      if (promoOrder.length && promoSlot !== -1 && index + 1 < displayedProjects.length) {
        const promoIndex = ((currentPage - 1) * promoSlots.length + promoSlot) % promoOrder.length;
        nextItems.push(promoOrder[promoIndex]);
      }
    });

    const currentItems = Array.from(feed.children);
    if (currentItems.length !== nextItems.length ||
      currentItems.some((node, index) => node !== nextItems[index])) {
      feed.replaceChildren(...nextItems);
    }
    resultCount.textContent = filtering
      ? `Showing ${filteredProjects.length} of ${projects.length} projects`
      : `${projects.length} projects`;
    renderPagination(filteredProjects.length, pageCount, startIndex, displayedProjects.length);
    emptyState.hidden = filteredProjects.length !== 0;
    renderFilterCount();
    if (scrollToResults) window.scrollTo({ top: scrollTop, behavior: "instant" });
  };

  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled || Number(button.dataset.page) === currentPage) return;
    currentPage = Number(button.dataset.page);
    renderFeed(true, false);
    feed.querySelector("h2 a").focus({ preventScroll: true });
  });

  const clearTagError = () => {
    tagInput.removeAttribute("aria-invalid");
    tagError.hidden = true;
  };

  const addTag = (rawTag, showError = true) => {
    const tag = availableTags.get(rawTag.trim().toLocaleLowerCase());
    if (!tag) {
      if (showError && rawTag.trim()) {
        tagInput.setAttribute("aria-invalid", "true");
        tagError.hidden = false;
      }
      return false;
    }

    selectedTags.add(tag);
    tagInput.value = "";
    clearTagError();
    renderSelectedTags();
    renderFeed();
    return true;
  };

  tagForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTag(tagInput.value);
  });

  tagInput.addEventListener("input", clearTagError);
  tagInput.addEventListener("change", () => addTag(tagInput.value, false));

  selectedTagList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-tag]");
    if (!button) return;
    selectedTags.delete(button.dataset.removeTag);
    renderSelectedTags();
    renderFeed();
    tagInput.focus();
  });

  eventInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) selectedEvents.add(input.value);
      else selectedEvents.delete(input.value);
      renderFeed();
    });
  });

  apiInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) selectedApis.add(input.value);
      else selectedApis.delete(input.value);
      renderFeed();
    });
  });

  const updateSearch = () => {
    searchTerms = normalizeSearch(searchInput.value).trim().split(/\s+/).filter(Boolean);
    searchClear.hidden = searchInput.value.length === 0;
    renderFeed();
  };

  searchInput.addEventListener("input", updateSearch);
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    updateSearch();
    searchInput.focus();
  });

  const clearFilters = () => {
    searchInput.value = "";
    searchTerms = [];
    searchClear.hidden = true;
    selectedTags.clear();
    selectedApis.clear();
    selectedEvents.clear();
    eventInputs.forEach((input) => { input.checked = false; });
    apiInputs.forEach((input) => { input.checked = false; });
    tagInput.value = "";
    clearTagError();
    renderSelectedTags();
    renderFeed();
  };

  clearButtons.forEach((button) => button.addEventListener("click", clearFilters));
  closeButton.addEventListener("click", () => {
    filterDetails.open = false;
    filterDetails.querySelector("summary").focus();
  });

  document.addEventListener("click", (event) => {
    if (filterDetails.open && !filterDetails.contains(event.target)) filterDetails.open = false;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && filterDetails.open) {
      filterDetails.open = false;
      filterDetails.querySelector("summary").focus();
    }
  });

  select.addEventListener("change", () => {
    if (select.value === "random") shuffleRandomOrder();
    renderFeed();
  });

  renderSelectedTags();
  renderFeed(false);

  let toolbarHeight = toolbar.offsetHeight;
  let lastScrollY = Math.max(0, window.scrollY);

  const measureToolbar = () => {
    toolbarHeight = toolbar.offsetHeight;
    toolbar.style.setProperty("--catalog-toolbar-bottom", `${toolbar.getBoundingClientRect().bottom}px`);
    toolbar.style.setProperty("--site-header-height", `${siteHeader.getBoundingClientRect().height}px`);
    toolbar.style.setProperty("--catalog-toolbar-height", `${toolbarHeight}px`);
  };
  const toolbarResize = new ResizeObserver(measureToolbar);
  toolbarResize.observe(siteHeader);
  toolbarResize.observe(toolbar);
  measureToolbar();

  window.addEventListener("scroll", () => {
    if (filterDetails.open) measureToolbar();
    const scrollY = Math.max(0, window.scrollY);
    const delta = scrollY - lastScrollY;
    if (Math.abs(delta) < 8 && scrollY > toolbarHeight) return;

    toolbar.classList.toggle("is-hidden",
      scrollY > toolbarHeight && delta > 0 &&
      toolbar.getBoundingClientRect().top <= siteHeader.getBoundingClientRect().bottom &&
      !filterDetails.open && !toolbar.contains(document.activeElement)
    );
    lastScrollY = scrollY;
  }, { passive: true });

  toolbar.addEventListener("focusin", () => toolbar.classList.remove("is-hidden"));
  filterDetails.addEventListener("toggle", () => {
    if (filterDetails.open) {
      toolbar.classList.remove("is-hidden");
      measureToolbar();
    }
  });

})();
