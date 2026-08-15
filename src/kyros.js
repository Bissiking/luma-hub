// src/kyros.js
import { config } from "./config.js";

function kyrosFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(config.kyrosTimeoutMs)
  });
}

function getHandshakeFields() {
  return {
    kyros_sso_version: config.kyrosSsoVersion,
    kyros_edition: config.kyrosEdition,
    kyros_application_scope: config.kyrosApplicationScope
  };
}

function normalizeKyrosAssetUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw, `${config.kyrosBaseUrl}/`).toString();
  } catch {
    return null;
  }
}

function normalizeApplication(app) {
  if (!app || typeof app !== "object") return app;

  const logoUrl = normalizeKyrosAssetUrl(app.logoUrl || app.logo_url);
  const iconUrl = normalizeKyrosAssetUrl(app.iconUrl || app.icon_url || app.icon?.url);

  return {
    ...app,
    ...(logoUrl ? { logoUrl } : {}),
    ...(iconUrl ? { iconUrl } : {})
  };
}

export function buildAuthorizeUrl(state) {
  const url = new URL(config.kyrosAuthorizeUrl);
  url.searchParams.set("client_id", config.kyrosClientId);
  url.searchParams.set("redirect_uri", `${config.publicBaseUrl}/auth/callback`);
  url.searchParams.set("scope", config.kyrosRequestedScope);
  url.searchParams.set("state", state);

  for (const [key, value] of Object.entries(getHandshakeFields())) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export async function exchangeAuthorizationCode(code) {
  const response = await kyrosFetch(config.kyrosTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.kyrosClientId,
      client_secret: config.kyrosClientSecret,
      code,
      redirect_uri: `${config.publicBaseUrl}/auth/callback`,
      ...getHandshakeFields()
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const details = [payload.error, payload.expected && `expected=${payload.expected}`, payload.received !== undefined && `received=${payload.received ?? "none"}`]
      .filter(Boolean)
      .join(" ");
    throw new Error(details || `Kyros HTTP ${response.status}`);
  }

  return payload;
}

export async function fetchUserApps(accessToken) {
  const response = await kyrosFetch(config.kyrosAppsUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    }
  });

  if (response.status === 404) {
    return { apps: [], unavailable: true, reason: "apps_endpoint_not_ready" };
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      apps: [],
      unavailable: true,
      reason: payload.error || payload.message || `HTTP ${response.status}`
    };
  }

  return {
    apps: Array.isArray(payload.apps) ? payload.apps.map(normalizeApplication) : [],
    unavailable: false,
    reason: null
  };
}
