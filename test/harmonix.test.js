import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { createHarmonixFixture } from './support/harmonix-fixture.js';
import { openWorkspaceStore } from '../src/workspace/repository.js';
import { createHarmonixConnector, serviceOrigin } from '../src/connectors/harmonix.js';

test('Harmonix delegated connection: account and cookie binding, encryption, DTOs, artwork, refresh and disconnect',async t=> {
  const fixture = await createHarmonixFixture(), dir = fs.mkdtempSync(path.join(os.tmpdir(),'hub-music-'));
  const store = openWorkspaceStore(path.join(dir,'test.sqlite'));
  t.after(async()=>{store.close();await fixture.close();fs.rmSync(dir,{recursive:true,force:true});});
  const connector = createHarmonixConnector({store,baseUrl:fixture.base,harmonixUrl:'https://music.example',keyPath:path.join(dir,'key')});
  assert.equal(connector.status('alice').configured,false);
  let target = new URL(await connector.start('alice','cookie-a'));
  let params = target.searchParams;
  await assert.rejects(connector.complete('alice','wrong-cookie',params),{code:'harmonix_invalid_authorization'});
  await assert.rejects(connector.complete('bob','cookie-a',params),{code:'harmonix_invalid_authorization'});
  const rawState = params.get('state');
  assert.equal((await fetch(fixture.base+'/api/harmonix/apps/v2/sso/status?state='+rawState)).status,404,'state alone cannot retrieve the token');
  await connector.complete('alice','cookie-a',params);
  await assert.rejects(connector.complete('alice','cookie-a',params),{code:'harmonix_invalid_authorization'});
  assert.equal(connector.status('alice').configured,true);
  assert.equal(connector.status('bob').configured,false);
  assert.equal(store.connection('alice'),null,'Drivio provider untouched');
  assert.ok(!store.connection('alice','harmonix').sealedToken.includes('access_token'));
  const music = await connector.data('alice');
  assert.equal(music.releases[0].title,fixture.row.title);
  assert.equal(music.resume.url,'https://music.example/piste/song-1?position_ms=42000');
  assert.ok(!JSON.stringify(music).includes('access_token'));
  assert.equal((await connector.artwork('alice','song-1')).type,'image/png');
  fixture.controls.cover='https://outside.example/private';
  await assert.rejects(connector.artwork('alice','song-1'),{code:'harmonix_invalid_artwork'});
  fixture.controls.cover='/covers/test.png';fixture.controls.imageType='image/svg+xml';
  await assert.rejects(connector.artwork('alice','song-1'),{code:'harmonix_invalid_artwork'});
  fixture.controls.releasesStatus=403;
  const partial=await connector.data('alice'); assert.ok(partial.releasesError);assert.ok(partial.resume);
  fixture.controls.releasesStatus=200;
  await connector.disconnect('alice'); assert.equal(fixture.controls.revoked,1);
  await assert.rejects(connector.data('alice'),{code:'harmonix_not_connected'});
  fixture.controls.user='bob'; target=new URL(await connector.start('alice','cookie-a'));
  await assert.rejects(connector.complete('alice','cookie-a',target.searchParams),{code:'harmonix_account_mismatch'});
  assert.equal(connector.status('alice').configured,false);
  fixture.controls.user='alice';fixture.controls.expiresIn=1;
  target=new URL(await connector.start('alice','cookie-a'));await connector.complete('alice','cookie-a',target.searchParams);
  fixture.controls.expiresIn=900;
  await Promise.all([connector.data('alice'),connector.data('alice')]);
  assert.equal(fixture.controls.refreshCalls,1,'one rotating refresh for concurrent readers');
  await connector.disconnect('alice');
});
test('Harmonix rejects unsafe configured origins',()=>{
  for(const url of ['http://remote.example','https://user:pass@music.example','https://music.example/path','file:///tmp/test']) assert.throws(()=>serviceOrigin(url));
  assert.throws(()=>serviceOrigin('http://localhost:6002',true));
  assert.equal(serviceOrigin('https://music.example/'),'https://music.example');
});

test('Migration 003 preserves existing Drivio credentials and separates provider rows',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-provider-upgrade-')),file=path.join(dir,'hub.sqlite');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const db=new Database(file);
  db.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  for(const [version,name] of [[1,'001-workspaces'],[2,'002-connector-secrets']]) {
    db.exec(fs.readFileSync(new URL(`../src/workspace/migrations/${name}.sql`,import.meta.url),'utf8'));
    db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(version,'2026-11-01');
  }
  db.prepare('INSERT INTO connector_secrets VALUES (?,?,?,?,?)').run('alice','drivio','original-sealed-data','original-revision','2026-11-01');
  db.close();
  const store=openWorkspaceStore(file);t.after(()=>store.close());
  assert.deepEqual(store.connection('alice'),{sealedToken:'original-sealed-data',revision:'original-revision',connectedAt:'2026-11-01'});
  store.saveConnection('alice',{sealedToken:'music-secret',revision:'music-revision',connectedAt:'2026-11-19'},'harmonix');
  assert.equal(store.connection('alice').sealedToken,'original-sealed-data');
  assert.equal(store.connection('alice','harmonix').sealedToken,'music-secret');
});
