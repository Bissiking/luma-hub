import { icon, escapeHtml as e, toast } from "../ui.js";
import { loadHarmonix, disconnectHarmonix } from './harmonix-client.js';
import { openSearch } from "../search.js";
import { WIDGETS, CONNECTORS, validateConfig } from "./model.js";
import {
  workspace,
  device,
  composition,
  layout,
  deviceQuery,
  loadWorkspace,
  mutateWorkspace,
  flushWorkspace,
  addWidget,
  removeWidget,
  duplicateWidget,
  moveWidget,
  discardDraft,
  restoreDraft,
} from "./store.js";
import {
  calendarMarkup,
  calendarOffsets,
  clockParts,
  setLauncherQuery,
  launcherResults,
} from "./view.js";
import {
  drivio,
  loadDrivioVehicles,
  refreshDrivio,
  disconnectDrivio,
  ensureDrivioWidgets,
} from "./drivio-client.js";

let dialog, popover;
function showDialog(title, body, submitLabel = null) {
  popover?.hidePopover();
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "workspace-dialog";
    document.body.append(dialog);
  }
  dialog.innerHTML = `<form id="widgetForm"><header class="dialog-head"><h2 id="dialogTitle">${e(title)}</h2><button class="icon-btn" type="button" data-close-dialog aria-label="Fermer">${icon("close")}</button></header><div class="dialog-body">${body}</div>${submitLabel ? `<footer class="dialog-footer"><p id="configError" role="alert"></p><button class="btn" type="button" data-close-dialog>Annuler</button><button class="btn btn-primary" type="submit">${e(submitLabel)}</button></footer>` : ""}</form>`;
  dialog.setAttribute("aria-labelledby", "dialogTitle");
  dialog.showModal();
  dialog
    .querySelector("form")
    .addEventListener("submit", (event) => event.preventDefault());
  dialog
    .querySelector("[data-close-dialog]")
    .addEventListener("click", () => dialog.close());
  dialog
    .querySelectorAll("[data-close-dialog]")
    .forEach((button) => (button.onclick = () => dialog.close()));
  return dialog.querySelector("form");
}
export function showWidgetCatalog() {
  showDialog(
    "Ajouter un widget",
    `<p class="muted">Ajoutez des widgets natifs ou connectés à votre espace.</p><div class="widget-catalog">${Object.entries(
      WIDGETS,
    )
      .map(
        ([type, spec]) =>
          `<article><div class="catalog-widget-icon">${icon(spec.icon)}</div><div><h3>${e(spec.name)}</h3><p>${e(spec.description)}</p></div><button class="btn" data-widget-add="${type}" ${workspace.data?.widgets.length >= 24 ? "disabled" : ""} aria-label="Ajouter ${e(spec.name)}">${icon("plus")}Ajouter</button></article>`,
      )
      .join(
        "",
      )}</div><h3 class="dialog-subtitle">Connecteurs indisponibles</h3><ul class="connector-list">${CONNECTORS.filter(
      (c) => !c.available,
    )
      .map(
        (c) =>
          `<li><div><strong>${e(c.name)}</strong><p>${e(c.reason)}</p></div><span class="pill">Indisponible</span></li>`,
      )
      .join("")}</ul>`,
  );
}
function linkRow(link = { label: "", url: "" }) {
  return `<div class="link-editor"><label>Libellé<input name="link-label" maxlength="80" value="${e(link.label)}" placeholder="Mon lien"></label><label>Adresse<input name="link-url" type="url" maxlength="2048" value="${e(link.url)}" placeholder="https://…"></label><button class="icon-btn" type="button" data-remove-link aria-label="Retirer ce lien">${icon("trash")}</button></div>`;
}
async function configureWidget(id) {
  const widget = workspace.data.widgets.find((w) => w.id === id);
  if (!widget) return;
  const spec = WIDGETS[widget.type],
    item = layout().find((w) => w.id === id);
  let config = "";
  if (widget.type === "drivio") {
    if (drivio.vehicles.status === "idle") await loadDrivioVehicles();
    config = `<label>Véhicule<select name="vehicleId"><option value="">Véhicule principal, sinon premier véhicule</option>${drivio.vehicles.items.map((v) => `<option value="${e(v.id)}" ${widget.config.vehicleId === v.id ? "selected" : ""}>${e(`${v.brand} ${v.model}`)}</option>`).join("")}${widget.config.vehicleId && !drivio.vehicles.items.some((v) => v.id === widget.config.vehicleId) ? `<option value="${e(widget.config.vehicleId)}" selected>Véhicule sélectionné précédemment</option>` : ""}</select></label>${drivio.vehicles.nextOffset !== null ? '<button class="btn" type="button" data-drivio-config-more>Charger d’autres véhicules</button>' : ""}<label>Informations affichées<select name="drivioView">${[
      ["overview", "Vue d’ensemble"],
      ["maintenance", "Entretiens et alertes"],
      ["expenses", "Dépenses"],
      ["fuel", "Carburant"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${widget.config.view === value ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>`;
  }
  if (widget.type === "clock")
    config = `<label>Fuseau horaire<input name="timezone" value="${e(widget.config.timezone)}" list="timezones" placeholder="Fuseau de l’appareil"><datalist id="timezones"><option>Europe/Paris</option><option>Europe/London</option><option>America/Montreal</option><option>America/New_York</option><option>Asia/Tokyo</option><option>UTC</option></datalist></label><label class="check-label"><input name="hour12" type="checkbox" ${widget.config.hour12 ? "checked" : ""}>Format 12 heures</label>`;
  if (["favorites", "recents"].includes(widget.type))
    config = `<label>Nombre d’applications affichées<input name="limit" type="number" min="1" max="24" required value="${widget.config.limit}"></label>`;
  if (widget.type === "shortcuts")
    config = `<p class="muted">Sans lien personnalisé, les accès à Kyros et aux applications sont proposés.</p><div id="linkRows">${widget.config.links.map(linkRow).join("")}</div><button class="btn" type="button" data-add-link>${icon("plus")}Ajouter un lien</button>`;
  const form = showDialog(
    `Configurer · ${spec.name}`,
    `<label>Titre du widget<input name="title" maxlength="80" value="${e(widget.title)}" placeholder="${e(spec.name)}"></label>${config}<div class="size-settings"><label>Largeur · ${device() === "mobile" ? "mobile" : "desktop"}<select name="width">${Array.from({ length: device() === "mobile" ? 2 : 3 }, (_, i) => `<option value="${i + 1}" ${item.width === i + 1 ? "selected" : ""}>${i + 1} colonne${i ? "s" : ""}</option>`).join("")}</select></label><label>Hauteur<select name="height"><option value="1" ${item.height === 1 ? "selected" : ""}>Standard</option><option value="2" ${item.height === 2 ? "selected" : ""}>Étendue</option></select></label></div><p class="source-note">Source : ${e(spec.source)}.</p>`,
    "Enregistrer",
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    const values = new FormData(form);
    let config = { ...widget.config };
    if (widget.type === "drivio")
      config = {
        vehicleId: values.get("vehicleId"),
        view: values.get("drivioView"),
      };
    if (widget.type === "clock")
      config = {
        timezone: values.get("timezone").trim(),
        hour12: values.get("hour12") === "on",
      };
    if (["favorites", "recents"].includes(widget.type))
      config = { limit: Number(values.get("limit")) };
    if (widget.type === "shortcuts")
      config = {
        links: [...form.querySelectorAll(".link-editor")]
          .map((row) => ({
            label: row.querySelector("[name=link-label]").value,
            url: row.querySelector("[name=link-url]").value,
          }))
          .filter((link) => link.label || link.url),
      };
    try {
      config = validateConfig(widget.type, config);
      mutateWorkspace((data) => {
        Object.assign(
          data.widgets.find((w) => w.id === id),
          { title: values.get("title").trim(), config },
        );
        Object.assign(
          data.layouts[device()][composition()].find((w) => w.id === id),
          {
            width: Number(values.get("width")),
            height: Number(values.get("height")),
          },
        );
      });
      dialog.close();
      toast("Widget configuré");
    } catch {
      form.querySelector("#configError").textContent =
        "Vérifiez le fuseau, les limites et les adresses HTTP ou HTTPS de vos liens.";
    }
  };
}
function showWidgetMenu(button) {
  if (!popover) {
    popover = document.createElement("div");
    popover.id = "widgetActions";
    popover.setAttribute("popover", "auto");
    popover.className = "widget-popover";
    document.body.append(popover);
  }
  const id = button.dataset.widgetMenu;
  popover.innerHTML = `<button data-configure-widget="${e(id)}">${icon("settings")}Configurer et redimensionner</button><button data-duplicate-widget="${e(id)}">${icon("copy")}Dupliquer</button><button data-remove-widget="${e(id)}" class="danger">${icon("trash")}Retirer de l’espace</button>`;
  const rect = button.getBoundingClientRect();
  popover.style.left = `${Math.max(12, Math.min(innerWidth - 300, rect.right - 280))}px`;
  popover.style.top = `${Math.min(innerHeight - 170, rect.bottom + 6)}px`;
  popover.showPopover();
  popover.querySelector("button").focus();
}
function exportWorkspace() {
  const data = workspace.recovery?.workspace || workspace.data;
  const blob = new Blob(
    [
      JSON.stringify(
        { format: "luma-workspace", schemaVersion: 1, workspace: data },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "luma-workspace.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function stepWidget(id, direction) {
  const items = layout(),
    index = items.findIndex((w) => w.id === id),
    target = items[index + direction];
  if (target) {
    moveWidget(id, target.id, direction > 0);
    toast("Position du widget modifiée");
  }
}
export function initWorkspace(render) {
  document.addEventListener("hub:workspace", render);
  deviceQuery.addEventListener("change", render);
  document.addEventListener("input", (event) => {
    if (event.target.id !== "launcherFilter") return;
    setLauncherQuery(event.target.value);
    const results = document.getElementById("launcherResults");
    if (results) results.innerHTML = launcherResults();
  });
  document.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-composition]");
    if (!input) return;
    mutateWorkspace((data) => {
      data.compositions[input.dataset.composition] = input.value;
    });
    toast(
      `Composition ${input.dataset.composition === "mobile" ? "mobile" : "desktop"} modifiée`,
    );
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const d = button.dataset;
    try {
      if ('harmonixRefresh' in d) await loadHarmonix({force:true});
      if ('harmonixAdd' in d) { addWidget('harmonix'); toast('Widget Harmonix ajouté'); }
      if ('harmonixDisconnect' in d) { await disconnectHarmonix(); toast('Harmonix déconnecté du Hub'); }
      if ("openSearch" in d) openSearch();
      if ("addWidget" in d) showWidgetCatalog();
      if ("widgetAdd" in d) {
        addWidget(d.widgetAdd);
        dialog.close();
        toast("Widget ajouté");
      }
      if ("editWorkspace" in d) {
        workspace.editing = !workspace.editing;
        render();
      }
      if ("widgetMenu" in d) showWidgetMenu(button);
      if ("configureWidget" in d) await configureWidget(d.configureWidget);
      if ("duplicateWidget" in d) {
        duplicateWidget(d.duplicateWidget);
        popover.hidePopover();
        toast("Widget dupliqué");
      }
      if ("removeWidget" in d) {
        removeWidget(d.removeWidget);
        popover.hidePopover();
        toast("Widget retiré");
      }
      if ("addLink" in d && dialog.querySelectorAll(".link-editor").length < 12)
        dialog
          .querySelector("#linkRows")
          .insertAdjacentHTML("beforeend", linkRow());
      if ("removeLink" in d) button.closest(".link-editor").remove();
      if ("move" in d) stepWidget(d.id, d.move === "up" ? -1 : 1);
      if ("resize" in d) await configureWidget(d.resize);
      if ("addDrivioWidget" in d) {
        addWidget("drivio");
        location.hash = "#/";
        toast("Suivi Drivio ajouté");
      }
      if ("drivioRefresh" in d) {
        button.disabled = true;
        try {
          await refreshDrivio();
          await ensureDrivioWidgets();
        } finally {
          button.disabled = false;
        }
      }
      if ("drivioMore" in d) {
        button.disabled = true;
        try {
          await loadDrivioVehicles({ more: true });
          await ensureDrivioWidgets();
        } finally {
          button.disabled = false;
        }
      }
      if ("drivioDisconnect" in d) {
        button.disabled = true;
        try {
          await disconnectDrivio();
          toast("Connexion Drivio retirée du Hub");
        } finally {
          button.disabled = false;
        }
      }
      if ("drivioConfigMore" in d) {
        const values = new FormData(dialog.querySelector("form"));
        const select = dialog.querySelector("[name=vehicleId]");
        const known = new Set(
          [...select.options].map((option) => option.value),
        );
        await loadDrivioVehicles({ more: true });
        for (const v of drivio.vehicles.items)
          if (!known.has(v.id))
            select.add(new Option(`${v.brand} ${v.model}`, v.id));
        select.value = values.get("vehicleId");
        button.hidden = drivio.vehicles.nextOffset === null;
      }
      if ("calendar" in d || "calendarToday" in d) {
        const id = d.id || d.calendarToday;
        calendarOffsets.set(
          id,
          "calendarToday" in d
            ? 0
            : Math.max(
                -120,
                Math.min(
                  120,
                  (calendarOffsets.get(id) || 0) + Number(d.calendar),
                ),
              ),
        );
        const host = [
          ...document.querySelectorAll("[data-calendar-body]"),
        ].find((el) => el.dataset.calendarBody === id);
        if (host) host.innerHTML = calendarMarkup(id);
        host?.querySelector("button")?.focus();
      }
      if ("saveRetry" in d) workspace.data ? flushWorkspace() : loadWorkspace();
      if ("loadWorkspace" in d) loadWorkspace();
      if ("discardDraft" in d) discardDraft();
      if ("restoreDraft" in d) restoreDraft();
      if ("exportWorkspace" in d) exportWorkspace();
    } catch (error) {
      toast(error.message, "error");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      (event.target.id === "launcherFilter" ||
        event.target.closest("[data-launcher-link]")) &&
      ["ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const items = [...document.querySelectorAll("[data-launcher-link]")],
        index = items.indexOf(event.target.closest("[data-launcher-link]"));
      const next = index + (event.key === "ArrowDown" ? 1 : -1);
      if (next < 0) document.getElementById("launcherFilter")?.focus();
      else items[Math.min(next, items.length - 1)]?.focus();
      return;
    }
    const handle = event.target.closest("[data-drag]");
    if (
      handle &&
      event.altKey &&
      ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      stepWidget(
        handle.dataset.drag,
        ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1,
      );
    }
  });
  let gesture;
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-drag], [data-resize-drag]");
    if (!handle || event.button !== 0) return;
    const id = handle.dataset.drag || handle.dataset.resizeDrag;
    gesture = {
      id,
      handle,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      resize: Boolean(handle.dataset.resizeDrag),
      active: event.pointerType !== "touch",
      width: layout().find((w) => w.id === id).width,
      height: layout().find((w) => w.id === id).height,
    };
    handle.setPointerCapture(event.pointerId);
    if (!gesture.active)
      gesture.timer = setTimeout(() => {
        if (gesture) {
          gesture.active = true;
          handle.closest(".widget")?.classList.add("is-dragging");
        }
      }, 350);
  });
  document.addEventListener(
    "pointermove",
    (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId || !gesture.active)
        return;
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 5)
        return;
      event.preventDefault();
      gesture.moved = true;
      gesture.handle.closest(".widget")?.classList.add("is-dragging");
      document
        .querySelectorAll(".drop-target")
        .forEach((el) => el.classList.remove("drop-target"));
      if (!gesture.resize) {
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest("[data-widget]");
        if (target && target.dataset.widget !== gesture.id) {
          target.classList.add("drop-target");
          gesture.target = target.dataset.widget;
          gesture.after =
            event.clientY >
            target.getBoundingClientRect().top + target.offsetHeight / 2;
        }
        if (event.clientY > innerHeight - 90) window.scrollBy(0, 12);
        else if (event.clientY < 100) window.scrollBy(0, -12);
      }
    },
    { passive: false },
  );
  const finish = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = gesture;
    gesture = null;
    clearTimeout(current.timer);
    document
      .querySelectorAll(".is-dragging, .drop-target")
      .forEach((el) => el.classList.remove("is-dragging", "drop-target"));
    if (event.type === "pointercancel" || !current.moved) return;
    if (current.resize) {
      const grid = current.handle.closest(".widget-grid"),
        unit = grid.clientWidth / (device() === "mobile" ? 2 : 3);
      const width = Math.max(
        1,
        Math.min(
          device() === "mobile" ? 2 : 3,
          current.width + Math.round((event.clientX - current.x) / unit),
        ),
      );
      const height = Math.max(
        1,
        Math.min(
          2,
          current.height + Math.round((event.clientY - current.y) / 180),
        ),
      );
      mutateWorkspace((data) =>
        Object.assign(
          data.layouts[device()][composition()].find(
            (w) => w.id === current.id,
          ),
          { width, height },
        ),
      );
    } else if (current.target)
      moveWidget(current.id, current.target, current.after);
  };
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
  setInterval(() => {
    for (const widget of workspace.data?.widgets || [])
      if (widget.type === "clock") {
        const parts = clockParts(widget);
        document.querySelectorAll("[data-clock-time]").forEach((el) => {
          if (el.dataset.clockTime === widget.id) el.textContent = parts.time;
        });
        document.querySelectorAll("[data-clock-date]").forEach((el) => {
          if (el.dataset.clockDate === widget.id) el.textContent = parts.date;
        });
      }
  }, 10000);
}
