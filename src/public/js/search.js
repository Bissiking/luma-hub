// search.js — recherche globale ⌘K : pages + applications du catalogue

import { visibleApps } from "./state.js";
import { icon, escapeHtml, categoryLabel, categoryIcon, launchApp } from "./ui.js";

const PAGES = [
  { route: "accueil", label: "Accueil", hint: "Page · votre tableau de bord", icon: "home", keywords: "accueil home dashboard tableau" },
  { route: "applications", label: "Applications", hint: "Page · catalogue complet", icon: "grid", keywords: "applications catalogue apps services" },
  { route: "favoris", label: "Favoris", hint: "Page · vos applications favorites", icon: "star", keywords: "favoris star préférées" },
  { route: "recents", label: "Récents", hint: "Page · derniers accès", icon: "clock", keywords: "récents historique derniers" }
];

let overlay;
let input;
let results;
let activeIndex = 0;
let currentItems = [];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildResults(query) {
  const q = normalize(query.trim());
  const items = [];

  for (const page of PAGES) {
    if (!q || normalize(`${page.label} ${page.keywords}`).includes(q)) {
      items.push({ type: "page", ...page });
    }
  }

  if (q) {
    for (const app of visibleApps()) {
      const haystack = normalize(
        `${app.name} ${app.description || ""} ${categoryLabel(app.category)}`
      );
      if (haystack.includes(q)) {
        items.push({ type: "app", app });
      }
    }
  } else {
    for (const app of visibleApps().slice(0, 6)) {
      items.push({ type: "app", app });
    }
  }

  return items.slice(0, 8);
}

function renderResults() {
  if (!currentItems.length) {
    results.innerHTML = `<li class="search-empty">Aucun résultat pour « ${escapeHtml(
      input.value.trim()
    )} »</li>`;
    return;
  }

  results.innerHTML = currentItems
    .map((item, index) => {
      const active = index === activeIndex ? " is-active" : "";
      if (item.type === "page") {
        return `<li class="search-result${active}" data-index="${index}" role="option" aria-selected="${
          index === activeIndex
        }">
          ${icon(item.icon, "icon-result")}
          <span class="search-result-copy">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.hint)}</span>
          </span>
          <span class="search-result-meta">Page</span>
        </li>`;
      }
      const app = item.app;
      return `<li class="search-result${active}" data-index="${index}" role="option" aria-selected="${
        index === activeIndex
      }">
        ${icon(categoryIcon(app.category), "icon-result")}
        <span class="search-result-copy">
          <strong>${escapeHtml(app.name)}</strong>
          <span>${escapeHtml(app.description || "Application")}</span>
        </span>
        <span class="search-result-meta">${escapeHtml(categoryLabel(app.category))}</span>
      </li>`;
    })
    .join("");
}

function refresh() {
  currentItems = buildResults(input.value);
  if (activeIndex >= currentItems.length) activeIndex = 0;
  renderResults();
}

export function openSearch() {
  if (!overlay) return;
  overlay.classList.remove("hidden");
  activeIndex = 0;
  input.value = "";
  refresh();
  requestAnimationFrame(() => input.focus());
}

export function closeSearch() {
  if (!overlay) return;
  overlay.classList.add("hidden");
}

export function isSearchOpen() {
  return overlay ? !overlay.classList.contains("hidden") : false;
}

function activate(index) {
  const item = currentItems[index];
  if (!item) return;
  closeSearch();

  if (item.type === "page") {
    location.hash = item.route === "accueil" ? "#/" : `#/${item.route}`;
    return;
  }
  launchApp(item.app);
  if (item.app.url) window.open(item.app.url, "_blank", "noopener");
}

export function initSearch() {
  overlay = document.getElementById("searchOverlay");
  input = document.getElementById("searchInput");
  results = document.getElementById("searchResults");
  if (!overlay || !input || !results) return;

  document.getElementById("searchTrigger")?.addEventListener("click", openSearch);
  document.getElementById("searchBackdrop")?.addEventListener("click", closeSearch);

  input.addEventListener("input", () => {
    activeIndex = 0;
    refresh();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      renderResults();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderResults();
    } else if (event.key === "Enter") {
      event.preventDefault();
      activate(activeIndex);
    }
  });

  results.addEventListener("click", (event) => {
    const row = event.target.closest(".search-result");
    if (row) activate(Number(row.dataset.index));
  });

  document.addEventListener("keydown", (event) => {
    const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (shortcut) {
      event.preventDefault();
      isSearchOpen() ? closeSearch() : openSearch();
      return;
    }
    if (event.key === "Escape" && isSearchOpen()) {
      event.preventDefault();
      closeSearch();
    }
  });
}
