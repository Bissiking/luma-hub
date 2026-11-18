import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  createWorkspace,
  validateWorkspace,
  WorkspaceError,
} from "../public/js/workspace/model.js";

export function openWorkspaceStore(filename) {
  if (filename !== ":memory:")
    fs.mkdirSync(path.dirname(path.resolve(filename)), {
      recursive: true,
      mode: 0o700,
    });
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  db.transaction(() => {
    const version =
      db.prepare("SELECT max(version) AS version FROM schema_migrations").get()
        .version || 0;
    if (version > 1)
      throw new Error(
        "Schéma SQLite plus récent que ce runtime ; restauration du runtime requise.",
      );
    if (version < 1) {
      db.exec(
        fs.readFileSync(
          new URL("./migrations/001-workspaces.sql", import.meta.url),
          "utf8",
        ),
      );
      db.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(
        1,
        new Date().toISOString(),
      );
    }
  }).immediate();
  const read = db.prepare(
    "SELECT revision, state_json, updated_at FROM workspaces WHERE user_id = ? AND space_id = ?",
  );
  const write = db.prepare(
    "INSERT INTO workspaces VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, space_id) DO UPDATE SET revision=excluded.revision, state_json=excluded.state_json, updated_at=excluded.updated_at",
  );
  function identity(userId, spaceId) {
    if (typeof userId !== "string" || !userId || userId.length > 200)
      throw new WorkspaceError(
        "authentication_required",
        "Identité absente.",
        401,
      );
    if (spaceId !== "personal")
      throw new WorkspaceError(
        "space_unavailable",
        "Cet espace n’est pas disponible.",
        403,
      );
  }
  return {
    read(userId, spaceId = "personal") {
      identity(userId, spaceId);
      const row = read.get(userId, spaceId);
      return row
        ? {
            revision: row.revision,
            updatedAt: row.updated_at,
            workspace: validateWorkspace(JSON.parse(row.state_json)),
          }
        : { revision: 0, updatedAt: null, workspace: createWorkspace() };
    },
    save(userId, spaceId, { baseRevision, workspace }) {
      identity(userId, spaceId);
      if (
        !Number.isSafeInteger(baseRevision) ||
        baseRevision < 0 ||
        baseRevision >= Number.MAX_SAFE_INTEGER
      )
        throw new WorkspaceError("invalid_revision", "Révision invalide.");
      const valid = validateWorkspace(workspace);
      return db
        .transaction(() => {
          const currentRevision = read.get(userId, spaceId)?.revision || 0;
          if (currentRevision !== baseRevision)
            throw new WorkspaceError(
              "revision_conflict",
              "Cet espace a changé sur un autre appareil. Rechargez avant de modifier.",
              409,
            );
          const updatedAt = new Date().toISOString();
          write.run(
            userId,
            spaceId,
            currentRevision + 1,
            JSON.stringify(valid),
            updatedAt,
          );
          return { revision: currentRevision + 1, updatedAt, workspace: valid };
        })
        .immediate();
    },
    close() {
      db.close();
    },
  };
}
