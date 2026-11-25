import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createHarness } from '../test/support/harness.js';
import { projectsFixture } from '../test/support/projects-fixture.js';
import { projectCatalogue } from '../src/projects/catalogue.js';

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const executablePath = candidates.find(file => file && fs.existsSync(file));
if (!executablePath) throw new Error('Définir CHROME_PATH vers un Chrome ou Edge installé.');
const raw = process.env.HUB_PROJECT_CATALOGUE_SOURCE ? JSON.parse(fs.readFileSync(process.env.HUB_PROJECT_CATALOGUE_SOURCE, 'utf8')) : projectsFixture();
const catalogue = projectCatalogue(raw);
const h = await createHarness();
const { config } = await import('../src/config.js');
config.projectCataloguePath = path.join(path.dirname(h.keyPath), 'projects.json');
fs.writeFileSync(config.projectCataloguePath, JSON.stringify(raw));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const out = path.resolve('.impeccable/review/projects');
fs.mkdirSync(out, { recursive: true });
const listReady = () => page.waitForSelector('.project-row');
const count = () => page.$$eval('.project-row', rows => rows.length);
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
const screenshot = async name => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
};
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(h.base + '/auth/login');
  await page.waitForSelector('[data-widget]');
  await page.locator('.sidebar [data-route="projets"]').click();
  await listReady();
  assert.equal(await count(), catalogue.projects.length);
  await noOverflow();
  await screenshot('desktop');

  const first = catalogue.projects.find(p => p.function) || catalogue.projects[0];
  await page.type('#project-query', first.name);
  assert.ok(await count() >= 1);
  assert.equal(await page.$eval('#project-query', el => el === document.activeElement), true);
  await page.locator(`a[href="#/projets?projet=${first.id}"]`).click();
  await page.waitForSelector('#project-information');
  assert.equal(await page.$eval('#view h1', el => el.textContent), first.name);
  assert.equal(await page.$eval('#view', (el, name) => el.textContent.includes(name), first.responsible || 'À renseigner'), true);
  await noOverflow();
  await screenshot('detail-desktop');
  await page.locator('.project-back').click();
  await listReady();
  assert.equal(await page.$eval('#project-query', el => el.value), first.name);
  await page.locator('[data-project-reset]').click();

  const archived = catalogue.projects.filter(p => p.archived).length;
  await page.select('#project-archive', 'archived');
  assert.equal(await count(), archived);
  await page.locator('[data-project-reset]').click();
  const component = catalogue.projects.find(p => p.relatedProjectId);
  if (component) {
    await page.goto(h.base + '/#/projets?projet=' + component.id);
    await page.waitForSelector('.project-related a');
    await page.locator('.project-related a').click();
    await page.waitForFunction(id => new URLSearchParams(location.hash.split('?')[1]).get('projet') === id, {}, component.relatedProjectId);
  }
  await page.goto(h.base + '/#/projets');
  await listReady();
  await page.type('#project-query', 'aucun-resultat-xyz');
  assert.equal(await count(), 0);
  assert.match(await page.$eval('#view', el => el.textContent), /Aucun projet trouvé/);
  await page.locator('[data-project-reset]').click();
  await page.goto(h.base + '/#/projets?projet=not-a-project');
  await page.waitForFunction(() => document.querySelector('#view').textContent.includes('Projet introuvable'));
  await page.goto(h.base + '/#/projets');
  await listReady();
  await page.focus('#project-query');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'project-division');

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(h.base + '/#/applications');
  await page.waitForSelector('.page-head a[href="#/projets"]');
  await page.locator('.page-head a[href="#/projets"]').click();
  await listReady();
  await noOverflow();
  await screenshot('mobile');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(h.base + '/#/projets?projet=' + first.id);
  await page.waitForSelector('#project-information');
  await noOverflow();
  await screenshot('detail-mobile-dark');

  let failOnce = true;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (failOnce && new URL(request.url()).pathname === '/api/projects') { failOnce = false; return request.abort(); }
    return request.continue();
  });
  await page.goto(h.base + '/#/projets');
  await page.reload();
  await page.waitForSelector('[data-project-retry]');
  await page.locator('[data-project-retry]').click();
  await listReady();
  assert.equal(await count(), catalogue.projects.length);
  assert.deepEqual(errors, []);
  const report = { projects: catalogue.projects.length, errors, checks: ['SSO HTTP synthétique', 'navigation desktop et mobile', 'recherche et conservation du focus', 'retour aux filtres', 'archives', 'composants liés', 'états vides et fiche inconnue', 'navigation clavier', 'absence de débordement', 'thèmes clair et sombre', 'reprise après erreur réseau'], screenshots: ['desktop', 'mobile', 'detail-desktop', 'detail-mobile-dark'] };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await h.close();
}
