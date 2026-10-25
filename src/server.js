// src/server.js
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { config, validateConfig } from "./config.js";
import * as sso from "./sso.js";
import {
  createSession,
  getSession,
  touchSession,
  destroySession,
  createOAuthTransaction,
  consumeOAuthTransaction,
  sessionCookieOptions
} from "./session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const version = readVersion();

validateConfig();

const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json());
app.use(
  express.static(publicDir, {
    index: false,
    maxAge: config.isProduction ? "1h" : 0
  })
);

function readVersion() {
  try {
    return fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function errorPage(res, status, title, message) {
  res.status(status).type("html").send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d15;color:#eef1f8;font:16px/1.5 system-ui,sans-serif}
main{text-align:center;max-width:520px;padding:32px}h1{font-size:24px;margin:0 0 8px}p{color:#9aa3b8;margin:0 0 24px}a{display:inline-block;padding:12px 20px;border-radius:10px;background:#7a7bf0;color:#fff;text-decoration:none;font-weight:600}</style>
</head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/">Retour au Hub</a></main></body></html>`);
}

// ---------------------------------------------------------------------------
// Sessions et jetons
// ---------------------------------------------------------------------------

function requestSession(req, res) {
  const token = req.cookies?.[config.cookieName];
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "authentication_required" });
    return null;
  }
  return { token, session };
}

// Rotation locale : access + refresh remplacés ensemble, sérialisés par
// session (un seul refresh à la fois, jamais de rejeu d'un ancien token).
function refreshSession(token, session) {
  if (!session.refreshPromise) {
    session.refreshPromise = (async () => {
      try {
        const pair = await sso.refreshAccessToken(session.refreshToken);
        const claims = await sso.verifyAccessToken(pair.accessToken);
        touchSession(token, {
          accessToken: pair.accessToken,
          refreshToken: pair.refreshToken || session.refreshToken,
          accessExpiresAt: Date.now() + pair.expiresInSeconds * 1000,
          claims
        });
      } catch {
        destroySession(token);
        throw new sso.SsoError("session_expired", "Session expirée, reconnectez-vous.", 401);
      } finally {
        session.refreshPromise = null;
      }
    })();
  }
  return session.refreshPromise;
}

async function ensureFreshTokens(token, session) {
  if (session.accessExpiresAt - Date.now() > 60_000) return session;
  if (!session.refreshToken) {
    destroySession(token);
    throw new sso.SsoError("session_expired", "Session expirée, reconnectez-vous.", 401);
  }
  await refreshSession(token, session);
  const refreshed = getSession(token);
  if (!refreshed) throw new sso.SsoError("session_expired", "Session expirée, reconnectez-vous.", 401);
  return refreshed;
}

async function kyrosCall(url, { method = "GET", body, accessToken }) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(config.kyrosTimeoutMs)
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new sso.SsoError("kyros_timeout", "Kyros ne répond pas (délai dépassé).", 504);
    }
    throw new sso.SsoError("kyros_unreachable", "Impossible de joindre Kyros.", 502);
  }
  return response;
}

// Proxy transparent : on conserve le statut et le corps Kyros (dont
// 409 revision_conflict et les 400 de préférences) pour le client.
async function proxyToKyros(req, res, url, { method = "GET", body } = {}) {
  const entry = requestSession(req, res);
  if (!entry) return;

  const send = async (session) => {
    const response = await kyrosCall(url, { method, body, accessToken: session.accessToken });
    if (response.status === 401 && session.refreshToken) {
      await refreshSession(entry.token, session);
      const retried = getSession(entry.token);
      if (!retried) {
        res.status(401).json({ error: "authentication_required" });
        return;
      }
      const retry = await kyrosCall(url, { method, body, accessToken: retried.accessToken });
      return forward(retry);
    }
    return forward(response);
  };

  const forward = async (response) => {
    if (response.status === 401) {
      destroySession(entry.token);
      res.status(401).json({ error: "authentication_required" });
      return;
    }
    const payload = await response.json().catch(() => null);
    res.set("Cache-Control", "no-store");
    res.status(response.status);
    if (payload === null) res.end();
    else res.json(payload);
  };

  try {
    const session = await ensureFreshTokens(entry.token, entry.session);
    await send(session);
  } catch (error) {
    handleApiError(res, error);
  }
}

function handleApiError(res, error) {
  if (error instanceof sso.SsoError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  console.error("[hub] erreur inattendue", error);
  res.status(500).json({ error: "internal_error" });
}

// ---------------------------------------------------------------------------
// Authentification SSO v4
// ---------------------------------------------------------------------------

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "luma-hub", version });
});

