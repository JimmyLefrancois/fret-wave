---
name: Fretwave
description: Tablature en pixel art sur un décor de synthwave (nuit) ou d'aube (jour), pour apprendre la guitare.
colors:
  night-void: "#06000F"
  night-bg: "#0D0221"
  night-surface: "#150A33"
  night-surface-hi: "#201048"
  night-line: "#5B2FA8"
  night-line-soft: "#3A1C71"
  night-text: "#F6EEFF"
  night-muted: "#C4B6E4"
  night-dim: "#A99BCF"
  neon-magenta: "#FF2A6D"
  neon-cyan: "#05D9E8"
  neon-orange: "#FF9E3D"
  neon-yellow: "#FFD23F"
  neon-violet: "#A86BFF"
  neon-green: "#7CFF6B"
  spark: "#FFD23F"
  night-danger: "#FF5C7A"
  night-ok: "#4CFF9A"
  night-on-accent: "#12021F"
  dawn-sky: "#FFDCC7"
  dawn-bg: "#FFF3E8"
  dawn-paper: "#FFFBF5"
  dawn-surface-hi: "#FFE7D6"
  dawn-line: "#B23A6B"
  dawn-line-soft: "#F3C3D3"
  dawn-ink: "#2B0B2E"
  dawn-muted: "#5E2C52"
  dawn-dim: "#6E4462"
  dawn-magenta: "#C2185B"
  dawn-cyan: "#0B6E7A"
  dawn-orange: "#B4530A"
  dawn-yellow: "#7D6000"
  dawn-violet: "#5B2A9E"
  dawn-green: "#1C6B36"
  dawn-spark: "#FFC93C"
  dawn-danger: "#B3122F"
  dawn-ok: "#14683A"
  dawn-on-accent: "#FFF8F2"
  interval-root: "#FFD23F"
  interval-2: "#FF8A3D"
  interval-3: "#FF3CAC"
  interval-4: "#7CFF6B"
  interval-5: "#3CE6FF"
  interval-6: "#A86BFF"
  interval-7: "#FF5C5C"
typography:
  display:
    fontFamily: "'Press Start 2P', monospace"
    fontSize: "15px"
    lineHeight: 1.5
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.35
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Silkscreen', 'Press Start 2P', monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
    lineHeight: 1.6
  hero-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
  label-lg:
    fontFamily: "'Silkscreen', 'Press Start 2P', monospace"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.06em"
    lineHeight: 1.6
rounded:
  pixel: "2px"
spacing:
  tight: "4px"
  inside: "8px"
  block: "12px"
components:
  button:
    backgroundColor: "{colors.night-surface-hi}"
    textColor: "{colors.night-text}"
    rounded: "{rounded.pixel}"
    padding: "0 14px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.neon-magenta}"
    textColor: "{colors.night-on-accent}"
    rounded: "{rounded.pixel}"
    padding: "0 14px"
    height: "44px"
  button-hero:
    backgroundColor: "{colors.neon-magenta}"
    textColor: "{colors.night-on-accent}"
    rounded: "{rounded.pixel}"
    padding: "0 14px"
    height: "56px"
    fontSize: "17px"
  chip:
    backgroundColor: "{colors.night-surface-hi}"
    textColor: "{colors.night-muted}"
    rounded: "{rounded.pixel}"
    padding: "0 10px"
    height: "38px"
  chip-on:
    backgroundColor: "{colors.neon-cyan}"
    textColor: "{colors.night-on-accent}"
  panel:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-text}"
    rounded: "{rounded.pixel}"
    padding: "14px"
---

# Design System: Fretwave

## Overview

**Creative North Star: "La salle de répétition au néon"**

Une cabine d'enregistrement vue à travers un moniteur CRT : un ciel dégradé, un soleil rayé, des montagnes en silhouette et une grille en perspective servent de décor, et la tablature est l'instrument posé devant. Tout le chrome est en pixels francs : traits de 2 px, ombres dures décalées, coins à 2 px, jamais de flou ni de dégradé décoratif sur les panneaux. Le thème « Aube » est le même monde sous la lumière du jour, pas une variante : même décor, même forme, encre prune sur papier chaud.

