---
name: LUMA Hub
description: Un plan de travail lisible pour retrouver ses applications et organiser ses widgets.
colors:
  bg: "#f4f5f2"
  panel: "#fff"
  surface: "#eef1ed"
  surface-hover: "#e7eeea"
  text: "#172629"
  text-2: "#425256"
  muted: "#5d6d70"
  line: "#d7deda"
  line-strong: "#a5b8b1"
  accent: "#174f51"
  accent-2: "#236b69"
  accent-soft: "#dcebea"
  amber: "#966023"
  danger: "#a33336"
  success: "#42723b"
  dark-bg: "#131b1d"
  dark-panel: "#1a2527"
  dark-surface: "#202e30"
  dark-surface-hover: "#293d3e"
  dark-text: "#ecf2ee"
  dark-text-2: "#c5d1cd"
  dark-muted: "#a4b7b1"
  dark-line: "#36484a"
  dark-line-strong: "#68847e"
  dark-accent: "#9dd8cc"
  dark-accent-2: "#b9e7de"
  dark-accent-soft: "#214642"
  dark-amber: "#e5b870"
  dark-danger: "#ffa7a7"
  dark-success: "#a2cc92"
typography:
  headline:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
  metadata:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  clock:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "56px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.04em"
rounded:
  compact: "4px"
  control: "6px"
  button: "7px"
  overlay: "8px"
  radius: "10px"
  dialog: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  control: "10px"
  md: "12px"
  lg: "16px"
  surface: "18px"
  section: "20px"
  xl: "24px"
  page: "32px"
components:
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.panel}"
  button-soft:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  nav-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.metadata}"
    padding: "3px 7px"
  app-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
    padding: "20px"
  widget:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius}"
  launch-tile:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "9px 10px"
---

# Design System: LUMA Hub

## Overview

**Creative North Star: "Le plan de travail LUMA"**

Le Hub est une surface de travail professionnelle en français. Des neutres calmes, un pétrole fonctionnel et des séparateurs fins mettent les applications et les widgets au premier plan. La géométrie du L de marque apporte l'identité sans illustration ni texture dans le produit.

La densité reste pratique : actions proches de leur objet, titres courts, métadonnées secondaires et états de sauvegarde visibles. Les cinq compositions partagent les mêmes composants et la même palette ; leur structure varie réellement. Le thème suit automatiquement le système, conformément au choix utilisateur consigné dans PRODUCT.md.

**Key Characteristics:**
- Surfaces plates et contrastes tonaux.
- Pétrole pour les actions et sélections, ambre pour les favoris et la marque.
- Typographie système fonctionnelle, chiffres horaires tabulaires.
- Navigation latérale sur grand écran, navigation basse sur téléphone.
- Compositions et dispositions indépendantes pour desktop et mobile.

Source normative des valeurs : `src/public/styles/tokens.css`, `ui.css`, `shell.css` et `home.css`. Le frontmatter décrit les primitives claires et leurs contreparties sombres ; le CSS associe les rôles au thème actif. Ce document constate le système construit, sans certification de conformité automatique aux maquettes. La méthode et ses limites sont décrites dans `docs/design/reproduction.md`.

## Colors

La palette associe des neutres légèrement végétaux à un pétrole contenu et un ambre ponctuel.

### Primary
- **Pétrole d'action** (`accent`) : boutons principaux, liens d'action, focus, jour courant et sélection de navigation.
- **Pétrole de réponse** (`accent-2`) : survol du bouton principal.
- **Pétrole diffus** (`accent-soft`) : fonds de sélection et composition immersive.

### Secondary
- **Ambre de repère** (`amber`) : favoris actifs et barre horizontale du symbole LUMA. Il ne remplace pas le pétrole des actions générales.

### Neutral
- **Fond de travail** (`bg`) : canevas principal.
- **Papier de panneau** (`panel`) : navigation, cartes et dialogues.
- **Surface de proximité** (`surface`, `surface-hover`) : fonds secondaires et réponses au survol.
- **Encre de lecture** (`text`, `text-2`, `muted`) : trois degrés de hiérarchie textuelle ; les métadonnées conservent leur contraste.
- **Traits de structure** (`line`, `line-strong`) : séparateurs et contours ; la variante forte distingue les champs et la grille modulaire.

