// Vrais Hub et Drivio, bases et sessions synthétiques jetables ; Kyros simulé.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { createHarness } from "../test/support/harness.js";
const drivio = path.resolve(process.env.DRIVIO_REPO || "../Drivio");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "luma-drivio-browser-"));
const out = path.resolve(".impeccable/review/drivio");
fs.mkdirSync(out, { recursive: true });
const seedOutput = path.join(scratch, "seed.json");
const env = {
  ...process.env,
  NODE_ENV: "development",
  SESSION_SECRET: "local-consent-recipe-session-secret-32-characters",
  HUB_FIXTURE_OUTPUT: seedOutput,
};
const seeded = spawnSync(
  process.execPath,
  [
    path.join(drivio, "node_modules/tsx/dist/cli.mjs"),
    "--tsconfig",
    path.join(drivio, "tsconfig.json"),
    path.join(drivio, "scripts/hub-consent-fixture.ts"),
  ],
  { cwd: drivio, env, encoding: "utf8" },
);
if (seeded.status) throw new Error(seeded.stderr);
const seed = JSON.parse(fs.readFileSync(seedOutput, "utf8"));
const reserve = net.createServer();
await new Promise((r) => reserve.listen(0, "127.0.0.1", r));
const port = reserve.address().port;
await new Promise((r) => reserve.close(r));
const drivioBase = `http://127.0.0.1:${port}`,
  h = await createHarness({ drivioBaseUrl: drivioBase });
// Copie de sources sans .env, bases privées, .git ou serveur .next partagé.
const app = path.join(scratch, "app");
fs.mkdirSync(app);
for (const name of [
  "src",
  "public",
  "prisma",
  "package.json",
  "tsconfig.json",
  "next-env.d.ts",
  "next.config.ts",
  "postcss.config.mjs",
])
  if (fs.existsSync(path.join(drivio, name)))
    fs.cpSync(path.join(drivio, name), path.join(app, name), {
      recursive: true,
      filter: (source) =>
        !source.endsWith(".db") &&
        !source.endsWith(".db-wal") &&
        !source.endsWith(".db-shm"),
    });