L'interface est un outil d'entraînement, regardé à distance, les mains sur le manche. Le décor ambiance ; le contenu pédagogique (tablature, note à jouer, verdict) prend toujours le premier plan. L'identité pixel art vit dans les bordures, les ombres, les étiquettes et la tablature, pas dans le texte qu'on lit.

**Key Characteristics:**
- Pixel logique unique à échelle entière pour le canvas ; traits DOM de 2 px, jamais 1.
- Ombres dures, décalées de 3-4 px, sans flou. Les halos néon ne servent qu'à désigner l'action principale ou l'état actif.
- Deux thèmes entièrement jetonnés (`ThemeTokens`) ; aucun hex dans `app.css`.
- Couleurs d'intervalle globales, identiques dans les deux thèmes.
- Texte courant en sans-serif système ; polices pixel réservées aux étiquettes et à la marque.

## Colors

Une palette de nuit saturée (violets profonds, néons) et son jumeau diurne où les mêmes accents sont assombris pour tenir comme texte. Sources : `src/core/themes/synthwave.ts` et `dawn.ts`, injectées en variables CSS par `cssVars()`.

### Primary
- **Néon magenta** (`#FF2A6D` nuit / `#C2185B` aube) : l'action principale (`.btn-primary`), l'onglet actif, le curseur de lecture, les titres de page. Rare par écran.

### Secondary
- **Néon cyan** (`#05D9E8` / `#0B6E7A`) : survol, focus, titres de carte, pastille sélectionnée par défaut.

### Tertiary
- **Orange** (`#FF9E3D` / `#B4530A`), **jaune** (`#FFD23F` / `#7D6000`, assombri pour tenir 4,98:1 sur `surfaceHi`), **violet** (`#A86BFF` / `#5B2A9E`), **vert** (`#7CFF6B` / `#1C6B36`) : accents de module et d'état (accord, fondamentale, barré, succès). Jaune du survol sur le bouton primaire.

### Neutral
- **Vide nocturne** (`#06000F`) et **nuit** (`#0D0221`) : fond de page et fond de champ ; **surface** (`#150A33`) et **surface haute** (`#201048`) : panneaux et boutons. Aube : ciel `#FFDCC7`, fond `#FFF3E8`, papier `#FFFBF5`, papier chaud `#FFE7D6`.
- **Trait** (`#5B2FA8` / `#B23A6B`) et **trait doux** (`#3A1C71` / `#F3C3D3`) : bordures.
- **Texte / atténué / discret** (`#F6EEFF`, `#C4B6E4`, `#A99BCF` ; aube `#2B0B2E`, `#5E2C52`, `#6E4462`) : sur aube, tous ≥ 7:1 (testé dans `tests/theme.test.ts`).
- **Danger / ok** (`#FF5C7A`, `#4CFF9A` ; aube `#B3122F`, `#14683A`). **Encre sur accent** (`#12021F` / `#FFF8F2`) : le texte posé sur un aplat d'accent.

### Couleurs d'intervalle (hors thème)
Fondamentale jaune `#FFD23F`, 2 orange `#FF8A3D`, 3 magenta `#FF3CAC`, 4 vert `#7CFF6B`, 5 cyan `#3CE6FF`, 6 violet `#A86BFF`, 7 corail `#FF5C5C` (`core/tab/colors.ts`). Elles ne changent jamais avec le thème : l'élève apprend une couleur, pas un habillage. Les bémols assombrissent, les dièses éclaircissent.

### Named Rules
**The Ink-On-Accent Rule.** Le texte posé sur un aplat d'accent utilise `--on-accent`, jamais un noir ou un blanc codé en dur : un seul jeton garantit la lisibilité dans les deux thèmes.

**The Fixed-Interval Rule.** Aucune couleur d'intervalle n'est lue depuis le thème. Un thème peut changer le panneau de la tablature, pas le sens d'une couleur de note.

**The Spark Rule.** `--spark` est de la lumière, jamais du texte : le jaune d'Aube est assombri pour se lire, l'étincelle garde un jaune vif dans les deux thèmes.

**The No-Hex Rule.** `app.css` ne contient aucun hex ; tout passe par les variables issues des tokens.

## Typography

