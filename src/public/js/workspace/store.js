import { request } from "../api.js";
import { state } from "../state.js";
import { COMPOSITIONS, defaultConfig, validateWorkspace } from "./model.js";
import { draftOperation, isolateDrafts } from "./cache.js";

export const workspace = {
  data: null,
  revision: 0,
  status: "loading",
  error: null,
  editing: false,
  recovery: null,
};
export const deviceQuery = matchMedia("(max-width: 700px)");
export const device = () => (deviceQuery.matches ? "mobile" : "desktop");
export const composition = () =>
  workspace.data?.compositions[device()] || "dashboard";
export const layout = () =>
  workspace.data?.layouts[device()][composition()] || [];
let timer,
  saving = false,
  changed = 0,
  saved = 0;
const key = () =>
  `${state.session?.user?.id}:personal:${state.session?.authTime}`;
const emit = () => document.dispatchEvent(new CustomEvent("hub:workspace"));
export async function loadWorkspace() {
  clearTimeout(timer);
  workspace.status = "loading";
  workspace.error = null;
  emit();
  try {
    const result = await request("/api/workspace/personal");
    workspace.data = validateWorkspace(result.workspace);
    workspace.revision = result.revision;
    workspace.error = null;
    changed = saved = 0;
    workspace.status = "saved";
    await isolateDrafts(key());
    const draft = await draftOperation("get", key());
    workspace.recovery = draft
      ? { ...draft, workspace: validateWorkspace(draft.workspace) }
      : null;
  } catch (error) {
    workspace.status = "error";
    workspace.error = error.message;
  }
  emit();
}
export function mutateWorkspace(change) {
  if (
    !workspace.data ||
    ["conflict", "loading"].includes(workspace.status) ||
    workspace.recovery
  )
    return;
  const next = structuredClone(workspace.data);
  change(next);
  workspace.data = validateWorkspace(next);
  changed++;
  workspace.status = "pending";
  workspace.error = null;
  clearTimeout(timer);
  timer = setTimeout(flushWorkspace, 650);
  emit();
}
export async function flushWorkspace() {
  if (
    saving ||
    changed === saved ||
    ["conflict", "loading"].includes(workspace.status)
  )
    return;
  saving = true;
  const generation = changed;
  const snapshot = structuredClone(workspace.data),
    baseRevision = workspace.revision;
  workspace.status = "saving";
  emit();
  await draftOperation("set", key(), { baseRevision, workspace: snapshot });
  try {
    const result = await request("/api/workspace/personal", {
      method: "PUT",
      body: { baseRevision, workspace: snapshot },
    });
    workspace.revision = result.revision;
    workspace.error = null;
    saved = generation;
    if (changed === generation) {
      workspace.status = "saved";
      await draftOperation("delete", key());
    } else workspace.status = "pending";
  } catch (error) {
    workspace.status = error.status === 409 ? "conflict" : "error";
    workspace.error = error.message;
  } finally {
    saving = false;
    emit();
    if (workspace.status === "pending") {
      clearTimeout(timer);
      timer = setTimeout(flushWorkspace, 650);
    }
  }
}
export async function discardDraft() {
  await draftOperation("delete", key());
  workspace.recovery = null;
  await loadWorkspace();
}
export function restoreDraft() {
  const draft = workspace.recovery;
  if (!draft || draft.baseRevision !== workspace.revision) return;
  workspace.data = validateWorkspace(draft.workspace);
  workspace.recovery = null;
  changed++;
  workspace.status = "pending";
  emit();
  flushWorkspace();
}
export function addWidget(type) {
  mutateWorkspace((data) => {
    if (data.widgets.length >= 24)
      throw new Error("Vous pouvez ajouter jusqu’à 24 widgets.");
    const id = crypto.randomUUID();
    data.widgets.push({ id, type, title: "", config: defaultConfig(type) });
    for (const format of ["desktop", "mobile"])
      for (const name of Object.keys(COMPOSITIONS))
        data.layouts[format][name].push({
          id,
          width: format === "mobile" ? 2 : 1,
          height: 1,
        });
  });
}
export function duplicateWidget(id) {
  const original = workspace.data.widgets.find((w) => w.id === id);
  if (!original) return;
  mutateWorkspace((data) => {
    if (data.widgets.length >= 24)
      throw new Error("Vous pouvez ajouter jusqu’à 24 widgets.");
    const copy = { ...structuredClone(original), id: crypto.randomUUID() };
    data.widgets.push(copy);
    for (const format of ["desktop", "mobile"])
      for (const name of Object.keys(COMPOSITIONS)) {
        const items = data.layouts[format][name],
          index = items.findIndex((item) => item.id === id);
        items.splice(index + 1, 0, { ...items[index], id: copy.id });
      }
  });
}
export function removeWidget(id) {
  mutateWorkspace((data) => {
    data.widgets = data.widgets.filter((w) => w.id !== id);
    for (const format of ["desktop", "mobile"])
      for (const name of Object.keys(COMPOSITIONS))
        data.layouts[format][name] = data.layouts[format][name].filter(
          (w) => w.id !== id,
        );
  });
}
export function moveWidget(id, targetId, after = false) {
  mutateWorkspace((data) => {
    const items = data.layouts[device()][composition()];
    const index = items.findIndex((w) => w.id === id);
    if (index < 0 || id === targetId) return;
    const [item] = items.splice(index, 1);
    const target = items.findIndex((w) => w.id === targetId);
    items.splice(target < 0 ? items.length : target + Number(after), 0, item);
  });
}
export async function clearWorkspaceCache() {
  clearTimeout(timer);
  await draftOperation("clear");
}
export function hasUnsavedChanges() {
  return changed !== saved;
}
window.addEventListener("beforeunload", (event) => {
  if (hasUnsavedChanges()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
