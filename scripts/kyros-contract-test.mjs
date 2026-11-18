// Optionnel : vrai source Kyros, nouvelle base PostgreSQL locale jetable.
// Aucun utilisateur/client du Kyros courant n’est modifié.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fork } from "node:child_process";
const repo = process.env.KYROS_REPO || path.resolve("../kyros");
const require = createRequire(path.join(repo, "package.json"));
const local = (file) => import(pathToFileURL(path.join(repo, file)).href);

if (process.env.LUMA_KYROS_CONTRACT_CHILD !== "1") {
  const env = require("dotenv").parse(fs.readFileSync(path.join(repo, ".env")));
  const url = new URL(env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Base PostgreSQL locale obligatoire.");
  const { Client } = require("pg");
  const admin = new Client({ connectionString: url.href });
  await admin.connect();
  const database = `luma_hub_validation_${Date.now()}`;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    url.pathname = "/" + database;
    let report;
    const child = fork(new URL(import.meta.url), [], {
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: url.href,
        KYROS_REPO: repo,
        LUMA_KYROS_CONTRACT_CHILD: "1",
        NODE_ENV: "test",
        SEED_DEV_USER: "false",
        SSO_V4_ENABLED: "true",
        PUBLIC_BASE_URL: "",
        KYROS_REQUESTED_SCOPE:
          "profile email offline_access hub:read hub:preferences",
        KYROS_REQUIRED_SCOPES: "profile email hub:read",
        KYROS_EDITION: "standard",
        KYROS_APPLICATION_SCOPE: "standard",
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    child.on("message", (value) => {
      report = value;
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Délai de validation Kyros dépassé."));
      }, 120000);
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        code === 0
          ? resolve()
          : reject(
              new Error(report?.error || `Validation Kyros échouée (${code}).`),
            );
      });
    });
    fs.mkdirSync("test/artifacts", { recursive: true });
    fs.writeFileSync(
      "test/artifacts/kyros-real-contract.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (created) await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
    await admin.end();
  }
} else {
  let provider, hub, closeDatabase, workspaceStore;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-real-kyros-"));
  try {
    const kyros = await local("src/app.js");
    ({ closeDatabase } = await local("src/database/db.js"));
    await (await local("src/database/migrate.js")).migrateDatabase();
    const { config: kyrosConfig } = await local("src/core/config.js");
    provider = kyros.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => provider.once("listening", resolve));
    const kyrosBase = `http://127.0.0.1:${provider.address().port}`;
    const { createUser } = await local("src/users/users.repository.js");
    const user = await createUser({
      username: "luma_contract_owner",
      passwordHash: "!",
      role: "user",
    });
    const { createSession } = await local("src/auth/auth.service.js");
    const kyrosSession = await createSession(user, { protocolVersion: "v4" });
    Object.assign(process.env, {
      PUBLIC_BASE_URL: "http://127.0.0.1:4321",
      PORT: "4321",
      KYROS_BASE_URL: kyrosBase,
      KYROS_PAR_URL: kyrosBase + "/par",
      KYROS_AUTHORIZE_URL: kyrosBase + "/authorize",
      KYROS_TOKEN_URL: kyrosBase + "/token",
      KYROS_REVOKE_URL: kyrosBase + "/revoke",
      KYROS_JWKS_URL: kyrosBase + "/sso/v4/jwks",
      KYROS_CLIENT_ID: "temporary",
      KYROS_CLIENT_SECRET: "temporary",
      KYROS_ISSUER: kyrosConfig.jwtIssuer,
      KYROS_AUDIENCE: kyrosConfig.jwtAudience,
      KYROS_RESOURCE_AUDIENCE: "kyros:hub",
      HUB_DB_PATH: path.join(dir, "hub.sqlite"),
    });
    const hubModule = await import("../src/server.js");
    workspaceStore = hubModule.workspaceStore;
    const { config: hubConfig } = await import("../src/config.js");
    hub = hubModule.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => hub.once("listening", resolve));
    const base = `http://localhost:${hub.address().port}`;
    hubConfig.publicBaseUrl = base;
    const { registerApplication } = await local(
      "src/auth-apps/auth-apps.service.js",
    );
    const client = await registerApplication({
      name: "LUMA validation",
      integrationMode: "sso",
      applicationScope: "standard",
      ssoProtocolVersion: "v4",
      tokenAudience: "kyros:hub",
      callbackUrls: [base + "/auth/callback"],
      scopes: [
        "profile",
        "email",
        "offline_access",
        "hub:read",
        "hub:preferences",
      ],
    });
    assert.ok(client.clientId, `Client de test refusé : ${client.error}`);
    hubConfig.kyrosClientId = client.clientId;
    hubConfig.kyrosClientSecret = client.clientSecret;
    const { registerHubApp } = await local("src/hub-apps/hub-apps.service.js");
    const application = await registerHubApp({
      slug: "luma-contract-app",
      name: "Application de recette",
      url: "https://example.test",
      accessPolicy: "open",
    });
    assert.ok(application.app);
    const login = await fetch(base + "/auth/login", { redirect: "manual" });
    assert.equal(login.status, 302, "PAR réel refusé");
    const binding = login.headers.getSetCookie()[0].split(";")[0];
    // Continuation de l’interstitiel Kyros, contrat auth-apps.navigation.js.
    const authorizeUrl = new URL(login.headers.get("location"));
    authorizeUrl.searchParams.set("kyros_auto_continue", "1");
    const auth = await fetch(authorizeUrl, {
      redirect: "manual",
      headers: { cookie: `${kyrosConfig.cookieName}=${kyrosSession}` },
    });
    assert.equal(auth.status, 302, "Autorisation réelle refusée");
    const callbackUrl = auth.headers.get("location");
    assert.ok(
      callbackUrl.startsWith(base + "/auth/callback"),
      `Interaction Kyros requise : ${new URL(callbackUrl, kyrosBase).pathname}`,
    );
    const callback = await fetch(callbackUrl, {
      redirect: "manual",
      headers: { cookie: binding },
    });
    assert.equal(callback.status, 302, "Échange code/PKCE réel refusé");
    const cookie = callback.headers.getSetCookie()[0].split(";")[0];
    const call = (route, method = "GET", body) =>
      fetch(base + route, {
        method,
        headers: { cookie, origin: base, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const session = await (await call("/api/session")).json();
    assert.equal(session.user.id, user.id);
    let response = await call("/api/catalog");
    assert.equal(response.status, 200);
    const catalog = await response.json();
    assert.ok(catalog.apps.some((app) => app.id === application.app.id));
    response = await call("/api/preferences", "PATCH", {
      baseRevision: catalog.revision,
      preferences: { favorites: [application.app.id] },
    });
    assert.equal(response.status, 200);
    const conflict = await call("/api/preferences", "PATCH", {
      baseRevision: catalog.revision,
      preferences: { favorites: [] },
    });
    assert.equal(conflict.status, 409);
    const current = await (await call("/api/catalog")).json();
    assert.deepEqual(current.preferences.favorites, [application.app.id]);
    const context = await (await call("/api/context")).json();
    assert.equal(context.context.type, "personal");
    const initial = await (await call("/api/workspace/personal")).json();
    assert.equal(initial.revision, 0);
    assert.equal(
      (
        await call("/api/workspace/personal", "PUT", {
          baseRevision: 0,
          workspace: initial.workspace,
        })
      ).status,
      200,
    );
    const { getSession, touchSession } = await import("../src/session.js");
    const token = cookie.split("=")[1],
      before = getSession(token).refreshToken;
    touchSession(token, { accessExpiresAt: Date.now() });
    assert.equal((await call("/api/catalog")).status, 200);
    assert.notEqual(getSession(token).refreshToken, before);
    assert.equal((await call("/auth/logout", "POST")).status, 200);
    assert.equal(getSession(token), null);
    process.send?.({
      passed: true,
      provider: "Code Kyros local réel, PostgreSQL jetable et serveur Hub réel",
      checks: [
        "Migrations Kyros sur nouvelle base",
        "PAR SSO v4",
        "Session Kyros de test isolée puis authorize",
        "Code + PKCE S256 + JWT RS256/JWKS",
        "Catalogue autorisé",
        "Favoris et conflit 409",
        "Contexte personnel",
        "SQLite Hub lié à identité /api/me",
        "Refresh rotatif",
        "Révocation et déconnexion",
      ],
      limits: [
        "Connexion par mot de passe/MFA dans le navigateur non testée",
        "Client et comptes Kyros courants inchangés",
        "Aucune validation de production ou appareil physique",
      ],
    });
  } catch (error) {
    process.send?.({
      passed: false,
      error: String(error.message).slice(0, 500),
    });
    process.exitCode = 1;
  } finally {
    for (const server of [hub, provider])
      if (server)
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        });
    workspaceStore?.close();
    if (closeDatabase) await closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(process.exitCode || 0);
}
