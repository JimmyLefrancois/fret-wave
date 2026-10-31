---
name: refonte-mobile
description: Refonte de la version téléphone d'une page Fretwave, en cohérence avec la refonte bureau, sans toucher au bureau. À utiliser dès que l'utilisateur veut adapter une page au mobile, trouve une page trop longue ou trop chargée sur téléphone, demande de reprendre sur mobile ce qui a été fait au bureau, ou de traiter la page suivante (Entraînement, Séquences, Improviser, Accords, Accordeur, Métronome, Réglages…). Pas pour un simple ajustement de marge ou de couleur. Pour le bureau, voir `refonte-page`.
---

# Refonte d'une page sur téléphone

Référence vivante : le rendu téléphone de `src/modules/gammes/ScaleDiscoveryPage.tsx` et le bloc « Page Jouer au téléphone » de `src/app/app.css` (classes `.mplay-*`). Lis-les, ainsi que le rendu bureau de la page cible et le skill `refonte-page`, qui fixe les préférences de fond et la règle « Avant de supprimer ». Ce skill dit ce qui change sur téléphone.

## Le principe

Mêmes choix que le bureau, **mais les blocs restent** : ils conviennent mieux à une colonne. Reprends suppressions, mises en valeur et repositionnements du bureau, pas sa surface unique. Le bureau ne bouge pas.

## Ce que l'auteur veut

- **L'action d'abord.** En-tête collant (`.mplay-head`, `top: 0`) : retour, titre, sous-titre, niveau, puis action principale et tempo sur une rangée. Il reste petit (116 px sur Jouer).
- **Les réglages au-dessus de ce qu'ils règlent**, dans le même bloc, séparés par un trait. Segments sans libellé quand les options parlent d'elles-mêmes. Interrupteurs sans cadre, sur une rangée.
- **Position : `‹` à gauche, « Position 1 / 5 » centré, `›` à droite.** Rien d'autre sur cette rangée, et elle passe au-dessus du contenu : un contrôle situé sous un contenu haut est à un écran de défilement. C'est un écart voulu avec le bureau.
- **Niveaux en onglets, sur une rangée** (`.mplay-levels`) : numéro et titre, le niveau courant en cyan plein. Les précisions des tuiles vont dans les Détails.
- **La tablature à la verticale n'est pas exploitable.** Sur une page d'écoute, le manche est la vue principale, dans la page, et la note jouée s'y cadre (`NeckView`, prop `playback`). La tablature s'ouvre en plein écran paysage par un bouton « Tablature ».
- **Théorie fermée**, derrière « ▸ Détails de la gamme », en blocs `Panel`.
- **Pas de doublon.** Un bouton qui mène au même endroit qu'un onglet disparaît (S'exercer, Improviser, Séquences sur Jouer). Son texte d'aide va dans les Détails.
- **Une série de boutons de même nature a une seule taille** : une grille à colonnes égales, pas une rangée fluide, même si la dernière rangée reste incomplète. Des groupes logiques (toniques naturelles, puis altérées) partagent la même grille et sont séparés par un trait léger (`--line-soft`). Sur `/gammes`, 7 colonnes font 32 px de large à 320 px : surveille la zone tactile.
- **Un séparateur a le même espace dessus et dessous.** Mesure-le : la marge automatique entre enfants d'un `.panel` s'ajoute souvent d'un seul côté.
- **Barre basse commune** : Instrument et « ← Changer de gamme » dans un seul bloc (`.mplay-foot`).
- **Ce qui repose sur le décor se détache du fond dans les deux thèmes** : fond `--surface`, bordure `--line`, texte `--text`. En Aube, `--surface-hi` et un fond transparent se confondent avec le décor.

## Ce qui ne se transpose pas du bureau

- **Au téléphone aussi, on répond à la guitare** : l'auteur a retiré pavé, clavier et sélection de case sur Entraînement (D121). Propose la même chose ailleurs, avec la question de `refonte-page`, car un élève sans micro ne peut plus finir. Micro ouvert seul si possible, sinon bouton `.mic-spark`.
- **`oneLine` ne s'applique que dans la vue paysage** : passe `oneLine={wide || playing}`, sinon la tablature reste en plusieurs lignes.
- **Les popups restent possibles pour un outil secondaire**, mais si l'outil devient la vue principale, il passe dans la page.
- **Tablature d'exercice : à trancher page par page.** Elle est le support de l'exercice (trous, motifs). Ne la remplace pas par le manche : pose la question à l'auteur avec `AskUserQuestion`, en montrant ce qui change. Sur Entraînement, il a choisi le paysage : le portrait règle, lance et rend le résultat (`ScaleTrainingPage.tsx`, D120). Propose ce modèle en premier.
- **Les options suivent le bureau**, avec l'accord de l'auteur : chaque retrait de fonction passe par la question de `refonte-page`.

