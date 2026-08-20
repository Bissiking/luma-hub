// src/public/app.js

const guestView = document.querySelector("#guestView");
const userView = document.querySelector("#userView");
const logoutButton = document.querySelector("#logoutButton");
const searchButton = document.querySelector("#searchButton");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const appsGrid = document.querySelector("#appsGrid");
const emptyState = document.querySelector("#emptyState");
const statusMessage = document.querySelector("#statusMessage");
const welcomeTitle = document.querySelector("#welcomeTitle");
const welcomeSubtitle = document.querySelector("#welcomeSubtitle");
const avatar = document.querySelector("#avatar");
const cursorGlow = document.querySelector("#cursor-glow");
const favoritesGrid = document.querySelector("#favoritesGrid");
const recentGrid = document.querySelector("#recentGrid");
const favoritesCount = document.querySelector("#favoritesCount");
const appsTotal = document.querySelector("#appsTotal");

const CATEGORY_DEFINITIONS = {
  media: { label: "Média", icon: "◉", order: 10 },
  tools: { label: "Outils", icon: "⌘", order: 20 },
  communication: { label: "Communication", icon: "◇", order: 30 },
  creation: { label: "Création", icon: "✦", order: 40 },
  infrastructure: { label: "Infrastructure", icon: "⌁", order: 50 },
  leisure: { label: "Loisirs", icon: "△", order: 60 },
  lab: { label: "Lab", icon: "⌬", order: 70 },
  system: { label: "Système", icon: "⚙", order: 80 },
  other: { label: "Autres", icon: "·", order: 90 }
};

const CATEGORY_ALIASES = {
  medias: "media",
  music: "media",
  musique: "media",
  video: "media",
  vidéo: "media",
  story: "media",
  outil: "tools",
  outils: "tools",
  utility: "tools",
  utilities: "tools",
  finance: "tools",
  communication: "communication",
  chat: "communication",
  social: "communication",
  creation: "creation",
  création: "creation",
  creative: "creation",
  infra: "infrastructure",
  infrastructure: "infrastructure",
  supervision: "infrastructure",
  administration: "infrastructure",
  loisirs: "leisure",
  loisir: "leisure",
  games: "leisure",
  game: "leisure",
  jeu: "leisure",
  jeux: "leisure",
  laboratoire: "lab",
  experimental: "lab",
  expérimental: "lab",
  systeme: "system",
  système: "system",
  admin: "system"
};

let apps = [];
let currentUser = null;
let favorites = new Set();
let recent = [];

/* ── Cursor spotlight ── */
if (cursorGlow && window.matchMedia("(pointer: fine)").matches) {
  document.addEventListener("mousemove", (e) => {
    cursorGlow.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
  });
}

/* ── Card magnetic tilt ── */
function attachCardMotion(card) {
  const TILT = 6;

  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    const rx = (((e.clientY - rect.top) / rect.height) - .5) * -TILT;
    const ry = (((e.clientX - rect.left) / rect.width) - .5) * TILT;

    card.style.setProperty("--mx", `${mx}%`);
    card.style.setProperty("--my", `${my}%`);
    card.style.setProperty("--rx", `${rx}deg`);
    card.style.setProperty("--ry", `${ry}deg`);
  });

  card.addEventListener("mouseleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.removeProperty("--mx");
    card.style.removeProperty("--my");
  });
}

/* ── Helpers ── */
function displayName(user) {
  return user?.displayName || user?.display_name || user?.username || "vous";
}

function appKey(app) {
  return String(app.id || app.key || app.clientId || app.client_id || app.name || "app");
}

function appUrl(app) {
  return app.url || app.homeUrl || app.home_url || app.launchUrl || app.launch_url || "#";
}

function appDescription(app) {
  return app.description || "Application LUMA";
}

function normalizeCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "other";
  if (CATEGORY_DEFINITIONS[raw]) return raw;
  return CATEGORY_ALIASES[raw] || "other";
}

