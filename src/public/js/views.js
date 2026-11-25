// views.js — rendu des pages : Accueil, Applications, Favoris, Récents

import {
  state,
  catalogErrorText,
  visibleApps,
  favoriteApps,
  hiddenIds,
  recentItems,
} from "./state.js";
import {
  icon,
  escapeHtml,
  appCard,
  recentRow,
  emptyState,
  notice,
  categoryLabel,
  categoryIcon,
} from "./ui.js";

const CATEGORY_ORDER = [
  "media",
  "creation",
  "communication",
  "tools",
  "finance",
  "administration",
  "story",
  "infrastructure",
  "leisure",
  "lab",
  "system",
  "other",
];

function catalogNotice() {
  if (!state.bootError) return "";
  return notice({
    tone: "error",
    text: catalogErrorText(),
    action: { label: "Réessayer" },
  });
}

// --------------------------------------------------------------- Accueil

export { renderWorkspace as renderHome } from "./workspace/view.js";
import { renderProjects } from "./projects/view.js";
import { renderWorkspace, renderSettings } from "./workspace/view.js";

// --------------------------------------------------------------- Applications

function groupByCategory(list) {
  const groups = new Map();
  for (const app of list) {
    const key = String(app.category || "other").toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(app);
  }
  const ordered = [];
  for (const key of CATEGORY_ORDER) {
    if (groups.has(key)) ordered.push([key, groups.get(key)]);
  }
  for (const [key, list] of groups) {
    if (!CATEGORY_ORDER.includes(key)) ordered.push([key, list]);
  }
  return ordered;
}

export function renderApplications() {
  const list = visibleApps();
  const groups = groupByCategory(list);

  return `
    <header class="page-head">
      <div class="page-head-copy">
        <p class="page-eyebrow">Catalogue</p>
        <h1>Applications</h1>
        <p>Toutes les applications auxquelles votre compte a accès, filtrées par Kyros selon vos droits.</p>
      </div>
      <span class="page-count" title="Applications accessibles">${list.length}</span>
      <a class="btn" href="#/projets">${icon("layers")}Projets LUMA</a>
    </header>

    ${catalogNotice()}

    ${
      list.length
        ? groups
            .map(
              ([key, group]) => `
        <section class="panel">
          <header class="category-head">
            <span class="category-icon">${icon(categoryIcon(key))}</span>
            <h3>${escapeHtml(categoryLabel(key))}</h3>
            <span class="category-count">${group.length} application${group.length > 1 ? "s" : ""}</span>
          </header>
          <div class="cards-grid">${group.map(appCard).join("")}</div>
        </section>`,
            )
            .join("")
        : emptyState({
            iconName: "grid",
            title: "Aucune application disponible",
            text: "Vos droits d'accès ne donnent accès à aucune application pour le moment. Contactez votre administrateur si besoin.",
          })
    }`;
}

// --------------------------------------------------------------- Favoris

export function renderFavorites() {
  const favorites = favoriteApps();
  const hidden = hiddenIds();

  return `
    <header class="page-head">
      <div class="page-head-copy">
        <p class="page-eyebrow">Vos choix</p>
        <h1>Favoris</h1>
        <p>Vos favoris sont enregistrés côté Kyros avec vos préférences : retrouvez-les sur tous vos appareils.</p>
      </div>
      <span class="page-count">${favorites.length}</span>
    </header>

    <section class="panel">
      ${
        favorites.length
          ? `<div class="cards-grid">${favorites
              .map((app) =>
                hidden.has(app.id)
                  ? appCard(app).replace(
                      '<h3 class="app-card-name">',
                      '<h3 class="app-card-name" title="Application masquée">',
                    )
                  : appCard(app),
              )
              .join("")}</div>`
          : emptyState({
              iconName: "star",
              title: "Aucun favori pour l'instant",
              text: "Parcourez le catalogue et cliquez sur l'étoile d'une application pour l'ajouter à vos favoris.",
              action: {
                href: "#/applications",
                label: "Explorer les applications",
              },
            })
      }
    </section>`;
}

// --------------------------------------------------------------- Récents

export function renderRecents() {
  const recents = recentItems();

  return `
    <header class="page-head">
      <div class="page-head-copy">
        <p class="page-eyebrow">Historique</p>
        <h1>Derniers accès</h1>
        <p>Les dernières applications ouvertes depuis ce Hub, conservées localement pour votre compte.</p>
      </div>
      <div class="page-actions">
        ${
          recents.length
            ? `<button class="btn btn-ghost" type="button" data-clear-recents>${icon(
                "trash",
              )} Tout effacer</button>`
            : ""
        }
      </div>
    </header>

    <section class="panel">
      ${
        recents.length
          ? `<ul class="list-rows">${recents.map((entry) => recentRow(entry)).join("")}</ul>`
          : emptyState({
              iconName: "clock",
              title: "Aucun accès récent",
              text: "Ouvrez une application depuis le catalogue : elle apparaîtra ici pour un retour rapide.",
              action: { href: "#/applications", label: "Voir le catalogue" },
            })
      }
    </section>`;
}

export function renderNotFound() {
  return emptyState({
    iconName: "alert",
    title: "Page introuvable",
    text: "Cette section n'existe pas dans le Hub.",
    action: { href: "#/", label: "Retour à l'accueil" },
  });
}

export const ROUTES = {
  accueil: renderWorkspace,
  personnaliser: renderSettings,
  applications: renderApplications,
  projets: renderProjects,
  favoris: renderFavorites,
  recents: renderRecents,
};

export function routeFromHash(hash) {
  const clean = String(hash || "")
    .replace(/^#\/?/, "")
    .replace(/\/$/, "")
    .split("?")[0];
  if (!clean) return "accueil";
  return ROUTES[clean] ? clean : null;
}