**Display Font:** Press Start 2P (repli monospace) : marque et mot-symbole seulement, car sans minuscules.
**Body Font:** sans-serif système (`ui-sans-serif, system-ui, …`) : tout ce qui se lit.
**Label Font:** Silkscreen (repli Press Start 2P) : étiquettes, badges, onglets de décor, capitales courtes.

**Character:** Un chrome typographique de borne d'arcade posé sur un texte de pédagogie totalement neutre. La police pixel étiquette ; elle ne raconte jamais.

### Hierarchy
- **Display** (Press Start 2P, 15 px, 1.5) : titre de page `main.wide h1`, marque.
- **Title** (système, 650, 17 px, 1.35) : `.card-title`, titre d'élément dans une liste.
- **Body** (système, 400, 16-16,5 px, 1.55) : explications, consignes ; `.t-small` à 14,5 px en atténué.
- **Control** (système, 650-700, 13,5 px, capitales, interlettrage 0,04em) : texte des boutons ; 12,5-13,5 px pour pastilles et segments.
- **Label** (Silkscreen, 700, 14 px pour `.t-label`, 11 px pour `.tag`, 0,06em, capitales) : `.t-label`, `.tag`, titres de carte de contrôle (12-13 px).
- **Label large** (Silkscreen, 700, 13 px, token `--label-lg`) : étiquettes lues à un mètre, celles du héros de l'accueil et l'accroche de l'affiche.
- **Action du héros** (système, 17 px, bouton de 56 px, tokens `--hero-btn-size` et `--hero-btn-h`) : le seul bouton primaire de l'accueil, la chose à lire depuis le tabouret, guitare en main.
- **Titre de la tâche** (système, 700, 30 px, 36 px au bureau, token `--hero-title`) : la gamme ou l'accord du héros, **le plus grand mot de l'accueil** ; la marque de l'affiche descend à 22-30 px (D82).

### Named Rules
**The Reading-Text Rule.** Tout texte que l'élève doit lire (navigation, consignes, valeurs) est en sans-serif. Silkscreen en capitales tronquait « ACCORDEUR » et perdait les accents : il reste réservé aux étiquettes.

## Layout

Application à une colonne sur téléphone (390 px est la cible de référence), qui devient une grille de page à `gap: 20px` au bureau (≥ 900 px) avec un contenu large plafonné à 1100 px. Navigation du bas fixe avec zone de sécurité (`env(safe-area-inset-bottom)`), jamais d'action principale masquée derrière elle. Points de rupture observés : 520 px, 900 px, 1500 px.

Rythme vertical en trois valeurs : 12 px entre blocs de page (`--gap-block`), 8 px entre sous-blocs d'un panneau (`--gap-inside`), 4 px entre un libellé et sa valeur (`--gap-tight`). Zones tactiles ≥ 38 px (pastilles 38, segments 40, boutons 44, action du héros 56, navigation 52). La barre fixe ne cache jamais l'élément focalisé : `scroll-padding` à sa hauteur (en bas au téléphone, en haut au bureau).

La tablature est un canvas à largeur variable dont le facteur d'échelle est entier (S ≥ 2) ; la mise en page de la tablature est une fonction pure (`core/tab`).

**Pages de jeu au bureau (≥ 900 px, module Gammes, D114).** Une seule surface (`.play-surface`), plus large que les autres pages (96 vw) pour la tablature. De haut en bas : en-tête collant à 54 px (`.play-head`), barre de réglages avec un trait dessous (`.play-tab-bar`), tablature, zone de verdict rendue seulement si elle a du contenu, niveaux et positions sur une ligne (`.play-nav`), bouton « Détails » (`.play-more`), deux colonnes de sections à filet pointillé (`PlaySection`), barre basse (`.play-foot`). L'écran de jeu tient sans défiler à 1440 × 900, sauf Séquences, dont la tablature reste sur plusieurs lignes. Le module Accords a la même surface (`.chord-surface`, D115), panneaux aplatis en sections et sept étapes en onglets. Un outil secondaire visuel, comme le manche, s'ouvre dans un `<dialog>`.

