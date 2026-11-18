# Workspace V1 · architecture alpha

## Décision frontend

React + Vite + TypeScript a été évalué : intérêt pour un futur grand nombre de connecteurs asynchrones, la granularité du rendu et les contrats de types. Le dépôt initial comportait déjà des modules ESM courts, un routeur hash, un client API et un moteur de favoris Kyros. Cette alpha conserve Express et le client ESM natif pour limiter le périmètre de migration de l’authentification et des routes. Le contrat de données est un module pur partagé, validé à l’exécution au serveur. Ce choix n’est pas une affirmation que le frontend est typé ou compilé.

Une migration ultérieure pourra remplacer les rendus sans modifier le schéma SQLite ni les API internes. Le script `build` vérifie le graphe d’imports et les assets ; il ne produit pas de bundle.

## Frontières

| Responsabilité | Source |
| --- | --- |
| Configuration serveur, secrets | `src/config.js`, environnement serveur |
| Client Kyros PAR/PKCE/JWKS/rotation/révocation | `src/sso.js` |
| Sessions opaques et liaison OAuth au navigateur | `src/session.js` |
| Proxy catalogue/préférences/logos, CSRF, CSP | `src/server.js` |
| Validation du workspace, registre des widgets/compositions | `src/public/js/workspace/model.js` |
| Migration SQLite et sauvegardes atomiques | `src/workspace/repository.js`, `migrations/001-workspaces.sql` |
| API des espaces et configurations | `src/workspace/routes.js` |
| Session, catalogue, favoris et récents client | `src/public/js/state.js` |
| État des widgets, debounce et conflits | `src/public/js/workspace/store.js` |
| Brouillons IndexedDB | `src/public/js/workspace/cache.js` |
| Rendus et commandes accessibles des widgets | `src/public/js/workspace/view.js`, `controller.js` |
| Démarrage protégé et routeur existant | `src/public/boot.js`, `app.js`, `js/views.js` |

## Espaces et données

Cette alpha expose uniquement `personal`. Tout autre identifiant d’espace est refusé au serveur. L’identité vient de la session vérifiée, jamais du corps ni d’un paramètre de propriétaire. Les lectures/écritures locales vérifient aussi `/api/me` dans Kyros ; une erreur d’identité ou une panne ne donne pas accès au stockage. Les comptes sont isolés par clé composée `(user_id, space_id)`.

Le contexte `/api/apps/me` représente les appartenances connues, pas une commande de sélection. La composition E expose honnêtement cette limite. Ni permissions JWT seules ni une appartenance affichée ne sont utilisées pour autoriser un espace entreprise.

SQLite ne contient aucun favori, catalogue ou token. Les favoris, épingles, masqués, ordre et affichage restent dans Kyros. Le Hub respecte l’ordre/épingles, les masqués, la densité, le mode grille/liste et la visibilité des descriptions. Le thème du Hub suit le système, conformément au choix utilisateur ; le champ thème Kyros n’est pas réécrit.

## Schéma et concurrence

Un document versionné contient les instances de widgets et dix dispositions : cinq compositions pour deux formats. Les instances sont partagées dans l’espace ; ordre, largeur et hauteur sont indépendants pour chaque disposition. Maximum 24 instances. Identifiants uniques, configurations strictes, tailles bornées, liens HTTP(S) sans identifiants ni schémas actifs. Un widget supprimé est retiré des dix dispositions atomiquement.

`PUT /api/workspace/personal` attend `{baseRevision, workspace}`. Une transaction SQLite `BEGIN IMMEDIATE` compare la révision avant de remplacer le document. Deux onglets au même état ne peuvent pas s’écraser : le second obtient 409, conserve son brouillon, et peut exporter ou recharger. Aucun retry aveugle d’un conflit.

Les déplacements/réductions de taille écrivent à la fin du geste, avec regroupement de 650 ms. Les mutations pendant une requête en cours sont sérialisées dans la génération suivante. Une panne propose une relance explicite ; aucune boucle d’appels distants.

## Cache et cycle de session

IndexedDB ne cache que les brouillons de configurations. La clé comporte utilisateur, espace et heure d’authentification. Le serveur reste toujours prioritaire au chargement : un brouillon retrouvé demande une restauration explicite à révision égale, ou un export si le serveur a changé. Les autres clés de session sont supprimées. Logout et expiration nettoient ce cache. Une indisponibilité d’IndexedDB n’empêche pas SQLite de fonctionner.

L’historique local existant `luma-hub:v1:recent:<compte>` est conservé. Les entrées sont confrontées au catalogue courant ; une application devenue inaccessible n’est plus affichée ni lancée avec une ancienne URL. Les métadonnées périmées ne constituent jamais un droit.

## Livraison des assets et démarrage

Le HTML dynamique est `no-store`. Le préfixe `/assets/<version package>/` isole toute la chaîne d’imports relatifs, y compris les modules secondaires. JS/CSS ne restent pas en cache entre deux sources de la même alpha ; les anciennes URLs publiques restent servies. Une ancienne version d’asset reçoit 404, pas du HTML à la place de JavaScript.

`boot.js` vérifie les éléments essentiels avant d’importer l’application et intercepte aussi son démarrage asynchrone. Un HTML incomplet donne une erreur récupérable au lieu d’un `classList` sur `null`. Ce durcissement ne prouve pas la cause d’une trace de navigateur qui ne correspond pas aux fichiers servis.

Manifeste PWA préparatoire seulement : aucun service worker, cache de ressources privées hors ligne, notification ou installation PWA complète revendiqué.

## Limites structurantes

- Sessions mémoire : perte au redémarrage, un seul processus Hub pour cette alpha.
- SQLite local : volume durable obligatoire ; pas de distribution multi-hôtes prévue.
- Sauvegarde cohérente via outil SQLite `.backup` ou arrêt du Hub ; ne pas copier seulement le fichier principal en ignorant WAL/SHM.
- Les dispositions sont une grille avec positions relatives, pas un canvas de coordonnées libres.
- Le calendrier natif ne contient aucun rendez-vous distant.
- Les connecteurs métier sont des descripteurs désactivés. Aucune requête d’application, météo ou RSS n’est inventée.
- Les JWT déjà émis suivent leur durée de validité et les contrôles Kyros ; ce Hub n’invente pas une introspection instantanée.
