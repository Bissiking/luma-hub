import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  createWorkspace,
  validateWorkspace,
  parseSave,
  shortcutUrl,
} from "../src/public/js/workspace/model.js";
import { openWorkspaceStore } from "../src/workspace/repository.js";

test("les cinq compositions et deux formats possèdent des dispositions indépendantes", () => {
  const data = createWorkspace();
  assert.deepEqual(validateWorkspace(data), data);
  data.layouts.mobile.dashboard.reverse();
  assert.notDeepEqual(
    data.layouts.mobile.dashboard.map((x) => x.id),
    data.layouts.desktop.dashboard.map((x) => x.id),
  );
  assert.notDeepEqual(
    data.layouts.desktop.minimal,
    data.layouts.desktop.modular,
  );
  data.compositions.mobile = "spaces";
  assert.equal(data.compositions.desktop, "dashboard");
});
test("la validation rejette les propriétaires, espaces et champs non prévus", () => {
  for (const key of ["userId", "spaceId", "token", "__proto__"]) {
    const data = JSON.parse(
      JSON.stringify({ ...createWorkspace(), [key]: "foreign" }),
    );
    assert.throws(() => validateWorkspace(data));
  }
  for (const baseRevision of [-1, "0", 0.1, null, Number.MAX_SAFE_INTEGER])
    assert.throws(() =>
      parseSave({ baseRevision, workspace: createWorkspace() }),
    );
  assert.throws(() =>
    parseSave({
      baseRevision: 0,
      workspace: createWorkspace(),
      userId: "foreign",
    }),
  );
});
test("widgets et dispositions incohérents sont refusés atomiquement", () => {
  const edits = [
    (d) => d.widgets.push(d.widgets[0]),
    (d) => (d.widgets[0].type = "braindump"),
    (d) => d.layouts.desktop.dashboard.pop(),
    (d) => (d.layouts.mobile.dashboard[0].width = 3),
    (d) => (d.layouts.desktop.dashboard[0].height = 0),
    (d) => (d.widgets[0].config.limit = 500),
    (d) => (d.widgets[1].config.timezone = "not/a/timezone"),
    (d) => (d.widgets[0].config.token = "secret"),
    (d) => (d.compositions.mobile = "constructor"),
    (d) => (d.widgets[0].type = "toString"),
    (d) => (d.widgets[0].title = "x".repeat(81)),
    (d) => (d.widgets[0].id = "x\n"),
    (d) => (d.layouts.desktop.dashboard[0].id = "foreign"),
  ];
  for (const edit of edits) {
    const data = createWorkspace();
    edit(data);
    assert.throws(() => validateWorkspace(data));
  }
});
test("raccourcis : HTTP(S) seulement, sans identifiants ni URL ambiguë", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,a",
    "//evil.test",
    "/relative",
    "https://user:pass@host.test",
    "https://host.test\\evil",
    "https://host.test\n",
    "file:///tmp/test",
  ])
    assert.equal(shortcutUrl(value), null);
  assert.equal(
    shortcutUrl("https://example.test/a#b"),
    "https://example.test/a#b",
  );
});
test("SQLite persiste après réouverture, migre une seule fois et isole les comptes", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-workspace-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "hub.sqlite");
  let store = openWorkspaceStore(filename);
  assert.equal(store.read("owner").revision, 0);
  const initial = createWorkspace();
  initial.compositions.desktop = "immersive";
  assert.equal(
    store.save("owner", "personal", { baseRevision: 0, workspace: initial })
      .revision,
    1,
  );
  assert.equal(store.read("other").revision, 0);
  store.close();
  store = openWorkspaceStore(filename);
  t.after(() => store.close());
  assert.equal(store.read("owner").workspace.compositions.desktop, "immersive");
  assert.throws(() => store.read("owner", "foreign"), {
    code: "space_unavailable",
  });
  assert.throws(
    () =>
      store.save("owner", "personal", {
        baseRevision: 0,
        workspace: createWorkspace(),
      }),
    { code: "revision_conflict" },
  );
  assert.equal(store.read("owner").revision, 1);
  const raw = new Database(filename);
  assert.equal(
    raw.prepare("SELECT count(*) AS n FROM schema_migrations").get().n,
    1,
  );
  raw.close();
});
test("lectures sans écriture et validation sans perte des anciennes données", (t) => {
  const store = openWorkspaceStore(":memory:");
  t.after(() => store.close());
  const first = store.read("alice"),
    second = store.read("alice");
  assert.equal(first.updatedAt, null);
  assert.equal(second.revision, 0);
  store.save("alice", "personal", {
    baseRevision: 0,
    workspace: first.workspace,
  });
  const invalid = createWorkspace();
  invalid.widgets[0].type = "external";
  assert.throws(() =>
    store.save("alice", "personal", { baseRevision: 1, workspace: invalid }),
  );
  assert.deepEqual(store.read("alice").workspace, first.workspace);
  assert.equal(store.read("alice").revision, 1);
});
test("deux connexions SQLite ne peuvent écraser la même révision", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-concurrency-")),
    filename = path.join(dir, "hub.sqlite");
  const a = openWorkspaceStore(filename),
    b = openWorkspaceStore(filename);
  t.after(() => {
    a.close();
    b.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  a.save("owner", "personal", {
    baseRevision: 0,
    workspace: createWorkspace(),
  });
  assert.throws(
    () =>
      b.save("owner", "personal", {
        baseRevision: 0,
        workspace: createWorkspace(),
      }),
    { code: "revision_conflict" },
  );
  assert.equal(b.read("owner").revision, 1);
});
