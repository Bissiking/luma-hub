// src/public/enterprise-context.js
(() => {
  const nativeFetch = window.fetch.bind(window);

  function applyContext(context) {
    const enterprise = context?.type === "enterprise";
    document.body.dataset.accountContext = enterprise ? "enterprise" : "personal";

    const eyebrow = document.querySelector("#spaceEyebrow");
    const contextBadge = document.querySelector("#contextBadge");
    const companyContext = document.querySelector("#companyContext");
    const appsLabel = document.querySelector("#appsLabel");

    if (!enterprise) {
      if (eyebrow) eyebrow.textContent = "ESPACE PERSONNEL";
      contextBadge?.classList.add("hidden");
      companyContext?.classList.add("hidden");
      return;
    }

    const companyName = context.companyName || "Entreprise";
    const role = context.role ? String(context.role).replaceAll("_", " ") : "membre";

    if (eyebrow) eyebrow.textContent = "ESPACE ENTREPRISE";

    if (contextBadge) {
      contextBadge.textContent = "Entreprise";
      contextBadge.classList.remove("hidden");
    }

    if (companyContext) {
      companyContext.innerHTML = `
        <span class="company-context-name">${escapeHtml(companyName)}</span>
        <span class="company-context-role">${escapeHtml(role)}</span>
      `;
      companyContext.classList.remove("hidden");
    }

    if (appsLabel && !appsLabel.textContent.includes("Entreprise")) {
      appsLabel.dataset.enterpriseLabel = "true";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const input = args[0];
    const url = typeof input === "string" ? input : input?.url || "";

    if (url === "/api/apps" || url.endsWith("/api/apps")) {
      response.clone().json()
        .then((payload) => applyContext(payload.context))
        .catch(() => applyContext(null));
    }

    return response;
  };
})();
