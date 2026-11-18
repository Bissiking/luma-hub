// Fournisseur synthétique isolé : jamais un compte, client ou secret Kyros réel.
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

export async function createHarness({ drivioBaseUrl = "" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-http-validation-"));
  const provider = express();
  provider.use(express.json());
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  const transactions = new Map(),
    codes = new Map(),
    access = new Map(),
    refresh = new Map();
  const controls = {
    meStatus: 200,
    catalogStatus: 200,
    refreshStatus: 200,
    refreshCalls: 0,
    identityOverride: null,
    refreshSubject: null,
    callbackIssuer: "kyros",
    preferenceConflict: false,
    logoType: "image/png",
  };
  const userPreferences = new Map();
  const defaultPreferences = () => ({
    favorites: ["hub_braindump", "hub_drivio", "hub_nino", "hub_harmonix"],
    pinned: [],
    hidden: [],
    order: [],
    display: {
      layout: "grid",
      density: "comfortable",
      theme: "system",
      showDescriptions: true,
    },
  });
  const apps = ["BrainDump", "Drivio", "Nino", "Harmonix", "Kyros"].map(
    (name, i) => ({
      id: `hub_${name.toLowerCase()}`,
      slug: name.toLowerCase(),
      name,
      description: [
        "Notes, tâches et rappels",
        "Véhicules et entretiens",
        "Vos vidéos",
        "Votre musique",
        "Identité et accès",
      ][i],
      url: `https://${name.toLowerCase()}.example.test/`,
      category: i > 1 && i < 4 ? "media" : "tools",
      logoUrl: null,
      brandPrimaryColor: i % 2 ? "#966023" : "#174f51",
      defaultOrder: i,
    }),
  );
  function prefs(id) {
    if (!userPreferences.has(id))
      userPreferences.set(id, {
        revision: 0,
        preferences: defaultPreferences(),
      });
    return userPreferences.get(id);
  }
  async function pair(id) {
    const accessToken = await new SignJWT({
      client_id: "fixture-client",
      resource_aud: "kyros:hub",
      scope: "profile email hub:read hub:preferences",
      username: id,
      display_name: "Camille",
      email: `${id}@example.test`,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject(id)
      .setIssuer("kyros")
      .setAudience("kyros-modules")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const refreshToken = crypto.randomUUID();
    access.set(accessToken, id);
    refresh.set(refreshToken, id);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 300,
    };
  }
  provider.get("/sso/v4/jwks", (req, res) => res.json({ keys: [jwk] }));
  provider.post("/par", (req, res) => {
    if (
      req.body.client_id !== "fixture-client" ||
      req.body.client_secret !== "fixture-secret" ||
      req.body.kyros_sso_version !== "v4" ||
      req.body.code_challenge_method !== "S256"
    )
      return res.status(400).json({ error: "invalid_request" });
    const requestUri = `urn:fixture:${crypto.randomUUID()}`;
    transactions.set(requestUri, req.body);
    res.json({ request_uri: requestUri, expires_in: 90 });
  });
  provider.get("/authorize", (req, res) => {
    const txn = transactions.get(req.query.request_uri);
    if (!txn) return res.sendStatus(400);
    const code = crypto.randomUUID();
    codes.set(code, txn);
    const url = new URL(txn.redirect_uri);
    url.searchParams.set("code", code);
    url.searchParams.set("state", txn.state);
    url.searchParams.set("iss", controls.callbackIssuer);
    res.redirect(url.href);
  });
  provider.post("/token", async (req, res) => {
    if (req.body.grant_type === "refresh_token") {
      controls.refreshCalls++;
      if (controls.refreshStatus !== 200)
        return res.status(controls.refreshStatus).json({
          error:
            controls.refreshStatus >= 500
              ? "temporarily_unavailable"
              : "invalid_grant",
        });
      const id = refresh.get(req.body.refresh_token);
      refresh.delete(req.body.refresh_token);
      if (!id) return res.status(400).json({ error: "invalid_grant" });
      return res.json(await pair(controls.refreshSubject || id));
    }
    const txn = codes.get(req.body.code);
    codes.delete(req.body.code);
    if (
      !txn ||
      txn.code_challenge !==
        crypto
          .createHash("sha256")
          .update(req.body.code_verifier || "")
          .digest("base64url") ||
      txn.redirect_uri !== req.body.redirect_uri
    )
      return res.status(400).json({ error: "invalid_grant" });
    res.json(await pair("qa-owner"));
  });
  provider.post("/revoke", (req, res) => {
    refresh.delete(req.body.refresh_token);
    res.json({ ok: true });
  });
  provider.use("/api", (req, res, next) => {
    req.userId = access.get(req.get("authorization")?.replace(/^Bearer /, ""));
    if (!req.userId)
      return res.status(401).json({ error: "authentication_required" });
    next();
  });
  provider.get("/api/me", (req, res) =>
    controls.meStatus === 200
      ? res.json({ id: controls.identityOverride || req.userId })
      : res.status(controls.meStatus).json({ error: "unavailable" }),
  );
  provider.get("/api/apps/me", (req, res) =>
    res.json({ apps, context: { type: "personal", memberships: [] } }),
  );
  provider.get("/api/hub/v1/apps/:id/logo", (req, res) =>
    res
      .type(controls.logoType)
      .send(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      ),
  );
  provider.get("/api/hub/v1/catalog", (req, res) =>
    controls.catalogStatus === 200
      ? res.json({ schemaVersion: 1, ...prefs(req.userId), apps })
      : res.status(controls.catalogStatus).json({ error: "unavailable" }),
  );
  provider.patch("/api/hub/v1/preferences", (req, res) => {
    const current = prefs(req.userId);
    if (
      controls.preferenceConflict ||
      current.revision !== req.body.baseRevision
    )
      return res.status(409).json({ error: "revision_conflict" });
    current.preferences = { ...current.preferences, ...req.body.preferences };
    current.revision++;
    res.json({ schemaVersion: 1, ...current });
  });
  const upstream = provider.listen(0, "127.0.0.1");
  await new Promise((resolve) => upstream.once("listening", resolve));
  const kyrosBase = `http://127.0.0.1:${upstream.address().port}`;
  Object.assign(process.env, {
    NODE_ENV: "test",
    PORT: "4321",
    PUBLIC_BASE_URL: "http://127.0.0.1:4321",
    KYROS_BASE_URL: kyrosBase,
    KYROS_CLIENT_ID: "fixture-client",
    KYROS_CLIENT_SECRET: "fixture-secret",
    KYROS_ISSUER: "kyros",
    KYROS_AUDIENCE: "kyros-modules",
    KYROS_RESOURCE_AUDIENCE: "kyros:hub",
    KYROS_PAR_URL: `${kyrosBase}/par`,
    KYROS_AUTHORIZE_URL: `${kyrosBase}/authorize`,
    KYROS_TOKEN_URL: `${kyrosBase}/token`,
    KYROS_REVOKE_URL: `${kyrosBase}/revoke`,
    KYROS_JWKS_URL: `${kyrosBase}/sso/v4/jwks`,
    KYROS_TIMEOUT_SECONDS: "1",
    HUB_DB_PATH: path.join(dir, "hub.sqlite"),
    HUB_CONNECTOR_KEY_PATH: path.join(dir, "connectors.key"),
    DRIVIO_BASE_URL: drivioBaseUrl,
    DOTENV_CONFIG_PATH: path.join(dir, "absent.env"),
  });
  const { app, workspaceStore, drivioConnector } =
    await import("../../src/server.js");
  const { config } = await import("../../src/config.js");
  const { createSession } = await import("../../src/session.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  config.publicBaseUrl = base;
  return {
    base,
    kyrosBase,
    controls,
    apps,
    store: workspaceStore,
    drivio: drivioConnector,
    keyPath: path.join(dir, "connectors.key"),
    async sessionFor(id, options = {}) {
      const tokens = await pair(id);
      const { decodeJwt } = await import("jose");
      const token = createSession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessExpiresAt: Date.now() + 300000,
        claims: decodeJwt(tokens.access_token),
        authTime: Date.now(),
        ...options,
      });
      return { cookie: `luma_hub_session=${token}`, token };
    },
    async close() {
      await Promise.all(
        [server, upstream].map(
          (s) =>
            new Promise((resolve) => {
              s.close(resolve);
              s.closeAllConnections();
            }),
        ),
      );
      workspaceStore.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
