// ui.js — utilitaires de rendu : échappement, icônes, cartes, listes, toast

import { isFavorite, toggleFavorite, recordLaunch } from "./state.js";

const ICON_PATHS = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  bell: '<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.6 2.4h15.2z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>',
  arrow: '<path d="M4.5 12h14M13 6.5 18.5 12 13 17.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"/><path d="M17 8.5 20.5 12 17 15.5M20 12h-9"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c1.2-3.4 4-5 7.2-5s6 1.6 7.2 5"/>',
  building: '<path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M15 10h3a1 1 0 0 1 1 1v10"/><path d="M8 8h3M8 12h3M8 16h3M3 21h18"/>',
  zap: '<path d="M13 3 5 13.5h6L10.5 21 19 10.5h-6z"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/>',
  layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5z"/><path d="m4 12.5 8 4.5 8-4.5"/><path d="m4 16.8 8 4.5 8-4.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.8v.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  kebab: '<circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4.5 3 19.5h18z"/><path d="M12 10v4"/><path d="M12 16.8v.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V7"/><path d="M6.5 7l.9 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7"/>',
  play: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="m10.5 9.5 4.5 2.5-4.5 2.5z"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L21 10l-7 7-3.5 3.5a2.1 2.1 0 0 1-3-3L11 14z"/><path d="M6.5 17.5h.01"/>',
  chat: '<path d="M20 12.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.43L4.5 20l1.2-3.1C4.6 15.7 4 14.2 4 12.5 4 8.9 7.6 6 12 6s8 2.9 8 6.5z"/>',
  euro: '<path d="M17.5 6.8A6.3 6.3 0 0 0 7.6 12a6.3 6.3 0 0 0 9.9 5.2"/><path d="M4.5 10.5h8M4.5 13.8h8"/>',
  book: '<path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v15H6.8A1.8 1.8 0 0 0 5 19.8z"/><path d="M5 19.8A1.8 1.8 0 0 1 6.8 18H19v3H6.8A1.8 1.8 0 0 1 5 19.8z"/>',
  box: '<path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2z"/><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21"/>',
  crown: '<path d="m4 17 2.2-8.5L12 13l5.8-4.5L20 17z"/><path d="M4 20h16"/>',
  rocket: '<path d="M13.5 4.5C16 6 18.5 9 19 13l-4.5 4.5-6-6z"/><path d="M8.5 14.5 5 16l2-4.5L4.5 9 9 9.5"/><path d="M14 18.5 16 21l-4-.5"/>'
};

