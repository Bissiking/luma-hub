// state.js — état partagé : session, catalogue Kyros v1, contexte, favoris, récents

import * as api from "./api.js";

export const state = {
  booted: false,
  session: null,
  catalog: null, // {schemaVersion, revision, preferences, apps}
  context: null, // {context: {type, companyName, role, memberships, ...}}
  route: "accueil"
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(reason = "update") {
  for (const fn of listeners) fn(reason);
}

export function kyrosUrl() {
  return state.session?.links?.kyros || "http://localhost:3001";
}

export function user() {
  return state.session?.user || null;
}

export function isAuthenticated() {
  return Boolean(state.session?.authenticated);
}

export function contextInfo() {
  return state.context?.context || null;
}

export function apps() {
  return state.catalog?.apps || [];
}

export function preferences() {
  return (
    state.catalog?.preferences || {
      favorites: [],
      pinned: [],
      hidden: [],
      order: [],
      display: {}
    }
  );
}

export function revision() {
  return state.catalog?.revision ?? 0;
}

export function hiddenIds() {
  return new Set(preferences().hidden || []);
}

export function favoriteIds() {
  return new Set(preferences().favorites || []);
}

export function isFavorite(id) {
  return favoriteIds().has(id);
}

// Applications visibles (hidden appliqué côté affichage, jamais supprimé).
export function visibleApps() {
  const hidden = hiddenIds();
  return apps().filter((app) => !hidden.has(app.id));
}

export function favoriteApps() {
  const favs = preferences().favorites || [];
  const byId = new Map(apps().map((app) => [app.id, app]));
  return favs.map((id) => byId.get(id)).filter(Boolean);
}

export function findApp(id) {
  return apps().find((app) => app.id === id) || null;
}

// --------------------------------------------------------------- Favoris
// Écriture serveur (Kyros /api/hub/v1/preferences) avec révision atomique.

export async function toggleFavorite(id) {
  const current = preferences().favorites || [];
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];

  try {
    const result = await api.patchPreferences({
      baseRevision: revision(),
      preferences: { favorites: next }
    });
    if (state.catalog) {
      state.catalog.revision = result.revision;
      state.catalog.preferences = result.preferences;
    }
    emit("favorites");
    return next.includes(id);
  } catch (error) {
    if (error.status === 409) {
      // Conflit de révision : on relit l'état serveur, aucun écrasement.
      await reloadCatalog();
      emit("favorites");
      throw new api.ApiError(
        "revision_conflict",
        "Vos préférences ont changé sur un autre appareil. Réessayez.",
        409,
        error.data
      );
    }
    throw error;
  }
}

export async function reloadCatalog() {
  const catalog = await api.getCatalog();
  state.catalog = catalog;
  return catalog;
}

// --------------------------------------------------------------- Récents
// Pas d'API Kyros pour les récents : stockage local indexé par compte.

function recentsKey() {
  return `luma-hub:v1:recent:${user()?.id || "anon"}`;
}

export function getRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(recentsKey()) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveRecents(list) {
  try {
    localStorage.setItem(recentsKey(), JSON.stringify(list.slice(0, 12)));
  } catch {
    // Stockage plein/indisponible : les récents restent non persistés.
  }
}

// Fusionne le stockage local avec les données fraîches du catalogue.
export function recentItems() {
  const stored = getRecents();
  return stored
    .map((entry) => {
      const fresh = findApp(entry.id);
      return fresh ? { ...fresh, openedAt: entry.openedAt } : entry;
    })
    .filter((entry) => entry && entry.id && entry.name);
}

export function recordLaunch(app) {
  if (!app?.id) return;
  const list = getRecents().filter((entry) => entry.id !== app.id);
  list.unshift({
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description || "",
    url: app.url,
    category: app.category || null,
    icon: app.icon || null,
    logoUrl: app.logoUrl || null,
    brandPrimaryColor: app.brandPrimaryColor || null,
    brandSecondaryColor: app.brandSecondaryColor || null,
    openedAt: Date.now()
  });
  saveRecents(list);
  emit("recents");
}

export function removeRecent(id) {
  saveRecents(getRecents().filter((entry) => entry.id !== id));
  emit("recents");
}

export function clearRecents() {
  saveRecents([]);
  emit("recents");
}

// --------------------------------------------------------------- Cycle de vie

export async function boot() {
  state.session = await api.getSession();

  if (state.session.authenticated) {
    const [catalog, context] = await Promise.all([
      api.getCatalog().catch((error) => ({ error })),
      api.getContext().catch(() => null)
    ]);
    state.catalog = catalog?.apps ? catalog : null;
    state.context = context;
    state.bootError = catalog?.apps ? null : catalog?.error || "catalog_error";
  }

  state.booted = true;
  emit("boot");
  return state;
}

export async function refreshContext() {
  try {
    state.context = await api.getContext();
    emit("context");
  } catch {
    // Le contexte est complémentaire : un échec ne bloque pas le Hub.
  }
}
