# LUMA Hub

Portail principal de l'écosystème mhemery.fr, branché sur **Kyros** (SSO v4).

## Rôle

LUMA Hub gère l'expérience utilisateur : accueil, catalogue, favoris, récents et
navigation. Kyros reste la source d'identité, d'authentification, des droits et
des préférences.

## Stack

- Node.js 20+, Express, vanilla JS/CSS côté client (aucun build)
- **SSO v4** : PAR + Authorization Code + PKCE S256, access token **RS256** vérifié via le JWKS
- API Kyros : `/api/me`, `/api/apps/me` (contexte), `/api/hub/v1/catalog`, `/api/hub/v1/preferences`
- Aucun secret Kyros exposé au navigateur

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner KYROS_CLIENT_ID / KYROS_CLIENT_SECRET
npm run dev
```

Puis ouvrir `http://localhost:3000`. Kyros doit tourner (par défaut `http://localhost:3001`).

## Client Kyros SSO v4

Dans **Kyros → Administration → Clients SSO & OIDC** :

| Champ | Valeur |
|---|---|
| Protocole | SSO v4 |
| Mode d'intégration | `sso` |
| Périmètre | `standard` |
| Audience de ressource | **`kyros:hub`** |
| Scopes | `profile email offline_access hub:read hub:preferences` |
| Callbacks | `http://localhost:3000/auth/callback` et `https://mhemery.fr/auth/callback` |

Handshake attendu par Kyros : `kyros_sso_version=v4`,
`kyros_edition=standard`, `kyros_application_scope=standard`.

> Sans `kyros:hub` et les scopes `hub:read` / `hub:preferences`, l'API Hub v1
> renvoie 403 `invalid_audience` / `insufficient_scope`.

## Flow d'authentification

```
GET /auth/login        → transaction (state + code_verifier) → POST Kyros /par → redirect /authorize
GET /auth/callback     → vérif state + iss → POST Kyros /token (+ PKCE) → vérif RS256 (JWKS) → session
GET /api/*             → proxy Bearer vers Kyros (refresh rotatif automatique)
POST /auth/logout      → POST Kyros /revoke puis destruction de la session
```

## API interne (côté navigateur)

| Route | Rôle |
|---|---|
| `GET /api/session` | `{authenticated, user, authTime, links}` |
| `GET /api/context` | contexte Personnel / Entreprise (`/api/apps/me`) |
| `GET /api/catalog` | catalogue + préférences + révision (`/api/hub/v1/catalog`) |
| `GET|PATCH /api/preferences` | favoris/épingles/masqués/ordre (révision atomique, 409 géré) |

Les récents (derniers accès) restent en `localStorage`, indexés par compte.
Les favoris sont persistés côté Kyros (partagés entre appareils).

## Commandes

```bash
npm run dev     # développement (nodemon)
npm run start   # production
npm run check   # contrôle de syntaxe
```

## Branches

- `dev` : développement
- `prod` : production
