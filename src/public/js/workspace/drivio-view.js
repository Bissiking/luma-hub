import { escapeHtml as e, icon } from "../ui.js";
import { state } from "../state.js";
import { drivio, selectedDrivioVehicle } from "./drivio-client.js";
const n = (value, unit = "") =>
  value === null || value === undefined
    ? "Indisponible"
    : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ""}`;
const money = (value) =>
  value == null
    ? "Indisponible"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(value);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date non renseignée";
const url = (path) => `${drivio.connection?.baseUrl || ""}${path}`;
const link = (path, label) =>
  `<a class="text-btn" href="${e(url(path))}" target="_blank" rel="noopener">${e(label)} ${icon("external")}</a>`;
function unavailable() {
  if (drivio.status === "loading")
    return '<p class="drivio-message" role="status">Vérification de la connexion Drivio…</p>';
  if (drivio.error)
    return `<p class="drivio-message" role="status">${e(drivio.error.message)}</p><button class="btn" data-drivio-refresh>Réessayer</button><a class="text-btn" href="#/personnaliser">Réglages de connexion ${icon("arrow")}</a>`;
  if (!drivio.connection?.configured)
    return `<div class="drivio-message"><p>Choisissez dans Drivio les véhicules à afficher ici.</p><a class="btn btn-primary" href="/api/connectors/drivio/authorize">Connecter Drivio ${icon("external")}</a></div>`;
  return "";
}
function errorMessage(error) {
  return `<p class="drivio-message" role="status">${e(error?.message || "Données Drivio indisponibles.")}</p><button class="btn" data-drivio-refresh>Réessayer</button>`;
}
function loading() {
  return '<div class="drivio-loading" role="status">Chargement depuis Drivio…</div>';
}
function footer(fetchedAt) {
  return `<footer class="drivio-footer"><span>Lecture seule${fetchedAt ? ` · Actualisé à ${e(new Date(fetchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))}` : ""}</span><button class="icon-btn" data-drivio-refresh aria-label="Actualiser Drivio">${icon("refresh")}</button></footer>`;
}
export function renderDrivioVehicles() {
  const blocked = unavailable();
  if (blocked) return blocked;
  const source = drivio.vehicles;
  if (source.status === "error") return errorMessage(source.error);
  if (source.status === "idle" || source.status === "loading") return loading();
  return `${source.items.length ? `<ul class="drivio-vehicles">${source.items.map((v) => `<li><a href="${e(url(`/suivi?vehicle=${encodeURIComponent(v.id)}`))}" target="_blank" rel="noopener"><span><strong>${e(`${v.brand} ${v.model}`)}</strong><small>${e(String(v.year))}${v.isPrimary ? " · Principal" : ""}${v.status !== "ACTIVE" ? " · Archivé" : ""}</small></span><span class="drivio-mileage">${e(n(v.mileage.value, "km"))}${icon("external")}</span></a></li>`).join("")}</ul>` : '<p class="muted">Aucun véhicule dans Drivio.</p>'}${source.nextOffset !== null ? '<button class="btn" data-drivio-more>Afficher plus de véhicules</button>' : ""}${link("/garage", "Ouvrir le garage")}${footer(source.fetchedAt)}`;
}
function maintenance(data) {
  return `<section class="drivio-section"><h3>Entretiens à venir</h3>${
    data.maintenance.items.length
      ? `<ul class="drivio-maintenance">${data.maintenance.items
          .map((item) => {
            const label = {
              OVERDUE: "En retard",
              SOON: "À prévoir",
              OK: "Planifié",
            }[item.status];
            const remaining = [];
            if (item.kmRemaining !== null)
              remaining.push(
                item.kmRemaining > 0
                  ? `${n(item.kmRemaining, "km")} restants`
                  : item.kmRemaining < 0
                    ? `${n(-item.kmRemaining, "km")} de retard`
                    : "À échéance au compteur",
              );
            if (item.dueDate) remaining.push(date(item.dueDate));
            return `<li><div><strong>${e(item.title)}</strong><small>${e(remaining.join(" · ") || "Échéance non renseignée")}</small></div><span class="drivio-state state-${item.status.toLowerCase()}">${label}</span></li>`;
          })
          .join("")}</ul>`
      : '<p class="muted">Aucune échéance enregistrée.</p>'
  }${data.maintenance.truncated ? '<p class="drivio-note">Échantillon limité à 100 échéances. Retrouvez toutes les données dans Drivio.</p>' : data.maintenance.totalInSample > data.maintenance.items.length ? `<p class="drivio-note">${data.maintenance.items.length} premières échéances sur ${data.maintenance.totalInSample}.</p>` : ""}</section>`;
}
function expenses(data, details = false) {
  const month = data.expenses.month;
  return `<section class="drivio-section"><h3>Dépenses du mois · UTC</h3><p class="drivio-amount">${e(money(month.total))}</p><p class="drivio-note">${month.count} écriture${month.count > 1 ? "s" : ""} · Du ${e(date(month.from))} au ${e(date(month.to))}</p>${details && data.expenses.recent.length ? `<ul class="drivio-maintenance">${data.expenses.recent.map((item) => `<li><div><strong>${e(item.category.replaceAll("_", " "))}</strong><small>${e(date(item.date))}</small></div><span>${e(money(item.amount))}</span></li>`).join("")}</ul>` : ""}</section>`;
}
function fuel(data, details = false) {
  const fuel = data.fuel;
  return `<section class="drivio-section"><h3>Carburant</h3>${fuel.consumptionPer100Km === null ? '<p class="muted">Pas assez de pleins exploitables pour calculer une consommation.</p>' : `<p class="drivio-consumption">${e(n(fuel.consumptionPer100Km, "L/100 km"))}</p>`}${fuel.costPer100Km !== null ? `<p class="drivio-note">${e(money(fuel.costPer100Km))} / 100 km</p>` : ""}<p class="drivio-note">${fuel.entriesInSample} plein${fuel.entriesInSample > 1 ? "s" : ""} dans l’échantillon${fuel.truncated ? " · Limité aux 100 derniers pleins" : ""}</p>${details && fuel.entriesInSample ? `<dl class="drivio-details"><div><dt>Volume relevé</dt><dd>${e(n(fuel.liters, "L"))}</dd></div><div><dt>Dépenses de l’échantillon</dt><dd>${e(money(fuel.total))}</dd></div></dl><p class="drivio-note">Du ${e(date(fuel.from))} au ${e(date(fuel.to))}. Moyenne sur les trajets clôturés entre pleins complets.</p>` : ""}</section>`;
}
export function renderDrivioSummary(widget) {
  const blocked = unavailable();
  if (blocked) return blocked;
  const vehicleId = selectedDrivioVehicle(widget);
  if (!vehicleId)
    return drivio.vehicles.status === "error"
      ? errorMessage(drivio.vehicles.error)
      : drivio.vehicles.status === "ready"
        ? `<p class="muted">Ajoutez un véhicule dans Drivio pour suivre ses échéances ici.</p>${link("/garage", "Ouvrir Drivio")}`
        : loading();
  const item = drivio.summaries.get(vehicleId);
  if (!item || item.status === "loading") return loading();
  if (item.status === "error") return errorMessage(item.error);
  const vehicle = drivio.vehicles.items.find((v) => v.id === vehicleId),
    data = item.data,
    view = widget.config.view;
  const alerts =
    (view === "overview" || view === "maintenance") && data.alerts.items.length
      ? `<ul class="drivio-alerts">${data.alerts.items.map((a) => `<li><strong>${icon(a.urgent ? "alert" : "info")}${e(a.title)}</strong><p>${e(a.detail)}</p></li>`).join("")}</ul>`
      : "";
  return `<div class="drivio-vehicle-heading"><strong>${e(vehicle ? `${vehicle.brand} ${vehicle.model}` : "Véhicule sélectionné")}</strong><span>${e(n(data.mileage.value, "km"))}</span></div>${alerts}${data.alerts.truncated && (view === "overview" || view === "maintenance") ? '<p class="drivio-note">La liste d’alertes est limitée ; consultez Drivio pour la vue complète.</p>' : ""}${view === "overview" || view === "maintenance" ? maintenance(data) : ""}${view === "overview" || view === "expenses" ? expenses(data, view === "expenses") : ""}${view === "overview" || view === "fuel" ? fuel(data, view === "fuel") : ""}${link(`/suivi?vehicle=${encodeURIComponent(vehicleId)}`, "Ouvrir dans Drivio")}${footer(item.fetchedAt)}`;
}
export function renderDrivioSettings() {
  const connection = drivio.connection;
  const result = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "drivio",
  );
  const outcome = {
    connected:
      "Drivio est connecté. Vous pouvez maintenant ajouter vos widgets.",
    cancelled: "Connexion annulée. Aucun nouvel accès n’a été ajouté.",
    account_mismatch:
      "Utilisez le même compte Kyros dans Drivio et dans le Hub.",
    failed: "La connexion n’a pas abouti. Relancez-la depuis ce bouton.",
  }[result];
  return `<section class="settings-section drivio-settings" aria-labelledby="drivioSettingsTitle"><header><h2 id="drivioSettingsTitle">Votre garage Drivio</h2><span class="pill">Lecture seule</span></header><p>Connectez Drivio, choisissez les véhicules à partager, puis retrouvez leur suivi dans vos widgets.</p>${outcome ? `<p class="connection-status" role="status">${e(outcome)}</p>` : ""}${drivio.status === "loading" ? '<p class="drivio-message">Vérification de la connexion…</p>' : drivio.error ? `<p class="drivio-message" role="status">${e(drivio.error.message)}</p>` : connection?.configured ? `<p class="connection-status">${icon("check")}Drivio est connecté à votre compte.</p>` : '<p class="connection-status">Votre garage n’est pas encore connecté.</p>'}<div class="settings-actions">${connection?.available ? `<a class="btn ${connection.configured ? "" : "btn-primary"}" href="/api/connectors/drivio/authorize">${icon("car")}${connection.configured ? "Choisir les véhicules partagés" : "Connecter Drivio"}</a>` : ""}${connection?.configured ? `<button class="btn" data-add-drivio-widget>${icon("plus")}Ajouter un suivi</button><button class="btn" data-drivio-refresh>${icon("refresh")}Actualiser</button><button class="btn" data-drivio-disconnect>Déconnecter Drivio</button>` : ""}</div><p class="drivio-note">Vous autorisez l’accès dans Drivio avec votre compte Kyros. Le Hub peut consulter les véhicules choisis ; il ne peut ni les modifier ni les supprimer.</p>${connection?.remoteRevoked === false ? '<p class="drivio-note" role="status">La connexion a été retirée du Hub. Vérifiez aussi la révocation dans les paramètres Drivio.</p>' : ""}${connection?.baseUrl ? link("/parametres", "Voir les applications autorisées dans Drivio") : ""}</section>`;
}
