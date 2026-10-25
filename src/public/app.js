// app.js — démarrage, routeur hash, interactions globales

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
  recentItems,
  kyrosUrl
} from "./js/state.js";
import * as api from "./js/api.js";
import { ROUTES, routeFromHash, renderNotFound } from "./js/views.js";
import { initSearch, closeSearch } from "./js/search.js";
import { toast, launchApp } from "./js/ui.js";

const view = document.getElementById("view");
const guestView = document.getElementById("guestView");
const appShell = document.getElementById("appShell");

let currentRoute = null;
let rendering = false;

// --------------------------------------------------------------- Routeur

function updateNav() {
  for (const link of document.querySelectorAll(".nav-link[data-route]")) {
    const active = link.dataset.route === state.route;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  const count = favoriteIds().size;
  const badge = document.getElementById("navFavoritesCount");
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count === 0);
  }
}

const TITLES = {
  accueil: "Accueil",
  applications: "Applications",
  favoris: "Favoris",
  recents: "Récents"
};

function render() {
  if (!isAuthenticated() || rendering) return;

  const route = routeFromHash(location.hash);
  if (route === null) {
    state.route = "notfound";
    view.innerHTML = renderNotFound();
    updateNav();
    document.title = "Page introuvable — LUMA Hub";
    return;
  }

  const routeChanged = route !== currentRoute;
  if (routeChanged) {
    currentRoute = route;
    state.route = route;
    view.removeAttribute("data-rendered");
    view.innerHTML = ROUTES[route]();
    window.scrollTo(0, 0);
    document.title = `${TITLES[route]} — LUMA Hub`;
    updateNav();
    requestAnimationFrame(() => view.setAttribute("data-rendered", "1"));
  } else {
    // Mise à jour in-place (favoris/récents) : on conserve la position.
    const scrollY = window.scrollY;
    view.innerHTML = ROUTES[route]();
    view.setAttribute("data-rendered", "1");
    window.scrollTo({ top: scrollY });
    updateNav();
  }
}

// --------------------------------------------------------------- Compte

function fillAccountUi() {
  const user = state.session?.user;
  const name = user?.display_name || user?.username || "Compte";
  const initial = (name || "·").trim().charAt(0).toUpperCase() || "·";

  const topbarName = document.getElementById("topbarName");
  const menuName = document.getElementById("menuName");
  const menuEmail = document.getElementById("menuEmail");
  if (topbarName) topbarName.textContent = name;
  if (menuName) menuName.textContent = name;
  if (menuEmail) menuEmail.textContent = user?.email || "";
  for (const avatarId of ["topbarAvatar", "menuAvatar"]) {
    const el = document.getElementById(avatarId);
    if (el) el.textContent = initial;
  }

  const accountLink = document.getElementById("openKyrosAccount");
  if (accountLink) accountLink.href = `${kyrosUrl()}/account`;
}

function closeDropdowns() {
  for (const dd of document.querySelectorAll(".dropdown.is-open")) {
    dd.classList.remove("is-open");
    dd.querySelector("[aria-haspopup]")?.setAttribute("aria-expanded", "false");
  }
}

// --------------------------------------------------------------- Actions

async function handleFavorite(button) {
  const id = button.dataset.fav;
  const willBeFavorite = !favoriteIds().has(id);

  // Mise à jour optimiste du bouton (feedback immédiat).
  button.classList.toggle("is-favorite", willBeFavorite);
  button.setAttribute("aria-pressed", String(willBeFavorite));
  button.setAttribute("aria-label", willBeFavorite ? "Retirer des favoris" : "Ajouter aux favoris");
  button.disabled = true;

  try {
    await toggleFavorite(id);
    toast(willBeFavorite ? "Ajouté aux favoris" : "Retiré des favoris");
  } catch (error) {
    button.classList.toggle("is-favorite", !willBeFavorite);
    toast(error.message || "Impossible de mettre à jour vos favoris.", "error");
  } finally {
    button.disabled = false;
  }
}

