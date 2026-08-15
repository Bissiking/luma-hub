// src/public/app.js

const guestView = document.querySelector("#guestView");
const userView = document.querySelector("#userView");
const logoutButton = document.querySelector("#logoutButton");
const searchButton = document.querySelector("#searchButton");
const searchInput = document.querySelector("#searchInput");
const appsGrid = document.querySelector("#appsGrid");
const emptyState = document.querySelector("#emptyState");
const appsLabel = document.querySelector("#appsLabel");
const statusMessage = document.querySelector("#statusMessage");
const welcomeTitle = document.querySelector("#welcomeTitle");
const avatar = document.querySelector("#avatar");
const cursorGlow = document.querySelector("#cursor-glow");

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
  outil: "tools",
  outils: "tools",
  utility: "tools",
  utilities: "tools",
  communication: "communication",
  chat: "communication",
  social: "communication",
  creation: "creation",
  création: "creation",
  creative: "creation",
  infra: "infrastructure",
  infrastructure: "infrastructure",
  supervision: "infrastructure",
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

function favoriteStorageKey() {
  const userId = currentUser?.id || currentUser?.sub || currentUser?.username || "anonymous";
  return `luma-hub:favorites:${userId}`;
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

function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  saveFavorites();
  renderApps(searchInput?.value || "");
}

function renderAppCard(app, index) {
  const name = String(app.name || appKey(app));
  const key = appKey(app);
  const isFavorite = favorites.has(key);
  const delay = Math.min(index * 0.04, 0.35);

  return `
    <article class="app-card" data-app="${escapeHtml(key)}" style="animation-delay:${delay}s; perspective:600px;">
      <a class="app-card-link" href="${safeUrl(appUrl(app))}" aria-label="Ouvrir ${escapeHtml(name)}">
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

/* ── Render apps ── */
function renderApps(filter = "") {
  const query = filter.trim().toLowerCase();
  const visible = apps.filter((app) => {
    const category = CATEGORY_DEFINITIONS[appCategory(app)]?.label || "Autres";
    const haystack = `${app.name || ""} ${appDescription(app)} ${category}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  const favoriteApps = query ? [] : visible.filter((app) => favorites.has(appKey(app)));
  const regularApps = query ? visible : visible.filter((app) => !favorites.has(appKey(app)));
  const sections = [];

  if (favoriteApps.length) {
    sections.push({ key: "favorites", label: "Favoris", icon: "★", items: favoriteApps, order: 0 });
  }

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

  appsGrid.querySelectorAll("[data-app-logo]").forEach((image) => {
    image.addEventListener("error", () => image.closest(".app-icon-image")?.classList.add("is-broken"), { once: true });
  });

  appsGrid.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
  });

  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(pointer: fine)").matches) {
    appsGrid.querySelectorAll(".app-card").forEach(attachCardMotion);
  }

  const isEmpty = visible.length === 0;
  emptyState.classList.toggle("hidden", !isEmpty);
  if (appsLabel) {
    appsLabel.textContent = query ? `Résultats · ${visible.length}` : `Applications · ${apps.length}`;
    appsLabel.style.display = visible.length > 0 ? "" : "none";
  }
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

  renderApps();
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

  const name = displayName(session.user);
  userView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  searchButton.classList.remove("hidden");
  welcomeTitle.textContent = `Bienvenue, ${name}.`;
  avatar.textContent = name.slice(0, 1).toUpperCase();

  await loadApps();
}

/* ── Events ── */
searchInput?.addEventListener("input", () => renderApps(searchInput.value));

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