export function icon(name, className = "") {
  const path = ICON_PATHS[name] || ICON_PATHS.box;
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// N'accepte que http(s) ou un chemin relatif simple (anti-XSS/javascript:).
export function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

const CATEGORY_LABELS = {
  media: "Médias",
  tools: "Outils",
  communication: "Communication",
  finance: "Finance",
  administration: "Administration",
  story: "Récits",
  creation: "Création",
  leisure: "Loisirs",
  infrastructure: "Infrastructure",
  lab: "Labo",
  system: "Système",
  other: "Divers"
};

const CATEGORY_ICONS = {
  media: "play",
  tools: "wrench",
  communication: "chat",
  finance: "euro",
  administration: "shield",
  story: "book",
  creation: "rocket",
  leisure: "star",
  infrastructure: "layers",
  lab: "zap",
  system: "box",
  other: "box"
};

export function categoryKey(category) {
  return String(category || "other").toLowerCase().trim();
}

export function categoryLabel(category) {
  const key = categoryKey(category);
  return CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function categoryIcon(category) {
  return CATEGORY_ICONS[categoryKey(category)] || "box";
}

export function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function appGradient(app) {
  const primary = app?.brandPrimaryColor;
  const secondary = app?.brandSecondaryColor;
  if (primary && secondary) return `linear-gradient(140deg, ${primary}, ${secondary})`;
  if (primary) return `linear-gradient(140deg, ${primary}, rgba(var(--accent-rgb), .55))`;
  return "var(--grad-card)";
}

export function logoMarkup(app, size = "") {
  const url = safeUrl(app?.logoUrl);
  const cls = `app-logo ${size}`.trim();
  if (url) {
    return `<span class="${cls}" style="background:${appGradient(app)}"><img src="${escapeHtml(
      url
    )}" alt="" loading="lazy" data-app-logo data-initials="${escapeHtml(initials(app.name))}"></span>`;
  }
  const label = app?.icon && String(app.icon).length <= 3 ? app.icon : initials(app?.name);
  return `<span class="${cls}" style="background:${appGradient(app)}">${escapeHtml(label)}</span>`;
}

export function starButton(app) {
  const fav = isFavorite(app.id);
  return `<button class="star-btn ${fav ? "is-favorite" : ""}" data-fav="${escapeHtml(
    app.id
  )}" type="button" aria-label="${
    fav ? "Retirer des favoris" : "Ajouter aux favoris"
  }" aria-pressed="${fav}">${icon("star")}</button>`;
}

export function appCard(app) {
  const url = safeUrl(app.url);
  return `
    <article class="app-card" data-app-card="${escapeHtml(app.id)}">
      <div class="app-card-top">
        ${logoMarkup(app)}
        ${starButton(app)}
      </div>
      <h3 class="app-card-name">${escapeHtml(app.name)}</h3>
      <p class="app-card-desc">${escapeHtml(app.description || "Aucune description.")}</p>
      ${
        url
          ? `<a class="app-card-open" href="${escapeHtml(url)}" data-launch="${escapeHtml(
              app.id
            )}" target="_blank" rel="noopener">Ouvrir ${icon("arrow")}</a>`
          : `<span class="app-card-open" aria-disabled="true">Lien indisponible</span>`
      }
    </article>`;
}

export function recentRow(entry, { withKebab = true } = {}) {
  const url = safeUrl(entry.url);
  return `
    <li class="list-row">
      ${logoMarkup(entry, "app-logo--sm")}
      <div class="list-row-copy">
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${escapeHtml(entry.description || categoryLabel(entry.category))}</span>
      </div>
      <time class="list-row-time" datetime="${new Date(entry.openedAt).toISOString()}">${timeAgo(
        entry.openedAt
      )}</time>
      ${
        url
          ? `<a class="btn btn-soft" href="${escapeHtml(url)}" data-launch="${escapeHtml(
              entry.id
            )}" target="_blank" rel="noopener">Ouvrir ${icon("arrow")}</a>`
          : ""
      }
      ${
        withKebab
          ? `<button class="kebab-btn" type="button" data-remove-recent="${escapeHtml(
              entry.id
            )}" aria-label="Retirer des récents">${icon("kebab")}</button>`
          : ""
      }
    </li>`;
}

export function emptyState({ iconName = "box", title, text, action } = {}) {
  return `
    <div class="empty">
      ${icon(iconName)}
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${action ? `<a class="btn btn-ghost" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>` : ""}
    </div>`;
}

export function notice({ tone = "warn", text, action } = {}) {
  return `
    <div class="notice ${tone === "error" ? "notice-error" : ""}" role="status">
      ${icon(tone === "error" ? "alert" : "info")}
      <span>${escapeHtml(text)}</span>
      ${action ? `<span class="notice-actions"><button class="btn btn-soft" type="button" data-retry>${escapeHtml(
        action.label
      )}</button></span>` : ""}
    </div>`;
}

// --------------------------------------------------------------- Temps

export function timeAgo(timestamp) {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(then).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function connectedSince(authTime) {
  const start = new Date(authTime || Date.now()).getTime();
  const minutes = Math.floor((Date.now() - start) / 60000);
  if (minutes < 1) return "Connecté à l'instant";
  if (minutes < 60) return `Connecté depuis ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Connecté depuis ${hours} h`;
  return `Connecté depuis ${Math.floor(hours / 24)} j`;
}

// --------------------------------------------------------------- Toasts

export function toast(message, tone = "ok") {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${tone === "error" ? "toast--error" : tone === "warn" ? "toast--warn" : ""}`;
  el.innerHTML = `${icon(tone === "error" ? "alert" : tone === "warn" ? "info" : "check")}<span>${escapeHtml(
    message
  )}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

// --------------------------------------------------------------- Lancement

export function launchApp(app) {
  const url = safeUrl(app?.url);
  if (!url) {
    toast("Cette application n'a pas d'URL valide.", "warn");
    return;
  }
  recordLaunch(app);
}
