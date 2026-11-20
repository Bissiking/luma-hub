# Widget Harmonix — Hub 1.0.0-alpha.4 / Sonora 6.4.2

Dans **Personnaliser → Votre musique Harmonix**, choisir **Connecter Harmonix**,
puis **Ajouter le widget Harmonix**. Disponible aussi dans « Ajouter un widget ».
Les cinq compositions et leurs dispositions desktop/mobile sont conservées.

Le widget affiche la reprise personnelle et six dernières sorties datées, avec
pochettes protégées. Un clic ouvre Harmonix ; la reprise transmet `position_ms`,
sans lecture automatique ni télécommande. La date est celle de sortie de l’album,
jamais celle d’import du morceau.

## Configuration

Hub : `SONORA_BASE_URL` (défaut développement `http://localhost:6002`) et
`HARMONIX_BASE_URL` (défaut développement `http://localhost:5174`). Origines fixes,
sans chemin, identifiants, query ni fragment. HTTPS obligatoire en production ;
HTTP loopback uniquement en développement. En production, les deux variables
sont nécessaires pour proposer la connexion.

Sonora : `LUMA_HUB_PUBLIC_URL` doit être l’origine publique du Hub, identique à
son `PUBLIC_BASE_URL`. Le `.env` Sonora local a reçu uniquement
`LUMA_HUB_PUBLIC_URL=http://localhost:3000`. Les autres valeurs sont conservées.
Relancer les processus locaux Hub et Sonora si leur lancement ne surveille pas
les fichiers. Aucun processus existant redémarré ni déploiement effectué.

## Connexion et isolation

Le jeton du Hub n’est pas réutilisé pour Sonora. Le connecteur utilise le relais
SSO Sonora existant avec `platform=hub` et un challenge S256 supplémentaire.
Sonora effectue son propre PAR/PKCE Kyros puis revient à une URL fixe du Hub avec
seulement `state`. La récupération des jetons nécessite le vérificateur resté sur
le serveur Hub ; le state seul ne suffit pas. Retour lié au compte et au cookie
de session Hub, à usage unique, TTL dix minutes. Aucun client ni secret Kyros modifié.

Sonora valide le jeton pour son audience. Le Hub vérifie `/api/auth/me` et refuse
un compte différent de celui de sa session. Les droits restent contrôlés par Sonora
à chaque appel. C’est une session Sonora issue du relais existant, pas un nouveau
scope Kyros limité au widget. Le connecteur ne réalise que les lectures documentées
et les opérations de session.

Jetons chiffrés AES-256-GCM dans SQLite, AAD propriétaire + fournisseur, avec la clé
privée existante des connecteurs. La migration 003 conserve les secrets Drivio sans
les déchiffrer. Restaurer la clé depuis sa sauvegarde en cas de perte ; ne pas la
remplacer. Refresh rotatif sérialisé par compte, sans recréation de la connexion
après déconnexion. Déconnexion : suppression locale puis révocation du refresh
token ; un échec distant est indiqué dans l’interface.

## API et interface

Hub : `/api/connectors/harmonix` (GET statut, DELETE déconnexion), `/authorize`,
`/callback`, `/music`, `/artwork/:id`. Authentification Hub requise, DELETE soumis au
contrôle Origin existant, aucun paramètre de propriétaire. DTO autorisés seulement,
liens reconstruits avec `HARMONIX_BASE_URL`, aucun jeton au navigateur, `no-store`.

Sonora : `/api/hub/music/releases?limit=6&offset=0` (`tracks:read`) et
`/api/hub/music/resume` (`playback:own`). Chaque section a ses propres états vide,
refus et indisponibilité. Actualisation à la demande et toutes les cinq minutes
sur un onglet visible avec widget. Pas de musique persistée dans le navigateur.

Les pochettes passent par le serveur Hub après vérification de la piste Sonora.
Seuls les chemins `/covers/<nom>` sont permis, sans redirection externe. Taille,
délai et types raster bornés ; SVG et images absentes utilisent l’icône du widget.
Les originaux audio ne transitent pas par le Hub.

## Validation

`npm test`, `npm run check`, `npm run build`, `npm run test:harmonix`.
La recette utilise le Hub HTTP réel, SQLite temporaire et Chrome avec Sonora et
Kyros synthétiques. Captures 1440 / 390 / 320 px, thèmes clair et sombre, dans
`docs/validation/harmonix/`. Sonora teste son vrai callback HTTP et le challenge
du relais, en plus des permissions et lectures isolées par utilisateur.
Cela ne prouve ni une connexion avec un compte Kyros réel ni un déploiement.
