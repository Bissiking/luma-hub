// src/sso.js
// Client SSO v4 (Kyros 5.x) : PAR + PKCE S256, Authorization Code, JWT RS256 (JWKS),
// refresh rotatif et révocation. Aucun secret n'est exposé au navigateur.
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config.js";

export class SsoError extends Error {
  constructor(code, message, status = 502) {
    super(message || code);
    this.name = "SsoError";
    this.code = code;
    this.status = status;
  }
}

function handshake() {
  return {
    kyros_sso_version: config.kyrosSsoVersion,
    kyros_edition: config.kyrosEdition,
    kyros_application_scope: config.kyrosApplicationScope
  };
}

async function kyrosFetch(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.kyrosTimeoutMs)
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new SsoError("kyros_timeout", "Kyros ne répond pas (délai dépassé).", 504);
    }
    throw new SsoError("kyros_unreachable", "Impossible de joindre Kyros.", 502);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error || `http_${response.status}`;
    const status = response.status === 500 ? 502 : 502;
    throw new SsoError(code, payload?.error_description || payload?.message || null, status);
  }
  return payload;
}

export function createPkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export async function createPushedAuthorizationRequest({ redirectUri, scope, state, codeChallenge }) {
  const payload = await kyrosFetch(config.kyrosParUrl, {
    client_id: config.kyrosClientId,
    client_secret: config.kyrosClientSecret,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    ...handshake()
  });

  if (!payload?.request_uri) {
    throw new SsoError("par_failed", "Kyros n'a pas retourné de request_uri.");
  }
  return { requestUri: payload.request_uri, expiresIn: Number(payload.expires_in) || 90 };
}

export function buildAuthorizeUrl(requestUri) {
  const url = new URL(config.kyrosAuthorizeUrl);
  url.searchParams.set("client_id", config.kyrosClientId);
  url.searchParams.set("request_uri", requestUri);
  return url.toString();
}

let jwksInstance = null;
function getJwks() {
  if (!jwksInstance) {
    jwksInstance = createRemoteJWKSet(new URL(config.kyrosJwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000,
      timeoutDuration: config.kyrosTimeoutMs
    });
  }
  return jwksInstance;
}

// Vérification RS256 stricte avant de créer la session (guide 5.1, étape 6).
export async function verifyAccessToken(accessToken) {
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(accessToken, getJwks(), {
      algorithms: ["RS256"],
      issuer: config.kyrosIssuer,
      audience: config.kyrosAudience,
      clockTolerance: 30
    }));
  } catch (error) {
    const code = error.code === "ERR_JWT_EXPIRED" ? "token_expired" : "token_invalid";
    throw new SsoError(code, "Jeton d'accès Kyros invalide ou expiré.", 401);
  }

  if (claims.resource_aud !== config.kyrosResourceAudience) {
    throw new SsoError("invalid_audience", "Le jeton n'est pas destiné au Hub.", 401);
  }
  if (claims.client_id !== config.kyrosClientId) {
    throw new SsoError("invalid_client", "Le jeton appartient à un autre client.", 401);
  }
  if (!claims.sub) {
    throw new SsoError("invalid_token", "Sujet (sub) manquant dans le jeton.", 401);
  }

  const granted = String(claims.scope || "").split(/\s+/).filter(Boolean);
  const missing = config.kyrosRequiredScopes.filter((scope) => !granted.includes(scope));
  if (missing.length > 0) {
    throw new SsoError("insufficient_scope", `Scopes manquants : ${missing.join(", ")}.`, 401);
  }

  return claims;
}

function tokenPairFrom(payload) {
  if (!payload?.access_token) {
    throw new SsoError(payload?.error || "token_failed", payload?.error_description || "Échange de jeton refusé.");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || null,
    scope: payload.scope || config.kyrosRequestedScope,
    expiresInSeconds: Number(payload.expires_in) || 300,
    user: payload.user || null
  };
}

export async function exchangeAuthorizationCode({ code, codeVerifier, redirectUri }) {
  const payload = await kyrosFetch(config.kyrosTokenUrl, {
    grant_type: "authorization_code",
    client_id: config.kyrosClientId,
    client_secret: config.kyrosClientSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
    ...handshake()
  });
  return tokenPairFrom(payload);
}

// Rotation : remplacer access + refresh ensemble. Une réutilisation de refresh
// révoque toute la famille côté Kyros : jamais de rejeu automatique.
export async function refreshAccessToken(refreshToken) {
  const payload = await kyrosFetch(config.kyrosTokenUrl, {
    grant_type: "refresh_token",
    client_id: config.kyrosClientId,
    client_secret: config.kyrosClientSecret,
    refresh_token: refreshToken,
    ...handshake()
  });
  return tokenPairFrom(payload);
}

export async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  try {
    await kyrosFetch(config.kyrosRevokeUrl, {
      client_id: config.kyrosClientId,
      client_secret: config.kyrosClientSecret,
      refresh_token: refreshToken,
      ...handshake()
    });
  } catch {
    // La déconnexion locale reste prioritaire : la révocation est best-effort.
  }
}
