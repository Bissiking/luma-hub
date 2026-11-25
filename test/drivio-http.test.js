import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./support/harness.js";
import { createDrivioFixture } from "./support/drivio-fixture.js";
test("API Hub Drivio : identité Kyros, CSRF, absence de secrets et expiration distincte", async (t) => {
  const fixture = await createDrivioFixture(),
    h = await createHarness({ drivioBaseUrl: fixture.base });
  t.after(async () => {
    await h.close();
    await fixture.close();
  });
  const alice = await h.sessionFor("alice"),
    bob = await h.sessionFor("bob");
  const call = (
    route,
    { cookie = alice.cookie, method = "GET", origin = h.base } = {},
  ) =>
    fetch(h.base + route, {
      method,
      redirect: "manual",
      headers: { cookie, origin },
    });
  await h.drivio.connect("alice", fixture.token);
  const anonymousNavigation = await call("/api/connectors/drivio/authorize", {
    cookie: "",
  });
  assert.equal(anonymousNavigation.status, 303);
  assert.equal(
    anonymousNavigation.headers.get("location"),
    "/#/personnaliser?drivio=failed",
  );
  const status = await call("/api/connectors/drivio");
  assert.equal(status.headers.get("cache-control"), "private, no-store");
  const metadata = await status.json();
  assert.equal(metadata.configured, true);
  assert.ok(!JSON.stringify(metadata).includes(fixture.token));
  assert.equal(
    (await call("/api/connectors/drivio/vehicles", { cookie: "" })).status,
    401,
  );
  assert.equal(
    (await call("/api/connectors/drivio/vehicles", { cookie: bob.cookie }))
      .status,
    424,
  );
  assert.equal(
    (await call("/api/connectors/drivio/vehicles?userId=alice")).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/connectors/drivio/summary?vehicle=car-0&vehicle=foreign-car",
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("/api/connectors/drivio/summary?vehicle=car-0")).status,
    200,
  );
  fixture.controls.status = 401;
  const expired = await call("/api/connectors/drivio/vehicles?refresh=1");
  assert.equal(expired.status, 424);
  assert.equal((await expired.json()).error, "drivio_reconnect_required");
  assert.equal((await (await call("/api/session")).json()).authenticated, true);
  assert.equal(
    (
      await call("/api/connectors/drivio", {
        method: "DELETE",
        origin: "https://foreign.test",
      })
    ).status,
    403,
  );
  assert.equal(h.drivio.status("alice").configured, true);
  await call("/api/connectors/drivio", { method: "DELETE" });
  assert.equal(h.drivio.status("alice").configured, false);
});
