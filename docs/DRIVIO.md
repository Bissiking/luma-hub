# Drivio · connexion par consentement · alpha.3

## Parcours utilisateur

1. Dans LUMA Hub, ouvrir **Personnaliser → Votre garage Drivio → Connecter Drivio**.
2. Drivio ouvre une page dédiée, absente du menu et non indexable. Si nécessaire, se connecter avec le même compte Kyros.
3. Cocher les véhicules de son garage puis **Autoriser LUMA Hub**. La sélection précédente est reprise lors d’une modification.
4. De retour dans le Hub, **Ajouter un suivi**, ou ajouter **Garage Drivio** depuis le catalogue de widgets. Le menu de chaque suivi permet de choisir le véhicule et la vue : ensemble, entretiens/alertes, dépenses ou carburant.
5. Retirer l’accès dans **Drivio → Paramètres → Hub LUMA**, ou **Déconnecter Drivio** dans le Hub.

Aucune commande, copie de jeton ou saisie de secret ne fait partie de ce parcours. Le garage correspond au compte Drivio ; la sélection porte sur ses véhicules. Les véhicules reçus en partage et ceux ajoutés ultérieurement ne sont pas implicitement autorisés.

## Contrat entre applications

| Route Drivio | Rôle |
| --- | --- |
| `GET /hub/authorize` | Consentement avec session Drivio et choix des véhicules |
| `POST /api/hub/authorize` | Consentement signé, lié à la session, contrôle d’origine et de propriété |
| `POST /api/hub/token` | Échange serveur du code à usage unique contre un accès `widgets:read` |
| `POST /api/hub/revoke` | Révocation de l’accès applicatif par le Hub |
| `DELETE /api/preferences/hub/applications?id=…` | Révocation par le propriétaire dans Drivio |
| `GET /api/hub/v1/vehicles?offset=…` | Véhicules autorisés et compteurs enregistrés, pages de 50 |
| `GET /api/hub/v1/summary?vehicle=…` | Entretiens, alertes, dépenses et carburant d’un véhicule autorisé |

Application enregistrée : `luma-hub`. Callback exact : `<PUBLIC_BASE_URL>/api/connectors/drivio/callback`. `state` aléatoire lié à l’utilisateur et à sa session Hub, PKCE S256, intent HMAC lié à la session Drivio, code valable dix minutes et consommé une seule fois. L’échange vérifie que le sujet Kyros correspond dans les deux applications. Les redirections et retours après connexion sont limités aux destinations prévues.

L’accès applicatif dure 90 jours, remplace l’autorisation précédente de cette application et ne permet que la lecture des véhicules choisis. Drivio conserve son empreinte SHA-256 et la liste d’identifiants, jamais le jeton brut. Le jeton personnel antérieur reste disponible dans l’accès manuel avancé de Drivio ; sa génération ou sa révocation ne modifie pas les autorisations applicatives.

## Stockage et appels Hub

Le navigateur reçoit uniquement le résultat de la connexion et des projections validées de données. L’échange de code et le jeton restent côté serveur. Les configurations exportées, brouillons IndexedDB et localStorage ne contiennent pas de données Drivio ni de secrets.

Migration SQLite Hub `002-connector-secrets.sql` : table séparée, isolation par sujet Kyros et fournisseur, sans modification des documents/révisions existants. AES-256-GCM, IV aléatoire et authentification liée au propriétaire. Clé de 32 octets générée automatiquement au premier consentement dans `<HUB_DB_PATH>.key` (permissions 0600), chemin surchargeable par `HUB_CONNECTOR_KEY_PATH`. Une clé absente après une connexion doit être restaurée ; elle n’est pas remplacée automatiquement. Sauvegarder ensemble la base et sa clé. Ne jamais les ajouter à Git.

`DRIVIO_BASE_URL` fixe l’origine du fournisseur côté serveur (défaut développement `http://localhost:3002`, explicite en production). Drivio fixe l’origine Hub par `LUMA_HUB_URL` (défaut développement `http://localhost:3000`). HTTPS obligatoire en production. Aucun widget ne fournit une URL d’amont ; les redirections de l’amont ne sont pas suivies. Corps bornés, délai de cinq secondes, projection des champs autorisés et paramètres stricts.

Cache mémoire isolé par compte, connexion et requête : cinq minutes, appels simultanés mutualisés, actualisation manuelle sans réutilisation du cache, 40 appels amont/minute par compte. Une révocation Drivio est détectée au prochain rafraîchissement (au plus cinq minutes pour une page visible) ; le Hub efface alors les données du connecteur sans déconnecter Kyros. Une déconnexion depuis le Hub tente la révocation Drivio puis efface toujours son secret local ; l’interface signale si la révocation distante n’a pas été confirmée.

Le suivi distingue zéro dépense enregistrée et consommation indisponible. Les dépenses du mois viennent exclusivement du registre Drivio en UTC, sans ajouter une seconde fois entretiens ou carburant. Les limitations des échantillons d’entretiens, d’alertes et de pleins sont affichées. Les liens véhicule utilisent `/suivi?vehicle=…`.

## Validation locale du 18 novembre 2026

- Hub : syntaxe, build ESM, 30 tests unitaires/HTTP/SQLite, migration 001→002 et isolation des secrets ; recette Chrome des fonctionnalités existantes (cinq compositions, six largeurs, deux thèmes).
- Drivio : génération Prisma, typecheck, lint, 180 tests dans 25 fichiers et build Next en copie isolée (avertissement préexistant sur l’import de version). SQLite et comptes de recette jetables ; aucune base courante utilisée pour ces tests.
- `npm run test:drivio` : vrais serveurs Hub et Next Drivio, bases jetables, sessions Drivio synthétiques et fournisseur Kyros simulé. Consentement, sélection, refus des véhicules exclus/tiers, jeton absent du navigateur, widget réel, annulation, choix précédent conservé, révocation depuis Drivio et session Hub conservée. Captures 320/390/1440 px en clair/sombre, sans erreur JavaScript.
- Migration Drivio additive `20261118120000_hub_application_consent` disponible en SQLite et PostgreSQL. Appliquée uniquement au SQLite de développement courant après sauvegarde dans `Drivio/storage/backups/` ; nombres d’enregistrements métier identiques et aucun défaut de clé étrangère. La migration de partage de véhicules développée en parallèle n’a pas été appliquée par ce travail.

Limites : pas de qualification production, de parcours avec les comptes réels de l’utilisateur, de connexion Kyros réelle pour Drivio dans cette recette, de test physique mobile ni de validation PostgreSQL du nouveau consentement. Aucun déploiement, push ou tag. Les rapports/captures locaux se trouvent dans `.impeccable/review/drivio/` (ignorés). La revue graphique est consignée à côté du rapport fonctionnel.
