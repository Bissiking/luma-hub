// src/session.js
// Sessions applicatives et transactions OAuth SSO v4 (mémoire, TTL court).
import crypto from "node:crypto";
import { config } from "./config.js";

const sessions = new Map();
const oauthTransactions = new Map();
const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function cleanup() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [state, record] of oauthTransactions) {
    if (record.expiresAt <= now) oauthTransactions.delete(state);
  }
}

export function createSession(data) {
  cleanup();
  const token = randomToken();
  const now = Date.now();
  sessions.set(token, {
    ...data,
    createdAt: now,
    expiresAt: now + config.sessionTtlMs
  });
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function touchSession(token, data) {
  const session = getSession(token);
  if (!session) return null;
  Object.assign(session, data, { expiresAt: Date.now() + config.sessionTtlMs });
  return session;
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

// Transaction OAuth liée au navigateur : state, verifier et callback d'origine.
// Consommation one-shot (anti-rejeu) au retour de Kyros.
export const OAUTH_BINDING_COOKIE = "luma_hub_oauth";

export function isOAuthBrowserBinding(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function newOAuthBrowserBinding() {
  return randomToken();
}

export function oauthBindingCookieOptions() {
  return { ...sessionCookieOptions(), path: "/auth", maxAge: OAUTH_TRANSACTION_TTL_MS };
}

export function safeReturnTo(value) {
  if (typeof value !== "string" || value.length > 8192 || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(value)) return "/";
  try {
    const target = new URL(value, config.publicBaseUrl);
    return target.origin === new URL(config.publicBaseUrl).origin ? target.pathname + target.search + target.hash : "/";
  } catch { return "/"; }
}

export function createOAuthTransaction({ returnTo = "/", codeVerifier, scope, browserBinding }) {
  if (!isOAuthBrowserBinding(browserBinding)) throw new TypeError("OAuth browser binding required");
  cleanup();
  const state = randomToken(24);
  oauthTransactions.set(state, {
    returnTo: safeReturnTo(returnTo),
    browserBindingHash: crypto.createHash("sha256").update(browserBinding).digest(),
    codeVerifier,
    scope,
    redirectUri: `${config.publicBaseUrl}/auth/callback`,
    expiresAt: Date.now() + OAUTH_TRANSACTION_TTL_MS
  });
  return state;
}

export function consumeOAuthTransaction(state, browserBinding) {
  if (typeof state !== "string" || !isOAuthBrowserBinding(browserBinding)) return null;
  const record = oauthTransactions.get(state);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) { oauthTransactions.delete(state); return null; }
  const supplied = crypto.createHash("sha256").update(browserBinding).digest();
  if (!crypto.timingSafeEqual(record.browserBindingHash, supplied)) return null;
  oauthTransactions.delete(state);
  return record;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlMs
  };
}
