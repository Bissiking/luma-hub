# Reproduction des maquettes et limites de preuve

## THESIS

Réunir les accès autorisés et les widgets natifs dans un espace de travail utile, dont les dispositions sont réellement sauvegardées. L’interface doit rendre la prochaine action lisible, sans données métier inventées.

## OWN-WORLD

Plan de travail LUMA : neutres, pétrole, ambre, traits fins, géométrie de la lettre L, surfaces plates, texte fonctionnel. Pas d’illustration ni de texture raster dans le produit. Les PNG générés servent uniquement à la documentation de la direction approuvée.

## STORY

Entrer via Kyros → retrouver ses applications → choisir une composition par format → organiser et configurer ses widgets → retrouver ses choix après rechargement. Les refus d’accès sont explicites et ne donnent pas de droits fictifs.

## FIRST VIEWPORT

Sur la planche A de 1536 × 1024, l’écran desktop occupe approximativement x15–1134 / y90–990 ; le mobile x1150–1524 / y86–977. À l’intérieur du desktop, navigation latérale jusqu’à x250, recherche jusqu’à y177, titre/actions y213–278, favoris x278–797 / y317–538, horloge x813–1115 / même rang, calendrier x278–797 / y555–929, raccourcis et récents empilés à droite. Ce sont des mesures manuelles indicatives, pas des métriques générées par comp-diff.

La planche B–E de 1536 × 1024 comporte quatre écrans, environ x25–750 et x786–1512, y135–547 et y615–1009. Leurs traits structurants sont documentés dans `workspace-brief.md`. Les captures fonctionnelles utilisent le vrai viewport desktop 1440 px et mobile 390 px plutôt que le ratio des artboards assemblés de la planche.

## FORM

A : grille lisible et pile latérale. B : recherche/favoris/listes compactes, widgets secondaires dépliables. C : heure puis favoris à gauche et calendrier compact à droite. D : grille à poignées et tailles configurables. E : rail des espaces, titre Personnel et sous-navigation d’accès. Chaque rendu utilise des éléments sémantiques, pas une image de la maquette.

## Historique réel de la méthode

Le script `concept-seed` a d’abord refusé faute de PRODUCT.md. Après écriture du produit, il a produit la clé `f3a7c4b9` et l’index 5. Aucun classement de sept concepts ni tournoi de directions n’a été validé avec cet index : les cinq compositions étaient imposées par le brief et les planches générées ont été approuvées directement dans la conversation. Le choix de workflow `comp` a été confirmé avant la génération.

Les prompts exacts et l’approbation sont conservés dans les sidecars JSON des deux PNG. Les sources ont ensuite été construites et vérifiées dans Chrome. Une revue indépendante a demandé des corrections sur B/C/E, la petite typographie et l’élévation des popovers ; ces changements sont consignés dans le bilan de validation.

**Limite assumée :** le protocole automatique `build-phase`, ses gates hero et son `comp-diff` n’ont pas été exécutés. Aucun `state.json`, `spec.json`, score numérique, QUALITY BAR externe ou rapport hero n’est fabriqué rétroactivement. Cette documentation manuelle rend la direction et les écarts contrôlables, sans présenter l’alpha comme certifiée par ces outils.