**Pages de jeu au téléphone (< 900 px, `gammes/jouer`, D119).** Les choix du bureau, en gardant les blocs. De haut en bas : en-tête collant (`.mplay-head`), bloc de contenu avec positions et réglages au-dessus, cinq onglets de niveaux (`.mplay-levels`), bouton « Détails », barre basse (`.mplay-foot`). Le manche remplace la tablature, qui s'ouvre en plein écran paysage (`.tab-full`). Tout ce qui repose sur le décor prend `--surface`, seule valeur qui s'en détache dans les deux thèmes. Sur les pages d'exercice, le portrait ne garde que Jouer et une phrase d'explication, les options passent dans la vue paysage (`.tab-full-options`, D123). L'entraînement (D120) se joue entièrement en paysage : tablature sur une ligne, verdict dessous (`.land-*`), au micro seul (D121), comme les sessions de Séquences (D122), sur une ligne qui suit la note ; le portrait règle, lance et rend le résultat.

## Elevation & Depth

Profondeur par **ombre dure décalée**, pas par flou : `box-shadow: 4px 4px 0` en `--shadow-ink` (noir à 45 % sur nuit, magenta à 28 % sur aube : un noir sur papier fait une tache). Les contrôles s'enfoncent à l'appui : `translate(2px, 2px)` et ombre réduite à 1 px, en `steps(1)`.

### Shadow Vocabulary
- **Panneau** (`box-shadow: var(--shadow) var(--shadow) 0 var(--shadow-ink)`) : repos des panneaux ; équerres de coin de 9 px en `--accent` en haut à gauche et en bas à droite.
- **Bouton** (`3px 3px 0 var(--shadow-ink)`) : repos des boutons, 1 px à l'appui.
- **Halo néon** (`0 0 16-20px -4/-6px <accent>`) : réservé à l'action principale (`.btn-primary`) et au panneau actif (`.panel-active`, un seul par écran). Jamais sur un contrôle secondaire, ni sur un panneau seulement accentué.

### Named Rules
**The Hard-Shadow Rule.** Aucune ombre floue pour la profondeur. Le seul flou autorisé est le halo néon, et il signale l'action ou l'état actif.

## Shapes

Angles quasi vifs : un seul rayon, 2 px (`--corner`), qui lit comme un coin « pixel ». Bordures pleines de 2 px (`--bw`), 1 px seulement sur les badges et tags. Équerres de coin sur les panneaux plutôt que des arrondis. Le décor (soleil rayé, montagnes, grille en perspective) est dessiné au canvas en pixels logiques et ne porte jamais de contenu.

## Components

### Buttons
- **Shape:** rectangle à coins vifs (2 px), bordure 2 px, hauteur mini 44 px.
- **Default:** fond surface haute, texte `--text`, capitales 13,5 px, ombre dure 3 px. Survol : bordure cyan. Focus visible : contour cyan 2 px décalé de 2 px.
- **Primary:** aplat magenta, texte `--on-accent`, halo magenta et liseré `--bg-deep`. Survol : bordure jaune.
- **Quiet / Danger:** fond transparent et texte atténué ; ou fond `--bg` avec bordure et texte `--danger`. Désactivé : opacité 0,4.

### Chips et segments
- **Chip** (38 px) et **segment** (40 px) sont des boutons : ils portent un fond (surface haute ou fond) pour ne pas se lire comme une étiquette posée sur le décor. Sélectionné : aplat `--accent` (cyan par défaut pour la pastille, magenta pour le segment), texte `--on-accent`, gras.

### Panneaux et cartes
- **Panneau :** fond surface, bordure 2 px, ombre dure, équerres. **Panneau accentué :** bordure et titre en `--accent`, sans halo. **Panneau actif :** accentué plus le halo, réservé au panneau où l'on agit (héros, étape en cours).
- **Carte de contrôle :** fond surface, bordure 2 px, sans ombre ; titre en Silkscreen cyan ; état « ok » en bordure `--ok`.

