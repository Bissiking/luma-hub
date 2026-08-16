// src/config.js
import "dotenv/config";

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
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

  kyrosBaseUrl,
  kyrosAuthorizeUrl: process.env.KYROS_AUTHORIZE_URL || `${kyrosBaseUrl}/authorize`,
  kyrosTokenUrl: process.env.KYROS_TOKEN_URL || `${kyrosBaseUrl}/token`,
  kyrosAppsUrl: `${kyrosBaseUrl}/api/apps/me`,
  kyrosClientId: process.env.KYROS_CLIENT_ID || "",
  kyrosClientSecret: process.env.KYROS_CLIENT_SECRET || "",
  kyrosRequestedScope: process.env.KYROS_REQUESTED_SCOPE || "profile email",
  kyrosTimeoutMs: Number(process.env.KYROS_TIMEOUT_SECONDS || 5) * 1000,

  // Handshake obligatoire depuis Kyros SSO 4.4.0.
  kyrosSsoVersion: process.env.KYROS_SSO_VERSION || "4.4.0",
  kyrosEdition: String(process.env.KYROS_EDITION || "standard").toLowerCase(),
  kyrosApplicationScope: String(process.env.KYROS_APPLICATION_SCOPE || "standard").toLowerCase()
};

export function validateConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT invalide");
  }

  if (!Number.isFinite(config.kyrosTimeoutMs) || config.kyrosTimeoutMs <= 0) {
    throw new Error("KYROS_TIMEOUT_SECONDS invalide");
  }

  if (!config.kyrosSsoVersion) {
    throw new Error("KYROS_SSO_VERSION est requis");
  }

  if (!["standard", "enterprise"].includes(config.kyrosEdition)) {
    throw new Error("KYROS_EDITION doit valoir standard ou enterprise");
  }

  if (!["standard", "enterprise", "both"].includes(config.kyrosApplicationScope)) {
    throw new Error("KYROS_APPLICATION_SCOPE doit valoir standard, enterprise ou both");
  }

  if (config.isProduction) {
    if (!config.publicBaseUrl.startsWith("https://")) {
      throw new Error("PUBLIC_BASE_URL doit utiliser HTTPS en production");
    }
    if (!config.kyrosBaseUrl.startsWith("https://")) {
      throw new Error("KYROS_BASE_URL doit utiliser HTTPS en production");
    }
    if (!config.kyrosClientId || !config.kyrosClientSecret) {
      throw new Error("KYROS_CLIENT_ID et KYROS_CLIENT_SECRET sont requis en production");
    }
  }
}
