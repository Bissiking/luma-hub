# Contrats Kyros vérifiés

Sources locales inspectées le 18 novembre 2026 : `../kyros/src/auth-apps/{auth-apps.routes,auth-apps.service,auth-apps.navigation}.js`, `auth/{tokens.service,v4.crypto,auth.routes}.js`, `hub-apps/{hub-api,preferences.routes,preferences.validation,preferences.repository,hub-apps.routes,hub-apps.service,catalogue.routes}.js` et contrats dans `docs/Archives/HUB_PREFERENCES_V5.md` / `CATALOGUE_HUB_V5.md`.

| Contrat | Vérification / conséquence |
| --- | --- |
| PAR `/par`, `/authorize`, `/token`, `/revoke` | SSO v4, PKCE S256, handshake version/édition/périmètre. Aucun retour au v3. |
| JWKS `/sso/v4/jwks` | RS256 ; issuer, audience, resource_aud, client_id, sub et exp vérifiés. |
| `/api/me` | Retourne un `id` à comparer au sujet de la session avant accès SQLite. |
| `/api/hub/v1/catalog` | IDs opaques stables séparés des slugs ; catalogue filtré par droits actuels, préférences et révision. |
| `/api/hub/v1/preferences` | PATCH partiel avec baseRevision, conflit 409 ; listes absentes préservées. |
| Audience API Hub | Exige exactement `kyros:hub` ; une audience personnalisée valide pour le SSO ne suffit pas. |
| Scopes API Hub | `hub:read` en lecture, `hub:preferences` en écriture. |
| `/api/apps/me` | Contexte principal et liste d’appartenances ; aucune API de sélection de contexte entreprise trouvée pour le Hub. |
| `/api/hub/v1/apps/:id/logo` | Image autorisée par Kyros ; proxy Hub vers PNG/JPEG/WebP, 2 Mio maximum, aucun SVG/HTML actif. |
| `/preferences/import` | Consentement explicite, format versionné et révision zéro. Aucun import silencieux de clés navigateur inconnues. |
| Interstitiel de connexion | Le test isolé utilise `kyros_auto_continue=1`, paramètre du contrat `auth-apps.navigation.js`, avec une véritable session Kyros de test. |

## Instance locale courante

Les endpoints de santé ont répondu `ok`, `auth_ready=true`, `database_ready=true`, et le JWKS a publié RS256. Le premier essai PAR du client alors configuré a répondu `par_not_supported`. Une lecture ultérieure a constaté que le client a été passé en v4, avec audience `kyros:sso:hub-local` et scopes `profile email hub:read`. Cette audience explique le 403 du catalogue : la garde Hub exige `kyros:hub`. Sans `hub:preferences`, les favoris ne peuvent pas être écrits.

L’utilisateur a choisi de modifier lui-même le client Kyros. Aucun changement du client courant ni de `.env` n’a été effectué par cette intervention. Configuration attendue :

```dotenv
KYROS_RESOURCE_AUDIENCE=kyros:hub
KYROS_REQUESTED_SCOPE=profile email offline_access hub:read hub:preferences
KYROS_REQUIRED_SCOPES=profile email hub:read
```

Le client courant a ensuite été aligné par l’utilisateur sur `kyros:hub` avec les scopes ci-dessus. Après redémarrage du Hub, il a confirmé l’ouverture réelle du workspace et du catalogue.

Le client Kyros doit autoriser les mêmes scopes et l’audience `kyros:hub`, avec son callback localhost enregistré. Redémarrer le Hub puis se reconnecter : une modification du registre ne réécrit pas un JWT existant. Ne pas changer le secret ni les comptes pour corriger ce problème.

## Vraie intégration isolée

`npm run test:kyros` importe le véritable code Kyros local et crée une base PostgreSQL dont le nom commence par `luma_hub_validation_`. Le script refuse un serveur PostgreSQL distant, crée ses propres compte, session et client, lance des serveurs locaux sur ports éphémères et détruit la base dans `finally`. Aucun client, compte ou organisation courant n’est modifié. Le rapport exclut la saisie de mot de passe/MFA et toute qualification production.

Le test couvre migrations, PAR, autorisation, code/PKCE, signature/JWKS, catalogue, favoris, conflit, contexte personnel, identité pour SQLite, refresh rotatif et révocation. Les premiers essais ont révélé deux conditions réelles : les callbacks SSO v4 HTTP passent par le normaliseur qui n’accepte que `localhost`, et la connexion automatique nécessite sa continuation d’interstitiel. Le test final respecte ces contrats sans modifier Kyros.
