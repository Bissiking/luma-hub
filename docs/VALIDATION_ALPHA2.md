# Validation locale · 18 novembre 2026

Version atteinte : **1.0.0-alpha.2** sur `1.x.x`. Ni version stable, ni publication, tag, push ou déploiement.

## Réalisé

- Cinq compositions avec un même modèle métier et un thème système ; navigation mobile indépendante de la sidebar.
- Compositions et dix dispositions indépendantes, six types de widgets natifs, instances multiples, ajout/configuration/duplication/suppression, déplacement clavier/souris/toucher et tailles configurables.
- SQLite versionné avec transactions et révisions, isolation par compte, conflits 409 et brouillons IndexedDB.
- Favoris Kyros préservés, ordre/épingles/masqués/affichage respectés, récents locaux filtrés par les autorisations actuelles.
- Proxy de logos authentifié, entrée navigateur protégée et modules sous préfixe de version.
- Connecteurs et entreprise indisponibles explicitement, sans données simulées dans le runtime produit.

## Contrôles exécutés

| Contrôle | Résultat et portée |
| --- | --- |
| `npm run check` | Syntaxe de tous les modules/scripts/tests, cohérence package/lock et absence de VERSION |
| `npm run build` | Graphe des imports ESM, assets et manifeste valides ; pas de transpilation |
| `npm test` | 24 tests et sous-tests passés : OAuth, TTL, CSRF, HTTP, SQLite, révisions, isolation, validation, conflits et rotation |
| `npm run test:browser` | Vrai Chrome for Testing headless via Puppeteer ; vrai Hub et SQLite temporaire, fournisseur Kyros synthétique |
| Matrice navigateur | 5 compositions × 6 largeurs (320/390/700/768/1024/1440) × 2 thèmes ; pas de débordement horizontal, pas d’erreur JS dans la recette passée |
| Interactions navigateur | Recherche clavier, favoris, récents, ajout/configuration/duplication/suppression, déplacement, tailles, persistance après rechargement, conflit et panne récupérable |
| Toucher | Événements CDP avec appui long, indépendance desktop/mobile ; émulation, aucun téléphone physique |
| `npm run test:kyros` | Vrai code Kyros + PostgreSQL jetable : PAR, session de test, authorize, PKCE, RS256/JWKS, catalogue, favoris/409, contexte personnel, SQLite, refresh et révocation |
| Instance Kyros courante | Santé et JWKS vérifiés ; configuration du client examinée en lecture seule, ajustée par l’utilisateur |
| Audit dépendances | Aucun avis de vulnérabilité dans les dépendances de production après mise à jour compatible du lockfile |

Les rapports détaillés reproductibles sont écrits dans `.impeccable/review/browser-report.json` et `test/artifacts/kyros-real-contract.json`, ignorés par Git. La base PostgreSQL de recette est supprimée ; une lecture finale du catalogue PostgreSQL a confirmé zéro base `luma_hub_validation_*` restante.

## Incidents corrigés pendant la recette

- Ajout d’un widget : le bouton déclenchait la soumission implicite d’un formulaire. La soumission du catalogue est désormais interceptée.
- Configuration d’un widget : le sélecteur de composition capturait aussi l’attribut du body lors d’un `change`. Le sélecteur est limité aux inputs prévus.
- Captures après breakpoint : la recette attend maintenant la composition ET le format demandés, sans confondre un rendu précédent avec le bon.
- Typographie des légendes : minimum 12 px ; les constats tiny-text ont été traités sans suppression globale.
- B : liste du catalogue et aide clavier rétablies. C : calendrier compact et favoris rapprochés de l’heure. E : sous-navigation et titre personnel rétablis.
- Élévation : dialogue à ombre sans bordure, popovers à bordure sans ombre ; pas d’ignore du détecteur.
- Brouillon après panne : le message d’erreur est effacé à la réussite de la relance. Cache indisponible/bloqué : aucune dépendance bloquante au stockage local.

## Signalements utilisateur et preuve disponible

Une trace `boot failed … classList … app.js:346` ne correspondait pas au fichier servi alors, de 226 lignes, sans cette fonction ni ce log. Un Chrome neuf sur l’URL locale a démarré sans erreur. La cause historique n’est donc pas affirmée. Le nouveau bootstrap vérifie les nœuds essentiels et offre une récupération explicite ; HTML et ESM ne sont plus servis comme des versions interchangeables en cache.

Le catalogue a ensuite renvoyé `invalid_audience`. Le client local et le `.env` utilisaient `kyros:sso:hub-local`, puis `kyros:sso:hub`. La source Kyros exige exactement `kyros:hub`. L’utilisateur a choisi de modifier lui-même le client et le `.env` ; l’agent ne les a pas écrits.

Après alignement sur `kyros:hub`, le processus lancé à 08:55:07 précédait la modification du `.env` à 08:56:45. Le mode watch a relancé le Hub à 08:59:01. La route `/auth/login` a ensuite répondu 302 et le bootstrap versionné 200. Cela vérifiait l’entrée du parcours. L’utilisateur a ensuite confirmé explicitement : « Le workspace et le catalogue s’ouvrent ». Cette confirmation couvre sa reconnexion réelle et l’ouverture du catalogue ; elle ne prouve pas les autres interactions avec son compte.

## Restant avant bêta/stable

- Vérifier les favoris, l’expiration et les interactions de widgets avec le compte réel après la reconnexion confirmée.
- Contrat serveur d’entreprise et permissions/contextes spécifiques, puis recette d’isolation multi-entreprises.
- Contrats et authentification déléguée des connecteurs, fournisseurs météo/RSS et protection SSRF.
- Tests physiques tactiles/tablette, Safari/Firefox et technologies d’assistance.
- Durabilité des sessions, politique de rétention/effacement des configurations, exploitation/backup multi-utilisateurs.
- Reproduction automatique complète des maquettes : voir `design/reproduction.md` ; aucun comp-diff/hero gate certifié.

Les contrôles locaux ne qualifient pas la production et ne justifient pas une release stable.

Revue Impeccable : les quatre demandes visuelles ont été scorées résolues par le reviewer indépendant. Le protocole automatique de reproduction reste partiel et explicitement déclaré ; il ne s’agit pas d’un verdict global ship. DESIGN.md et son sidecar décrivent le système réellement construit.