function appCategory(app) {
  return normalizeCategory(
    app.category ||
    app.categoryKey ||
    app.category_key ||
    app.metadata?.category
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const s = String(value || "#");
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return escapeHtml(s);
  return "#";
}

function normalizeAssetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;

  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function appVisual(app, name) {
  const imageUrl = normalizeAssetUrl(
    app.logoUrl || app.logo_url || app.iconUrl || app.icon_url || app.icon?.url
  );

  if (imageUrl) {
    return `
      <span class="app-icon app-icon-image">
        <img src="${safeUrl(imageUrl)}" alt="" loading="lazy" data-app-logo>
        <span class="app-icon-fallback">${escapeHtml(name.slice(0, 2).toUpperCase())}</span>
      </span>
    `;
  }

  const iconText = typeof app.icon === "string" && !normalizeAssetUrl(app.icon)
    ? app.icon.trim().slice(0, 3)
    : "";

  return `<span class="app-icon">${escapeHtml(iconText || name.slice(0, 2).toUpperCase())}</span>`;
}

function tileVisual(app, name) {
  const imageUrl = normalizeAssetUrl(
    app.logoUrl || app.logo_url || app.iconUrl || app.icon_url || app.icon?.url
  );

  if (imageUrl) {
    return `
      <span class="tile-row-icon app-icon-image">
        <img src="${safeUrl(imageUrl)}" alt="" loading="lazy" data-tile-logo>
        <span class="app-icon-fallback">${escapeHtml(name.slice(0, 2).toUpperCase())}</span>
      </span>
    `;
  }

  const iconText = typeof app.icon === "string" && !normalizeAssetUrl(app.icon)
    ? app.icon.trim().slice(0, 3)
    : "";

  return `<span class="tile-row-icon">${escapeHtml(iconText || name.slice(0, 2).toUpperCase())}</span>`;
}

function favoriteStorageKey() {
  const userId = currentUser?.id || currentUser?.sub || currentUser?.username || "anonymous";
  return `luma-hub:favorites:${userId}`;
}

function recentStorageKey() {
  const userId = currentUser?.id || currentUser?.sub || currentUser?.username || "anonymous";
  return `luma-hub:recent:${userId}`;
}

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(favoriteStorageKey()) || "[]");
    favorites = new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    favorites = new Set();
  }
}

function saveFavorites() {
  localStorage.setItem(favoriteStorageKey(), JSON.stringify([...favorites]));
}

function loadRecent() {
  try {
    const stored = JSON.parse(localStorage.getItem(recentStorageKey()) || "[]");
    recent = Array.isArray(stored) ? stored.slice(0, 6) : [];
  } catch {
    recent = [];
  }
}

function saveRecent() {
  localStorage.setItem(recentStorageKey(), JSON.stringify(recent));
}

function recordLaunch(key) {
  recent = [key, ...recent.filter((item) => item !== key)].slice(0, 6);
  saveRecent();
  renderDashboard();
}

function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  saveFavorites();
  renderDashboard();
}

/* ── Widget rendering ── */
function renderAppCard(app, index) {
  const name = String(app.name || appKey(app));
  const key = appKey(app);
  const isFavorite = favorites.has(key);
  const delay = Math.min(index * 0.04, 0.35);

  return `
    <article class="app-card" data-app="${escapeHtml(key)}" style="animation-delay:${delay}s; perspective:600px;">
      <a class="app-card-link" href="${safeUrl(appUrl(app))}" aria-label="Ouvrir ${escapeHtml(name)}" data-launch="${escapeHtml(key)}">
        <div class="app-top">
          ${appVisual(app, name)}
          <span class="app-copy">
            <span class="app-name">${escapeHtml(name)}</span>
            <span class="app-desc">${escapeHtml(appDescription(app))}</span>
          </span>
        </div>
        <span class="app-arrow">↗</span>
      </a>
      <button class="favorite-button${isFavorite ? " is-favorite" : ""}" type="button" data-favorite="${escapeHtml(key)}" aria-label="${isFavorite ? "Retirer" : "Ajouter"} ${escapeHtml(name)} ${isFavorite ? "des" : "aux"} favoris" title="${isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}">
        <span aria-hidden="true">${isFavorite ? "★" : "☆"}</span>
      </button>
    </article>
  `;
}

