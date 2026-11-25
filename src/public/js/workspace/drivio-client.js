import { request } from "../api.js";
import { workspace } from "./store.js";

export const drivio = {
  status: "loading",
  connection: null,
  error: null,
  vehicles: { status: "idle", items: [], nextOffset: null, error: null },
  summaries: new Map(),
};
const emit = () => document.dispatchEvent(new CustomEvent("hub:drivio"));
let statusPromise,
  vehiclesPromise,
  epoch = 0;
const widgets = () =>
  workspace.data?.widgets.filter(
    (w) => w.type === "drivio" || w.type === "drivio-vehicles",
  ) || [];
export function selectedDrivioVehicle(widget) {
  return (
    widget.config.vehicleId ||
    drivio.vehicles.items.find((v) => v.isPrimary)?.id ||
    drivio.vehicles.items[0]?.id ||
    null
  );
}
function fail(error) {
  if (
    error.code === "drivio_reconnect_required" ||
    error.code === "drivio_not_connected"
  ) {
    epoch++;
    drivio.vehicles = {
      status: "idle",
      items: [],
      nextOffset: null,
      error: null,
    };
    drivio.summaries.clear();
    drivio.error = error;
    drivio.status = "error";
  }
}
export async function loadDrivioStatus() {
  if (statusPromise) return statusPromise;
  const generation = epoch;
  statusPromise = (async () => {
    try {
      const connection = await request("/api/connectors/drivio");
      if (generation !== epoch) return;
      if (
        connection.connectionId !== drivio.connection?.connectionId ||
        !connection.configured
      ) {
        epoch++;
        drivio.vehicles = {
          status: "idle",
          items: [],
          nextOffset: null,
          error: null,
        };
        drivio.summaries.clear();
      }
      drivio.connection = connection;
      drivio.status = "ready";
      drivio.error = null;
    } catch (error) {
      if (generation === epoch) {
        drivio.status = "error";
        drivio.error = error;
      }
    } finally {
      statusPromise = null;
      emit();
    }
  })();
  return statusPromise;
}
export async function loadDrivioVehicles({ more = false, force = false } = {}) {
  if (vehiclesPromise)
    return vehiclesPromise.then(() => {
      if (drivio.vehicles.status === "idle")
        return loadDrivioVehicles({ more, force });
    });
  if (!drivio.connection?.configured || drivio.status === "error") return;
  const generation = epoch,
    previous = drivio.vehicles.items,
    offset = more ? drivio.vehicles.nextOffset : 0;
  if (offset === null) return;
  drivio.vehicles.status = "loading";
  drivio.vehicles.error = null;
  emit();
  vehiclesPromise = (async () => {
    try {
      const result = await request(
        `/api/connectors/drivio/vehicles?offset=${offset}${force ? "&refresh=1" : ""}`,
      );
      if (epoch !== generation) return;
      const items = more
        ? [...previous, ...result.data.vehicles]
        : result.data.vehicles;
      drivio.vehicles = {
        status: "ready",
        items: [...new Map(items.map((v) => [v.id, v])).values()],
        nextOffset: result.data.nextOffset,
        error: null,
        fetchedAt: result.fetchedAt,
      };
    } catch (error) {
      if (epoch === generation) {
        fail(error);
        if (epoch === generation)
          drivio.vehicles = {
            status: "error",
            items: [],
            nextOffset: null,
            error,
          };
      }
    } finally {
      vehiclesPromise = null;
      emit();
    }
  })();
  return vehiclesPromise;
}
export async function loadDrivioSummary(vehicleId, { force = false } = {}) {
  if (!vehicleId || !drivio.connection?.configured || drivio.status === "error")
    return;
  const existing = drivio.summaries.get(vehicleId);
  if (existing?.status === "loading" || (!force && existing)) return;
  const generation = epoch,
    item = { status: "loading", data: null, error: null };
  drivio.summaries.set(vehicleId, item);
  emit();
  try {
    const result = await request(
      `/api/connectors/drivio/summary?vehicle=${encodeURIComponent(vehicleId)}${force ? "&refresh=1" : ""}`,
    );
    if (epoch === generation)
      Object.assign(item, {
        status: "ready",
        data: result.data,
        fetchedAt: result.fetchedAt,
      });
  } catch (error) {
    if (epoch === generation) {
      fail(error);
      if (epoch === generation)
        Object.assign(item, { status: "error", error, data: null });
    }
  }
  emit();
}
export async function ensureDrivioWidgets() {
  if (
    !widgets().length ||
    drivio.status !== "ready" ||
    !drivio.connection?.configured
  )
    return;
  if (drivio.vehicles.status === "idle") await loadDrivioVehicles();
  for (const widget of widgets())
    if (widget.type === "drivio")
      loadDrivioSummary(selectedDrivioVehicle(widget));
}
export async function refreshDrivio() {
  await loadDrivioStatus();
  if (!drivio.connection?.configured || drivio.status === "error") return;
  await loadDrivioVehicles({ force: true });
  await Promise.all(
    [
      ...new Set(
        widgets()
          .filter((w) => w.type === "drivio")
          .map(selectedDrivioVehicle),
      ),
    ].map((id) => loadDrivioSummary(id, { force: true })),
  );
}
export async function disconnectDrivio() {
  const result = await request("/api/connectors/drivio", { method: "DELETE" });
  epoch++;
  drivio.connection = result;
  drivio.status = "ready";
  drivio.error = null;
  drivio.vehicles = {
    status: "idle",
    items: [],
    nextOffset: null,
    error: null,
  };
  drivio.summaries.clear();
  emit();
}
export function initDrivio(render) {
  document.addEventListener("hub:drivio", render);
  document.addEventListener("hub:workspace", () =>
    queueMicrotask(ensureDrivioWidgets),
  );
  loadDrivioStatus().then(ensureDrivioWidgets);
  setInterval(() => {
    if (!document.hidden && widgets().length) refreshDrivio();
  }, 300000);
}
