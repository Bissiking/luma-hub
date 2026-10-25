// src/config.js
import "dotenv/config";

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function splitScopes(value, fallback) {
  const list = String(value || fallback)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const kyrosBaseUrl = trimSlash(process.env.KYROS_BASE_URL || "http://localhost:3001");

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: trimSlash(process.env.PUBLIC_BASE_URL || "http://localhost:3000"),
  sessionTtlMs: Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
  cookieName: "luma_hub_session",

  kyrosBaseUrl,
  kyrosParUrl: process.env.KYROS_PAR_URL || `${kyrosBaseUrl}/par`,
  kyrosAuthorizeUrl: process.env.KYROS_AUTHORIZE_URL || `${kyrosBaseUrl}/authorize`,
  kyrosTokenUrl: process.env.KYROS_TOKEN_URL || `${kyrosBaseUrl}/token`,
  kyrosRevokeUrl: process.env.KYROS_REVOKE_URL || `${kyrosBaseUrl}/revoke`,
  kyrosJwksUrl: process.env.KYROS_JWKS_URL || `${kyrosBaseUrl}/sso/v4/jwks`,
  kyrosMeUrl: `${kyrosBaseUrl}/api/me`,
  kyrosContextUrl: `${kyrosBaseUrl}/api/apps/me`,
  kyrosCatalogUrl: `${kyrosBaseUrl}/api/hub/v1/catalog`,
  kyrosPreferencesUrl: `${kyrosBaseUrl}/api/hub/v1/preferences`,
  kyrosClientId: process.env.KYROS_CLIENT_ID || "",
  kyrosClientSecret: process.env.KYROS_CLIENT_SECRET || "",
  kyrosRequestedScope: splitScopes(
    process.env.KYROS_REQUESTED_SCOPE,
    "profile email hub:read hub:preferences"
  ).join(" "),
  kyrosRequiredScopes: splitScopes(
    process.env.KYROS_REQUIRED_SCOPES,
    "profile email hub:read"
  ),
  kyrosTimeoutMs: Number(process.env.KYROS_TIMEOUT_SECONDS || 5) * 1000,

  // Handshake SSO v4 : propriétés strictes du client enregistré.
  kyrosSsoVersion: process.env.KYROS_SSO_VERSION || "v4",
  kyrosEdition: String(process.env.KYROS_EDITION || "standard").toLowerCase(),
  kyrosApplicationScope: String(process.env.KYROS_APPLICATION_SCOPE || "standard").toLowerCase(),

  kyrosIssuer: process.env.KYROS_ISSUER || "kyros",
  kyrosAudience: process.env.KYROS_AUDIENCE || "kyros-modules",
  kyrosResourceAudience: process.env.KYROS_RESOURCE_AUDIENCE || "kyros:hub"
};

export function validateConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT invalide");
  }

  if (!Number.isFinite(config.kyrosTimeoutMs) || config.kyrosTimeoutMs <= 0) {
    throw new Error("KYROS_TIMEOUT_SECONDS invalide");
  }

  if (config.kyrosSsoVersion !== "v4") {
    throw new Error("KYROS_SSO_VERSION doit valoir v4 (SSO v4 obligatoire)");
  }

  if (!["standard", "enterprise"].includes(config.kyrosEdition)) {
    throw new Error("KYROS_EDITION doit valoir standard ou enterprise");
  }

  if (!["standard", "enterprise", "both"].includes(config.kyrosApplicationScope)) {
    throw new Error("KYROS_APPLICATION_SCOPE doit valoir standard, enterprise ou both");
  }

  if (!config.kyrosRequiredScopes.every((scope) => config.kyrosRequestedScope.split(" ").includes(scope))) {
    throw new Error("KYROS_REQUIRED_SCOPES doit être inclus dans KYROS_REQUESTED_SCOPE");
  }

  if (!config.kyrosRequestedScope.split(" ").includes("hub:read")) {
    throw new Error("KYROS_REQUESTED_SCOPE doit contenir hub:read pour l'API Hub v1");
  }

  if (config.isProduction) {
    if (!config.publicBaseUrl.startsWith("https://")) {
      throw new Error("PUBLIC_BASE_URL doit utiliser HTTPS en production");
    }
    if (!config.kyrosBaseUrl.startsWith("https://")) {
      throw new Error("KYROS_BASE_URL doit utiliser HTTPS en production");
    }
  }

  if (!config.kyrosClientId || !config.kyrosClientSecret) {
    throw new Error("KYROS_CLIENT_ID et KYROS_CLIENT_SECRET sont requis");
  }
}
