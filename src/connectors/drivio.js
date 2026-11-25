import crypto from "node:crypto";
import { WorkspaceError } from "../public/js/workspace/model.js";
import { readConnectorKey, openToken, sealToken } from "./secrets.js";
import { vehiclesResponse, summaryResponse } from "./drivio-contract.js";

export function drivioBaseUrl(value, isProduction = false) {
  if (!value) return null;
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && local && !isProduction))
  )
    throw new Error(
      "DRIVIO_BASE_URL : origine HTTPS, ou localhost HTTP en développement, requise.",
    );
  return url.origin;
}
export const isDrivioToken = (value) =>
  typeof value === "string" &&
  /^drv_(?:hub|app)_[A-Za-z0-9_-]{43}$/.test(value);
export function createDrivioConnector({
  store,
  baseUrl,
  keyPath,
  isProduction = false,
  timeoutMs = 5000,
  cacheTtlMs = 300000,
  now = Date.now,
}) {
  const base = drivioBaseUrl(baseUrl, isProduction),
    cache = new Map(),
    attempts = new Map();
  const unavailable = () => {
    throw new WorkspaceError(
      "drivio_not_connected",
      "Connectez Drivio depuis les réglages du Hub.",
      424,
    );
  };
  function invalidate(userId) {
    for (const [key, row] of cache)
      if (row.userId === userId) cache.delete(key);
  }
  async function fetchData(token, route, parse) {
    let response;
    try {
      response = await fetch(new URL(route, base), {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new WorkspaceError(
        error.name === "TimeoutError" || error.name === "AbortError"
          ? "drivio_timeout"
          : "drivio_unreachable",
        "Drivio ne répond pas. Réessayez dans un instant.",
        504,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401)
        throw new WorkspaceError(
          "drivio_reconnect_required",
          "L’accès Drivio a expiré ou a été retiré. Reconnectez Drivio pour choisir les véhicules à partager.",
          424,
        );
      if (response.status === 404)
        throw new WorkspaceError(
          "drivio_vehicle_unavailable",
          "Ce véhicule n’est plus accessible dans Drivio.",
          404,
        );
      if (response.status === 429)
        throw new WorkspaceError(
          "drivio_rate_limited",
          "Drivio limite les appels. Réessayez plus tard.",
          429,
        );
      throw new WorkspaceError(
        "drivio_unavailable",
        "Le service Drivio est momentanément indisponible.",
        502,
      );
    }
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 512 * 1024) {
          await reader.cancel();
          throw new WorkspaceError(
            "drivio_invalid_response",
            "La réponse Drivio dépasse la limite autorisée.",
            502,
          );
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new WorkspaceError(
        "drivio_invalid_response",
        "La réponse Drivio est illisible.",
        502,
      );
    }
    return parse(payload);
  }
  function status(userId) {
    const row = store.connection(userId);
    return {
      available: Boolean(base),
      configured: Boolean(base && row),
      connectedAt: row?.connectedAt || null,
      connectionId: row?.revision || null,
      scope: "widgets:read",
      baseUrl: base,
      refreshAfterSeconds: cacheTtlMs / 1000,
    };
  }
  function credential(userId) {
    const row = store.connection(userId);
    if (!base || !row) unavailable();
    try {
      const token = openToken(
        row.sealedToken,
        userId,
        readConnectorKey(keyPath),
      );
      if (!isDrivioToken(token)) throw new Error();
      return { token, revision: row.revision };
    } catch {
      throw new WorkspaceError(
        "drivio_secret_unavailable",
        "La clé serveur du connecteur est indisponible. Faites vérifier la configuration.",
        503,
      );
    }
  }
  async function read(userId, route, parse, force = false) {
    const { token, revision } = credential(userId),
      key = JSON.stringify([userId, revision, route]);
    const entry = cache.get(key),
      at = now();
    if (entry?.pending || (entry && entry.expiresAt > at && !force)) {
      if (entry.error) throw entry.error;
      return (
        entry.pending || {
          data: entry.data,
          fetchedAt: new Date(entry.fetchedAt).toISOString(),
          cached: true,
        }
      );
    }
    const window = attempts.get(userId);
    if (window && at - window.start < 60000 && window.count >= 40)
      throw new WorkspaceError(
        "drivio_rate_limited",
        "Trop de demandes Drivio. Réessayez dans une minute.",
        429,
      );
    attempts.set(
      userId,
      window && at - window.start < 60000
        ? { start: window.start, count: window.count + 1 }
        : { start: at, count: 1 },
    );
    if (attempts.size > 500) attempts.delete(attempts.keys().next().value);
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    const item = { userId, fetchedAt: at, expiresAt: at + cacheTtlMs };
    item.pending = fetchData(token, route, parse)
      .then((data) => {
        item.data = data;
        item.pending = null;
        return {
          data,
          fetchedAt: new Date(item.fetchedAt).toISOString(),
          cached: false,
        };
      })
      .catch((error) => {
        if (error.code === "drivio_reconnect_required") invalidate(userId);
        item.error = error;
        item.pending = null;
        item.expiresAt = now() + 15000;
        cache.set(key, item);
        throw error;
      });
    cache.set(key, item);
    return item.pending;
  }
  return {
    status,
    async authorize(userId, { code, verifier, redirectUri }) {
      if (!base) unavailable();
      let response;
      try {
        response = await fetch(new URL("/api/hub/token", base), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: "luma-hub",
            code,
            code_verifier: verifier,
            redirect_uri: redirectUri,
            subject: userId,
          }),
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new WorkspaceError(
          "drivio_unreachable",
          "Drivio ne répond pas. Relancez la connexion.",
          502,
        );
      }
      if (!response.ok) {
        const status = response.status;
        await response.body?.cancel();
        throw new WorkspaceError(
          status === 403
            ? "drivio_account_mismatch"
            : "drivio_authorization_failed",
          status === 403
            ? "Utilisez le même compte Kyros dans Drivio et dans le Hub."
            : "L’autorisation Drivio a expiré. Relancez la connexion.",
          424,
        );
      }
      const reader = response.body.getReader(),
        chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 8192) {
            await reader.cancel();
            throw new WorkspaceError(
              "drivio_invalid_response",
              "Autorisation Drivio incompatible.",
              502,
            );
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        throw new WorkspaceError(
          "drivio_invalid_response",
          "Autorisation Drivio incompatible.",
          502,
        );
      }
      if (
        result.subject !== userId ||
        result.scope !== "widgets:read" ||
        !isDrivioToken(result.access_token) ||
        !result.access_token.startsWith("drv_app_")
      )
        throw new WorkspaceError(
          "drivio_invalid_response",
          "Autorisation Drivio incompatible.",
          502,
        );
      return this.connect(userId, result.access_token);
    },
    vehicles(userId, { offset = 0, force = false } = {}) {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
        throw new WorkspaceError(
          "invalid_query",
          "Pagination Drivio invalide.",
        );
      return read(
        userId,
        `/api/hub/v1/vehicles?offset=${offset}`,
        (raw) => {
          const data = vehiclesResponse(raw);
          if (data.nextOffset !== null && data.nextOffset !== offset + 50)
            throw new WorkspaceError(
              "drivio_invalid_response",
              "Pagination Drivio incohérente.",
              502,
            );
          return data;
        },
        force,
      );
    },
    summary(userId, { vehicleId, force = false } = {}) {
      if (
        typeof vehicleId !== "string" ||
        !vehicleId ||
        vehicleId.length > 100 ||
        /[\x00-\x1f\x7f]/.test(vehicleId)
      )
        throw new WorkspaceError(
          "invalid_query",
          "Choisissez un véhicule Drivio valide.",
        );
      return read(
        userId,
        `/api/hub/v1/summary?vehicle=${encodeURIComponent(vehicleId)}`,
        (raw) => summaryResponse(raw, vehicleId),
        force,
      );
    },
    async connect(userId, token) {
      store.connection(userId);
      if (!base)
        throw new WorkspaceError(
          "drivio_not_configured",
          "DRIVIO_BASE_URL doit être configurée côté serveur.",
          503,
        );
      if (!isDrivioToken(token))
        throw new WorkspaceError(
          "invalid_token_format",
          "Format de jeton Drivio invalide.",
        );
      // Vérifie le jeton avant de remplacer un accès existant ; aucune écriture Drivio.
      await fetchData(token, "/api/hub/v1/vehicles", vehiclesResponse);
      // Une clé perdue doit être restaurée, pas remplacée au détriment des autres comptes.
      const encryptionKey = readConnectorKey(keyPath, {
        create: !store.hasConnections(),
      });
      const sealedToken = sealToken(token, userId, encryptionKey);
      store.saveConnection(userId, {
        sealedToken,
        revision: crypto.randomUUID(),
        connectedAt: new Date(now()).toISOString(),
      });
      invalidate(userId);
      return status(userId);
    },
    async disconnect(userId) {
      const row = store.connection(userId);
      let remoteRevoked = true;
      if (base && row)
        try {
          const { token } = credential(userId);
          if (token.startsWith("drv_app_")) {
            const response = await fetch(new URL("/api/hub/revoke", base), {
              method: "POST",
              headers: { authorization: `Bearer ${token}` },
              redirect: "manual",
              signal: AbortSignal.timeout(timeoutMs),
            });
            remoteRevoked = response.ok || response.status === 401;
            await response.body?.cancel();
          }
        } catch {
          remoteRevoked = false;
        }
      store.removeConnection(userId);
      invalidate(userId);
      return { ...status(userId), remoteRevoked };
    },
  };
}
