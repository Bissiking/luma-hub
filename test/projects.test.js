import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCatalogue } from '../src/projects/catalogue.js';
import { filterProjects } from '../src/public/js/projects/model.js';
import { projectsFixture } from './support/projects-fixture.js';

test('catalogue: projection bornée, données inconnues et liens sûrs', () => {
  const raw = projectsFixture();
  raw.projects[0].serviceUrl = 'javascript:alert(1)';
  raw.projects[0].evidence = [{ url: 'https://github.com/example/garage', path: 'README.md' }, { url: 'data:text/html,bad' }];
  raw.secret = 'not-for-client';
  const data = projectCatalogue(raw);
  assert.equal(data.projects[0].serviceUrl, null);
  assert.equal(data.projects[0].status, null);
  assert.equal(data.projects[1].division, null);
  assert.equal(data.projects[1].archived, true);
  assert.equal(data.projects[0].sources[1].url, null);
  assert.equal('secret' in data, false);
  raw.projects.push(raw.projects[0]);
  assert.throws(() => projectCatalogue(raw), /invalid_catalogue/);
});
test('catalogue: recherche multi-mots sans accents, types, divisions et archives combinables', () => {
  const data = projectCatalogue(projectsFixture());
  assert.deepEqual(filterProjects(data, { query: 'garage demo' }).map(p => p.id), ['demo-garage']);
  assert.deepEqual(filterProjects(data, { query: 'automobile', division: 'software', kind: 'application' }).map(p => p.id), ['demo-garage']);
  assert.deepEqual(filterProjects(data, { division: 'unclassified', kind: 'component', archive: 'archived' }).map(p => p.id), ['demo-agent']);
  assert.equal(filterProjects(data, { query: 'inconnu' }).length, 0);
  assert.equal(filterProjects(data, { archive: 'current' }).length, 2);
});
