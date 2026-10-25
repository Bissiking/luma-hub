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
export function createOAuthTransaction({ returnTo = "/", codeVerifier, scope }) {
  cleanup();
  const state = randomToken(24);
  oauthTransactions.set(state, {
    returnTo: returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/",
    codeVerifier,
    scope,
    redirectUri: `${config.publicBaseUrl}/auth/callback`,
    expiresAt: Date.now() + OAUTH_TRANSACTION_TTL_MS
  });
  return state;
}

export function consumeOAuthTransaction(state) {
  if (!state) return null;
  const record = oauthTransactions.get(state);
  oauthTransactions.delete(state);
  if (!record || record.expiresAt <= Date.now()) return null;
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
