import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';
import { createHarness } from '../test/support/harness.js';
import { createHarmonixFixture } from '../test/support/harmonix-fixture.js';

const fixture = await createHarmonixFixture(); fixture.controls.user='qa-owner';
const h = await createHarness({sonoraBaseUrl:fixture.base,harmonixBaseUrl:'https://harmonix.example'});
fixture.controls.hubBase=h.base;
const cache=path.join(os.homedir(),'.cache/puppeteer/chrome');
const candidates=[process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',...fs.readdirSync(cache).reverse().map(entry=>path.join(cache,entry,'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'))];
const executablePath=candidates.find(file=>file && fs.existsSync(file));
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
const page=await browser.newPage(), errors=[];
page.on('pageerror',error=>errors.push(error.message));
const out=path.resolve('docs/validation/harmonix');fs.mkdirSync(out,{recursive:true});
const report={scope:'Actual Hub HTTP, temporary SQLite, synthetic Sonora and Kyros, Chrome; no real account or deployment',checks:[]};
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
const state=()=>page.evaluate(async()=>{const prefix=document.querySelector('meta[name="luma-asset-prefix"]').content;return (await import(prefix+'/js/workspace/harmonix-client.js')).harmonix;});
const refresh=async()=>{
  await page.locator('[data-harmonix-refresh]').click();
  await page.waitForFunction(async()=>{const prefix=document.querySelector('meta[name="luma-asset-prefix"]').content;return !(await import(prefix+'/js/workspace/harmonix-client.js')).harmonix.loading;});
};
try {
  await page.setViewport({width:1440,height:1100});
  await page.goto(h.base+'/auth/login');await page.waitForSelector('[data-widget]');
  await page.goto(h.base+'/#/personnaliser');
  await page.waitForSelector('a[href="/api/connectors/harmonix/authorize"]');
  await page.locator('a[href="/api/connectors/harmonix/authorize"]').click();
  await page.waitForSelector('[data-harmonix-add]');
  assert.equal((await state()).connection.configured,true);
  await page.locator('[data-harmonix-add]').click();
  await page.goto(h.base+'/#/');
  await page.waitForSelector('.widget-harmonix .harmonix-track');
  assert.match(await page.$eval('.widget-harmonix',el=>el.innerText),/Musique <test>/);
  const links=await page.$$eval('.widget-harmonix .harmonix-track',els=>els.map(el=>el.href));
  assert.equal(links[0],'https://harmonix.example/piste/song-1?position_ms=42000');
  assert.equal(await page.$eval('.harmonix-artwork img',el=>el.src.startsWith(location.origin)),true);
  const dto=await page.evaluate(async()=>JSON.stringify(await(await fetch('/api/connectors/harmonix/music')).json()));
  assert.ok(!/access_token|refresh_token|sealedToken/.test(dto));
  check('Connection via real Hub routes, account binding, protected artwork, resume link and no browser tokens');
  for(const width of [1440,390,320]) for(const theme of ['light','dark']) {
    await page.setViewport({width,height:1100});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
    await page.$eval('.widget-harmonix',el=>{if(el.tagName==='DETAILS')el.open=true;el.scrollIntoView({block:'center'});});
    await page.waitForFunction(()=>document.querySelector('.widget-harmonix').getBoundingClientRect().width>0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await new Promise(resolve => setTimeout(resolve,200));
    await page.screenshot({path:path.join(out,`widget-${width}-${theme}.png`)});
  }
  check('Rendered widget at 1440, 390 and 320 px in both system themes');
  fixture.controls.empty=true;await refresh();
  assert.match(await page.$eval('.widget-harmonix',el=>el.innerText),/Aucune écoute à reprendre/);
  fixture.controls.empty=false;fixture.controls.resumeStatus=403;await refresh();
  assert.match(await page.$eval('.widget-harmonix',el=>el.innerText),/ne permet pas cet accès/);
  assert.equal(await page.$$eval('.widget-harmonix .harmonix-track',els=>els.length),1);
  fixture.controls.resumeStatus=200;fixture.controls.releasesStatus=503;await refresh();
  assert.match(await page.$eval('.widget-harmonix',el=>el.innerText),/momentanément indisponible/);
  check('Empty history/catalogue, denied resume and unavailable releases retain explicit independent states');
  await page.goto(h.base+'/#/personnaliser');await page.waitForSelector('[data-harmonix-disconnect]');
  await page.locator('[data-harmonix-disconnect]').click();
  await page.waitForSelector('a[href="/api/connectors/harmonix/authorize"]');
  assert.equal(fixture.controls.revoked,1);
  await page.goto(h.base+'/#/');await page.waitForSelector('.widget-harmonix a[href="/api/connectors/harmonix/authorize"]');
  check('Disconnect clears music and revokes the refresh session');
  assert.deepEqual(errors,[]);report.passed=true;
} catch(error) { report.passed=false;report.failure=error.stack;throw error; }
finally {fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();await h.close();await fixture.close();}
