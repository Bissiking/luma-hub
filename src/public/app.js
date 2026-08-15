// src/public/app.js
const guestView = document.querySelector("#guestView");
const userView = document.querySelector("#userView");
const logoutButton = document.querySelector("#logoutButton");
const searchButton = document.querySelector("#searchButton");
const searchInput = document.querySelector("#searchInput");
const appsGrid = document.querySelector("#appsGrid");
const emptyState = document.querySelector("#emptyState");
const statusMessage = document.querySelector("#statusMessage");
const welcomeTitle = document.querySelector("#welcomeTitle");
const avatar = document.querySelector("#avatar");

let apps = [];

function displayName(user) {
  return user?.displayName || user?.display_name || user?.username || "vous";
}

function appKey(app) {
  return String(app.id || app.key || app.client_id || app.name || "app");
}

function appUrl(app) {
  return app.url || app.homeUrl || app.home_url || "#";
}

function appDescription(app) {
  return app.description || "Application LUMA";
}

function renderApps(filter = "") {
  const query = filter.trim().toLowerCase();
  const visible = apps.filter((app) => {
    const haystack = `${app.name || ""} ${appDescription(app)} ${app.category || ""}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  appsGrid.innerHTML = visible.map((app) => {
    const name = String(app.name || appKey(app));
    const initial = name.slice(0, 1).toUpperCase();
    return `
      <a class="app-card" href="${escapeAttribute(appUrl(app))}" data-app="${escapeAttribute(appKey(app))}">
        <div class="app-top">
          <span class="app-icon">${escapeHtml(initial)}</span>
          <span>
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml(appDescription(app))}</small>
          </span>
        </div>
        <span class="app-arrow">↗</span>
      </a>
    `;
  }).join("");

  emptyState.classList.toggle("hidden", visible.length !== 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  const stringValue = String(value || "#");
  if (/^https?:\/\//i.test(stringValue) || stringValue.startsWith("/")) return escapeHtml(stringValue);
  return "#";
}

async function loadApps() {
  const response = await fetch("/api/apps", { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({ apps: [] }));
  apps = Array.isArray(payload.apps) ? payload.apps : [];

  if (!response.ok && payload.reason === "apps_endpoint_not_ready") {
    statusMessage.textContent = "Connexion Kyros prête. Le nouvel endpoint des applications n'est pas encore disponible côté Kyros.";
    statusMessage.classList.remove("hidden");
  } else if (!response.ok) {
    statusMessage.textContent = "Impossible de récupérer les applications depuis Kyros pour le moment.";
    statusMessage.classList.remove("hidden");
  } else {
    statusMessage.classList.add("hidden");
  }

  renderApps();
}

async function boot() {
  const response = await fetch("/api/session", { headers: { accept: "application/json" } });
  const session = await response.json();

  if (!session.authenticated) {
    guestView.classList.remove("hidden");
    return;
  }

  const name = displayName(session.user);
  userView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  searchButton.classList.remove("hidden");
  welcomeTitle.textContent = `Bienvenue, ${name}.`;
  avatar.textContent = name.slice(0, 1).toUpperCase();
  await loadApps();
}

searchInput?.addEventListener("input", () => renderApps(searchInput.value));
searchButton?.addEventListener("click", () => searchInput?.focus());

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
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