`danger` et `success` signalent respectivement les erreurs et les états positifs. Le texte accompagne le signal coloré. Les jetons préfixés `dark-` sont les contreparties réelles du thème sombre ; ils ne constituent pas une seconde identité.

**The System Theme Rule.** L'apparence suit `prefers-color-scheme`. Une nouvelle surface emploie les rôles CSS existants afin de conserver la lisibilité dans les deux thèmes.

## Typography

**Display Font:** la pile système du corps, admise pour cette surface Operate.

**Body Font:** la même pile système, sans téléchargement de police.

**Character:** une hiérarchie directe, légèrement resserrée dans les titres, sans effet éditorial décoratif. Les grandes valeurs sont réservées à une information dominante telle que l'heure.

### Hierarchy
- **Headline** : titre de page ; réduit sur mobile (28px). Le lanceur minimaliste possède un titre centré plus grand (36px).
- **Title** : titres de sections ; les en-têtes de widgets utilisent une variante compacte (16px, puis 15px sur mobile).
- **Body** : texte courant ; paragraphes limités en largeur (74ch).
- **Label** : boutons et accès ; la navigation desktop est légèrement plus grande (14px).
- **Metadata** : dates secondaires, sources, compteurs et statuts. La taille minimale du système construit est de 12px.
- **Clock** : chiffres tabulaires. La variante immersive élargit l'heure (100px desktop, 76px tablette, 72px mobile) ; le dashboard mobile utilise une heure compacte (29px).

**The Readable Metadata Rule.** Une information secondaire reste lisible et nommée : conserver le plancher de 12px et les rôles de texte du thème actif.

## Layout

Le shell desktop associe une barre latérale (220px), une barre supérieure (80px) et une vue centrale limitée (1600px). La vue garde une marge intérieure régulière (32px horizontalement). Entre 701 et 1050px, la barre latérale se réduit (185px), avec des marges adaptées (22px).

La grille de widgets compte trois colonnes desktop, puis deux entre 701 et 1150px. Chaque widget porte sa largeur et sa hauteur ; la hauteur de base passe de 180px à 140px sur téléphone. Les écarts courants sont courts dans les contrôles, puis plus généreux entre surfaces (18px pour la grille standard, 24px pour la grille modulaire).

À 700px et moins, le shell affiche la marque et le compte en tête, puis quatre accès dans une navigation basse fixe avec prise en compte de la zone sûre. La vue utilise des marges de 18px. Les boutons principaux et les commandes icônes passent à une cible minimale de 44px. Les dispositions mobiles ont leurs propres choix persistés ; la tablette conserve le format desktop avec une grille adaptée.

Le dashboard place les favoris et l'heure en tête, puis le calendrier face aux listes complémentaires. Le lanceur minimaliste réduit les cadres, privilégie recherche et applications, et replie ses widgets secondaires dans des éléments dépliables. L'immersive utilise un fond tonal et une heure dominante ; la modulaire conserve les commandes d'organisation ; la multi-espaces dispose un rail dédié puis une zone personnelle. Sur mobile, le rail devient horizontal et les compositions minimaliste et immersive empilent leurs sections.

**The Shared Engine Rule.** Les compositions changent la hiérarchie et la disposition ; elles réutilisent les composants, les états et les interactions métier communs.

## Elevation & Depth

Les surfaces de travail restent plates : fonds, traits et espacement produisent la séparation. Les popovers de widget et de compte utilisent un contour sans ombre. Les dialogues modaux utilisent une ombre sans bordure extérieure et un voile ; leurs séparateurs internes restent présents. Les notifications temporaires utilisent aussi l'ombre du thème.

### Shadow Vocabulary
- **Dialogue et notification, clair** (`0 12px 36px #15272420`) : profondeur douce réservée aux surfaces temporaires concernées.
- **Dialogue et notification, sombre** (`0 16px 40px #0005`) : contrepartie sombre du même rôle.

**The Single Depth Cue Rule.** Le contour définit un popover ; l'ombre définit un dialogue. Les cartes et widgets au repos ne reçoivent pas d'ombre décorative.

## Shapes

