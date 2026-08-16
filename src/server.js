// src/server.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config, validateConfig } from "./config.js";
import { buildAuthorizeUrl, exchangeAuthorizationCode, fetchUserApps } from "./kyros.js";
import {
  consumeOAuthState,
  createOAuthState,
  createSession,
  destroySession,
  getSession,
  sessionCookieOptions
} from "./session.js";

validateConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const cookieName = "luma_hub_session";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function currentSession(req) {
  return getSession(req.cookies[cookieName]);
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "luma-hub", version: "0.1.0-dev.1" });
});

app.get("/auth/login", (req, res) => {
  if (!config.kyrosClientId || !config.kyrosClientSecret) {
    return res.status(503).send("LUMA Hub n'est pas encore enregistré comme client Kyros.");
  }
  const state = createOAuthState(typeof req.query.returnTo === "string" ? req.query.returnTo : "/");
  return res.redirect(buildAuthorizeUrl(state));
});

app.get("/auth/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const stateRecord = consumeOAuthState(state);

  if (!code || !stateRecord) {
    return res.status(400).send("Callback Kyros invalide ou expiré.");
  }

  try {
    const tokenSet = await exchangeAuthorizationCode(code);
    const sessionToken = createSession({
      user: tokenSet.user,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token || null
    });
    res.cookie(cookieName, sessionToken, sessionCookieOptions());
    return res.redirect(stateRecord.returnTo);
  } catch (error) {
    console.error("[auth] Kyros callback failed", error);
    return res.status(502).send("Impossible de terminer la connexion Kyros.");
  }
});

app.post("/auth/logout", (req, res) => {
  destroySession(req.cookies[cookieName]);
  res.clearCookie(cookieName, sessionCookieOptions());
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const session = currentSession(req);
  res.set("Cache-Control", "no-store");
  res.json({ authenticated: Boolean(session), user: session?.user || null });
});

app.get("/api/apps", async (req, res) => {
  const session = currentSession(req);
  res.set("Cache-Control", "no-store");
  if (!session) return res.status(401).json({ message: "Authentication required", apps: [] });

  try {
    const result = await fetchUserApps(session.accessToken);
    return res.status(result.unavailable ? 503 : 200).json(result);
  } catch (error) {
    console.error("[apps] Kyros unavailable", error);
    return res.status(502).json({ apps: [], unavailable: true, reason: "kyros_unavailable" });
  }
});

app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(config.port, () => {
  console.log(`[luma-hub] http://localhost:${config.port}`);
});