app.get("/auth/login", async (req, res) => {
  try {
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";
    const { codeVerifier, codeChallenge } = sso.createPkcePair();
    const state = createOAuthTransaction({
      returnTo,
      codeVerifier,
      scope: config.kyrosRequestedScope
    });

    const par = await sso.createPushedAuthorizationRequest({
      redirectUri: `${config.publicBaseUrl}/auth/callback`,
      scope: config.kyrosRequestedScope,
      state,
      codeChallenge
    });
    res.redirect(sso.buildAuthorizeUrl(par.requestUri));
  } catch (error) {
    if (error instanceof sso.SsoError) {
      errorPage(res, error.status, "Connexion impossible", error.message);
      return;
    }
    console.error("[hub] /auth/login", error);
    errorPage(res, 500, "Connexion impossible", "Erreur interne du Hub.");
  }
});

app.get("/auth/callback", async (req, res) => {
  const transaction = consumeOAuthTransaction(req.query.state);
  if (!transaction) {
    errorPage(res, 400, "Connexion refusée", "Transaction invalide ou expirée. Réessayez.");
    return;
  }

  if (req.query.error) {
    errorPage(res, 400, "Connexion refusée", String(req.query.error_description || req.query.error));
    return;
  }

  // Contrôle RFC 9207 : l'issuer retourné doit correspondre à Kyros.
  if (req.query.iss !== config.kyrosIssuer) {
    errorPage(res, 400, "Connexion refusée", "Issuer inattendu (confusion de serveur possible).");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) {
    errorPage(res, 400, "Connexion refusée", "Code d'autorisation manquant.");
    return;
  }

  try {
    const pair = await sso.exchangeAuthorizationCode({
      code,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri
    });
    const claims = await sso.verifyAccessToken(pair.accessToken);

    const token = createSession({
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresAt: Date.now() + pair.expiresInSeconds * 1000,
      claims,
      authTime: claims.auth_time ? claims.auth_time * 1000 : Date.now()
    });
    res.cookie(config.cookieName, token, sessionCookieOptions());
    res.redirect(transaction.returnTo);
  } catch (error) {
    if (error instanceof sso.SsoError) {
      errorPage(res, error.status === 401 ? 400 : error.status, "Connexion refusée", error.message);
      return;
    }
    console.error("[hub] /auth/callback", error);
    errorPage(res, 500, "Connexion impossible", "Erreur interne du Hub.");
  }
});

app.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[config.cookieName];
  const session = getSession(token);
  if (session?.refreshToken) {
    await sso.revokeRefreshToken(session.refreshToken);
  }
  destroySession(token);
  res.clearCookie(config.cookieName, { ...sessionCookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// API Hub (aucun secret côté navigateur)
// ---------------------------------------------------------------------------

app.get("/api/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  const token = req.cookies?.[config.cookieName];
  const session = getSession(token);
  const links = { kyros: config.kyrosBaseUrl };

  if (!session) {
    res.json({ authenticated: false, user: null, authTime: null, links });
    return;
  }

  const claims = session.claims || {};
  res.json({
    authenticated: true,
    user: {
      id: claims.sub,
      username: claims.username || null,
      display_name: claims.display_name || claims.username || null,
      email: claims.email || null,
      avatar_url: claims.picture || claims.avatar_url || null,
      roles: claims.role ? [claims.role] : []
    },
    authTime: session.authTime || null,
    links
  });
});

app.get("/api/me", (req, res) => proxyToKyros(req, res, config.kyrosMeUrl));
app.get("/api/context", (req, res) => proxyToKyros(req, res, config.kyrosContextUrl));
app.get("/api/catalog", (req, res) => proxyToKyros(req, res, config.kyrosCatalogUrl));
app.get("/api/preferences", (req, res) => proxyToKyros(req, res, config.kyrosPreferencesUrl));
app.patch("/api/preferences", (req, res) =>
  proxyToKyros(req, res, config.kyrosPreferencesUrl, { method: "PATCH", body: req.body })
);

app.use("/api", (req, res) => res.status(404).json({ error: "not_found" }));
app.use("/auth", (req, res) => res.status(404).json({ error: "not_found" }));

// SPA : toute route inconnue renvoie l'entrée du Hub.
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  console.log(`LUMA Hub v${version} → http://localhost:${config.port}`);
  console.log(`Kyros ${config.kyrosBaseUrl} · SSO ${config.kyrosSsoVersion} · audience ${config.kyrosResourceAudience}`);
});