Les panneaux sont doucement arrondis, les contrôles plus courts et les avatars circulaires. Le rayon principal sert aux cartes et widgets ; boutons, champs et commandes icônes emploient leurs rayons plus compacts. Les dialogues ont un rayon plus ouvert. Les séparateurs sont fins (1px), sans angles bruts ni ombres décalées.

Le symbole LUMA est construit en deux rectangles, pétrole et ambre. Les icônes d'interface sont des SVG au trait (20px par défaut, 16px pour les petites variantes), tandis que les applications utilisent leur logo de catalogue ou leurs initiales. Les marqueurs +/− des sections dépliables indiquent un état ; ils ne remplacent pas le système d'icônes.

## Components

### Buttons
Compacts et explicitement libellés. La variante standard utilise le panneau et un trait fort ; la primaire utilise le pétrole et le contraste du panneau ; les variantes douce et fantôme servent les actions secondaires. Le survol change le fond. Le focus clavier est un contour pétrole (2px, décalage 3px). L'état désactivé réduit l'opacité et retire le curseur d'action.

### Chips
Les pastilles décrivent un statut court, avec fond secondaire, texte atténué et angles courts (5px). Elles ne deviennent pas un code couleur arbitraire pour chaque application.

### Cards / Containers
Les cartes d'applications ont un logo, un nom, une description et une action d'ouverture. Leur padding est plus compact sur mobile (14px). Les widgets séparent en-tête, contenu et commandes d'organisation ; les commandes sont permanentes dans la composition modulaire et visibles en mode édition ailleurs. Le mode minimal transforme les conteneurs en sections séparées par une ligne ; le mode immersif privilégie le fond tonal commun.

### Inputs / Fields
Les champs de configuration utilisent un fond de panneau, un trait fort et une hauteur minimale (42px). La recherche globale est un dialogue dédié ; le lanceur minimaliste possède aussi une recherche locale. Le résultat actif utilise le pétrole diffus. Les erreurs sont présentées en texte et les dialogues conservent une action explicite d'annulation ou de fermeture.

### Navigation
La navigation desktop associe icône, libellé et éventuel compteur. L'accès actif utilise fond pétrole diffus et texte pétrole ; le survol utilise une surface secondaire. Sur mobile, icônes et libellés sont empilés dans une barre fixe. Le mode minimal déplace la navigation desktop en tête, au lieu de simuler une barre latérale.

### Launcher / Calendar / Workspace State
Les tuiles d'accès gardent le logo et le nom visibles, avec un repère d'ouverture externe. Les favoris actifs utilisent l'ambre. Le calendrier est un mois natif à sept colonnes avec navigation et jour courant contrasté ; il ne montre aucun agenda connecté. Les statuts de sauvegarde, brouillons, conflits et erreurs restent explicitement libellés. L'entreprise et les connecteurs indisponibles sont présentés comme tels.

Les transitions de couleur et de fond sont brèves (0,15s). L'ouverture d'un dialogue déplace légèrement son contenu (5px, 0,15s). Ces mouvements sont activés seulement lorsque l'utilisateur n'a pas demandé une réduction des animations.

## Do's and Don'ts

### Do:
- **Do** utiliser les rôles CSS existants pour les deux thèmes système.
- **Do** conserver des métadonnées d'au moins 12px et des contrôles tactiles adaptés sur mobile.
- **Do** partager les composants et les états entre les cinq compositions.
- **Do** rendre les données indisponibles, les erreurs et l'état de sauvegarde explicites.
- **Do** proposer une commande clavier équivalente pour organiser les widgets.

### Don't:
- **Don't** ajouter de bannière marketing ou d'illustration décorative à la surface de travail.
- **Don't** généraliser le violet ou employer l'ambre comme couleur de toute action.
- **Don't** cumuler ombre et bordure extérieure pour les dialogues ou ajouter une ombre aux popovers.
- **Don't** comprimer la barre latérale desktop sur téléphone.
- **Don't** transformer les exemples synthétiques des captures en données métier du produit.

Non canonisé : les valeurs de placement propres à une capture, les données de recette, les erreurs de contenu présentes dans les maquettes générées et les scores de conformité inexistants ne sont pas des règles du système.
