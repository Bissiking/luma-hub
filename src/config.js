// src/config.js
import "dotenv/config";

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: trimSlash(process.env.PUBLIC_BASE_URL || "http://localhost:3000"),
  sessionTtlMs: Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
  kyrosBaseUrl: trimSlash(process.env.KYROS_BASE_URL || "http://localhost:3001"),
  kyrosClientId: process.env.KYROS_CLIENT_ID || "",
  kyrosClientSecret: process.env.KYROS_CLIENT_SECRET || "",
  kyrosRequestedScope: process.env.KYROS_REQUESTED_SCOPE || "profile email",
  kyrosAppsEndpoint: process.env.KYROS_APPS_ENDPOINT || "/api/apps/me"
};

export function validateConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT invalide");
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
