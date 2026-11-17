# docs/V1-ROADMAP.md

# LUMA Hub V1 · feuille de route

> Document de cadrage. Les fonctionnalités ci-dessous sont **prévues**, pas encore implémentées. Les API non vérifiées restent à spécifier.

## Objectif

Transformer le portail LUMA existant en workspace personnel et entreprise, sans remplacer les applications spécialisées.

## Invariants à préserver

- Authentification Kyros SSO v4 (PAR, PKCE S256, JWT RS256, refresh rotatif, logout).
- Kyros reste source de vérité pour identité, droits, catalogue et favoris existants.
- Ne pas exposer de jetons ou secrets au navigateur.
- Ne pas modifier `prod` pendant la construction de la V1.
- `package.json` est la source unique de version ; mettre à jour `package-lock.json` conjointement.
- Prévoir migration des préférences existantes sans écrasement ni perte.

## Interfaces

- Cinq compositions : A tableau de bord, B lanceur minimaliste, C immersive, D widgets modulaires, E multi-espaces.
- Expériences desktop et mobile distinctes partageant le même moteur, composition sélectionnable séparément pour chaque format.
- Dispositions de widgets distinctes par composition, format et espace ; tablette adaptable.
- Navigation au clavier et tactile, préférences d'accessibilité, chargements/erreurs explicites.
- Pas de bannière promotionnelle ni de panneaux décoratifs sans utilité.

## Espaces

- Espaces personnel et entreprise, cloisonnement des données et des droits.
- Le contrat d'activation et de sélection du contexte Kyros doit être vérifié avant toute interaction d'entreprise.
- Aucune donnée d'un espace ne doit être présentée dans un autre sans autorisation.

## Widgets

- Catalogue dynamique, ajouter/retirer/dupliquer/configurer à chaud, glisser-déposer, redimensionner.
- Instances multiples d'un même type ; gestion des états chargement, erreur, indisponible, déconnecté.
- Contrat : tailles supportées, source de données, permissions, mode d'actualisation, actions.
- Natif Hub : horloge, calendrier, favoris, raccourcis.
- BrainDump : notes et tâches (pas de double stockage fonctionnel).
- Drivio : véhicules, maintenance, consommation.
- Nino : reprise de lecture et nouveautés ; Harmonix : musique et playlists.
- Extérieur : météo et RSS, sous réserve de faisabilité et des API.
- **Hors périmètre** : supervision infrastructure, qui reste dans Argos.
- Vérifier la disponibilité et l'authentification des APIs avant de développer les connecteurs.

## Persistance et performances

- SQLite pour configurations et dispositions propres au Hub, avec JSON structuré et migrations versionnées.
- Ne pas dupliquer dans SQLite les favoris déjà stockés dans Kyros.
- IndexedDB comme cache local isolé par utilisateur et espace ; invalidation et déconnexion sûres.
- Abstraction de persistance pour permettre une synchronisation centralisée future via un contrat Kyros explicite.
- Écritures groupées / debounce pour les déplacements ; chargement différé et cache des données distantes.

## Ordre de réalisation

1. Auditer flux existants, sécurité, tests et contrat Kyros.
2. Poser une architecture front à composants et le système de styles sans casser les routes courantes.
3. Construire l'expérience desktop et mobile, puis les cinq compositions.
4. Ajouter stockage SQLite, migrations et paramètres séparés.
5. Développer moteur et catalogue de widgets.
6. Intégrer les applications par connecteurs indépendants et valider les espaces entreprise.
7. Tests fonctionnels, sécurité, performance, accessibilité, migrations, bêta et release candidate.

## Politique de release

- Branche de développement : `1.x.x`.
- Série `1.0.0-alpha.N` puis `beta.N`, `rc.N`, enfin `1.0.0` après validation.
- La V1 stable ne dépend pas de la disponibilité de tous les connecteurs secondaires.
- Protéger la branche `prod` et exiger des vérifications avant fusion.
