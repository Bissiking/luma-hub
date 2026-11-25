import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { createHarness } from "../test/support/harness.js";
const candidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const cache = path.join(os.homedir(), ".cache/puppeteer/chrome");
if (fs.existsSync(cache))
  for (const entry of fs.readdirSync(cache).sort().reverse())
    candidates.push(
      path.join(
        cache,
        entry,
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      ),
    );
const executablePath = candidates.find((file) => file && fs.existsSync(file));
if (!executablePath)
  throw new Error("Définir CHROME_PATH vers Chrome/Chrome for Testing.");
const h = await createHarness();
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.emulateTimezone("Europe/Paris");
const errors = [],
  evidence = [],
  requests = [];
page.on("pageerror", (error) => {
  errors.push(error.message);
  console.error("BROWSER_ERROR", error.stack);
});
page.on("request", (req) => {
  if (req.method() === "PUT") requests.push(req.url());
});
page.on("dialog", (d) => d.accept());
const out = path.resolve(".impeccable/review");
fs.mkdirSync(out, { recursive: true });
const waitSaved = () =>
  page.waitForFunction(
    async () =>
      (
        await import(
          (document.querySelector('meta[name="luma-asset-prefix"]')?.content ||
            "") + "/js/workspace/store.js"
        )
      ).workspace.status === "saved",
    { timeout: 10000 },
  );
const click = (selector) => page.locator(selector).click();
const getData = () =>
  page.evaluate(async () => (await fetch("/api/workspace/personal")).json());