function renderTileRow(app) {
  const name = String(app.name || appKey(app));
  const key = appKey(app);
  const isFavorite = favorites.has(key);

  return `
    <div class="tile-row" data-app="${escapeHtml(key)}">
      <a href="${safeUrl(appUrl(app))}" aria-label="Ouvrir ${escapeHtml(name)}" data-launch="${escapeHtml(key)}" style="text-decoration:none">
        ${tileVisual(app, name)}
      </a>
      <a class="tile-row-copy" href="${safeUrl(appUrl(app))}" aria-label="Ouvrir ${escapeHtml(name)}" data-launch="${escapeHtml(key)}" style="text-decoration:none">
        <span class="tile-row-name">${escapeHtml(name)}</span>
        <span class="tile-row-desc">${escapeHtml(appDescription(app))}</span>
      </a>
      <span class="tile-row-arrow" aria-hidden="true">↗</span>
      <button class="tile-row-star${isFavorite ? " is-favorite" : ""}" type="button" data-favorite="${escapeHtml(key)}" aria-label="${isFavorite ? "Retirer" : "Ajouter"} ${escapeHtml(name)} ${isFavorite ? "des" : "aux"} favoris" title="${isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}">
        <span aria-hidden="true">${isFavorite ? "★" : "☆"}</span>
      </button>
    </div>
  `;
}

function renderSection({ key, label, icon, items }, startIndex) {
  if (!items.length) return { html: "", nextIndex: startIndex };

  const cards = items.map((app, offset) => renderAppCard(app, startIndex + offset)).join("");
  return {
    html: `
      <section class="app-section" data-category="${escapeHtml(key)}">
        <div class="category-heading">
          <span class="category-icon" aria-hidden="true">${escapeHtml(icon)}</span>
          <h2>${escapeHtml(label)}</h2>
          <span class="category-count">${items.length}</span>
        </div>
        <div class="apps-grid">${cards}</div>
      </section>
    `,
    nextIndex: startIndex + items.length
  };
}

function filterApps(query) {
  const q = query.trim().toLowerCase();
  return apps.filter((app) => {
    const category = CATEGORY_DEFINITIONS[appCategory(app)]?.label || "Autres";
    const haystack = `${app.name || ""} ${appDescription(app)} ${category}`.toLowerCase();
    return !q || haystack.includes(q);
  });
}

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    searchResults.classList.add("hidden");
    return;
  }

  const matches = filterApps(q).slice(0, 8);

  if (!matches.length) {
    searchResults.innerHTML = `<p class="search-empty">Aucun résultat pour « ${escapeHtml(query.trim())} ».</p>`;
    searchResults.classList.remove("hidden");
    return;
  }

  searchResults.innerHTML = matches.map((app, index) => {
    const name = String(app.name || appKey(app));
    const key = appKey(app);
    return `
      <a class="search-result" href="${safeUrl(appUrl(app))}" data-launch="${escapeHtml(key)}">
        ${appVisual(app, name)}
        <span class="tile-row-copy">
          <span class="tile-row-name">${escapeHtml(name)}</span>
          <span class="tile-row-desc">${escapeHtml(appDescription(app))}</span>
        </span>
        <span class="search-index">${index + 1}</span>
      </a>
    `;
  }).join("");

  searchResults.classList.remove("hidden");
}

