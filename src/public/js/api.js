// api.js — accès à l'API interne du Hub (aucun secret côté navigateur)

export class ApiError extends Error {
  constructor(code, message, status, data) {
    super(message || code);
    this.name = "ApiError";
    this.code = code;
    this.status = status ?? 0;
    this.data = data ?? null;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin"
    });
  } catch {
    throw new ApiError("network_error", "Le Hub est injoignable.", 0);
  }

  if (response.status === 401) {
    document.dispatchEvent(new CustomEvent("hub:expired"));
    throw new ApiError("authentication_required", "Session expirée.", 401);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      data?.error || `http_${response.status}`,
      data?.message || `Erreur ${response.status}`,
      response.status,
      data
    );
  }
  return data;
}

export function getSession() {
  return request("/api/session");
}

export function getMe() {
  return request("/api/me");
}

export function getContext() {
  return request("/api/context");
}

export function getCatalog() {
  return request("/api/catalog");
}

export function getPreferences() {
  return request("/api/preferences");
}

export function patchPreferences(body) {
  return request("/api/preferences", { method: "PATCH", body });
}

export function logout() {
  return request("/auth/logout", { method: "POST" });
}
