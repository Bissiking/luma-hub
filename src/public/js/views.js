// views.js — rendu des pages : Accueil, Applications, Favoris, Récents

import {
  state,
  apps,
  visibleApps,
  favoriteApps,
  favoriteIds,
  hiddenIds,
  recentItems,
  isAuthenticated,
  contextInfo,
  kyrosUrl
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
  connectedSince,
  logoMarkup
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
  "other"
];

function catalogNotice() {
  if (!state.bootError) return "";
  return notice({
    tone: "error",
    text: "Le catalogue Kyros est momentanément indisponible. Vos préférences et applications ne peuvent pas être chargées.",
    action: { label: "Réessayer" }
  });
}

function contextPills() {
  const info = contextInfo();
  const type = info?.type === "enterprise" ? "enterprise" : "personal";
  const hasCompany = Boolean(info?.memberships?.length);
  return `
    <div class="context-pills" role="group" aria-label="Contexte actuel">
      <span class="context-pill ${
        type === "personal" ? "is-active" : "is-inactive"
      }" aria-pressed="${type === "personal"}">${icon("user")}Personnel</span>
      <span class="context-pill ${
        type === "enterprise" ? "is-active" : "is-inactive"
      }" aria-pressed="${type === "enterprise"}" ${
        hasCompany ? "" : 'title="Aucune appartenance entreprise"'
      }>${icon("building")}Entreprise</span>
    </div>`;
}

// --------------------------------------------------------------- Accueil

