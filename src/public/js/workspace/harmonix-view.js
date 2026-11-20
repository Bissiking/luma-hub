import { harmonix } from './harmonix-client.js';
import { escapeHtml as e, icon, safeUrl } from '../ui.js';
const connect = '<a class="btn btn-primary" href="/api/connectors/harmonix/authorize">Connecter Harmonix</a>';
const refresh = () => `<button class="text-btn" data-harmonix-refresh ${harmonix.loading ? 'disabled' : ''}>${icon('refresh')}${harmonix.loading ? 'Actualisation…' : 'Actualiser'}</button>`;
const time = value => { const seconds = Math.floor((Number(value) || 0)/1000); return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`; };
function row(track, resume = false) {
  const url = safeUrl(track.url);
  if (!url) return '';
  const cover = typeof track.cover === 'string' && /^\/api\/connectors\/harmonix\/artwork\/[A-Za-z0-9_-]+$/.test(track.cover) ? `<img src="${e(track.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  const date = track.release_date ? new Date(track.release_date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : '';
  return `<li><a class="harmonix-track" href="${e(url)}" target="_blank" rel="noopener noreferrer"><span class="harmonix-artwork">${icon('music')}${cover}</span><span class="harmonix-meta"><strong>${e(track.title)}</strong><span>${e(track.artist || 'Artiste inconnu')}</span>${resume ? `<small>Reprendre à ${e(time(track.position_ms))}${track.duration_ms ? ` sur ${e(time(track.duration_ms))}` : ''}</small>` : date ? `<time datetime="${e(track.release_date)}">${e(date)}</time>` : ''}</span>${icon('external')}</a></li>`;
}
export function renderHarmonix() {
  if (harmonix.status === 'loading') return '<p class="muted" role="status">Connexion à Harmonix…</p>';
  if (harmonix.error) return `<p role="status">${e(harmonix.error.message)}</p><div class="settings-actions">${refresh()}${['harmonix_reconnect_required','harmonix_not_connected'].includes(harmonix.error.code) ? connect : ''}</div>`;
  if (!harmonix.connection?.available) return '<p class="muted">La connexion Harmonix n’est pas encore configurée sur ce Hub.</p>';
  if (!harmonix.connection.configured) return `<p class="muted">Vos dernières écoutes et les nouveautés de votre bibliothèque Sonora.</p>${connect}`;
  if (!harmonix.data) return `<p class="muted" role="status">Chargement de votre musique…</p>${refresh()}`;
  const data = harmonix.data;
  return `<div class="harmonix-content"><section aria-label="Reprise d’écoute"><h3>Reprendre l’écoute</h3>${data.resumeError ? `<p role="status">${e(data.resumeError)}</p>` : data.resume ? `<ul class="harmonix-tracks">${row(data.resume,true)}</ul>` : '<p class="muted">Aucune écoute à reprendre pour le moment.</p>'}</section><section aria-label="Dernières sorties"><h3>Dernières sorties</h3>${data.releasesError ? `<p role="status">${e(data.releasesError)}</p>` : data.releases.length ? `<ul class="harmonix-tracks">${data.releases.map(track => row(track)).join('')}</ul>` : '<p class="muted">Aucune sortie datée disponible dans votre bibliothèque.</p>'}</section><div class="settings-actions">${refresh()}<a class="text-btn" href="${e(safeUrl(harmonix.connection.baseUrl) || '#/applications')}" target="_blank" rel="noopener noreferrer">Ouvrir Harmonix ${icon('external')}</a></div></div>`;
}
export function renderHarmonixSettings() {
  const outcome = new URLSearchParams(location.hash.split('?')[1] || '').get('harmonix');
  const message = { connected:'Harmonix est connecté à votre compte.', account_mismatch:'Utilisez le même compte Kyros dans le Hub et Harmonix.', failed:'La connexion n’a pas abouti. Réessayez.' }[outcome === 'connected' && !harmonix.connection?.configured ? '' : outcome];
  return `<section class="settings-section" aria-labelledby="harmonix-settings"><h2 id="harmonix-settings">Votre musique Harmonix</h2><p>Retrouvez vos nouveautés et reprenez votre écoute dans Harmonix depuis votre espace.</p>${message ? `<p role="status">${e(message)}</p>` : ''}${harmonix.error ? `<p role="status">${e(harmonix.error.message)}</p><div class="settings-actions">${refresh()}${harmonix.connection?.available ? connect : ''}${harmonix.connection?.configured ? '<button class="btn" data-harmonix-disconnect>Déconnecter Harmonix</button>' : ''}</div>` : harmonix.status === 'loading' ? '<p role="status">Vérification de la connexion…</p>' : harmonix.connection?.available ? `<div class="settings-actions">${harmonix.connection.configured ? '<button class="btn" data-harmonix-add>Ajouter le widget Harmonix</button><button class="btn" data-harmonix-disconnect>Déconnecter Harmonix</button>' : connect}</div>` : '<p class="muted">La connexion doit être configurée sur le serveur du Hub.</p>'}<p class="source-note">La lecture s’ouvre dans Harmonix. Le Hub ne modifie pas votre bibliothèque.</p>${harmonix.connection?.remoteRevoked === false ? '<p role="status">La connexion a été retirée du Hub, mais Sonora n’a pas confirmé sa révocation. Vérifiez vos sessions Kyros.</p>' : ''}</section>`;
}