async function retryCatalog() {
  rendering = true;
  try {
    await reloadCatalog();
    state.bootError = null;
    toast("Catalogue rechargé");
  } catch {
    toast("Kyros reste injoignable.", "error");
  } finally {
    rendering = false;
    render();
  }
}

async function handleLogout(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api.logout();
  } finally {
    location.href = "/";
  }
}

// --------------------------------------------------------------- Écouteurs

function bindEvents() {
  // Délégation globale des actions de la vue.
  document.addEventListener("click", (event) => {
    const favorite = event.target.closest("[data-fav]");
    if (favorite) {
      event.preventDefault();
      handleFavorite(favorite);
      return;
    }

    const launch = event.target.closest("[data-launch]");
    if (launch) {
      const app = findApp(launch.dataset.launch);
      if (app) launchApp(app);
      // L'anchor ouvre l'URL dans un nouvel onglet par défaut.
      return;
    }

    const remove = event.target.closest("[data-remove-recent]");
    if (remove) {
      removeRecent(remove.dataset.removeRecent);
      toast("Retiré des récents");
      return;
    }

    if (event.target.closest("[data-clear-recents]")) {
      clearRecents();
      toast("Historique des récents effacé");
      return;
    }

    if (event.target.closest("[data-retry]")) {
      retryCatalog();
      return;
    }

    // Dropdowns (notifications / compte).
    const trigger = event.target.closest("#userChip, #notifButton");
    if (trigger) {
      const dropdown = trigger.closest(".dropdown");
      const wasOpen = dropdown.classList.contains("is-open");
      closeDropdowns();
      if (!wasOpen) {
        dropdown.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
      return;
    }
    if (!event.target.closest(".dropdown-panel")) closeDropdowns();
  });

  // Déconnexion.
  document.getElementById("logoutButton")?.addEventListener("click", handleLogout);

  // Menu mobile.
  const burger = document.getElementById("burger");
  const backdrop = document.getElementById("sidebarBackdrop");
  const toggleNav = (open) => {
    document.body.classList.toggle("nav-open", open);
    burger?.setAttribute("aria-expanded", String(open));
    if (backdrop) backdrop.hidden = !open;
  };
  burger?.addEventListener("click", () => toggleNav(!document.body.classList.contains("nav-open")));
  backdrop?.addEventListener("click", () => toggleNav(false));
  document.querySelector(".sidebar")?.addEventListener("click", (event) => {
    if (event.target.closest(".nav-link, .brand")) toggleNav(false);
  });

  // Session expirée (401 sur n'importe quel appel API).
  document.addEventListener("hub:expired", () => {
    const returnTo = `/${location.hash || "#/"}`;
    location.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  });

  // Images de logos cassées → initiales (listener capture, compatible CSP).
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (img?.tagName === "IMG" && img.hasAttribute("data-app-logo")) {
        const holder = img.closest(".app-logo");
        if (holder) holder.textContent = img.dataset.initials || "?";
      }
    },
    true
  );

  // Fermer les dropdowns avec Échap.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdowns();
  });
}

// --------------------------------------------------------------- Démarrage

async function start() {
  initSearch();
  bindEvents();

  try {
    await boot();
  } catch {
    guestView?.classList.remove("hidden");
    guestView && (guestView.querySelector(".lead").textContent =
      "Le Hub ne peut pas contacter le serveur. Réessayez dans un instant.");
    return;
  }

  fetch("/health")
    .then((res) => res.json())
    .then((data) => {
      const el = document.getElementById("footerVersion");
      if (el && data?.version) el.textContent = `v${data.version}`;
    })
    .catch(() => {});

  if (!isAuthenticated()) {
    guestView?.classList.remove("hidden");
    return;
  }

  fillAccountUi();
  appShell?.classList.remove("hidden");
  render();

  window.addEventListener("hashchange", () => {
    closeSearch();
    render();
  });

  subscribe((reason) => {
    if (reason === "boot") return;
    render();
  });
}

start();
