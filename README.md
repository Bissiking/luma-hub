# LUMA Hub

Portail principal de l'écosystème LUMA pour `mhemery.fr`.

## Rôle

LUMA Hub gère l'expérience utilisateur : accueil, launcher, recherche et navigation.
Kyros reste la source d'identité, d'authentification et de droits.

## Stack

- Node.js 20+
- Express
- OAuth/SSO Kyros côté serveur
- Aucun secret Kyros exposé au navigateur

## Démarrage

```bash
npm install
cp .env.example .env
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Auth Kyros

Créer un client Kyros SSO pour LUMA Hub avec le callback :

```text
http://localhost:3000/auth/callback
```

En production :

```text
https://mhemery.fr/auth/callback
```

Puis renseigner `KYROS_CLIENT_ID` et `KYROS_CLIENT_SECRET` dans `.env`.

## Branches

- `dev` : développement
- `prod` : production
