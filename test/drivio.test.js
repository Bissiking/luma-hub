import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { openWorkspaceStore } from "../src/workspace/repository.js";
import {
  createDrivioConnector,
  drivioBaseUrl,
} from "../src/connectors/drivio.js";
import {
  sealToken,
  openToken,
  readConnectorKey,
} from "../src/connectors/secrets.js";
import { createDrivioAuthorization } from "../src/connectors/drivio-authorization.js";
import { createDrivioFixture } from "./support/drivio-fixture.js";

test("Secrets connecteur : chiffrement authentifié, fichier privé et isolation des propriétaires", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-secrets-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "secret.key"),
    key = readConnectorKey(file, { create: true }),
    token = "drv_app_" + "x".repeat(43);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const value = sealToken(token, "alice", key);
  assert.ok(!value.includes(token));
  assert.equal(openToken(value, "alice", key), token);
  assert.throws(() => openToken(value, "bob", key));
  assert.throws(() => openToken(value, "alice", crypto.randomBytes(32)));
  assert.throws(() => openToken(value.slice(0, -5) + "AAAAA", "alice", key));
  fs.chmodSync(file, 0o644);
  assert.throws(() => readConnectorKey(file));
});
test("Origine Drivio fixée côté serveur, sans redirection ni URL fournie par un widget", () => {
  assert.equal(drivioBaseUrl("http://localhost:3002"), "http://localhost:3002");
  assert.equal(
    drivioBaseUrl("https://drivio.example.test", true),
    "https://drivio.example.test",
  );
  for (const value of [
    "http://private.internal",
    "https://user:secret@example.test",
    "https://example.test/path",
    "https://example.test?x=1",
    "file:///etc/passwd",
    "https://example.test/#x",
  ])
    assert.throws(() => drivioBaseUrl(value));
  assert.throws(() => drivioBaseUrl("http://localhost:3002", true));
});
test("Connecteur Drivio : projection, pagination, cache, révocation et comptes séparés", async (t) => {
  const fixture = await createDrivioFixture({ count: 52 });
  t.after(() => fixture.close());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-drivio-")),
    store = openWorkspaceStore(path.join(dir, "hub.sqlite"));
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const client = createDrivioConnector({
    store,
    baseUrl: fixture.base,
    keyPath: path.join(dir, "key"),
  });
  await assert.rejects(client.vehicles("bob"), {
    code: "drivio_not_connected",
  });
  await client.connect("alice", fixture.token);
  assert.ok(!JSON.stringify(client.status("alice")).includes(fixture.token));
  assert.ok(!store.connection("alice").sealedToken.includes(fixture.token));
  fixture.controls.delay = 30;
  const before = fixture.controls.requests.length;
  const pages = await Promise.all(
    Array.from({ length: 8 }, () => client.vehicles("alice")),
  );
  assert.equal(fixture.controls.requests.length - before, 1);
  assert.equal(pages[0].data.vehicles.length, 50);
  assert.equal(pages[0].data.nextOffset, 50);
  assert.equal(
    (await client.vehicles("alice", { offset: 50 })).data.vehicles.length,
    2,
  );
  assert.throws(() => client.vehicles("alice", { offset: -1 }), {
    code: "invalid_query",
  });
  assert.ok(!JSON.stringify(pages[0]).includes("PRIVATE-VIN-CANARY"));
  const result = await client.summary("alice", { vehicleId: "car-0" });
  assert.equal(result.data.expenses.month.total, 40);
  assert.equal(result.data.fuel.consumptionPer100Km, null);
  assert.ok(!JSON.stringify(result).includes("PRIVATE-NOTE-CANARY"));
  assert.ok(!JSON.stringify(result).includes("NEVER-FORWARD-CANARY"));
  await client.connect("bob", fixture.otherToken);
  assert.equal(
    (await client.vehicles("bob")).data.vehicles[0].id,
    "foreign-car",
  );
  await assert.rejects(client.summary("bob", { vehicleId: "car-0" }), {
    code: "drivio_vehicle_unavailable",
  });
  fixture.controls.status = 401;
  await assert.rejects(client.vehicles("alice", { force: true }), {
    code: "drivio_reconnect_required",
    status: 424,
  });
  await assert.rejects(client.summary("alice", { vehicleId: "car-0" }), {
    code: "drivio_reconnect_required",
  });
  fixture.controls.status = 200;
  await client.disconnect("alice");
  assert.equal(store.connection("alice"), null);
  assert.equal(client.status("bob").configured, true);
  await client.connect("alice", fixture.token);
  fixture.controls.redirect = true;
  await assert.rejects(client.vehicles("alice", { force: true }), {
    code: "drivio_unavailable",
  });
  fixture.controls.redirect = false;
  fixture.controls.invalid = true;
  await assert.rejects(client.vehicles("alice", { force: true }), {
    code: "drivio_invalid_response",
  });
  fixture.controls.invalid = false;
  const originalKey = fs.readFileSync(path.join(dir, "key"));
  fs.unlinkSync(path.join(dir, "key"));
  await assert.rejects(client.connect("new-user", fixture.otherToken));
  assert.equal(fs.existsSync(path.join(dir, "key")), false);
  fs.writeFileSync(path.join(dir, "key"), originalKey, { mode: 0o600 });
  store.saveConnection("alice", {
    ...store.connection("alice"),
    sealedToken: "tampered",
  });
  await assert.rejects(client.vehicles("alice"), {
    code: "drivio_secret_unavailable",
  });
});
test("Consentement Hub : PKCE, état lié à la session, annulation et consommation unique", async () => {
  let accepted;
  const flow = createDrivioAuthorization({
    connector: {
      status: () => ({
        available: true,
        baseUrl: "https://drivio.example.test",
      }),
      authorize: async (user, data) => {
        accepted = { user, ...data };
      },
    },
    getPublicBaseUrl: () => "https://hub.example.test",
    cookieName: "session",
  });
  const url = new URL(flow.start("alice", "session-a")),
    params = url.searchParams;
  assert.equal(
    params.get("redirect_uri"),
    "https://hub.example.test/api/connectors/drivio/callback",
  );
  assert.equal(params.get("code_challenge_method"), "S256");
  const reply = new URLSearchParams({
    state: params.get("state"),
    code: "c".repeat(43),
  });
  await assert.rejects(flow.complete("alice", "session-b", reply));
  await assert.rejects(flow.complete("bob", "session-a", reply));
  assert.equal(await flow.complete("alice", "session-a", reply), "connected");
  assert.equal(accepted.user, "alice");
  assert.equal(
    crypto.createHash("sha256").update(accepted.verifier).digest("base64url"),
    params.get("code_challenge"),
  );
  await assert.rejects(flow.complete("alice", "session-a", reply));
  const other = new URL(flow.start("alice", "session-a"));
  assert.equal(
    await flow.complete(
      "alice",
      "session-a",
      new URLSearchParams({
        state: other.searchParams.get("state"),
        error: "access_denied",
      }),
    ),
    "cancelled",
  );
});