export function renderHome() {
  const user = state.session?.user;
  const kyros = kyrosUrl();
  const favorites = favoriteApps().slice(0, 6);
  const recents = recentItems().slice(0, 5);
  const info = contextInfo();
  const companyLine =
    info?.type === "enterprise" && info?.companyName
      ? escapeHtml(`${info.companyName}${info.role ? ` · ${info.role}` : ""}`)
      : "Aucune organisation attachée à ce compte.";

  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="badge">BIENVENUE</span>
        <h1>Votre point d'entrée<br>sur <em>mhemery.fr</em> Hub</h1>
        <p class="hero-lead">Le lanceur central de votre écosystème. Accédez à toutes vos applications, services et ressources depuis un seul endroit.</p>
        <p class="hero-lead muted">Kyros gère votre identité, votre session et votre contexte d'accès pour une expérience unifiée et sécurisée.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="${escapeHtml(kyros)}" target="_blank" rel="noopener">Ouvrir Kyros <span class="btn-arrow">→</span></a>
          <a class="btn btn-ghost" href="#/applications">${icon("grid")} Voir mes applications</a>
          <a class="btn btn-ghost" href="${escapeHtml(kyros)}/account" target="_blank" rel="noopener">${icon(
            "chart"
          )} Accéder au tableau de bord</a>
        </div>
      </div>
      <div class="hero-side">
        <ul class="hero-chips">
          <li class="hero-chip"><span class="hero-chip-icon">${icon("zap")}</span>Votre identité unifiée</li>
          <li class="hero-chip"><span class="hero-chip-icon">${icon("shield")}</span>Accès sécurisé</li>
          <li class="hero-chip"><span class="hero-chip-icon">${icon(
            "layers"
          )}</span>Tous vos services depuis un seul endroit</li>
        </ul>
      </div>
    </section>

    <div class="home-cols">
      <div class="home-main">
        ${catalogNotice()}

        <section class="panel">
          <header class="section-head">
            <h2>${icon("star")} Mes applications favorites</h2>
            <a class="section-link" href="#/favoris">Tout voir ${icon("arrow")}</a>
          </header>
          ${
            favorites.length
              ? `<div class="cards-grid">${favorites.map(appCard).join("")}</div>`
              : emptyState({
                  iconName: "star",
                  title: "Aucun favori pour l'instant",
                  text: "Cliquez sur l'étoile d'une application pour la retrouver ici, synchronisée avec votre compte Kyros.",
                  action: { href: "#/applications", label: "Explorer les applications" }
                })
          }
        </section>

        <section class="panel">
          <header class="section-head">
            <h2>${icon("clock")} Derniers accès</h2>
            <a class="section-link" href="#/recents">Tout voir ${icon("arrow")}</a>
          </header>
          ${
            recents.length
              ? `<ul class="list-rows">${recents.map((entry) => recentRow(entry)).join("")}</ul>`
              : emptyState({
                  iconName: "clock",
                  title: "Aucun accès récent",
                  text: "Les applications que vous ouvrez apparaîtront ici pour un retour rapide.",
                  action: { href: "#/applications", label: "Voir le catalogue" }
                })
          }
        </section>
      </div>

      <aside class="home-side">
        <section class="panel">
          <header class="section-head">
            <h2>${icon("user")} Contexte de session</h2>
            <span class="pill pill-success">Session active</span>
          </header>

          <div class="identity-block">
            <span class="k-mark" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="kSide" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#a78bfa"/><stop offset=".55" stop-color="#7c8cff"/><stop offset="1" stop-color="#4fd1ff"/>
                  </linearGradient>
                </defs>
                <path d="M28 16h18v33l28-33h22L62 56l36 48H74L46 66v38H28z" fill="url(#kSide)"/>
              </svg>
            </span>
            <div class="identity-copy">
              <strong>Identité Kyros</strong>
              <span class="identity-user">${escapeHtml(user?.display_name || user?.username || "—")}</span>
              <span class="identity-since">${escapeHtml(connectedSince(state.session?.authTime))}</span>
            </div>
            <a class="identity-open" href="${escapeHtml(kyros)}/account" target="_blank" rel="noopener" aria-label="Ouvrir Kyros">${icon(
              "arrow"
            )}</a>
          </div>

          <p class="side-label">Contexte actuel</p>
          ${contextPills()}
          <p class="side-note">${
            info?.type === "enterprise"
              ? `${companyLine}. Votre session s'adapte pour vous donner accès aux bonnes ressources et applications.`
              : "Votre session s'adapte pour vous donner accès aux bonnes ressources et applications."
          }</p>
        </section>

        <section class="panel about-panel">
          <header class="section-head">
            <h2>${icon("info")} À propos du Hub</h2>
          </header>
          <p>Le Hub mhemery.fr centralise toutes vos applications, services et ressources. Un accès simple, rapide et unifié, propulsé par Kyros.</p>
          <a class="about-link" href="${escapeHtml(kyros)}/docs" target="_blank" rel="noopener">En savoir plus ${icon(
            "arrow"
          )}</a>
        </section>
      </aside>
    </div>`;
}

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
        </section>`
            )
            .join("")
        : emptyState({
            iconName: "grid",
            title: "Aucune application disponible",
            text: "Vos droits d'accès ne donnent accès à aucune application pour le moment. Contactez votre administrateur si besoin."
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
                      '<h3 class="app-card-name" title="Application masquée">'
                    )
                  : appCard(app)
              )
              .join("")}</div>`
          : emptyState({
              iconName: "star",
              title: "Aucun favori pour l'instant",
              text: "Parcourez le catalogue et cliquez sur l'étoile d'une application pour l'ajouter à vos favoris.",
              action: { href: "#/applications", label: "Explorer les applications" }
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
                "trash"
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
              action: { href: "#/applications", label: "Voir le catalogue" }
            })
      }
    </section>`;
}

export function renderNotFound() {
  return emptyState({
    iconName: "alert",
    title: "Page introuvable",
    text: "Cette section n'existe pas dans le Hub.",
    action: { href: "#/", label: "Retour à l'accueil" }
  });
}

export const ROUTES = {
  accueil: renderHome,
  applications: renderApplications,
  favoris: renderFavorites,
  recents: renderRecents
};

export function routeFromHash(hash) {
  const clean = String(hash || "")
    .replace(/^#\/?/, "")
    .replace(/\/$/, "")
    .split("?")[0];
  if (!clean) return "accueil";
  return ROUTES[clean] ? clean : null;
}
