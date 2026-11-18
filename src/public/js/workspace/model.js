// Contrat partagé navigateur/serveur. Aucune donnée Kyros ni aucun jeton ici.
export const COMPOSITIONS = Object.freeze({
  dashboard: {
    name: "Dashboard",
    description: "Une vue structurée de votre quotidien.",
  },
  minimal: {
    name: "Minimaliste",
    description: "La recherche et vos applications, en priorité.",
  },
  immersive: {
    name: "Immersive",
    description: "L’heure et vos accès occupent le premier plan.",
  },
  modular: {
    name: "Modulaire",
    description: "Composez votre espace, widget par widget.",
  },
  spaces: {
    name: "Multi-espaces",
    description: "Votre espace personnel et les contextes disponibles.",
  },
});

export const WIDGETS = Object.freeze({
  favorites: {
    name: "Favoris",
    description: "Vos applications favorites, conservées dans Kyros.",
    icon: "star",
    source: "Kyros · catalogue et préférences",
    sizes: [1, 2, 3],
    permissions: ["hub:read"],
    refresh: "catalogue",
    actions: ["open", "favorite"],
    available: true,
  },
  clock: {
    name: "Horloge",
    description: "L’heure et la date, dans le fuseau de votre choix.",
    icon: "clock",
    source: "Horloge de l’appareil",
    sizes: [1, 2, 3],
    permissions: [],
    refresh: "minute",
    actions: ["configure"],
    available: true,
  },
  calendar: {
    name: "Calendrier",
    description: "Parcourez les mois. Aucun agenda externe connecté.",
    icon: "calendar",
    source: "Calendrier local",
    sizes: [1, 2, 3],
    permissions: [],
    refresh: "day",
    actions: ["previous", "next", "today"],
    available: true,
  },
  shortcuts: {
    name: "Raccourcis",
    description: "Les liens que vous choisissez pour cet espace.",
    icon: "external",
    source: "Configuration Hub",
    sizes: [1, 2, 3],
    permissions: [],
    refresh: "change",
    actions: ["configure", "open"],
    available: true,
  },
  search: {
    name: "Accès rapide",
    description: "Recherchez une application ou une page du Hub.",
    icon: "search",
    source: "Catalogue Kyros autorisé",
    sizes: [1, 2, 3],
    permissions: ["hub:read"],
    refresh: "catalogue",
    actions: ["search"],
    available: true,
  },
  recents: {
    name: "Accès récents",
    description: "Vos derniers accès sur cet appareil.",
    icon: "clock",
    source: "Historique local par compte",
    sizes: [1, 2, 3],
    permissions: [],
    refresh: "launch",
    actions: ["open", "remove"],
    available: true,
  },
});

export const CONNECTORS = Object.freeze([
  {
    id: "braindump",
    name: "BrainDump",
    description: "Notes, tâches et rappels",
    available: false,
    reason:
      "Contrat de lecture, authentification déléguée et permissions à valider.",
  },
  {
    id: "drivio",
    name: "Drivio",
    description: "Véhicules et entretiens",
    available: false,
    reason: "Contrat de lecture et autorisations du Hub à valider.",
  },
  {
    id: "nino",
    name: "Nino",
    description: "Reprise de lecture et nouveautés",
    available: false,
    reason: "API de reprise et authentification déléguée à valider.",
  },
  {
    id: "harmonix",
    name: "Harmonix",
    description: "Musique et playlists",
    available: false,
    reason: "API et droits de lecture distante à valider.",
  },
  {
    id: "weather",
    name: "Météo",
    description: "Prévisions locales",
    available: false,
    reason: "Fournisseur, localisation et limites d’appel à choisir.",
  },
  {
    id: "rss",
    name: "Flux RSS",
    description: "Vos sources d’actualité",
    available: false,
    reason: "Proxy avec protection SSRF, formats et limites à implémenter.",
  },
]);

