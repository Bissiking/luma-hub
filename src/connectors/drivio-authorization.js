import crypto from "node:crypto";
import { WorkspaceError } from "../public/js/workspace/model.js";
export function createDrivioAuthorization({
  connector,
  getPublicBaseUrl,
  cookieName,
}) {
  const transactions = new Map();
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  function start(userId, session) {
    if (typeof session !== "string" || !session)
      throw new WorkspaceError(
        "authentication_required",
        "Reconnectez-vous au Hub.",
        401,
      );
    const status = connector.status(userId);
    if (!status.available)
      throw new WorkspaceError(
        "drivio_not_configured",
        "La connexion Drivio est indisponible.",
        503,
      );
    for (const [key, value] of transactions)
      if (value.expiresAt <= Date.now()) transactions.delete(key);
    if (transactions.size >= 1000)
      throw new WorkspaceError(
        "rate_limited",
        "Trop de connexions en cours. Réessayez plus tard.",
        429,
      );
    const state = crypto.randomBytes(32).toString("base64url"),
      verifier = crypto.randomBytes(32).toString("base64url");
    const redirectUri = new URL(
      "/api/connectors/drivio/callback",
      getPublicBaseUrl(),
    ).href;
    transactions.set(state, {
      userId,
      binding: digest(session),
      verifier,
      redirectUri,
      expiresAt: Date.now() + 600000,
    });
    const url = new URL("/hub/authorize", status.baseUrl);
    url.search = new URLSearchParams({
      client_id: "luma-hub",
      redirect_uri: redirectUri,
      state,
      code_challenge: digest(verifier).toString("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return url.href;
  }
  async function complete(userId, session, params) {
    for (const key of params.keys())
      if (
        !["state", "code", "error"].includes(key) ||
        params.getAll(key).length !== 1
      )
        throw new WorkspaceError(
          "invalid_authorization",
          "Autorisation invalide.",
        );
    const state = params.get("state"),
      code = params.get("code"),
      error = params.get("error");
    if (
      !state ||
      Boolean(code) === Boolean(error) ||
      typeof session !== "string"
    )
      throw new WorkspaceError(
        "invalid_authorization",
        "Autorisation invalide.",
      );
    const transaction = transactions.get(state);
    if (
      !transaction ||
      transaction.expiresAt <= Date.now() ||
      transaction.userId !== userId ||
      !crypto.timingSafeEqual(transaction.binding, digest(session))
    )
      throw new WorkspaceError(
        "invalid_authorization",
        "Cette demande a expiré. Relancez la connexion.",
      );
    transactions.delete(state);
    if (error === "access_denied") return "cancelled";
    if (error || !code || !/^[A-Za-z0-9_-]{43}$/.test(code))
      throw new WorkspaceError(
        "invalid_authorization",
        "Autorisation invalide.",
      );
    await connector.authorize(userId, {
      code,
      verifier: transaction.verifier,
      redirectUri: transaction.redirectUri,
    });
    return "connected";
  }
  return { start, complete, cookieName };
}
