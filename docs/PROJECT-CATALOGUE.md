# Catalogue de projets LUMA

La section **Projets**, accessible depuis la navigation ordinateur, la page Applications, le menu du compte et la recherche de pages, présente un inventaire documentaire distinct du lanceur d’applications Kyros. Elle ne donne aucun droit sur les applications ou les dépôts GitHub qu’elle référence.

Tous les utilisateurs connectés peuvent consulter le même inventaire. Le serveur vérifie leur identité Kyros comme pour le workspace. Les réponses portent `Cache-Control: no-store`. Sans session, l’API refuse la lecture.

## Importer les données

Le dépôt du Hub est public. Le catalogue réel contient des informations sur des dépôts privés ; il ne doit pas être ajouté à Git ni à `src/public`.

Placer le JSON préparé pour l’inventaire sur le serveur, puis exécuter :

```sh
npm run catalogue:import -- /chemin/prive/catalogue-luma.json
```

La destination par défaut est `data/project-catalogue.json`, déjà ignorée par Git. Pour un autre volume persistant, définir `HUB_PROJECT_CATALOGUE_PATH` dans l’environnement du serveur et lors de l’import. Le script valide le JSON, refuse une destination dans `src/public` et remplace le fichier par renommage atomique. Aucun redémarrage n’est nécessaire pour actualiser un fichier déjà configuré ; un changement de variable d’environnement requiert un redémarrage.

Le fichier doit contenir `projects` et `divisions` sous forme de tableaux, avec des identifiants de projets uniques. Le modèle préparé dans cette conversation fournit également les sources, responsables, observations et dépôts. Les champs inconnus peuvent valoir `null`. Le serveur n’expose qu’une projection des champs utiles à la lecture, sans reprendre les logs de CI ou les contenus bruts des README.

Sans fichier valide, la section affiche un état d’indisponibilité et permet de réessayer ; les autres fonctions du Hub restent disponibles. Les données ne sont ni synchronisées automatiquement avec GitHub ni modifiées depuis cette première version de l’interface.

## Utilisation

- Recherche multi-mots sans distinction d’accents ni de casse dans les noms, descriptions et dépôts.
- Filtres cumulables par division, type et présence d’un dépôt archivé. Un dépôt archivé ne détermine pas le statut métier.
- Fiches partageables via `#/projets?projet=identifiant`, avec retour aux filtres, sources et liens entre composants.
- Les versions affichées sont celles déclarées dans les fichiers examinés, sans présumer de la version en production.
- Aucun lien de service n’est déduit d’un exemple de configuration. Les dépôts privés continuent d’exiger les droits GitHub habituels.

## Vérification

```sh
npm run check
npm test
npm run build
# CHROME_PATH doit désigner un Chrome/Edge installé.
npm run test:projects
```

La recette HTTP et navigateur utilise le fournisseur Kyros synthétique du projet. Elle ne remplace pas une validation avec le Kyros et les services de production.