export class WorkspaceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const invalid = () => {
  throw new WorkspaceError(
    "invalid_workspace",
    "Configuration du workspace invalide.",
  );
};
function object(value, fields) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !fields.includes(k))
  )
    invalid();
}
function text(value, max) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    invalid();
  return value;
}
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid();
  return value;
}
export function shortcutUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\\\x00-\x1f\x7f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function defaultConfig(type) {
  if (type === "clock") return { timezone: "", hour12: false };
  if (type === "shortcuts") return { links: [] };
  if (type === "favorites" || type === "recents")
    return { limit: type === "favorites" ? 8 : 5 };
  return {};
}
export function validateConfig(type, value) {
  const fields = Object.keys(defaultConfig(type));
  object(value, fields);
  const config = { ...defaultConfig(type), ...value };
  if (type === "clock") {
    text(config.timezone, 100);
    if (typeof config.hour12 !== "boolean") invalid();
    try {
      new Intl.DateTimeFormat(
        "fr",
        config.timezone ? { timeZone: config.timezone } : {},
      );
    } catch {
      invalid();
    }
  }
  if (type === "shortcuts") {
    if (!Array.isArray(config.links) || config.links.length > 12) invalid();
    config.links = config.links.map((link) => {
      object(link, ["label", "url"]);
      text(link.label, 80);
      const url = shortcutUrl(link.url);
      if (!link.label.trim() || !url) invalid();
      return { label: link.label.trim(), url };
    });
  }
  if (type === "favorites" || type === "recents") integer(config.limit, 1, 24);
  return config;
}
export function createWorkspace() {
  const widgets = [
    "favorites",
    "clock",
    "calendar",
    "shortcuts",
    "recents",
  ].map((type) => ({
    id: `initial-${type}`,
    type,
    title: "",
    config: defaultConfig(type),
  }));
  const layouts = {};
  for (const device of ["desktop", "mobile"]) {
    layouts[device] = {};
    for (const name of Object.keys(COMPOSITIONS)) {
      const order =
        name === "immersive" || (device === "mobile" && name === "dashboard")
          ? ["clock", "favorites", "calendar", "shortcuts", "recents"]
          : ["favorites", "clock", "calendar", "shortcuts", "recents"];
      layouts[device][name] = order.map((type) => ({
        id: `initial-${type}`,
        width:
          device === "mobile"
            ? 2
            : name === "minimal"
              ? 3
              : name === "modular"
                ? ["shortcuts", "recents"].includes(type)
                  ? 3
                  : 1
                : name === "immersive"
                  ? ["clock", "favorites"].includes(type)
                    ? 2
                    : 1
                  : ["favorites", "calendar"].includes(type)
                    ? 2
                    : 1,
        height: 1,
      }));
    }
  }
  return {
    schemaVersion: 1,
    compositions: { desktop: "dashboard", mobile: "minimal" },
    widgets,
    layouts,
  };
}
export function validateWorkspace(value) {
  object(value, ["schemaVersion", "compositions", "widgets", "layouts"]);
  if (value.schemaVersion !== 1) invalid();
  object(value.compositions, ["desktop", "mobile"]);
  for (const device of ["desktop", "mobile"])
    if (!Object.hasOwn(COMPOSITIONS, value.compositions[device])) invalid();
  if (!Array.isArray(value.widgets) || value.widgets.length > 24) invalid();
  const ids = new Set();
  const widgets = value.widgets.map((widget) => {
    object(widget, ["id", "type", "title", "config"]);
    if (
      typeof widget.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(widget.id) ||
      ids.has(widget.id) ||
      !Object.hasOwn(WIDGETS, widget.type)
    )
      invalid();
    ids.add(widget.id);
    text(widget.title, 80);
    return {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      config: validateConfig(widget.type, widget.config),
    };
  });
  object(value.layouts, ["desktop", "mobile"]);
  for (const device of ["desktop", "mobile"]) {
    object(value.layouts[device], Object.keys(COMPOSITIONS));
    for (const name of Object.keys(COMPOSITIONS)) {
      const layout = value.layouts[device][name];
      if (!Array.isArray(layout) || layout.length !== ids.size) invalid();
      const found = new Set();
      for (const item of layout) {
        object(item, ["id", "width", "height"]);
        if (!ids.has(item.id) || found.has(item.id)) invalid();
        found.add(item.id);
        integer(item.width, 1, device === "mobile" ? 2 : 3);
        integer(item.height, 1, 2);
      }
    }
  }
  return {
    schemaVersion: 1,
    compositions: { ...value.compositions },
    widgets,
    layouts: structuredClone(value.layouts),
  };
}

export function parseSave(value) {
  object(value, ["baseRevision", "workspace"]);
  integer(value.baseRevision, 0, Number.MAX_SAFE_INTEGER - 1);
  return {
    baseRevision: value.baseRevision,
    workspace: validateWorkspace(value.workspace),
  };
}
