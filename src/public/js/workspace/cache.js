// Cache de brouillons uniquement : aucun catalogue, secret, token ou permission.
const NAME = "luma-workspace-drafts";
let database;
async function db() {
  try {
    if (!globalThis.indexedDB) return null;
  } catch {
    return null;
  }
  if (!database)
    database = new Promise((resolve, reject) => {
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, 1500);
      const request = indexedDB.open(NAME, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("drafts");
      request.onsuccess = () => {
        clearTimeout(timeout);
        if (timedOut) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timeout);
        reject(request.error);
      };
      request.onblocked = () => {
        clearTimeout(timeout);
        timedOut = true;
        resolve(null);
      };
    });
  try {
    return await database;
  } catch {
    return null;
  }
}
export async function draftOperation(mode, key, value) {
  const database = await db();
  if (!database) return null;
  return new Promise((resolve) => {
    const tx = database.transaction(
      "drafts",
      mode === "get" ? "readonly" : "readwrite",
    );
    const store = tx.objectStore("drafts");
    const request =
      mode === "get"
        ? store.get(key)
        : mode === "set"
          ? store.put(value, key)
          : mode === "delete"
            ? store.delete(key)
            : store.clear();
    tx.oncomplete = () => resolve(request.result ?? null);
    tx.onerror = tx.onabort = () => resolve(null);
  }).catch(() => null);
}
export async function isolateDrafts(key) {
  const database = await db();
  if (!database) return;
  await new Promise((resolve) => {
    const tx = database.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts");
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (row) {
        if (row.key !== key) row.delete();
        row.continue();
      }
    };
    tx.oncomplete = tx.onabort = tx.onerror = resolve;
  }).catch(() => {});
}
