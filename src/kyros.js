// src/kyros.js
import { config } from "./config.js";

export function buildAuthorizeUrl(state) {
  const url = new URL(`${config.kyrosBaseUrl}/authorize`);
  url.searchParams.set("client_id", config.kyrosClientId);
  url.searchParams.set("redirect_uri", `${config.publicBaseUrl}/auth/callback`);
  url.searchParams.set("scope", config.kyrosRequestedScope);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(code) {
  const response = await fetch(`${config.kyrosBaseUrl}/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.kyrosClientId,
      client_secret: config.kyrosClientSecret,
      code,
      redirect_uri: `${config.publicBaseUrl}/auth/callback`
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `Kyros HTTP ${response.status}`);
  return payload;
}

export async function fetchUserApps(accessToken) {
  const response = await fetch(`${config.kyrosBaseUrl}${config.kyrosAppsEndpoint}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }
  });
  if (response.status === 404) return { apps: [], unavailable: true, reason: "apps_endpoint_not_ready" };
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { apps: [], unavailable: true, reason: payload.error || payload.message || `HTTP ${response.status}` };
  return { apps: Array.isArray(payload.apps) ? payload.apps : [], unavailable: false, reason: null };
}