function renderDashboard() {
  const visible = filterApps("");
  const favApps = visible.filter((app) => favorites.has(appKey(app)));
  const recentApps = recent
    .map((key) => apps.find((app) => appKey(app) === key))
    .filter(Boolean);

  // Favoris
  favoritesGrid.innerHTML = favApps.length
    ? favApps.map(renderTileRow).join("")
    : `<p class="widget-empty">Ajoutez vos applications préférées avec ☆ pour les retrouver ici.</p>`;

  if (favoritesCount) favoritesCount.textContent = favApps.length;

  // Récents
  recentGrid.innerHTML = recentApps.length
    ? recentApps.map(renderTileRow).join("")
    : `<p class="widget-empty">Les applications que vous ouvrez apparaîtront ici.</p>`;

  // Catégories
  const regularApps = visible.filter((app) => !favorites.has(appKey(app)));
  const sections = [];
  const grouped = new Map();

  for (const app of regularApps) {
    const key = appCategory(app);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(app);
  }

  for (const [key, items] of grouped.entries()) {
    const definition = CATEGORY_DEFINITIONS[key] || CATEGORY_DEFINITIONS.other;
    sections.push({ key, ...definition, items });
  }

  sections.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.label.localeCompare(b.label, "fr"));

  let index = 0;
  const html = sections.map((section) => {
    const rendered = renderSection(section, index);
    index = rendered.nextIndex;
    return rendered.html;
  }).join("");

  appsGrid.innerHTML = html;

  appsGrid.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
  });

  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(pointer: fine)").matches) {
    appsGrid.querySelectorAll(".app-card").forEach(attachCardMotion);
  }

  const isEmpty = visible.length === 0;
  emptyState.classList.toggle("hidden", !isEmpty);
  if (appsTotal) appsTotal.textContent = apps.length;

  // Délégué : lancement d'app + favoris dans les autres widgets
  favoritesGrid.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
  });
  recentGrid.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
  });

  bindLaunchHandlers();
}

function bindLaunchHandlers() {
  document.querySelectorAll("[data-launch]").forEach((link) => {
    link.addEventListener("click", () => recordLaunch(link.dataset.launch));
  });

  document.querySelectorAll("[data-app-logo], [data-tile-logo]").forEach((image) => {
    image.addEventListener("error", () => image.closest(".app-icon-image")?.classList.add("is-broken"), { once: true });
  });
}

/* ── Load apps ── */
async function loadApps() {
  const response = await fetch("/api/apps", { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({ apps: [] }));
  apps = Array.isArray(payload.apps) ? payload.apps : [];

  if (!response.ok && payload.reason === "apps_endpoint_not_ready") {
    statusMessage.textContent = "Connexion Kyros prête. Le nouvel endpoint des applications n'est pas encore disponible.";
    statusMessage.classList.remove("hidden");
  } else if (!response.ok) {
    statusMessage.textContent = "Impossible de récupérer les applications depuis Kyros pour le moment.";
    statusMessage.classList.remove("hidden");
  } else {
    statusMessage.classList.add("hidden");
  }

  renderDashboard();
}

/* ── Greeting ── */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Bonne nuit";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

/* ── Boot ── */
async function boot() {
  const response = await fetch("/api/session", { headers: { accept: "application/json" } });
  const session = await response.json();

  if (!session.authenticated) {
    guestView.classList.remove("hidden");
    return;
  }

  currentUser = session.user;
  loadFavorites();
  loadRecent();

  const name = displayName(session.user);
  userView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  searchButton.classList.remove("hidden");
  welcomeTitle.textContent = `${greeting()}, ${name}.`;
  welcomeSubtitle.textContent = "Vos applications et services LUMA, réunis en un seul endroit.";
  avatar.textContent = name.slice(0, 1).toUpperCase();

  await loadApps();
}

/* ── Events ── */
searchInput?.addEventListener("input", () => renderSearchResults(searchInput.value));

searchButton?.addEventListener("click", () => searchInput?.focus());

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchInput?.focus();
  }
});

logoutButton?.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  window.location.reload();
});

boot().catch((error) => {
  console.error("[luma-hub] boot failed", error);
  guestView.classList.remove("hidden");
});