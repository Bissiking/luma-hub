// Entrée protégée : un HTML incomplet ne doit pas produire un écran vide.
const required = [
  "view",
  "guestView",
  "appShell",
  "bootStatus",
  "navFavoritesCount",
  "topbarName",
  "menuName",
  "menuEmail",
  "topbarAvatar",
  "openKyrosAccount",
  "sidebarKyrosAccount",
  "logoutButton",
  "logoutError",
  "accountMenu",
  "searchOverlay",
  "searchInput",
  "searchResults",
];
try {
  const missing = required.filter((id) => !document.getElementById(id));
  if (missing.length)
    throw new Error(`Shell incomplet : ${missing.join(", ")}`);
  await import("./app.js");
} catch (error) {
  console.error("[luma-hub] boot failed", error);
  const main = document.createElement("main");
  main.className = "boot-failure";
  const title = document.createElement("h1");
  title.textContent = "LUMA Hub n’a pas pu démarrer.";
  const message = document.createElement("p");
  message.textContent =
    "Les fichiers chargés sont incomplets ou incompatibles. Rechargez la page pour récupérer la version courante.";
  const reload = document.createElement("button");
  reload.className = "btn btn-primary";
  reload.textContent = "Recharger le Hub";
  reload.onclick = () => location.reload();
  main.append(title, message, reload);
  document.body.replaceChildren(main);
}
