// Projection explicite du contrat Drivio 2.1.0 : aucun contenu libre interprété.
import { WorkspaceError } from "../public/js/workspace/model.js";
const bad = () => {
  throw new WorkspaceError(
    "drivio_invalid_response",
    "La réponse Drivio est incompatible. Réessayez après vérification du service.",
    502,
  );
};
const obj = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad();
  return value;
};
const str = (value, max = 200) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
  )
    bad();
  return value;
};
const nullableStr = (value, max) => (value == null ? null : str(value, max));
const num = (value) => {
  if (
    value !== null &&
    (typeof value !== "number" ||
      !Number.isFinite(value) ||
      Math.abs(value) > 1e15)
  )
    bad();
  return value;
};
const integer = (value, max) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) bad();
  return value;
};
const bool = (value) => {
  if (typeof value !== "boolean") bad();
  return value;
};
const date = (value) => {
  if (value === null) return null;
  str(value, 40);
  if (!/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value)))
    bad();
  return value;
};
const list = (value, max, parse) => {
  if (!Array.isArray(value) || value.length > max) bad();
  return value.map((x) => parse(obj(x)));
};
function header(raw) {
  obj(raw);
  if (raw.version !== "1") bad();
  return { version: "1", generatedAt: date(raw.generatedAt) };
}
function mileage(raw) {
  obj(raw);
  if (raw.unit !== "km" || raw.source !== "recorded") bad();
  return {
    value: num(raw.value),
    unit: "km",
    source: "recorded",
    ...(Object.hasOwn(raw, "recordedAt")
      ? { recordedAt: date(raw.recordedAt) }
      : {}),
  };
}
export function vehiclesResponse(raw) {
  const base = header(raw);
  return {
    ...base,
    vehicles: list(raw.vehicles, 50, (v) => ({
      id: str(v.id, 100),
      brand: str(v.brand),
      model: str(v.model),
      year: integer(v.year, 9999),
      status: str(v.status, 40),
      isPrimary: bool(v.isPrimary),
      mileage: mileage(v.mileage),
    })),
    nextOffset: raw.nextOffset === null ? null : integer(raw.nextOffset, 10050),
  };
}
export function summaryResponse(raw, vehicleId) {
  const base = header(raw);
  if (raw.vehicleId !== vehicleId) bad();
  const maintenance = obj(raw.maintenance),
    alerts = obj(raw.alerts),
    expenses = obj(raw.expenses),
    month = obj(expenses.month),
    fuel = obj(raw.fuel);
  if (
    month.currency !== "EUR" ||
    month.source !== "recorded" ||
    month.basis !== "expense-ledger" ||
    fuel.currency !== "EUR" ||
    fuel.source !== "calculated"
  )
    bad();
  return {
    ...base,
    vehicleId,
    mileage: mileage(raw.mileage),
    maintenance: {
      items: list(maintenance.items, 5, (item) => {
        if (!["OVERDUE", "SOON", "OK"].includes(item.status)) bad();
        return {
          id: str(item.id, 100),
          type: str(item.type, 100),
          category: nullableStr(item.category, 100),
          subcategory: nullableStr(item.subcategory, 100),
          title: str(item.title, 1000),
          dueDate: date(item.dueDate),
          dueMileage: num(item.dueMileage),
          status: item.status,
          daysRemaining: num(item.daysRemaining),
          kmRemaining: num(item.kmRemaining),
          estimatedDate: date(item.estimatedDate),
        };
      }),
      totalInSample: integer(maintenance.totalInSample, 100),
      truncated: bool(maintenance.truncated),
    },
    alerts: {
      items: list(alerts.items, 10, (item) => ({
        key: str(item.key, 250),
        category: str(item.category, 100),
        title: str(item.title, 1000),
        detail: str(item.detail, 4000),
        urgent: bool(item.urgent),
      })),
      truncated: bool(alerts.truncated),
    },
    expenses: {
      recent: list(expenses.recent, 5, (item) => ({
        id: str(item.id, 100),
        category: str(item.category, 100),
        subcategory: nullableStr(item.subcategory, 100),
        amount: num(item.amount),
        date: date(item.date),
      })),
      month: {
        from: date(month.from),
        to: date(month.to),
        total: num(month.total),
        count: integer(month.count, Number.MAX_SAFE_INTEGER),
        currency: "EUR",
        source: "recorded",
        basis: "expense-ledger",
      },
    },
    fuel: {
      entriesInSample: integer(fuel.entriesInSample, 100),
      truncated: bool(fuel.truncated),
      from: date(fuel.from),
      to: date(fuel.to),
      consumptionPer100Km: num(fuel.consumptionPer100Km),
      costPer100Km: num(fuel.costPer100Km),
      total: num(fuel.total),
      liters: num(fuel.liters),
      currency: "EUR",
      source: "calculated",
    },
  };
}
