import { Router } from "express";
import {
  CONNECTORS,
  WIDGETS,
  COMPOSITIONS,
  parseSave,
} from "../public/js/workspace/model.js";

export function workspaceRoutes({ store, authenticate }) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      req.workspaceUser = await authenticate(req, res);
      if (req.workspaceUser) next();
    } catch (error) {
      next(error);
    }
  });
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
