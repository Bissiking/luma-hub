# Catalogue de projets

Mode : Operate / Read. Extension du shell et du système visuel existants, sans remplacement de DESIGN.md ni de ses jetons.

Sources : src/public/js/projects/view.js, src/public/styles/projects.css, src/projects/catalogue.js.

Objectif : retrouver et comprendre les 56 fiches validées par Mathéo, y compris composants, événement LAN et dépôts archivés. Les nouvelles divisions et les statuts inconnus restent explicitement à clarifier. Les deux identités personnelles sont contextualisées ; Nino reste soutenu par les deux.

Structure : titre et description courts, contexte du groupe dépliable, recherche et trois filtres, liste lisible avec description et type. Une fiche partageable par fragment présente les faits, dépôts et composants liés ; les sources secondaires se déplient. Le retour conserve les filtres de la session.

Direction : palette pétrole et neutres, typographie système, séparateurs fins, surfaces plates. Aucun nouveau jeton. La liste remplace une grille dense de 56 cartes. Sur téléphone les filtres se replient en lignes et les fiches en une colonne ; le menu de compte et la page Applications rendent la section accessible sans changer les quatre accès de navigation basse.

Accès : tous les utilisateurs authentifiés, choix explicite de Mathéo. Le catalogue JSON reste sur un volume serveur hors du dépôt public ; l’API vérifie l’identité Kyros et ne met pas les réponses en cache. Aucun contournement d’authentification pour la recette : fournisseur synthétique isolé dans le harness de test existant.

Vérification attendue : recherche sans accents, filtres combinés, absence de résultats, fiche inconnue, retour et liens entre composants, reprise après erreur réseau, navigation clavier, thèmes système clair/sombre, desktop et mobile. La recette synthétique ne prouve ni le Kyros réel ni un déploiement.

## Vérification de l’extension livrée

La comparaison du code et des quatre captures confirme la continuité avec le système existant : rôles de couleur clair/sombre, pile typographique système, surfaces plates, séparateurs fins, champs et boutons partagés. Le seuil mobile reste celui du shell (700px). La fiche passe de deux colonnes à une colonne ; les quatre accès de navigation basse sont conservés. L’intégration est portée par `src/public/index.html`, `src/public/app.js`, `src/public/js/views.js` et `src/public/js/search.js`.

Le [rapport local](../review/projects/report.json) porte sur 56 fiches et ne signale aucune erreur. Il consigne le SSO HTTP synthétique, la navigation, la recherche avec conservation du focus, le retour aux filtres, les archives, les composants liés, les états vides et inconnus, le clavier, l’absence de débordement, les thèmes et la reprise après erreur réseau. Captures examinées : [liste desktop](../review/projects/desktop.png), [liste mobile](../review/projects/mobile.png), [fiche desktop](../review/projects/detail-desktop.png) et [fiche mobile sombre](../review/projects/detail-mobile-dark.png). La revue de finition conclut à une livraison sans correction matérielle ; cette preuve reste locale et synthétique.

Les avis du détecteur sur les tailles en rem ne constituent pas de nouveaux jetons : les valeurs employées pour la lecture (14px et 16px à la taille racine par défaut) sont déjà présentes dans le CSS du Hub. Le rayon des pastilles (5px), absent de l’échelle `rounded` du frontmatter, est déjà décrit dans la prose de `DESIGN.md`, dans la pastille du sidecar et dans le CSS partagé. Cet écart préexistant entre l’échelle machine et le composant est signalé sans régénérer le système. `DESIGN.md` et `.impeccable/design.json` sont préservés ; aucune nouvelle primitive n’est canonisée.
