# Migration alpha · données préservées

## Première ouverture

Le nouveau stockage est créé à `HUB_DB_PATH`, par défaut `data/hub.sqlite`. La migration `001-workspaces.sql` crée une table de documents isolés par utilisateur/espace. La table `schema_migrations` enregistre son application. WAL, intégrité JSON et transactions sont activés. Une version de schéma future inconnue provoque un refus de démarrage plutôt qu’une réinterprétation silencieuse.

Une lecture retourne un document initial en mémoire, à révision zéro ; seule la première sauvegarde écrit une ligne. Les choix Kyros ne sont ni copiés dans SQLite ni réinitialisés. Aucun compte ou catalogue n’est modifié.

## Ajout Drivio (alpha.3)

La migration `002-connector-secrets.sql` ajoute une table séparée pour les accès Drivio chiffrés. Elle ne réécrit ni documents, ni dates, ni révisions. Le test de montée depuis 001 vérifie la conservation exacte après réouverture. Sauvegarder aussi le fichier de clé créé automatiquement au premier consentement (`<HUB_DB_PATH>.key`, ou `HUB_CONNECTOR_KEY_PATH`) ; sans cette clé, restaurer une base ne suffit pas à relire les accès. Une clé manquante n’est pas régénérée si des secrets existent déjà.

Un runtime alpha.2 refuse le schéma 002 : pour revenir à cet état, restaurer une sauvegarde cohérente antérieure avec le runtime correspondant. Garder la base alpha.3 et sa clé à part pour la reprise ; ne pas supprimer manuellement les enregistrements de migration. Le détail Drivio est décrit dans [DRIVIO.md](DRIVIO.md).

## Préférences existantes

- Favoris, épingles, masqués, ordre et affichage : lecture du contrat Kyros existant. Thème du Hub système conformément au choix de l’utilisateur, sans réécriture du thème Kyros.
- Récents : clé existante `luma-hub:v1:recent:<id>` conservée. La vue utilise exclusivement les métadonnées du catalogue courant, avec validation des timestamps et des entrées.
- Pas de conversion silencieuse de clés inconnues, pas d’import Kyros forcé, pas de données d’un autre utilisateur réassignées.
- Composition et dispositions : nouveaux champs, indépendants des préférences historiques ; valeurs par défaut tant que l’utilisateur n’a pas enregistré de choix.

## Conflit ou panne

Le serveur compare `baseRevision` dans la transaction. Un conflit 409 laisse le document courant intact ; le navigateur propose d’exporter le brouillon ou de recharger le serveur. Un brouillon de même session peut être restauré explicitement à révision égale après rechargement. Le stockage navigateur indisponible ne bloque pas la sauvegarde SQLite ; l’interface ne promet pas une persistance hors ligne.

## Sauvegarde et repli

Sauvegarder SQLite par l’API de backup ou l’outil `.backup`, ou arrêter proprement le Hub avant une copie. Avec WAL actif, ne pas copier le seul fichier principal à chaud.

Pour revenir au portail précédent, conserver le fichier SQLite et remettre le runtime précédent sur un environnement de développement approprié. Il ignorera les nouvelles dispositions et continuera à lire les favoris Kyros. Ne supprimer ni favoris ni clé de récents pour revenir en arrière. Le nouveau runtime pourra retrouver SQLite ensuite.

Les sessions mémoire sont perdues au redémarrage, ce qui exige une reconnexion et ne supprime aucune préférence. Aucune migration ou restauration de production n’a été effectuée.
