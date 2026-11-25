import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHarness } from './support/harness.js';
import { projectsFixture } from './support/projects-fixture.js';

test('catalogue HTTP: authentification, identité Kyros et données hors assets publics', async t => {
  const h = await createHarness();
  t.after(() => h.close());
  const { config } = await import('../src/config.js');
  const previousPath = config.projectCataloguePath;
  config.projectCataloguePath = path.join(path.dirname(h.keyPath), 'projects.json');
  t.after(() => { config.projectCataloguePath = previousPath; });
  const file = config.projectCataloguePath;
  await fs.writeFile(file, JSON.stringify(projectsFixture()));
  assert.equal((await fetch(h.base + '/api/projects')).status, 401);
  for (const id of ['alice', 'bob']) {
    const { cookie } = await h.sessionFor(id);
    const response = await fetch(h.base + '/api/projects', { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).projects.length, 3);
  }
  const { cookie } = await h.sessionFor('alice');
  const call = () => fetch(h.base + '/api/projects', { headers: { cookie } });
  h.controls.meStatus = 503;
  assert.equal((await call()).status, 503);
  h.controls.meStatus = 200;
  await fs.writeFile(file, '{bad json');
  let response = await call();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'project_catalogue_unavailable');
  await fs.rm(file);
  response = await call();
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes(file), false);
  h.controls.identityOverride = 'bob';
  assert.equal((await call()).status, 401);
  h.controls.identityOverride = null;
  const staticResponse = await fetch(h.base + '/data/project-catalogue.json');
  assert.equal((await staticResponse.text()).includes('Garage Démo'), false);
});