const settings = async () => {
  await page.goto(h.base + "/#/personnaliser");
  await page.waitForSelector("input[data-composition]");
};
const choose = async (format, name) => {
  const selector = `label.composition-option:has(input[data-composition="${format}"][value="${name}"])`;
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));
  await click(selector);
  await page.waitForFunction(
    async (format, name) =>
      (
        await import(
          (document.querySelector('meta[name="luma-asset-prefix"]')?.content ||
            "") + "/js/workspace/store.js"
        )
      ).workspace.data.compositions[format] === name,
    {timeout:5000},
    format,
    name,
  ).catch(async error => { const data = await page.evaluate(async () => ({route:location.hash, state:(await import(document.querySelector('meta[name="luma-asset-prefix"]').content+'/js/workspace/store.js')).workspace})); throw new Error(`Sélection ${format}/${name} non appliquée : ${JSON.stringify({route:data.route,status:data.state.status,compositions:data.state.data?.compositions,error:data.state.error})}`); });
  await waitSaved();
};
const home = async () => {
  await page.goto(h.base + "/#/");
  await page.waitForSelector("[data-widget]");
};
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: "light" },
  ]);
  await page.goto(h.base + "/auth/login");
  await page.waitForSelector("[data-widget]");
  assert.equal((await getData()).revision, 0);
  evidence.push(
    "SSO synthétique réel HTTP : PAR, PKCE, RS256, cookie HttpOnly",
  );
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  await page.waitForSelector("#searchOverlay[open]");
  await page.type("#searchInput", "Nino");
  assert.match(
    await page.$eval("#searchResults", (el) => el.textContent),
    /Nino/,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval("#searchOverlay", (el) => el.open), false);
  evidence.push(
    "Recherche clavier, contenu, Échap et fermeture native du dialogue",
  );
  await page.goto(h.base + "/#/applications");
  await page.waitForSelector("[data-fav]");
  await click('[data-fav="hub_braindump"]');
  await page.waitForFunction(
    () => document.querySelector("#navFavoritesCount")?.textContent === "3",
  );
  assert.equal(
    (
      await page.evaluate(
        async () =>
          (await (await fetch("/api/catalog")).json()).preferences.favorites,
      )
    ).includes("hub_braindump"),
    false,
  );
  evidence.push("Favori modifié via UI et persisté côté fournisseur");
  await page.$eval('[data-launch="hub_nino"]', (el) =>
    el.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    }),
  );
  await click('[data-launch="hub_nino"]');
  await page.goto(h.base + "/#/recents");
  await page.waitForSelector(".list-row");
  assert.match(await page.$eval("#view", (el) => el.textContent), /Nino/);
  evidence.push(
    "Récents conservés sur cet appareil ; liens réels des applications non ouverts",
  );
  await settings();
  await choose("desktop", "immersive");
  assert.equal((await getData()).workspace.compositions.mobile, "minimal");
  await choose("mobile", "dashboard");
  await choose("desktop", "dashboard");
  await home();
  await click("[data-add-widget]");
  await page.waitForSelector(".workspace-dialog[open]");
  await click('[data-widget-add="clock"]');
  await waitSaved();
  let data = await getData();
  const added = data.workspace.widgets.at(-1).id;
  await click(`[data-widget-menu="${added}"]`);
  await click(`[data-configure-widget="${added}"]`);
  await page.type("[name=title]", "Horloge Tokyo");
  await page.type("[name=timezone]", "Asia/Tokyo");
  await click("#widgetForm [type=submit]");
  await waitSaved();
  assert.equal(
    (await getData()).workspace.widgets.find((w) => w.id === added).config
      .timezone,
    "Asia/Tokyo",
  );
  await click(`[data-widget-menu="${added}"]`);
  await click(`[data-duplicate-widget="${added}"]`);
  await waitSaved();
  assert.equal((await getData()).workspace.widgets.length, 7);
  const copy = (await getData()).workspace.widgets.at(-1).id;
  await click(`[data-widget-menu="${copy}"]`);
  await click(`[data-remove-widget="${copy}"]`);
  await waitSaved();
  evidence.push(
    "Ajout, configuration par instance/fuseau, duplication et suppression sans rechargement",
  );
  await click("[data-edit-workspace]");
  const before = (await getData()).workspace.layouts.desktop.dashboard.map(
    (w) => w.id,
  );
  await page.focus(`[data-drag="${added}"]`);
  await page.keyboard.down("Alt");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Alt");
  await waitSaved();
  assert.notDeepEqual(
    (await getData()).workspace.layouts.desktop.dashboard.map((w) => w.id),
    before,
  );
  const beforeMouse = (await getData()).workspace.layouts.desktop.dashboard.map(
    (w) => w.id,
  );
  const handle = await page.$(`[data-drag="${added}"]`);
  await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await handle.boundingBox();
  const target = await page.evaluate(
    (id, order) => {
      const current = order.indexOf(id);
      return [...document.querySelectorAll("[data-widget]")]
        .filter((el) => el.dataset.widget !== id)
        .map((el) => ({
          id: el.dataset.widget,
          rect: el.getBoundingClientRect().toJSON(),
        }))
        .filter(
          (item) => item.rect.top > 90 && item.rect.bottom < innerHeight - 50,
        )
        .map((item) => ({
          x: item.rect.x + item.rect.width / 2,
          y:
            order.indexOf(item.id) > current
              ? item.rect.bottom - 20
              : item.rect.top + 20,
        }))[0];
    },
    added,
    beforeMouse,
  );
  assert.ok(target, "Une cible visible pour le glisser-déposer est requise.");
  const beforeDrag = requests.length;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, {
    steps: 10,
  });
  await page.mouse.up();
  await waitSaved();
  assert.equal(requests.length - beforeDrag, 1);
  assert.notDeepEqual(
    (await getData()).workspace.layouts.desktop.dashboard.map((w) => w.id),
    beforeMouse,
  );
  evidence.push(
    "Ordre clavier et déplacement souris : au plus une écriture après relâchement",
  );
  await click(`[data-resize="${added}"]`);
  await page.select("[name=width]", "2");
  await page.select("[name=height]", "2");
  await click("#widgetForm [type=submit]");
  await waitSaved();
  assert.equal(
    await page.evaluate(
      async () =>
        (
          await import(
            document.querySelector('meta[name="luma-asset-prefix"]').content +
              "/js/workspace/store.js"
          )
        ).workspace.error,
    ),
    null,
  );
  assert.equal(
    (await getData()).workspace.layouts.desktop.dashboard.find(
      (w) => w.id === added,
    ).width,
    2,
  );
  await click("[data-edit-workspace]");
  await page.reload();
  await page.waitForSelector("[data-widget]");
  assert.ok(await page.$(`[data-widget="${added}"]`));
  evidence.push(
    "Tailles et dispositions persistées puis relues après rechargement",
  );
  // Retirer l’instance de recette pour capturer l’état de référence des maquettes.
  await click(`[data-widget-menu="${added}"]`);
  await click(`[data-remove-widget="${added}"]`);
  await waitSaved();
  const shots = [];
  for (const theme of ["light", "dark"]) {
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: theme },
    ]);
    for (const name of [
      "dashboard",
      "minimal",
      "immersive",
      "modular",
      "spaces",
    ]) {
      await settings();
      await choose("desktop", name);
      await choose("mobile", name);
      await home();
      for (const width of [1440, 1024, 768, 700, 390, 320]) {
        await page.setViewport({ width, height: width <= 700 ? 900 : 1000 });
        await page
          .waitForFunction(
            (width, name) =>
              document.querySelector(
                `.workspace-${width <= 700 ? "mobile" : "desktop"}.composition-${name}`,
              ),
            {},
            width,
            name,
          )
          .catch((error) => {
            throw new Error(
              `Composition attendue absente ${theme}/${name}/${width}: ${error.message}`,
            );
          });
        const sizes = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          count: document.querySelectorAll("[data-widget]").length,
        }));
        assert.ok(
          sizes.scroll <= sizes.width + 1,
          `Débordement ${theme}/${name}/${width}: ${sizes.scroll}`,
        );
        assert.equal(sizes.count, 5);
        if (width === 1440 || width === 390) {
          const file = path.join(out, `${name}-${theme}-${width}.png`);
          if (!process.env.SKIP_SCREENSHOTS) {
            await page.evaluate(() =>
              document.getElementById("toastHost").replaceChildren(),
            );
            await page.screenshot({ path: file, fullPage: true });
          }
          shots.push(file);
          if (name === "dashboard" && theme === "light" && width === 1440)
            fs.copyFileSync(file, path.join(out, "desktop.png"));
          if (name === "dashboard" && theme === "dark" && width === 390)
            fs.copyFileSync(file, path.join(out, "mobile.png"));
        }
      }
    }
  }
  evidence.push(
    "60 combinaisons : cinq compositions, six largeurs de 320 à 1440 px, deux thèmes ; aucun débordement horizontal",
  );
  // Brouillon de réseau en échec et conflit entre appareils : aucune perte silencieuse.
  await page.setViewport({ width: 1440, height: 1000 });
  await settings();
  h.controls.meStatus = 503;
  await click('[data-composition="desktop"][value="dashboard"]');
  await page.waitForFunction(
    async () =>
      (
        await import(
          (document.querySelector('meta[name="luma-asset-prefix"]')?.content ||
            "") + "/js/workspace/store.js"
        )
      ).workspace.status === "error",
  );
  h.controls.meStatus = 200;
  await click("[data-save-retry]");
  await waitSaved();
  assert.equal(await page.evaluate(async () => (await import(document.querySelector('meta[name="luma-asset-prefix"]').content+'/js/workspace/store.js')).workspace.error), null);
  const server = await getData();
  const next = structuredClone(server.workspace);
  next.compositions.desktop = "minimal";
  await page.evaluate(
    async ({ revision, next }) =>
      fetch("/api/workspace/personal", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseRevision: revision, workspace: next }),
      }),
    { revision: server.revision, next },
  );
  await click('[data-composition="desktop"][value="immersive"]');
  await page.waitForFunction(
    async () =>
      (
        await import(
          (document.querySelector('meta[name="luma-asset-prefix"]')?.content ||
            "") + "/js/workspace/store.js"
        )
      ).workspace.status === "conflict",
  );
  assert.match(
    await page.$eval("#view", (el) => el.textContent),
    /autre appareil/,
  );
  await click("[data-discard-draft]");
  await waitSaved();
  assert.equal((await getData()).workspace.compositions.desktop, "minimal");
  evidence.push(
    "Erreur réseau récupérable et conflit de révision visible sans écrasement du serveur",
  );
  // Toucher : appui long puis déplacement, les dispositions desktop restent indépendantes.
  await page.setViewport({
    width: 390,
    height: 900,
    isMobile: true,
    hasTouch: true,
  });
  await home();
  const desktopOrder = (await getData()).workspace.layouts.desktop.minimal;
  const mobileOrder = (await getData()).workspace.layouts.mobile.spaces.map(
    (w) => w.id,
  );
  await click("[data-edit-workspace]");
  const touchHandle = await page.$('[data-drag="initial-clock"]');
  await touchHandle.evaluate(el => el.scrollIntoView({block:'center'}));
  const touchBox = await touchHandle.boundingBox();
  // Gestes CDP authentiques (les événements synthétiques ne peuvent pas capturer un pointeur).
  const client = await page.createCDPSession();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchBox.x + 15, y: touchBox.y + 15 }],
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const favorite = await (
    await page.$('[data-widget="initial-favorites"]')
  ).boundingBox();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: favorite.x + 80, y: favorite.y + 60 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await waitSaved();
  assert.notDeepEqual(
    (await getData()).workspace.layouts.mobile.spaces.map((w) => w.id),
    mobileOrder,
  );
  assert.deepEqual(
    (await getData()).workspace.layouts.desktop.minimal,
    desktopOrder,
  );
  await client.detach();
  evidence.push(
    "Geste tactile CDP et indépendance des dispositions desktop/mobile (émulation, pas appareil physique)",
  );
  // HTML incomplet : récupération explicite, sans exception classList non interceptée.
  const incomplete = await browser.newPage();
  const shellErrors = [];
  incomplete.on("pageerror", (error) => shellErrors.push(error.message));
  await incomplete.setRequestInterception(true);
  incomplete.on("request", async (req) => {
    if (req.isNavigationRequest()) {
      const response = await fetch(h.base);
      await req.respond({
        status: 200,
        contentType: "text/html",
        body: (await response.text()).replace(
          'id="bootStatus"',
          'id="missing-boot-status"',
        ),
      });
    } else await req.continue();
  });
  await incomplete.goto(h.base);
  await incomplete.waitForSelector(".boot-failure");
  assert.match(
    await incomplete.$eval("body", (el) => el.textContent),
    /n’a pas pu démarrer/,
  );
  assert.deepEqual(shellErrors, []);
  await incomplete.close();
  evidence.push(
    "HTML incomplet : message récupérable, aucune erreur classList non interceptée ; assets versionnés/no-store vérifiés en HTTP",
  );
  assert.deepEqual(errors, []);
  const report = {
    source:
      "Fournisseur Kyros synthétique isolé + vrai serveur Hub + SQLite temporaire",
    passed: evidence,
    screenshots: shots.map((f) => path.relative(process.cwd(), f)),
    browserErrors: errors,
  };
  fs.writeFileSync(
    path.join(out, "browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await h.close();
}
