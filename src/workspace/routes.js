import { Router } from "express";
import {
  CONNECTORS,
  WIDGETS,
  COMPOSITIONS,
  parseSave,
} from "../public/js/workspace/model.js";

export function workspaceRoutes({
  store,
  authenticate,
  drivio,
  authorization,
}) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      req.workspaceUser = await authenticate(req, res);
      if (req.workspaceUser) next();
    } catch (error) {
      if (
        req.method === "GET" &&
        [
          "/connectors/drivio/authorize",
          "/connectors/drivio/callback",
        ].includes(req.path) &&
        !res.headersSent
      )
        return res.redirect(303, "/#/personnaliser?drivio=failed");
      next(error);
    }
  });
  router.get("/connectors/drivio/authorize", (req, res, next) => {
    try {
      res.redirect(
        authorization.start(
          req.workspaceUser,
          req.cookies[authorization.cookieName],
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/connectors/drivio/callback", async (req, res) => {
    let result;
    try {
      result = await authorization.complete(
        req.workspaceUser,
        req.cookies[authorization.cookieName],
        new URL(req.originalUrl, "http://hub.invalid").searchParams,
      );
    } catch (error) {
      result =
        error.code === "drivio_account_mismatch"
          ? "account_mismatch"
          : "failed";
    }
    res.redirect(303, `/#/personnaliser?drivio=${result}`);
  });
  const query = (req, allowed) => {
    const params = new URL(req.originalUrl, "http://hub.invalid").searchParams;
    for (const key of params.keys())
      if (!allowed.includes(key) || params.getAll(key).length !== 1)
        throw new Error("invalid_query");
    if (params.has("refresh") && params.get("refresh") !== "1")
      throw new Error("invalid_query");
    return params;
  };
  const connectorRoute = (fn) => async (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    try {
      res.json(await fn(req));
    } catch (error) {
      if (error.message === "invalid_query")
        return res.status(400).json({
          error: "invalid_query",
          message: "Paramètres du connecteur invalides.",
        });
      next(error);
    }
  };
  router.get(
    "/connectors/drivio",
    connectorRoute((req) => {
      query(req, []);
      return drivio.status(req.workspaceUser);
    }),
  );
  router.delete(
    "/connectors/drivio",
    connectorRoute((req) => {
      query(req, []);
      return drivio.disconnect(req.workspaceUser);
    }),
  );
  router.get(
    "/connectors/drivio/vehicles",
    connectorRoute((req) => {
      const params = query(req, ["offset", "refresh"]),
        raw = params.get("offset") || "0";
      if (!/^\d{1,5}$/.test(raw)) throw new Error("invalid_query");
      return drivio.vehicles(req.workspaceUser, {
        offset: Number(raw),
        force: params.has("refresh"),
      });
    }),
  );
  router.get(
    "/connectors/drivio/summary",
    connectorRoute((req) => {
      const params = query(req, ["vehicle", "refresh"]);
      return drivio.summary(req.workspaceUser, {
        vehicleId: params.get("vehicle"),
        force: params.has("refresh"),
      });
    }),
  );
  router.get("/widgets", (req, res) =>
    res.json({
      widgets: WIDGETS,
      connectors: CONNECTORS,
      compositions: COMPOSITIONS,
    }),
  );
  router.get("/spaces", (req, res) =>
    res.json({
      spaces: [{ id: "personal", name: "Personnel", available: true }],
      enterprise: {
        available: false,
        reason:
          "Le contrat de sélection de contexte entreprise du Hub reste à valider avec Kyros.",
      },
    }),
  );
  router.get("/workspace/:space", (req, res, next) => {
    try {
      res.json(store.read(req.workspaceUser, req.params.space));
    } catch (error) {
      next(error);
    }
  });
  router.put("/workspace/:space", (req, res, next) => {
    try {
      res.json(
        store.save(req.workspaceUser, req.params.space, parseSave(req.body)),
      );
    } catch (error) {
      next(error);
    }
  });
  return router;
}
