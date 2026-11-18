import {
  state,
  favoriteApps,
  recentItems,
  visibleApps,
  kyrosUrl,
  catalogErrorText,
} from "../state.js";
import {
  icon,
  escapeHtml as e,
  safeUrl,
  logoMarkup,
  starButton,
  emptyState,
  notice,
} from "../ui.js";
import { COMPOSITIONS, WIDGETS, CONNECTORS } from "./model.js";
import { workspace, device, composition, layout } from "./store.js";
import {
  renderDrivioVehicles,
  renderDrivioSummary,
  renderDrivioSettings,
} from "./drivio-view.js";

export function appLink(app) {
  const url = safeUrl(app.url);
  return `<a class="launch-tile" ${url ? `href="${e(url)}" target="_blank" rel="noopener" data-launch="${e(app.id)}"` : 'aria-disabled="true"'}>${logoMarkup(app, "app-logo--sm")}<span>${e(app.name)}</span>${icon("arrow")}</a>`;
}

export let launcherQuery = "";
export function setLauncherQuery(value) {
  launcherQuery = String(value).slice(0, 200);
}
export function launcherResults() {
  const normalize = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const query = normalize(launcherQuery);
  const found = visibleApps()
    .filter((app) =>
      normalize(`${app.name} ${app.description || ""}`).includes(query),
    )
    .slice(0, 8);
  return found.length
    ? found
        .map(
          (app) =>
            `<a class="launcher-result" data-launcher-link data-launch="${e(app.id)}" href="${e(safeUrl(app.url) || "#/applications")}" target="_blank" rel="noopener">${logoMarkup(app, "app-logo--sm")}<strong>${e(app.name)}</strong><span class="launcher-description">${e(app.description || "")}</span>${icon("right")}</a>`,
        )
        .join("")
    : '<p class="muted">Aucune application trouvée.</p>';
}
function launcherCatalog() {
  return `<section class="launcher-catalog" aria-label="Applications"><header><h2>Applications</h2><a href="#/applications">Tout voir ${icon("arrow")}</a></header><div id="launcherResults">${launcherResults()}</div><p class="launcher-help">Flèches pour naviguer · Entrée pour ouvrir · ⌘ K pour la recherche globale</p></section>`;
}
export function clockParts(widget) {
  const options = widget.config.timezone
    ? { timeZone: widget.config.timezone }
    : {};
  const now = new Date();
  return {
    time: now.toLocaleTimeString("fr-FR", {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
      hour12: widget.config.hour12,
    }),
    date: now.toLocaleDateString("fr-FR", {
      ...options,
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  };
}
export const calendarOffsets = new Map();
export function calendarMarkup(id) {
  const now = new Date(),
    date = new Date(
      now.getFullYear(),
      now.getMonth() + (calendarOffsets.get(id) || 0),
      1,
    );
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
    start = (date.getDay() + 6) % 7;
  const label = date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return `<div class="calendar-nav"><button class="icon-btn" data-calendar="-1" data-id="${e(id)}" aria-label="Mois précédent">${icon("left")}</button><strong aria-live="polite">${e(label)}</strong><button class="icon-btn" data-calendar="1" data-id="${e(id)}" aria-label="Mois suivant">${icon("right")}</button></div>
    <div class="calendar-grid" aria-label="${e(label)}">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<span class="weekday">${d}</span>`).join("")}${"<span></span>".repeat(start)}${Array.from(
      { length: days },
      (_, i) => {
        const today =
          i + 1 === now.getDate() &&
          now.getMonth() === date.getMonth() &&
          now.getFullYear() === date.getFullYear();
        return `<span class="calendar-day ${today ? "is-today" : ""}" ${today ? 'aria-current="date"' : ""}>${i + 1}</span>`;
      },
    ).join(
      "",
    )}</div><button class="text-btn" data-calendar-today="${e(id)}">Aujourd’hui</button>`;
}
function favoritesMarkup(widget) {
  if (state.bootError)
    return `<p class="widget-unavailable">Catalogue indisponible.</p><button class="btn" data-retry>Réessayer</button>`;
  const apps = favoriteApps().slice(0, widget.config.limit);
  return apps.length
    ? `<div class="launch-grid">${apps.map(appLink).join("")}</div>`
    : `<p class="muted">Vos applications préférées à portée de main.</p><a class="text-btn" href="#/applications">Choisir mes favoris ${icon("arrow")}</a>`;
}
function shortcutMarkup(widget) {
  const links = widget.config.links;
  return `<ul class="shortcut-list">${links.map((link) => `<li><a href="${e(link.url)}" target="_blank" rel="noopener">${icon("external")}<span>${e(link.label)}</span>${icon("arrow")}</a></li>`).join("")}${!links.length ? `<li><a href="${e(kyrosUrl())}/account" target="_blank" rel="noopener">${icon("user")}<span>Mon compte Kyros</span>${icon("external")}</a></li><li><a href="#/applications">${icon("grid")}<span>Applications</span>${icon("arrow")}</a></li>` : ""}</ul>`;
}
function widgetBody(widget) {
  switch (widget.type) {
    case "drivio-vehicles":
      return renderDrivioVehicles();
    case "drivio":
      return renderDrivioSummary(widget);
    case "clock": {
      const parts = clockParts(widget);
      return `<time class="clock-time" data-clock-time="${e(widget.id)}">${e(parts.time)}</time><p class="clock-date" data-clock-date="${e(widget.id)}">${e(parts.date)}</p>${widget.config.timezone ? `<p class="clock-zone">${e(widget.config.timezone)}</p>` : ""}`;
    }
    case "calendar":
      return `<div data-calendar-body="${e(widget.id)}">${calendarMarkup(widget.id)}</div>`;
    case "favorites":
      return favoritesMarkup(widget);
    case "shortcuts":
      return shortcutMarkup(widget);
    case "search":
      return `<button class="workspace-search" data-open-search>${icon("search")}<span>Rechercher une application…</span><kbd>⌘ K</kbd></button><a class="text-btn" href="#/applications">Voir toutes les applications ${icon("arrow")}</a>`;
    case "recents": {
      const recent = recentItems().slice(0, widget.config.limit);
      return recent.length
        ? `<div class="recent-launches">${recent.map(appLink).join("")}</div>`
        : '<p class="muted">Les applications ouvertes depuis le Hub apparaîtront ici, sur cet appareil.</p>';
    }
    default:
      return "<p>Widget indisponible.</p>";
  }
}
function widgetMarkup(item) {
  const widget = workspace.data.widgets.find((w) => w.id === item.id);
  if (!widget) return "";
  const spec = WIDGETS[widget.type],
    title = widget.title || spec.name;
  let content;
  try {
    content = widgetBody(widget);
  } catch {
    content =
      '<p role="status">Ce widget n’a pas pu être affiché. Vérifiez sa configuration.</p>';
  }
  const editing = workspace.editing || composition() === "modular";
  const collapsible =
    composition() === "minimal" &&
    !["favorites", "search"].includes(widget.type);
  const tag = collapsible ? "details" : "article",
    head = collapsible ? "summary" : "header";
  return `<${tag}${collapsible && editing ? " open" : ""} class="widget widget-${e(widget.type)}" data-widget="${e(widget.id)}" style="--span:${item.width};--height:${item.height}" aria-label="${e(title)}">
    <${head} class="widget-head">${editing ? `<button class="drag-handle icon-btn" data-drag="${e(widget.id)}" aria-label="Déplacer ${e(title)} par glisser-déposer ou avec Alt et les flèches">${icon("grip")}</button>` : ""}<h2>${e(title)}</h2><button class="icon-btn widget-menu" data-widget-menu="${e(widget.id)}" aria-label="Actions du widget ${e(title)}">${icon("kebab")}</button></${head}>
    <div class="widget-body">${content}</div>${editing ? `<footer class="widget-controls"><button class="icon-btn" data-move="up" data-id="${e(widget.id)}" aria-label="Déplacer ${e(title)} avant">${icon("left")}</button><button class="icon-btn" data-move="down" data-id="${e(widget.id)}" aria-label="Déplacer ${e(title)} après">${icon("right")}</button><button class="icon-btn" data-resize="${e(widget.id)}" aria-label="Changer la taille de ${e(title)}">${icon("resize")}</button><span class="size-label">${item.width} × ${item.height}</span><button class="resize-handle" data-resize-drag="${e(widget.id)}" aria-label="Redimensionner ${e(title)} à la souris ou au toucher">${icon("resize")}</button></footer>` : ""}</${tag}>`;
}
export function saveLabel() {
  return {
    loading: "Chargement…",
    saved: "Enregistré",
    pending: "Modifications en attente",
    saving: "Enregistrement…",
    conflict: "Conflit de sauvegarde",
    error: "Non enregistré",
  }[workspace.status];
}
function workspaceNotices() {
  let html = "";
  if (state.bootError)
    html += notice({
      tone: "error",
      text: catalogErrorText(),
      action: { label: "Réessayer" },
    });
  if (workspace.recovery)
    html += `<div class="notice" role="status"><span>Un brouillon non enregistré a été retrouvé sur cet appareil.${workspace.recovery.baseRevision !== workspace.revision ? " Le serveur a changé ; exportez-le avant de recharger." : ""}</span>${workspace.recovery.baseRevision === workspace.revision ? '<button class="btn" data-restore-draft>Restaurer</button>' : ""}<button class="btn" data-export-workspace>Exporter</button><button class="btn" data-discard-draft>Conserver le serveur</button></div>`;
  if (workspace.error)
    html += `<div class="notice notice-error" role="alert"><span>${e(workspace.error)} Votre brouillon est conservé sur cet appareil si le stockage est disponible.</span>${workspace.status === "conflict" ? '<button class="btn" data-export-workspace>Exporter le brouillon</button><button class="btn" data-discard-draft>Recharger le serveur</button>' : '<button class="btn" data-save-retry>Réessayer</button>'}</div>`;
  return html;
}
export function renderWorkspace() {
  const format = device(),
    name = composition();
  if (!workspace.data)
    return `<header class="page-head"><h1>Mon workspace</h1></header>${workspace.status === "loading" ? '<div class="loading-grid" role="status" aria-label="Chargement du workspace"><span></span><span></span><span></span></div>' : `<div class="notice notice-error" role="alert"><span>${e(workspace.error || "Workspace indisponible.")}</span><button class="btn" data-load-workspace>Réessayer</button></div>`}`;
  const header =
    format === "mobile"
      ? `<header class="mobile-workspace-head"><div><h1>Mon espace</h1><p>${e(COMPOSITIONS[name].name)}</p></div><button class="icon-btn" data-add-widget aria-label="Ajouter un widget">${icon("plus")}</button></header>`
      : `<header class="workspace-heading"><div><h1>${name === "minimal" ? "LUMA Hub" : name === "spaces" ? "Espace personnel" : "Mon workspace"}</h1><p>${name === "modular" ? "Votre espace, à votre façon." : "Un espace à votre rythme."}</p></div><div class="heading-actions">${name === "modular" ? `<a class="btn" href="#/personnaliser">${icon("settings")}Compositions</a>` : `<button class="btn" data-edit-workspace aria-pressed="${workspace.editing}">${icon(workspace.editing ? "check" : "settings")}${workspace.editing ? "Terminer" : "Personnaliser"}</button>`}<button class="btn btn-primary" data-add-widget>${icon("plus")}Ajouter un widget</button></div></header>`;
  const search =
    name === "minimal"
      ? `<div class="workspace-search launcher-search">${icon("search")}<input id="launcherFilter" type="search" placeholder="Rechercher une application…" aria-label="Filtrer les applications" value="${e(launcherQuery)}"><kbd>⌘ K</kbd></div>`
      : format === "mobile"
        ? `<button class="workspace-search launcher-search" data-open-search>${icon("search")}<span>Rechercher une application…</span></button>`
        : "";
  let launcherInserted = false;
  const renderedWidgets = layout()
    .map((item) => {
      const content = widgetMarkup(item);
      if (
        name === "minimal" &&
        !launcherInserted &&
        workspace.data.widgets.find((widget) => widget.id === item.id)?.type ===
          "favorites"
      ) {
        launcherInserted = true;
        return content + launcherCatalog();
      }
      return content;
    })
    .join("");
  const tabs =
    name === "spaces"
      ? `<nav class="space-tabs" aria-label="Accès de l’espace personnel"><a href="#/applications">${icon("grid")}Applications</a><a href="#/favoris">${icon("star")}Favoris</a></nav>`
      : "";
  const spaces =
    name === "spaces"
      ? `<aside class="space-rail"><h2>Mes espaces</h2><button class="space-choice is-active" aria-current="true">${icon("user")}Personnel</button><span class="space-choice is-disabled">${icon("building")}Entreprise</span><p>Le changement de contexte entreprise reste à valider avec Kyros.</p><p>Les favoris sont communs au compte Kyros.</p></aside>`
      : "";
  const empty = !workspace.data.widgets.length
    ? emptyState({
        iconName: "layers",
        title: "À vous de composer",
        text: "Ajoutez une horloge, vos favoris ou un calendrier pour commencer.",
      }) +
      '<button class="btn btn-primary" data-add-widget>Ajouter un widget</button>'
    : "";
  return `<div class="workspace-${format} composition-${name} ${workspace.editing || name === "modular" ? "is-editing" : ""}">${header}${search}${workspaceNotices()}${workspace.editing || name === "modular" ? '<p class="edit-help">Déplacez les widgets par leur poignée, avec Alt + flèches, ou avec les boutons. Sur mobile, maintenez la poignée puis déplacez.</p>' : ""}<div class="workspace-body">${spaces}<div class="workspace-content">${tabs}<div class="widget-grid">${renderedWidgets}${name === "minimal" && !launcherInserted ? launcherCatalog() : ""}${empty}</div></div></div><footer class="workspace-status" role="status">${icon(workspace.status === "saved" ? "check" : workspace.status === "error" || workspace.status === "conflict" ? "alert" : "clock")}<span>${e(saveLabel())}</span><span class="format-label">${format === "mobile" ? "Mobile" : "Desktop"} · ${e(COMPOSITIONS[name].name)}</span>${format === "mobile" && name !== "modular" ? `<button class="text-btn" data-edit-workspace>${workspace.editing ? "Terminer" : "Organiser"}</button>` : ""}</footer></div>`;
}
export function renderSettings() {
  if (!workspace.data) return renderWorkspace();
  return `<header class="page-head"><div><h1>Personnaliser</h1><p>Deux expériences, un même espace. Le thème suit votre système.</p></div></header>${workspaceNotices()}<section class="settings-section"><h2>Vos compositions</h2><div class="composition-settings">${[
    "desktop",
    "mobile",
  ]
    .map(
      (format) =>
        `<fieldset><legend>${icon(format === "desktop" ? "grid" : "layers")}${format === "desktop" ? "Ordinateur et tablette" : "Mobile"}</legend>${Object.entries(
          COMPOSITIONS,
        )
          .map(
            ([id, info]) =>
              `<label class="composition-option"><input type="radio" name="composition-${format}" value="${id}" data-composition="${format}" ${workspace.data.compositions[format] === id ? "checked" : ""}><span><strong>${e(info.name)}</strong><small>${e(info.description)}</small></span><span class="composition-preview preview-${id}" aria-hidden="true"><i></i><i></i><i></i></span></label>`,
          )
          .join("")}</fieldset>`,
    )
    .join(
      "",
    )}</div><p class="settings-note">Les widgets sont partagés dans l’espace personnel. Leur ordre et leurs tailles restent propres à chaque composition et à chaque format.</p></section><section class="settings-section"><h2>Widgets et données</h2><p>Les favoris restent dans Kyros. Les dispositions et configurations sont enregistrées dans le Hub. L’historique des accès reste sur cet appareil.</p><div class="settings-actions"><button class="btn" data-add-widget>${icon("plus")}Ajouter un widget</button><button class="btn" data-export-workspace>${icon("external")}Exporter ma configuration</button><a class="btn" href="#/">Organiser mon espace ${icon("arrow")}</a></div></section>${renderDrivioSettings()}<section class="settings-section"><h2>Connecteurs à venir</h2><p>Ces intégrations sont désactivées tant que leurs contrats ne sont pas validés.</p><ul class="connector-list">${CONNECTORS.filter(
    (c) => !c.available,
  )
    .map(
      (c) =>
        `<li><div><strong>${e(c.name)}</strong><p>${e(c.description)}</p><small>${e(c.reason)}</small></div><span class="pill">Indisponible</span></li>`,
    )
    .join("")}</ul></section>`;
}