### Accueil (lanceur, D78-D82)
- **Affiche :** marque, accroche, puis (sous un trait `--line-soft`) jauge du jour et série, sur **une seule plaque** légèrement translucide (`--veil-rgb` à 0,85 ; bordure `--line`, ombre dure), alignée sur le bord des cartes ; pas de voile dégradé sur le décor ; la jauge dit « Objectif du jour atteint » à 3 exercices vérifiés.
- **Héros :** panneau accentué magenta ; titre de la tâche, une ligne de contexte à 16 px, puis la rangée d'actions à **deux poids** : le primaire (56 px, 17 px, touche « Espace » au clavier seulement), l'autre étape en bouton ordinaire à sa taille (44 px), et « changer de gamme / d'accord » en **lien** souligné. Le primaire garde la même place dans tous les états : pleine largeur au téléphone, à gauche et au moins 20 rem au bureau.
- **Étapes :** liste numérotée en pastilles pixel 28 px ; étape en cours en aplat magenta, étape franchie en ✓ vert estompée (franchie seulement sur un fait observé, D79).
- **Parcours :** une ligne par module (nom en `--label-lg` cyan, sujet et compte, barre pixel 12 px au trait `--line` remplie de `--green`) ; trois colonnes au bureau, empilées sous 900 px.

### Actions de l'en-tête de jeu
Le magenta reste à l'action principale, une seule à l'écran. **Ouvrir le micro**, quand un clic est nécessaire, porte une comète qui tourne sur son cadre (`.mic-spark`, traîne `--cyan`, tête `--spark`) ; avec le mouvement réduit, un simple cadre `--spark`. Un mode à ne pas oublier prend le cyan (`.train-grid`) : contour au repos, aplat quand c'est le geste du moment.

### Navigation
Barre opaque (`--bg-deep`, trait 2 px `--line`) à six destinations, icônes pixel pleines 10×10 dessinées à ×2 (20 px). Téléphone : en bas, pleine largeur, icône au-dessus d'un libellé sans-serif de 11,5 px au plus (la taille suit la largeur pour que six onglets tiennent), 56 px de haut. Bureau (≥ 900 px) : en haut, onglets alignés à gauche sur le bord du contenu, icône et libellé de 14 px sur une ligne, 52 px de haut, sans cadre ni mot-symbole (la marque vit dans l'affiche de l'accueil). Repos en `--dim`, survol en `--text`, actif en magenta (icône et libellé), sans halo. Libellé tronqué par ellipse, jamais à la ligne.

### Tablature (composant signature)
Panneau de tablature dessiné au canvas : cordes fines, barres de mesure, chiffres sur pastilles colorées par intervalle avec contour qui sépare du fond (sombre en nuit, papier en aube), curseur de lecture magenta à cœur clair. Sur aube, le panneau s'éclaircit (`#FFFBF5`, encre `#2B0B2E`) mais les aplats d'intervalle restent saturés. Le chiffre sur pastille a toujours un contour : jamais de scanlines dessus.

### Étiquettes
`.home-key` (Silkscreen 11 px, bordure 1 px `currentColor`, dans le bouton primaire, masquée au tactile).
`.badge` (Silkscreen 12 px, bordure 1 px) et `.tag` (11 px, capitales, discret). `.tag-on` : aplat vert.

## Do's and Don'ts

### Do:
- **Do** passer par les jetons de thème (`var(--magenta)`, `var(--on-accent)`, `var(--shadow-ink)`) pour toute couleur de l'UI DOM.
- **Do** donner un fond à tout ce qui se clique (chip, segment, bouton quiet) pour qu'il lise comme un bouton.
- **Do** garder des cibles tactiles d'au moins 38 px et vérifier l'absence de débordement horizontal à 390 px.
- **Do** tenir le contraste AA sur le texte courant dans les deux thèmes (≥ 4,5:1 ; l'encre aube vise ≥ 7:1).
- **Do** respecter `prefers-reduced-motion` : suppression des transitions d'appui et des animations du décor.

### Don't:
- **Don't** coder un hex dans `app.css` ni en dur dans un composant React.
- **Don't** utiliser une police pixel pour du texte courant, de la navigation ou une consigne.
- **Don't** ajouter d'ombre floue de profondeur ni d'arrondi supérieur à 2 px.
- **Don't** laisser une couleur d'intervalle dépendre du thème ni la rendre seule porteuse du sens (le chiffre est toujours écrit).
- **Don't** poser des scanlines ou une traînée lumineuse sur un ciel clair, ni sur les chiffres de la tablature.
- **Don't** étendre un halo néon aux contrôles secondaires.
