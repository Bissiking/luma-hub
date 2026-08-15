// src/session.js
import crypto from "node:crypto";
import { config } from "./config.js";

const sessions = new Map();
const oauthStates = new Map();

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function cleanup() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [state, record] of oauthStates) {
    if (record.expiresAt <= now) oauthStates.delete(state);
  }
}

export function createSession(data) {
  cleanup();
  const token = randomToken();
  sessions.set(token, {
    ...data,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.sessionTtlMs
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

export function destroySession(token) {
  if (token) sessions.delete(token);
}

export function createOAuthState(returnTo = "/") {
  cleanup();
  const state = randomToken(24);
  oauthStates.set(state, {
    returnTo: returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/",
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  return state;
}

export function consumeOAuthState(state) {
  const record = oauthStates.get(state);
  oauthStates.delete(state);
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
