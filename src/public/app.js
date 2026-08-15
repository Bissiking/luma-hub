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

let apps = [];

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
  return String(app.id || app.key || app.client_id || app.name || "app");
}

function appUrl(app) {
  return app.url || app.homeUrl || app.home_url || "#";
}

function appDescription(app) {
  return app.description || "Application LUMA";
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
  const s = String(value || "#");
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return escapeHtml(s);
  return "#";
}

/* ── Render apps ── */
function renderApps(filter = "") {
  const query = filter.trim().toLowerCase();
  const visible = apps.filter((app) => {
    const haystack = `${app.name || ""} ${appDescription(app)} ${app.category || ""}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  appsGrid.innerHTML = visible.map((app, i) => {
    const name = String(app.name || appKey(app));
    const initial = name.slice(0, 2).toUpperCase();
    const delay = Math.min(i * 0.05, 0.4);

    return `
      <a class="app-card"
         href="${escapeAttribute(appUrl(app))}"
         data-app="${escapeAttribute(appKey(app))}"
         style="animation-delay: ${delay}s; perspective: 600px;">
        <div class="app-top">
          <span class="app-icon">${escapeHtml(initial)}</span>
          <span>
            <span class="app-name">${escapeHtml(name)}</span>
            <span class="app-desc">${escapeHtml(appDescription(app))}</span>
          </span>
        </div>
        <span class="app-arrow">↗</span>
      </a>
    `;
  }).join("");

  /* Attach motion to every card */
  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(pointer: fine)").matches) {
    appsGrid.querySelectorAll(".app-card").forEach(attachCardMotion);
  }

  const isEmpty = visible.length === 0;
  emptyState.classList.toggle("hidden", !isEmpty);
  if (appsLabel) appsLabel.style.display = visible.length > 0 ? "" : "none";
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