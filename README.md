# LUMA Hub

Workspace LUMA connecté à **Kyros SSO v4**, en développement sur `1.x.x`. La version courante est définie uniquement dans `package.json`.

Cinq compositions partagent le même moteur : dashboard, lanceur minimaliste, immersive, modulaire et multi-espaces. Navigation mobile dédiée, thème système, choix de composition et dispositions séparés desktop/mobile. Six widgets natifs : horloge/date, calendrier du mois, favoris, raccourcis, recherche et récents. Ajout, configuration, duplication, déplacement, tailles et sauvegarde automatique sont disponibles.

La composition multi-espaces n’active encore que l’espace personnel. Drivio propose deux widgets en lecture seule : garage et suivi par véhicule. Les connecteurs BrainDump, Nino, Harmonix, météo et RSS restent désactivés jusqu’à validation de leurs contrats.

## Démarrage

Node.js 20+ pour le serveur ; recette exécutée sur Node 24. SQLite via `better-sqlite3` (module natif). Chrome/Puppeteer pour la recette navigateur.

```bash
npm ci
cp .env.example .env
# Renseigner le client Kyros SSO v4.
npm run dev
```

Ouvrir `http://localhost:3000`, avec Kyros local sur `http://localhost:3001`. Ne pas utiliser `127.0.0.1:3000` à la place si le callback et PUBLIC_BASE_URL sont enregistrés pour `localhost`. Un autre service Docker peut occuper seulement l’adresse IPv4 de ce port.

Dans Kyros → Clients SSO & OIDC, le client dédié au Hub doit avoir :

| Champ | Valeur |
| --- | --- |
| Protocole / mode | SSO v4 / `sso` |
| Édition / périmètre | `standard` / `standard` |
| Audience ressource | **`kyros:hub`** (exactement) |
| Scopes autorisés | `profile email offline_access hub:read hub:preferences` |
| Callback local | `http://localhost:3000/auth/callback` |

Le `.env` doit demander la même audience et les mêmes scopes. Une audience générée comme `kyros:sso:hub` est refusée par l’API Hub. Après modification, redémarrer le Hub et se reconnecter pour renouveler les claims. Le détail de la vérification locale se trouve dans [les contrats Kyros](docs/KYROS_CONTRACTS.md).

## Connecter son garage Drivio

Dans **Personnaliser → Votre garage Drivio → Connecter Drivio**, choisir les véhicules dans Drivio puis cliquer **Autoriser LUMA Hub**. Le retour au Hub est automatique ; **Ajouter un suivi** ajoute le widget. Chaque instance peut afficher un véhicule et une vue différents. Aucune commande ni copie de jeton n’est demandée à l’utilisateur. L’accès se retire depuis **Drivio → Paramètres → Hub LUMA** ou depuis le Hub.

Le même compte Kyros doit être utilisé dans les deux applications. La page de consentement Drivio est accessible par le bouton, sans entrée dans le menu. [Contrat et fonctionnement](docs/DRIVIO.md).

## Données et sécurité

Kyros conserve identité, autorisations, catalogue et favoris existants. SQLite conserve compositions, instances de widgets, dispositions et accès Drivio chiffrés par compte. La clé privée est créée automatiquement dans un fichier voisin de la base ; sauvegarder la base et cette clé ensemble, sans les publier. `HUB_DB_PATH` vaut `./data/hub.sqlite` par défaut ; ce répertoire est ignoré par Git et doit être durable en exploitation. Une lecture initiale ne crée pas de préférence utilisateur en base. Les migrations sont versionnées et transactionnelles.

Les récents existants restent en localStorage par compte et sont filtrés par le catalogue courant. IndexedDB conserve seulement des brouillons de configuration, isolés par session et espace. Aucun jeton ni secret ne sort du serveur. Les erreurs réseau et conflits 409 ne remplacent pas silencieusement les données.

Les sessions restent en mémoire : un redémarrage déconnecte les utilisateurs. Le manifeste prépare une évolution PWA ; aucun mode hors ligne complet ou push n’est livré.

## API interne

| Route | Rôle |
| --- | --- |
| `GET /api/session` | Session et identité publique |
| `GET /api/me`, `GET /api/context` | Proxys identité et appartenances Kyros |
| `GET /api/catalog` | Catalogue autorisé et préférences Kyros |
| `GET\|PATCH /api/preferences` | Favoris et préférences Kyros révisionnés |
| `GET /api/apps/:id/logo` | Logo autorisé, proxy image borné |
| `GET /api/widgets` | Registre natif, Drivio et connecteurs futurs |
| `GET /api/connectors/drivio/authorize`, `GET /api/connectors/drivio/callback` | Connexion par consentement et PKCE |
| `GET\|DELETE /api/connectors/drivio` | État et retrait de la connexion |
| `GET /api/connectors/drivio/vehicles`, `GET /api/connectors/drivio/summary` | Proxy Drivio privé, borné et en lecture seule |
| `GET /api/spaces` | Espaces réellement disponibles |
| `GET\|PUT /api/workspace/personal` | Document Hub et révision SQLite |

## Validation

```bash
npm run check          # Syntaxe et cohérence des versions
npm run build          # Graphe ESM, assets et manifeste ; sans transpilation
npm test               # Tests unitaires, SQLite et HTTP isolés
npm run test:browser    # Chrome local, Puppeteer, fournisseur Kyros synthétique
npm run test:drivio     # Vrais Hub et Drivio voisins + SQLite jetable, Kyros simulé
npm run test:kyros      # Vrai code Kyros voisin + PostgreSQL local jetable
```

Pour Chrome, définir `CHROME_PATH` si l’exécutable n’est pas détecté dans le cache Puppeteer macOS. Le test réel utilise par défaut `../kyros`, configurable avec `KYROS_REPO`. Il exige les dépendances Kyros installées et le droit de créer/supprimer une base PostgreSQL locale de validation. Il ne modifie pas les comptes ou clients courants.

Captures et rapport navigateur dans `.impeccable/review/` (ignoré). Rapport réel Kyros dans `test/artifacts/kyros-real-contract.json` (ignoré). Bilans durables : [alpha.2](docs/VALIDATION_ALPHA2.md) et [connexion Drivio alpha.3](docs/DRIVIO.md).

## Documentation et livraison

- [Architecture, choix frontend et limites](docs/ARCHITECTURE_V1.md)
- [Contrats Kyros et configuration du client local](docs/KYROS_CONTRACTS.md)
- [Migration et repli](docs/MIGRATION_V1.md)
- [Feuille de route V1](docs/V1-ROADMAP.md)
- [Maquettes approuvées](docs/design/workspace-brief.md)

Aucun déploiement, push, tag ou changement de `prod` n’est effectué par cette refonte locale. La progression reste alpha → beta → rc → stable après les validations requises.
