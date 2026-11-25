import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./support/harness.js";
import { createWorkspace } from "../src/public/js/workspace/model.js";

test("HTTP, authentification, révisions, révocation et isolation avec fournisseur synthétique", async (t) => {
  const h = await createHarness();
  t.after(() => h.close());
  const a = await h.sessionFor("alice"),
    b = await h.sessionFor("bob");
  const call = (
    route,
    { cookie = a.cookie, method = "GET", body, origin = h.base } = {},
  ) =>
    fetch(h.base + route, {
      method,
      redirect: "manual",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method === "GET"
          ? {}
          : { origin, "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  await t.test(
    "session requise, no-store et refus des identités étrangères",
    async () => {
      assert.equal(
        (await call("/api/workspace/personal", { cookie: "" })).status,
        401,
      );
      const initial = await call("/api/workspace/personal");
      assert.equal(initial.status, 200);
      assert.equal(initial.headers.get("cache-control"), "no-store");
      assert.equal((await initial.json()).revision, 0);
      assert.equal((await call("/api/workspace/foreign")).status, 403);
      h.controls.identityOverride = "bob";
      assert.equal((await call("/api/workspace/personal")).status, 401);
      h.controls.identityOverride = null;
    },
  );
  const owner = await h.sessionFor("alice");
  a.cookie = owner.cookie;
  await t.test(
    "CSRF, validation et absence de sélecteur de propriétaire",
    async () => {
      const body = { baseRevision: 0, workspace: createWorkspace() };
      assert.equal(
        (
          await call("/api/workspace/personal", {
            method: "PUT",
            body,
            origin: "https://foreign.test",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await call("/api/workspace/personal", {
            method: "PUT",
            body: { ...body, userId: "bob" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/api/workspace/personal", {
            method: "PUT",
            body: { ...body, baseRevision: "0" },
          })
        ).status,
        400,
      );
      assert.equal(
        (await call("/api/workspace/personal", { method: "PUT", body })).status,
        200,
      );
      assert.equal(
        (await call("/api/workspace/personal", { method: "PUT", body })).status,
        409,
      );
      assert.equal(
        (
          await (
            await call("/api/workspace/personal", { cookie: b.cookie })
          ).json()
        ).revision,
        0,
      );
    },
  );
  await t.test(
    "écriture groupée atomique, widgets et limites HTTP",
    async () => {
      const data = createWorkspace();
      data.compositions.mobile = "immersive";
      data.widgets[1].config.timezone = "Asia/Tokyo";
      assert.equal(
        (
          await call("/api/workspace/personal", {
            method: "PUT",
            body: { baseRevision: 1, workspace: data },
          })
        ).status,
        200,
      );
      const result = await (await call("/api/workspace/personal")).json();
      assert.equal(result.revision, 2);
      assert.equal(result.workspace.compositions.mobile, "immersive");
      const huge = await call("/api/workspace/personal", {
        method: "PUT",
        body: { value: "x".repeat(100000) },
      });
      assert.equal(huge.status, 413);
      assert.equal(
        (await (await call("/api/workspace/personal")).json()).revision,
        2,
      );
    },
  );
  await t.test(
    "renouvellement rotatif sérialisé entre requêtes concurrentes",
    async () => {
      const entry = await h.sessionFor("refresh-owner", {
        accessExpiresAt: Date.now(),
      });
      const before = h.controls.refreshCalls;
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          call("/api/workspace/personal", { cookie: entry.cookie }),
        ),
      );
      assert.deepEqual(
        results.map((r) => r.status),
        [200, 200, 200, 200, 200],
      );
      assert.equal(h.controls.refreshCalls - before, 1);
    },
  );
  await t.test(
    "erreur temporaire : aucune perte ; révocation : session détruite",
    async () => {
      const entry = await h.sessionFor("transient", {
        accessExpiresAt: Date.now(),
      });
      h.controls.refreshStatus = 503;
      assert.equal(
        (await call("/api/workspace/personal", { cookie: entry.cookie }))
          .status,
        503,
      );
      h.controls.refreshStatus = 200;
      assert.equal(
        (await call("/api/workspace/personal", { cookie: entry.cookie }))
          .status,
        200,
      );
      const revoked = await h.sessionFor("revoked", {
        accessExpiresAt: Date.now(),
      });
      h.controls.refreshStatus = 400;
      assert.equal(
        (await call("/api/workspace/personal", { cookie: revoked.cookie }))
          .status,
        401,
      );
      h.controls.refreshStatus = 200;
      assert.equal(
        (await call("/api/workspace/personal", { cookie: revoked.cookie }))
          .status,
        401,
      );
    },
  );
  await t.test("un refresh qui change de sujet est refusé", async () => {
    const entry = await h.sessionFor("original", {
      accessExpiresAt: Date.now(),
    });
    h.controls.refreshSubject = "foreign";
    assert.equal(
      (await call("/api/workspace/personal", { cookie: entry.cookie })).status,
      401,
    );
    h.controls.refreshSubject = null;
  });
  await t.test(
    "SSO PAR → autorisation → PKCE → JWT → session puis logout",
    async () => {
      const par = await fetch(
        h.base + "/auth/login?returnTo=%2F%23%2Ffavoris",
        { redirect: "manual" },
      );
      assert.equal(par.status, 302);
      const binding = par.headers.getSetCookie()[0].split(";")[0];
      const authorization = await fetch(par.headers.get("location"), {
        redirect: "manual",
      });
      assert.equal(authorization.status, 302);
      const callback = authorization.headers.get("location");
      assert.equal((await fetch(callback, { redirect: "manual" })).status, 400);
      const result = await fetch(callback, {
        redirect: "manual",
        headers: { cookie: binding },
      });
      assert.equal(result.status, 302);
      assert.equal(result.headers.get("location"), "/#/favoris");
      const cookie = result.headers.getSetCookie()[0].split(";")[0];
      assert.match(result.headers.get("set-cookie"), /HttpOnly/);
      assert.match(result.headers.get("set-cookie"), /SameSite=Lax/);
      const session = await (await call("/api/session", { cookie })).json();
      assert.equal(session.user.id, "qa-owner");
      assert.equal("accessToken" in session, false);
      assert.equal(
        (
          await fetch(callback, {
            redirect: "manual",
            headers: { cookie: binding },
          })
        ).status,
        400,
      );
      assert.equal(
        (await call("/auth/logout", { cookie, method: "POST" })).status,
        200,
      );
      assert.equal(
        (await (await call("/api/session", { cookie })).json()).authenticated,
        false,
      );
    },
  );
  await t.test(
    "catalogue et favoris restent côté fournisseur ; conflits non écrasés",
    async () => {
      const catalog = await (await call("/api/catalog")).json();
      assert.equal(catalog.apps.length, 5);
      assert.equal(
        (
          await call("/api/preferences", {
            method: "PATCH",
            body: { baseRevision: 0, preferences: { favorites: ["hub_nino"] } },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call("/api/preferences", {
            method: "PATCH",
            body: { baseRevision: 0, preferences: { favorites: [] } },
          })
        ).status,
        409,
      );
      assert.deepEqual(
        (await (await call("/api/catalog")).json()).preferences.favorites,
        ["hub_nino"],
      );
      assert.equal(
        (await (await call("/api/workspace/personal")).json()).revision,
        2,
      );
    },
  );
  await t.test(
    "CSP et fichiers publics : pas de données privées ni jetons",
    async () => {
      const response = await fetch(h.base);
      assert.match(
        response.headers.get("content-security-policy"),
        /script-src 'self'/,
      );
      assert.match(
        response.headers.get("content-security-policy"),
        /frame-ancestors 'none'/,
      );
      assert.equal((await fetch(h.base + "/manifest.webmanifest")).status, 200);
      const html = await response.text();
      const version = (await (await fetch(h.base + "/health")).json()).version;
      assert.ok(html.includes(`src="/assets/${version}/boot.js"`));
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(
        (await fetch(h.base + "/assets/old-release/app.js")).status,
        404,
      );
      assert.equal(
        (await fetch(h.base + `/assets/${version}/app.js`)).headers.get(
          "cache-control",
        ),
        "no-store",
      );
      const logo = await call("/api/apps/hub_nino/logo");
      assert.equal(logo.status, 200);
      assert.equal(logo.headers.get("content-type"), "image/png");
      h.controls.logoType = "image/svg+xml";
      assert.equal((await call("/api/apps/hub_nino/logo")).status, 502);
      h.controls.logoType = "image/png";
      assert.equal((await call("/api/spaces")).status, 200);
      assert.equal(
        (await (await call("/api/spaces")).json()).enterprise.available,
        false,
      );
    },
  );
});