## Déroulé

1. **Capture la référence** à 390 px avant toute modification : `node .claude/skills/refonte-page/scripts/capture.mjs <dossier> avant <route> 390`, sur le `npm run dev` déjà lancé.
2. **Liste les états de la page** (résultat, à froid, session, à l'aveugle) et ses retraits au bureau (`git log`, `docs/DECISIONS.md`, D114-D116).
3. **Classe chaque bloc** : sert en jouant, se règle rarement, théorie, doublon.
4. **Charge `impeccable`** et `craft-floor.md` avant d'éditer.
5. **Construis**, vérifie, rends compte. Une page à la fois : l'auteur valide, puis on passe à la suivante.

## Construire

- N'édite que le `return` téléphone de la page. Les constantes JSX partagées restent ; si tu en changes une, vérifie le bureau.
- Réutilise les classes `.mplay-*` : renomme ce qui n'est propre à aucune page plutôt que de dupliquer. Styles sous `@media (max-width: 899px)`, sauf ce qui doit survivre au paysage.
- **Un grand téléphone dépasse 900 px en paysage** : `useDesktop` bascule et la page passe en rendu bureau. Toute vue paysage est rendue dans les deux `return` par `createPortal`, avec son CSS hors des media queries de largeur.
- **Plein écran paysage** : `LandscapeView` et `openLandscape` (`src/app/LandscapeView.tsx`), ce dernier appelé dans le geste. L'iPhone refuse le plein écran et le verrou : `.tab-full` pivote alors en CSS sous `@media (orientation: portrait)`.
- **Vue paysage d'exercice** : `const desktop = wide && !playing`, sinon un grand téléphone change de rendu au passage de 900 px. Fermer la vue avant la fin remet la série à zéro, sauf à froid, où recommencer fausserait l'essai : pause, micro sans effet, reprise par « Reprendre ». Sur Séquences, fermer termine la session et enregistre les passes (D122). Fin de série : referme la vue, le résultat se lit en portrait, avec un bouton pour revoir la correction. Si la tablature n'est plus visible en portrait, dis-le : « Touche Jouer pour afficher la tablature. »
- Un composant partagé (`LevelsNav`) se restyle par un conteneur (`.mplay-levels`), pas directement : les pages pas encore refaites gardent leur rendu.
- Le suivi de lecture d'une `TabView` en `wrap` ignore l'en-tête collant et la barre de navigation : vérifie qu'il reste visible.

## Vérifier

- `npx tsc --noEmit`, un test pour toute logique, `npm test` et `npm run build` à la fin.
- Captures à **390, 360, 320 et 768 px** dans les deux thèmes : regarde-les, jusqu'en bas de page. 360 px est courant sur Android, et c'est là que les rangées passent à la ligne. Pas de `scrollWidth` supérieur à la fenêtre.
- Vue paysage : 390 × 844 (pivot CSS), 844 × 390, 932 × 430. Playwright ne redimensionne pas une fenêtre en plein écran : remplace `requestFullscreen` par un refus dans `addInitScript`, et teste la sortie à part avec `document.exitFullscreen()`.
- Joue une série entière (`window.__training` : `select`, `press`, `validate`) jusqu'au résultat, et vérifie chaque niveau.
- Dans une vue en portail, cible les boutons par `.tab-full` : ceux de la page existent encore derrière.
- États ouverts : Détails, popups, Position voisine. Contenus extrêmes : titre long, cases hautes, aller-retour.
- Bureau : capture à 1440 px, inchangé. Si une constante partagée a bougé, ouvre aussi ses popups.
- Dis ce qui reste à essayer sur un vrai téléphone : orientation, retour Android, encoches.

## Fin de refonte

Retire le CSS devenu mort. Mets à jour `DESIGN.md`, `docs/DECISIONS.md` et l'état en tête de `PROJECT.md`. Ne commite que sur demande.

## Compte rendu

Dis ce qui est vérifié et ce qui ne l'est pas. Nomme les retraits, les textes déplacés dans les Détails, et tout effet sur le bureau ou sur une autre page.
