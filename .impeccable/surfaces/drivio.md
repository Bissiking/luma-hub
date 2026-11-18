# Drivio — connexion et widgets du Hub

Extension étroite de la surface Operate, documentée le 18 novembre 2026 après le verdict `ship` de [finish-verdict.md](../review/drivio/finish-verdict.md). Ce document décrit le parcours livré ; il ne remplace ni [DESIGN.md](../../DESIGN.md), ni [PRODUCT.md](../../PRODUCT.md), ni les systèmes du dépôt voisin Drivio.

## Intention et identité

Permettre de consulter dans le Hub les véhicules que l’utilisateur a explicitement autorisés dans Drivio. Le Hub conserve son thème système, ses surfaces plates, sa typographie système, ses actions pétrole et son ambre de repère. Les widgets Drivio emploient les mêmes en-têtes, menus, dialogues et règles de composition que les widgets natifs.

La page d’autorisation appartient à Drivio : graphite et cuivre dans les captures, Geist Sans, règles minérales et commandes existantes. Elle consomme les rôles sémantiques du thème Drivio. Le passage entre produits n’introduit aucune identité hybride, nouvelle palette ou maquette de référence.

## Parcours et responsabilités

1. Dans `#/personnaliser`, « Votre garage Drivio » annonce « Lecture seule » et propose « Connecter Drivio ». Le point d’entrée Hub est `/api/connectors/drivio/authorize`.
2. Drivio présente `/hub/authorize`, une page autonome hors navigation courante, avec métadonnées `noindex, nofollow`. Sans session, elle propose de continuer avec le même compte Kyros que dans le Hub, puis revient au consentement.
3. Le consentement affiche les deux produits, la portée en lecture seule, puis les véhicules sous forme de cases à cocher libellées. L’utilisateur sélectionne les véhicules possédés, avec année et repères Principal / Archivé. Le modèle réel est un garage personnel contenant des véhicules ; ces cases ne représentent pas plusieurs garages.
4. « Autoriser LUMA Hub » déclenche le retour automatique au Hub. Le parcours ne demande aucune commande, copie de jeton ou saisie technique. « Annuler » reste disponible ; aucune sélection désactive l’autorisation et affiche une consigne.
5. Au retour, le Hub annonce la connexion et permet « Ajouter un suivi ». Chaque instance choisit son véhicule et les informations affichées : Vue d’ensemble, Entretiens et alertes, Dépenses ou Carburant. Le choix par défaut prend le véhicule principal accessible, sinon le premier accessible.
6. « Choisir les véhicules partagés » relance le consentement depuis le Hub. Les paramètres Drivio présentent le périmètre et l’expiration, avec « Retirer l’accès ». Leur texte renvoie explicitement à la page d’autorisation pour choisir les véhicules et à une nouvelle connexion pour modifier ce choix.

La durée annoncée est de 90 jours au maximum. Les véhicules ajoutés ultérieurement ne sont pas partagés automatiquement. Retirer un widget ne constitue pas une révocation. Le Hub possède aussi « Déconnecter Drivio » ; si la révocation distante n’a pas abouti, un message demande de la vérifier dans les paramètres Drivio.

## Composition et lecture

Le consentement est une colonne centrée, limitée à 42 rem, avec identité en tête, titre direct, explication, bande de lecture seule entre deux règles, choix des véhicules, durée et actions. Ses marges passent de 20 px sur mobile à 32 px à partir de 640 px. Les lignes de véhicules sont cliquables via leur libellé et séparées par des règles. Les actions sont empilées en pleine largeur sur mobile, l’autorisation au-dessus de l’annulation ; elles se placent en ligne sur grand écran.

Le suivi Hub commence par le véhicule et son kilométrage. Alertes, entretiens, dépenses et carburant restent des sections d’un même registre, séparées par des traits fins. Les valeurs dominantes emploient des chiffres tabulaires ; dates, échantillons et actualisation restent des métadonnées lisibles. Le pied rappelle « Lecture seule », indique l’heure de récupération et propose une actualisation nommée. « Ouvrir dans Drivio » ouvre la fiche métier correspondante.

À 700 px et moins, les lignes peuvent se replier et les actions de connexion s’empilent. La composition minimaliste utilise ses sections dépliables existantes ; le suivi doit être ouvert pour observer son contenu. Aucun décor automobile, photographie de recette, cadran ou ombre de carte ne devient nécessaire à cette extension.

## États à conserver

- Connexion absente : explication et action de connexion ; vérification ou chargement : retour textuel.
- Connexion annulée, compte Kyros différent ou échec : message de résultat explicite et possibilité de relancer.
- Garage vide, échéance absente ou données carburant insuffisantes : texte propre à la situation ; une valeur absente reste « Indisponible » plutôt que zéro.
- Erreur de lecture : message et « Réessayer », avec accès aux réglages si nécessaire.
- Calculs de carburant, mois de dépenses en UTC et listes tronquées : période, méthode ou limite explicitée selon les données disponibles ; ne pas présenter l’échantillon comme une vue exhaustive.
- Autorisation révoquée : le prochain rafraîchissement refuse la lecture et permet la reconnexion ; la session Hub reste distincte de l’accès Drivio.

Les cases natives, `fieldset` / `legend`, messages de statut, état occupé et actions libellées présents dans les sources sont des garanties d’implémentation à préserver. Les seules captures ne certifient pas une recette clavier ou avec technologie d’assistance.

## Sources et preuves

Sources Hub : `src/public/js/workspace/drivio-view.js`, `drivio-client.js`, `controller.js` et `src/public/styles/home.css`. Sources Drivio : `Drivio/DESIGN.md`, `Drivio/PRODUCT.md`, `src/app/hub/authorize/page.tsx`, `src/components/forms/hub-consent-form.tsx` et `hub-applications.tsx`.

Le dossier [review/drivio](../review/drivio/) contient le [rapport local](../review/drivio/report.json), la [revue](../review/drivio/finish-review.md), le [verdict](../review/drivio/finish-verdict.md) et les captures de référence. La revue couvre le consentement à 1440 / 390 / 320 px, le widget et ses détails dans les thèmes système clair et sombre aux mêmes largeurs, ainsi que les applications autorisées à 390 px. Les images de détail sont des recadrages d’élément ; les widgets mobiles montrent la section ouverte.

Le rapport décrit de vraies routes locales Hub et Next Drivio, avec SQLite et comptes synthétiques isolés, Kyros simulé et navigateur automatisé. Il rapporte le consentement et retour PKCE, l’exclusion des véhicules non autorisés, l’absence de jeton saisi ou exposé au navigateur, l’annulation et la révocation effective au rafraîchissement. Le verdict final valide la seule correction demandée par la revue : rendre exacte l’instruction de changement de véhicules dans les paramètres Drivio et vérifier son retour à la ligne à 390 px.

Ces preuves ne qualifient ni Kyros réel, ni un appareil physique, ni la production. Les véhicules, compteurs et montants de recette ne définissent aucun contenu produit permanent. Cette passe documentaire ne constitue pas un nouvel audit global et ne modifie aucun fichier Drivio.
