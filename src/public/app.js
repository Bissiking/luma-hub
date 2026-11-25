import {
  state,
  boot,
  subscribe,
  isAuthenticated,
  favoriteIds,
  findApp,
  removeRecent,
  clearRecents,
  toggleFavorite,
  reloadCatalog,
  kyrosUrl,
  preferences,
} from "./js/state.js";
import * as api from "./js/api.js";
import { ROUTES, routeFromHash, renderNotFound } from "./js/views.js";
import { initSearch, closeSearch } from "./js/search.js";
import { toast, launchApp, icon } from "./js/ui.js";
import { initWorkspace } from "./js/workspace/controller.js";
import {initDrivio} from './js/workspace/drivio-client.js';
import { initHarmonix } from './js/workspace/harmonix-client.js';
import {
  loadWorkspace,
  workspace,
  composition,
  clearWorkspaceCache,
  hasUnsavedChanges,
  flushWorkspace,
} from "./js/workspace/store.js";
const view = document.getElementById("view");
const titles = {
  accueil: "Workspace",
  applications: "Applications",
  favoris: "Favoris",
  recents: "Récents",
  personnaliser: "Personnaliser",
};
let previousRoute;
function render() {
  if (!isAuthenticated()) return;
  const route = routeFromHash(location.hash),
    routeChanged = route !== previousRoute;
  const focus = view.contains(document.activeElement)
    ? {
        id: document.activeElement.id,
        name: document.activeElement.name,
        value: document.activeElement.value,
        dataset: { ...document.activeElement.dataset },
      }
    : null;
  const y = scrollY;
  const openWidgets = new Map([...view.querySelectorAll('details[data-widget]')].map(el => [el.dataset.widget,el.open]));
  state.route = route || "notfound";
  view.innerHTML = route ? ROUTES[route]() : renderNotFound();
  if (!routeChanged && !workspace.editing) for (const el of view.querySelectorAll('details[data-widget]')) {
    if (openWidgets.has(el.dataset.widget)) el.open = openWidgets.get(el.dataset.widget);
  }
  document.body.dataset.composition = composition();
  document.body.dataset.catalogLayout = preferences().display?.layout || "grid";
  document.body.dataset.density =
    preferences().display?.density || "comfortable";
  document.title = `${titles[route] || "Page introuvable"} · LUMA Hub`;
  for (const link of document.querySelectorAll(".nav-link[data-route]")) {
    const active = link.dataset.route === route;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const badge = document.getElementById("navFavoritesCount");
  badge.textContent = favoriteIds().size;
  badge.classList.toggle("hidden", !favoriteIds().size);
  const locked = workspace.status === "conflict" || Boolean(workspace.recovery);
  view
    .querySelectorAll(
      "[data-composition], [data-widget-menu], [data-edit-workspace], [data-add-widget], [data-drag], [data-resize], [data-resize-drag], [data-move]",
    )
    .forEach((el) => (el.disabled = locked));
  if (routeChanged) {
    scrollTo(0, 0);
    if (previousRoute !== undefined) view.focus({ preventScroll: true });
  } else {
    scrollTo(0, y);
    if (focus) {
      const target = [...view.querySelectorAll("button,input,select,a")].find(
        (el) =>
          focus.id
            ? el.id === focus.id
            : focus.name
              ? el.name === focus.name && el.value === focus.value
              : Object.keys(focus.dataset).length &&
                Object.entries(focus.dataset).every(
                  ([key, value]) => el.dataset[key] === value,
                ),
      );
      target?.focus({ preventScroll: true });
    }
  }
  previousRoute = route;
}
function fillAccount() {
  const user = state.session.user,
    name = user.display_name || user.username || "Compte";
  for (const id of ["topbarName", "menuName"])
    document.getElementById(id).textContent = name;
  document.getElementById("menuEmail").textContent = user.email || "";
  document.getElementById("topbarAvatar").textContent = name
    .trim()
    .slice(0, 1)
    .toUpperCase();
  for (const id of ["openKyrosAccount", "sidebarKyrosAccount"])
    document.getElementById(id).href = `${kyrosUrl()}/account`;
}
async function retryCatalog() {
  try {
    await reloadCatalog();
    state.bootError = null;
    render();
    toast("Catalogue rechargé");
  } catch (error) {
    toast(error.message || "Kyros est injoignable.", "error");
  }
}
function bindEvents() {
  document.addEventListener("click", async (event) => {
    const favorite = event.target.closest("[data-fav]");
    if (favorite) {
      event.preventDefault();
      favorite.disabled = true;
      try {
        const added = await toggleFavorite(favorite.dataset.fav);
        toast(added ? "Ajouté aux favoris" : "Retiré des favoris");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        favorite.disabled = false;
      }
      return;
    }
    const launch = event.target.closest("[data-launch]");
    if (launch) {
      const app = findApp(launch.dataset.launch);
      if (app) launchApp(app);
      else event.preventDefault();
    }
    const remove = event.target.closest("[data-remove-recent]");
    if (remove) removeRecent(remove.dataset.removeRecent);
    if (event.target.closest("[data-clear-recents]")) clearRecents();
    if (event.target.closest("[data-retry]")) retryCatalog();
    if (event.target.closest("#accountMenu a"))
      document.getElementById("accountMenu").hidePopover();
  });
  document
    .getElementById("logoutButton")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (hasUnsavedChanges()) {
          await flushWorkspace();
          if (hasUnsavedChanges())
            throw new Error(
              "Votre espace n’est pas enregistré. Réessayez ou exportez le brouillon avant de vous déconnecter.",
            );
        }
        await api.logout();
        await clearWorkspaceCache();
        location.assign("/");
      } catch (error) {
        document.getElementById("logoutError").textContent = error.message;
        button.disabled = false;
      }
    });
  document.addEventListener("hub:expired", async () => {
    await clearWorkspaceCache();
    location.assign(
      `/auth/login?returnTo=${encodeURIComponent("/" + (location.hash || "#/"))}`,
    );
  });
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (img?.tagName === "IMG" && img.hasAttribute("data-app-logo")) {
        const holder = img.closest(".app-logo");
        if (holder) holder.textContent = img.dataset.initials || "?";
      }
    },
    true,
  );
  window.addEventListener("hashchange", () => {
    closeSearch();
    render();
  });
  let refreshedAt = Date.now();
  window.addEventListener("focus", () => {
    if (isAuthenticated() && Date.now() - refreshedAt > 60000) {
      refreshedAt = Date.now();
      retryCatalog();
    }
  });
}
async function start() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
  initSearch();
  bindEvents();
  initWorkspace(render);
  try {
    await boot();
  } catch {
    document.querySelector("#guestView .lead").textContent =
      "Le Hub est injoignable. Réessayez dans un instant.";
  }
  document.getElementById("bootStatus").classList.add("hidden");
  if (!isAuthenticated()) {
    document.getElementById("guestView").classList.remove("hidden");
    return;
  }
  fillAccount();
  document.getElementById("appShell").classList.remove("hidden");
  render();
  subscribe(() => render());
  await loadWorkspace();
  initDrivio(render);
  initHarmonix(render);
  fetch("/health")
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("footerVersion").textContent = `v${data.version}`;
    })
    .catch(() => {});
}
await start();