fs.symlinkSync(
  path.join(drivio, "node_modules"),
  path.join(app, "node_modules"),
  "dir",
);
const log = fs.openSync(path.join(scratch, "next.log"), "w");
const next = spawn(
  process.execPath,
  [
    path.join(drivio, "node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: app,
    env: {
      ...env,
      DATABASE_URL: `file:${seed.directory}/test.db`,
      NEXT_PUBLIC_APP_URL: drivioBase,
      LUMA_HUB_URL: h.base,
    },
    stdio: ["ignore", log, log],
  },
);
let browser;
const passed = [],
  errors = [],
  browserRequests = [];
try {
  for (let n = 0; n < 90; n++) {
    try {
      if ((await fetch(drivioBase + "/hub/authorize")).ok) break;
    } catch {}
    if (next.exitCode !== null)
      throw new Error(
        "Next stopped: " +
          fs.readFileSync(path.join(scratch, "next.log"), "utf8"),
      );
    if (n === 89) throw new Error("Drivio startup timeout");
    await new Promise((r) => setTimeout(r, 1000));
  }
  const cache = path.join(os.homedir(), ".cache/puppeteer/chrome");
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ...fs
      .readdirSync(cache)
      .sort()
      .reverse()
      .map((n) =>
        path.join(
          cache,
          n,
          "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        ),
      ),
  ];
  browser = await puppeteer.launch({
    executablePath: candidates.find((f) => f && fs.existsSync(f)),
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => browserRequests.push(r.url()));
  await browser.setCookie({
    name: "drivio_session",
    value: seed.sessions["qa-owner"],
    url: drivioBase,
    httpOnly: true,
    sameSite: "Lax",
  });
  await page.goto(h.base + "/auth/login");
  await page.waitForSelector("[data-widget]");
  const settings = async () => {
    await page.goto(h.base + "/#/personnaliser");
    await page.waitForSelector('a[href="/api/connectors/drivio/authorize"]');
  };
  await settings();
  await page.locator('a[href="/api/connectors/drivio/authorize"]').click();
  await page.waitForSelector("[name=vehicle]");
  await page.waitForNetworkIdle();
  assert.ok(page.url().startsWith(drivioBase + "/hub/authorize?"));
  await page.locator("[name=vehicle][value=car-a]").click();
  await page.waitForFunction(
    () => document.querySelector("button[value=allow]").disabled,
  );
  await page.locator("[name=vehicle][value=car-b]").click();
  const consentUrl = page.url();
  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(out, `consent-${width}.png`),
      fullPage: true,
    });
  }
  await page.locator("button[value=allow]").click();
  await page.waitForFunction(() => location.hash.includes("drivio="), {
    timeout: 30000,
  });
  assert.ok(
    page.url().includes("drivio=connected"),
    "Callback failed: " + page.url(),
  );
  await page.waitForSelector("[data-add-drivio-widget]");
  passed.push(
    "Consentement réel Drivio → code PKCE → Hub ; sélection car-b uniquement, aucun jeton saisi",
  );
  const api = (route) =>
    page.evaluate(async (route) => {
      const r = await fetch(route);
      return { status: r.status, body: await r.json() };
    }, route);
  assert.deepEqual(
    (await api("/api/connectors/drivio/vehicles")).body.data.vehicles.map(
      (v) => v.id,
    ),
    ["car-b"],
  );
  assert.equal(
    (await api("/api/connectors/drivio/summary?vehicle=car-a")).status,
    404,
  );
  assert.equal(
    (await api("/api/connectors/drivio/summary?vehicle=foreign")).status,
    404,
  );
  assert.equal(
    (await api("/api/connectors/drivio/summary?vehicle=car-b")).status,
    200,
  );
  assert.ok(!browserRequests.some((url) => url.includes("/api/hub/token")));
  const secretLeak = await page.evaluate(() =>
    JSON.stringify({
      html: document.documentElement.outerHTML,
      local: localStorage,
      session: sessionStorage,
    }),
  );
  assert.ok(!/drv_(app|hub)_[A-Za-z0-9_-]{43}/.test(secretLeak));
  passed.push(
    "Véhicules exclus et tiers refusés en 404 ; échange et jeton absents du navigateur",
  );
  await page.locator("[data-add-drivio-widget]").click();
  await page.waitForSelector(".drivio-vehicle-heading");
  assert.match(
    await page.$eval(".drivio-vehicle-heading", (e) => e.textContent),
    /Peugeot 208/,
  );
  await page.waitForFunction(async () => {
    const p = document.querySelector('meta[name="luma-asset-prefix"]').content;
    return (
      (await import(p + "/js/workspace/store.js")).workspace.status === "saved"
    );
  });
  for (const theme of ["light", "dark"]) {
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: theme },
    ]);
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      await page.waitForFunction(
        (width) =>
          document.querySelector(
            width <= 700 ? ".workspace-mobile" : ".workspace-desktop",
          ),
        {},
        width,
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.evaluate(() => {
        document
          .querySelector("details.widget-drivio")
          ?.setAttribute("open", "");
        document.getElementById("toastHost")?.replaceChildren();
        window.scrollTo(0, 0);
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const clip = await page.$eval(".widget-drivio", (element) => {
        const r = element.getBoundingClientRect();
        return {
          x: r.x + scrollX,
          y: r.y + scrollY,
          width: r.width,
          height: r.height,
        };
      });
      await page.screenshot({
        clip,
        captureBeyondViewport: true,
        path: path.join(out, `detail-${theme}-${width}.png`),
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(out, `widget-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  passed.push(
    "Widget alimenté par les vraies routes Drivio ; 320/390/1440 px, thèmes système clair et sombre",
  );
  // Annuler ne remplace pas l'accès existant.
  await settings();
  await page.locator('a[href="/api/connectors/drivio/authorize"]').click();
  await page.waitForSelector("[name=vehicle]");
  assert.equal(
    await page.$eval("[name=vehicle][value=car-b]", (e) => e.checked),
    true,
  );
  assert.equal(
    await page.$eval("[name=vehicle][value=car-a]", (e) => e.checked),
    false,
  );
  await page.locator("button[value=deny]").click();
  await page.waitForFunction(() => location.hash.includes("drivio=cancelled"));
  assert.equal((await api("/api/connectors/drivio")).body.configured, true);
  passed.push("Annulation sans suppression de l’autorisation déjà accordée");
  await page.goto(drivioBase + "/parametres");
  await page.waitForSelector("button");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (e) => e.textContent === "Retirer l’accès",
      ),
    { timeout: 60000 },
  );
  await page.setViewport({ width: 390, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(out, "applications-390.png"),
    fullPage: true,
  });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((e) => e.textContent === "Retirer l’accès")
      .click(),
  );
  await page.waitForFunction(() =>
    document.body.textContent.includes("Aucune application autorisée."),
  );
  await settings();
  await page.locator("[data-drivio-refresh]").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".drivio-settings")
      ?.textContent.includes("Reconnectez Drivio"),
  );
  assert.equal((await api("/api/session")).body.authenticated, true);
  assert.equal(
    (await api("/api/connectors/drivio/vehicles?refresh=1")).status,
    424,
  );
  passed.push(
    "Révocation depuis les paramètres Drivio effective au rafraîchissement ; session Kyros du Hub conservée",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        source:
          "Vrais Hub + Next Drivio, SQLite et comptes synthétiques isolés, Kyros simulé",
        passed,
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed, browserErrors: errors }, null, 2));
} catch (error) {
  console.error("Recipe failed:", error.message);
  console.error(
    fs.readFileSync(path.join(scratch, "next.log"), "utf8").slice(-7000),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  next.kill("SIGTERM");
  await new Promise((r) =>
    next.exitCode !== null ? r() : next.once("exit", r),
  );
  fs.closeSync(log);
  await h.close();
  fs.rmSync(seed.directory, { recursive: true, force: true });
  fs.rmSync(scratch, { recursive: true, force: true });
}
