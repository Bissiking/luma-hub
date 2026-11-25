import { request } from '../api.js';
import { escapeHtml as esc, icon, emptyState, safeUrl } from '../ui.js';
import { filterProjects, KIND_LABELS } from './model.js';

const state = { status: 'idle', data: null, error: '', query: '', division: '', kind: '', archive: '' };
let redraw = () => {};
const badge = label => `<span class="project-tag">${esc(label)}</span>`;
const link = (url, label) => {
  const safe = safeUrl(url);
  return safe ? `<a class="project-source" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)}${icon('external')}</a>` : esc(label);
};
const divisionName = p => state.data.divisions.find(d => d.id === p.division)?.name || 'À classer';
const projectHref = id => `#/projets?projet=${encodeURIComponent(id)}`;

async function load() {
  if (state.status === 'loading') return;
  state.status = 'loading';
  try {
    state.data = await request('/api/projects');
    state.status = 'ready';
  } catch (error) {
    state.status = 'error';
    state.error = error.status === 503 ? 'Le catalogue est momentanément indisponible. Réessayez dans un instant.' : error.message;
  }
  if (location.hash.startsWith('#/projets')) redraw();
}

function aboutGroup() {
  const identities = state.data.entities.filter(e => e.description);
  if (!identities.length) return '';
  return `<details class="project-context"><summary>Les identités derrière LUMA</summary><dl>${identities.map(e => `<div><dt>${esc(e.name)}</dt><dd>${esc(e.description)}</dd></div>`).join('')}</dl><p>Nino est soutenu par les deux identités de Mathéo.</p></details>`;
}
function renderList() {
  const projects = filterProjects(state.data, state);
  const kinds = [...new Set(state.data.projects.map(p => p.kind))];
  return `<header class="page-head"><div class="page-head-copy"><h1>Projets LUMA</h1><p>Retrouvez les projets, les composants et les événements de l’écosystème.</p></div></header>
    ${aboutGroup()}
    <form class="project-filters" role="search" aria-label="Filtrer les projets">
      <label class="project-query">Rechercher<input id="project-query" type="search" value="${esc(state.query)}" placeholder="Nom, usage, dépôt…" autocomplete="off" data-project-filter="query"></label>
      <label>Division<select id="project-division" data-project-filter="division"><option value="">Toutes les divisions</option>${state.data.divisions.map(d => `<option value="${esc(d.id)}"${state.division === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}<option value="unclassified"${state.division === 'unclassified' ? ' selected' : ''}>À classer</option></select></label>
      <label>Type<select id="project-kind" data-project-filter="kind"><option value="">Tous les types</option>${kinds.map(k => `<option value="${esc(k)}"${state.kind === k ? ' selected' : ''}>${esc(KIND_LABELS[k] || 'Projet')}</option>`).join('')}</select></label>
      <label>Dépôts<select id="project-archive" data-project-filter="archive"><option value="">Tous les dépôts</option><option value="archived"${state.archive === 'archived' ? ' selected' : ''}>Avec dépôt archivé</option><option value="current"${state.archive === 'current' ? ' selected' : ''}>Sans dépôt archivé</option></select></label>
    </form>
    <div class="project-results-head"><p id="project-result-count" role="status" aria-live="polite">${projects.length} fiche${projects.length > 1 ? 's' : ''} sur ${state.data.projects.length}</p>${state.query || state.division || state.kind || state.archive ? '<button type="button" class="text-btn" data-project-reset>Réinitialiser les filtres</button>' : ''}</div>
    ${projects.length ? `<ul class="project-list">${projects.map(p => `<li><a class="project-row" href="${projectHref(p.id)}"><div class="project-row-copy"><h2>${esc(p.name)}</h2><p>${esc(p.function || 'Description à renseigner.')}</p><div class="project-tags">${badge(divisionName(p))}${badge(KIND_LABELS[p.kind] || 'Projet')}${p.archived ? badge('Dépôt archivé') : ''}${p.temporaryName ? badge('Nom provisoire') : ''}</div></div><span class="project-open">Voir la fiche ${icon('right')}</span></a></li>`).join('')}</ul>` : emptyState({ iconName: 'search', title: 'Aucun projet trouvé', text: 'Essayez un autre mot ou réinitialisez les filtres.' })}
    <p class="project-footnote">Catalogue vérifié le ${esc(state.data.checkedOn || 'date non renseignée')}. Les statuts non confirmés restent à clarifier.</p>`;
}
function renderDetail(p) {
  const related = state.data.projects.find(x => x.id === p.relatedProjectId);
  const components = state.data.projects.filter(x => x.relatedProjectId === p.id);
  return `<nav class="project-breadcrumb" aria-label="Fil d’Ariane"><a href="#/projets">Projets LUMA</a><span aria-hidden="true">/</span><span>${esc(p.name)}</span></nav>
    <header class="page-head"><div class="page-head-copy"><h1>${esc(p.name)}</h1><p>${esc(p.function || 'La description de ce projet reste à renseigner.')}</p></div></header>
    <div class="project-tags">${badge(divisionName(p))}${badge(KIND_LABELS[p.kind] || 'Projet')}${p.archived ? badge('Dépôt archivé sur GitHub') : ''}${p.temporaryName ? badge('Nom provisoire') : ''}</div>
    ${p.namingNote ? `<p class="project-note">${esc(p.namingNote)}</p>` : ''}
    <div class="project-detail-layout"><section class="project-facts" aria-labelledby="project-information"><h2 id="project-information">Informations</h2><dl>
      ${[['Division', divisionName(p)], ['Responsable', p.responsible || 'À renseigner'], ['Statut', p.status || 'À clarifier'], ['Mise en production', p.productionStatus || 'À confirmer'], ...(p.software ? [['Logiciel utilisé', p.software]] : []), ...(p.alias ? [['Alias', p.alias]] : [])].map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}
      <div><dt>Service</dt><dd>${p.serviceUrl ? link(p.serviceUrl, 'Ouvrir le service') : 'Adresse à renseigner'}</dd></div>
      ${p.supportedBy.length ? `<div><dt>Soutenu par</dt><dd>${p.supportedBy.map(id => esc(state.data.entities.find(e => e.id === id)?.name || id)).join(' et ')}</dd></div>` : ''}
    </dl></section><div class="project-documentation">
      ${p.observation ? `<section><h2>Ce que l’on sait</h2><p>${esc(p.observation)}</p>${p.qualification ? `<p class="project-secondary">${esc(p.qualification)}</p>` : ''}${p.affiliation ? `<p>${esc(p.affiliation)}</p>` : ''}</section>` : ''}
      ${p.repositories.length ? `<section><h2>Dépôts GitHub</h2><ul class="project-repositories">${p.repositories.map(r => `<li>${link(r.url, r.name)}<p>${[r.visibility === 'private' ? 'Privé' : r.visibility === 'public' ? 'Public' : '', r.archived ? 'Archivé' : '', r.branch ? 'Branche ' + r.branch : '', r.versions.length ? 'Version déclarée : ' + r.versions.join(' / ') : ''].filter(Boolean).map(esc).join(' · ')}</p></li>`).join('')}</ul></section>` : '<section><h2>Dépôt GitHub</h2><p>Aucun dépôt associé confirmé.</p></section>'}
      ${p.relatedRepositories.length ? `<section><h2>Dépôts potentiellement liés</h2><ul class="project-repositories">${p.relatedRepositories.map(r => `<li>${link(r.url, r.name)}<p>Rattachement à confirmer.</p></li>`).join('')}</ul></section>` : ''}
      ${related || components.length ? `<section><h2>Projets liés</h2><ul class="project-related">${(related ? [related] : components).map(x => `<li><a href="${projectHref(x.id)}">${esc(x.name)}</a></li>`).join('')}</ul>${p.relationship ? `<p class="project-secondary">${esc(p.relationship)}</p>` : ''}</section>` : ''}
      ${p.sources.length ? `<details class="project-sources"><summary>Sources de la fiche</summary><ul>${p.sources.map(s => `<li>${link(s.url, s.label)}</li>`).join('')}</ul></details>` : ''}
    </div></div><a class="btn project-back" href="#/projets">Retour aux projets</a>`;
}
export function renderProjects() {
  if (state.status === 'idle') void load();
  if (state.status === 'idle' || state.status === 'loading') return '<h1>Projets LUMA</h1><p class="project-loading" role="status">Chargement du catalogue…</p>';
  if (state.status === 'error') return `<h1>Projets LUMA</h1><div class="project-loading" role="alert"><p>${esc(state.error)}</p><button class="btn" type="button" data-project-retry>Réessayer</button></div>`;
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('projet');
  if (!id) return renderList();
  const project = state.data.projects.find(p => p.id === id);
  return project ? renderDetail(project) : emptyState({ iconName: 'search', title: 'Projet introuvable', text: 'Cette fiche ne figure pas dans le catalogue.', action: { href: '#/projets', label: 'Voir tous les projets' } });
}
export function initProjects(render) {
  redraw = render;
  document.addEventListener('submit', event => { if (event.target.matches('.project-filters')) event.preventDefault(); });
  const filter = event => {
    const field = event.target.closest('[data-project-filter]');
    if (!field || !Object.hasOwn(state, field.dataset.projectFilter)) return;
    if (event.type === 'input' && field.tagName === 'SELECT') return;
    state[field.dataset.projectFilter] = field.value;
    redraw();
  };
  document.addEventListener('input', filter);
  document.addEventListener('change', filter);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-project-retry]')) { void load(); redraw(); }
    if (event.target.closest('[data-project-reset]')) {
      Object.assign(state, { query: '', division: '', kind: '', archive: '' });
      redraw(); document.getElementById('project-query')?.focus();
    }
  });
  document.addEventListener('hub:expired', () => { state.data = null; state.status = 'idle'; });
}
