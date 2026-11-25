import crypto from 'node:crypto';
import { WorkspaceError } from '../public/js/workspace/model.js';
import { readConnectorKey, sealToken, openToken } from './secrets.js';

export function serviceOrigin(value, production = false) {
  if (!value) return null;
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && !production && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new Error('Origine HTTPS requise (localhost HTTP autorisé en développement).');
  return url.origin;
}
const digest = value => crypto.createHash('sha256').update(value).digest('base64url');
const error = (code, message, status = 502) => new WorkspaceError(`harmonix_${code}`, message, status);

export function createHarmonixConnector({ store, baseUrl, harmonixUrl, keyPath, isProduction = false, timeoutMs = 5000 }) {
  const base = serviceOrigin(baseUrl, isProduction), frontend = serviceOrigin(harmonixUrl, isProduction);
  const pending = new Map(), refreshes = new Map();
  const read = user => store.connection(user, 'harmonix');
  const status = user => ({ available: Boolean(base && frontend), configured: Boolean(base && frontend && read(user)), baseUrl: frontend });
  async function call(route, { token, method = 'GET', body, headers = {}, binary = false } = {}) {
    if (!base || !frontend) throw error('not_configured', 'La connexion Harmonix n’est pas configurée.', 503);
    let response;
    try {
      response = await fetch(new URL(route, base), { method, headers: { accept: binary ? 'image/*' : 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        await response.body?.cancel();
        throw error(response.status === 401 ? 'reconnect_required' : 'unavailable', response.status === 401 ? 'Reconnectez Harmonix pour retrouver votre musique.' : response.status === 403 ? 'Votre compte Sonora ne permet pas cet accès.' : 'Sonora est momentanément indisponible.', response.status === 401 ? 424 : response.status === 403 ? 403 : 502);
      }
      const lengthLimit = binary ? 5 * 1024 * 1024 : 512 * 1024;
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > lengthLimit) throw error('invalid_response', 'La réponse Sonora dépasse la limite autorisée.');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (binary) return { bytes, type: response.headers.get('content-type')?.split(';')[0] };
      return JSON.parse(bytes.toString());
    } catch (failure) {
      if (failure instanceof WorkspaceError) throw failure;
      throw error('unavailable', 'Sonora ne répond pas. Réessayez dans un instant.', 503);
    }
  }
  function save(user, pair, revision = crypto.randomUUID()) {
    if (typeof pair.access_token !== 'string' || pair.access_token.length > 32768 || !pair.access_token || (pair.refresh_token != null && (typeof pair.refresh_token !== 'string' || pair.refresh_token.length > 32768))) throw error('invalid_response', 'Connexion Sonora invalide.');
    const key = readConnectorKey(keyPath, { create: !store.hasConnections() });
    const secret = { access: pair.access_token, refresh: pair.refresh_token || null, expires: Date.now() + Math.max(1, Number(pair.expires_in) || 900) * 1000, base };
    store.saveConnection(user, { sealedToken: sealToken(JSON.stringify(secret), user, key, 'harmonix'), revision, connectedAt: new Date().toISOString() }, 'harmonix');
  }
  function secret(user) {
    const row = read(user);
    if (!row) throw error('not_connected', 'Connectez Harmonix pour retrouver votre musique.', 424);
    try {
      const value = JSON.parse(openToken(row.sealedToken, user, readConnectorKey(keyPath), 'harmonix'));
      if (value.base !== base) throw new Error('Changed provider');
      return value;
    } catch { throw error('reconnect_required', 'Reconnectez Harmonix depuis les réglages du Hub.', 424); }
  }
  async function access(user) {
    const value = secret(user);
    if (value.expires > Date.now() + 30000) return value.access;
    if (!value.refresh) throw error('reconnect_required', 'La connexion Harmonix a expiré.', 424);
    if (!refreshes.has(user)) {
      const revision = read(user).revision;
      refreshes.set(user, (async () => {
        const pair = await call('/auth/refresh', { method: 'POST', body: { refresh_token: value.refresh } });
        const identity = await call('/api/auth/me', { token: pair.access_token });
        if (identity.id !== user) throw error('account_mismatch', 'Utilisez le même compte Kyros dans le Hub et Harmonix.', 403);
        if (read(user)?.revision !== revision) throw error('reconnect_required', 'La connexion Harmonix a changé.', 424);
        save(user, { ...pair, refresh_token: pair.refresh_token || value.refresh }, revision);
        return pair.access_token;
      })().finally(() => refreshes.delete(user)));
    }
    return refreshes.get(user);
  }
  function track(row) {
    if (!row || typeof row.id !== 'string' || row.id.length > 128 || typeof row.title !== 'string') throw error('invalid_response', 'Données musicales invalides.');
    const url = new URL(`/piste/${encodeURIComponent(row.id)}`, frontend);
    const position = Math.max(0, Number(row.position_ms) || 0);
    if (row.position_ms !== undefined) url.searchParams.set('position_ms', String(Math.floor(position)));
    return { id: row.id, title: row.title.slice(0, 300), artist: typeof row.artist === 'string' ? row.artist.slice(0,300) : '', release_date: /^\d{4}-\d{2}-\d{2}/.test(row.release_date || '') ? row.release_date.slice(0,10) : null, position_ms: position, duration_ms: Math.max(0, Number(row.duration_ms) || 0), url: url.href, cover: row.cover ? `/api/connectors/harmonix/artwork/${encodeURIComponent(row.id)}` : null };
  }
  async function data(user) {
    const token = await access(user);
    const [releases, resume] = await Promise.allSettled([call('/api/hub/music/releases?limit=6&offset=0', { token }), call('/api/hub/music/resume', { token })]);
    for (const result of [releases,resume]) if (result.status === 'rejected' && result.reason.code === 'harmonix_reconnect_required') throw result.reason;
    if (releases.status === 'fulfilled' && (!releases.value.ok || !Array.isArray(releases.value.data))) throw error('invalid_response','Données musicales invalides.');
    if (resume.status === 'fulfilled' && !resume.value.ok) throw error('invalid_response','Reprise musicale invalide.');
    return { releases: releases.status === 'fulfilled' ? releases.value.data.slice(0,6).map(track) : [], resume: resume.status === 'fulfilled' && resume.value.data ? track(resume.value.data) : null, releasesError: releases.status === 'rejected' ? releases.reason.message : null, resumeError: resume.status === 'rejected' ? resume.reason.message : null };
  }
  return {
    status, data,
    async start(user, session) {
      if (!session || !status(user).available) throw error('not_configured','La connexion Harmonix est indisponible.',503);
      for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
      if (pending.size >= 1000) throw error('rate_limited','Trop de connexions en cours.',429);
      const state = crypto.randomBytes(32).toString('base64url'), verifier = crypto.randomBytes(32).toString('base64url');
      const result = await call('/api/harmonix/apps/v2/sso/start?' + new URLSearchParams({ state, platform:'hub', code_challenge:digest(verifier) }));
      const target = new URL(result.data?.authorize_url);
      if (target.protocol !== 'https:' && !(target.protocol === 'http:' && !isProduction && ['localhost','127.0.0.1','[::1]'].includes(target.hostname))) throw error('invalid_response','Adresse de connexion invalide.');
      if (target.username || target.password) throw error('invalid_response','Adresse de connexion invalide.');
      pending.set(state, { user, binding:digest(session), verifier, expires:Date.now()+600000 });
      return target.href;
    },
    async complete(user, session, params) {
      if ([...params.keys()].some(key => key !== 'state') || params.getAll('state').length !== 1 || !session) throw error('invalid_authorization','Connexion invalide.',400);
      const state = params.get('state'), entry = pending.get(state);
      if (!entry || entry.user !== user || entry.binding !== digest(session) || entry.expires < Date.now()) throw error('invalid_authorization','Cette connexion a expiré. Réessayez.',400);
      pending.delete(state);
      const result = await call('/api/harmonix/apps/v2/sso/status?' + new URLSearchParams({ state }), { headers:{ 'x-sonora-code-verifier':entry.verifier } });
      const pair = result.data;
      const identity = await call('/api/auth/me', { token:pair?.access_token });
      if (identity.id !== user) throw error('account_mismatch','Utilisez le même compte Kyros dans le Hub et Harmonix.',403);
      save(user,pair);
    },
    async artwork(user,id) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw error('invalid_artwork','Pochette invalide.',404);
      const token = await access(user);
      const result = await call(`/api/harmonix/apps/v2/catalog/tracks/${encodeURIComponent(id)}`,{token});
      const cover = result.data?.cover_file;
      if (typeof cover !== 'string' || !/^\/covers\/[A-Za-z0-9_.-]+$/.test(cover) || cover.includes('..')) throw error('invalid_artwork','Pochette indisponible.',404);
      const image = await call(cover,{token,binary:true});
      if (!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(image.type)) throw error('invalid_artwork','Format de pochette indisponible.',404);
      return image;
    },
    async disconnect(user) {
      let remoteRevoked = true;
      const current = read(user);
      if (current) {
        let value;
        try { value = secret(user); } catch { remoteRevoked = false; }
        store.removeConnection(user,'harmonix');
        if (value?.refresh) try { await call('/auth/revoke',{method:'POST',body:{refresh_token:value.refresh}}); } catch { remoteRevoked = false; }
      }
      for (const [key,value] of pending) if (value.user === user) pending.delete(key);
      return { ...status(user), remoteRevoked };
    },
  };
}
