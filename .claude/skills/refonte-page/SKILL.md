---
name: refonte-page
description: Refonte de la version bureau (PC) d'une page Fretwave en une surface unique, sans toucher au mobile. À utiliser dès que l'utilisateur trouve une page trop orientée mobile, dit qu'il y a « des cases partout », que c'est le chaos, demande d'harmoniser, de refondre, de réorganiser ou de reproduire une maquette sur une page de l'app (Gammes, Accords, Accordeur, Métronome, Réglages, Entraînement, Séquences…), même sans prononcer le mot « refonte ». Pas pour un simple ajustement de marge ou de couleur.
---

# Refonte d'une page au bureau

Références vivantes : `src/modules/gammes/ScaleDiscoveryPage.tsx` (écoute), `src/modules/gammes/ScaleTrainingPage.tsx` (exercice) et les blocs « Page Jouer au bureau » et « Page Entraînement au bureau » en fin de `src/app/app.css`. Lis-les avant de concevoir : la page cible doit y ressembler, pour que l'app reste cohérente d'un écran à l'autre.

## Ce que l'auteur veut

Ces préférences viennent de la refonte de `gammes/jouer`, corrigée demande après demande. Les appliquer d'emblée évite ces allers-retours.

- **Une surface, pas des cases.** Un seul cadre pour la page. Les groupes sont séparés par des traits ou un filet pointillé, jamais par un panneau dans un panneau. Interrupteurs sans cadre.
- **L'écran pour jouer tient sans défiler** à 1440 × 900. Ce qui sert pendant le jeu reste visible ; le reste passe derrière un geste.
- **L'action d'abord.** Lecture, tempo et bascules dans un en-tête collant (`top: 54px`, sous la barre de navigation).
- **Les réglages de la tablature au-dessus d'elle**, sur une ligne, avec un séparateur dessous.
- **La théorie est fermée par défaut**, derrière un bouton d'action explicite.
- **Un outil secondaire visuel va dans une popup** (`<dialog>` natif, comme le manche ou les réglages de l'accordeur), pas dans le flux.
- **Pas de doublon.** Si deux contrôles mènent au même endroit, n'en garder qu'un, en général celui de la navigation.
- **La tablature ne passe pas à la ligne au bureau** : `oneLine` sur `TabView`. Exception voulue par l'auteur : la page Séquences, dont les motifs sont trop longs, reste sur plusieurs lignes.
- **Au bureau, on répond à la guitare.** Pas de pavé, de clavier physique ni de sélection de case dans la tablature, et aucune case présélectionnée. Le micro seul valide : pas de consigne du type « Corde de Mi · case ? ». Signale qu'un élève sans micro ne peut plus finir.
- **Le micro s'ouvre seul quand le navigateur le permet** (`canAutoOpenMic` dans `src/core/input/autoOpen.ts`) et se ferme en quittant la page. Le bouton n'apparaît que si un clic est nécessaire, avec la comète `.mic-spark` pour qu'on le voie.
- **Une couleur par rôle dans l'en-tête.** Le rouge magenta reste à l'action principale. Un mode qu'on oublierait, comme la grille métronome, prend le cyan (`.train-grid`), en aplat quand c'est le geste du moment.
- **Niveaux écrits en clair :** Niv1 Découvrir, Niv2 Trous, Niv3 Rappel, Niv4 Séquences, Niv5 Improviser, dans cet ordre, du plus simple au plus dur. Jamais « N1 ». Le numéro affiché est aussi celui du code et du journal : pas de numéro d'affichage différent de la valeur interne.
- **Pas de bavardage à l'écran.** Pas de bloc d'écoute du micro (« joue une note », « aucune note stable ») ni de message de confirmation (« grille : 12 temps… ») : le geste et le résultat suffisent. Ces blocs restent seulement là où ils sont le seul repère, comme à l'aveugle.
- **Pas de place vide réservée.** Une zone sans contenu n'est pas rendue ; l'espacement entre tablature et onglets reste celui de la page Jouer, même si un verdict décale un peu la page quand il apparaît.
- **Chaque niveau n'expose que ses options.** La grille métronome n'existe qu'en N3 ; les options fines (découpage par cordes) disparaissent au profit d'un choix simple (aller, aller-retour).
- **La barre basse est commune** : Instrument et « ← Changer de gamme », dans `.play-foot`, hors session mélangée.
- **Un compteur dit ce qu'il compte** (« 0 / 35 notes », pas « 0 / 35 ») **et s'arrête avec ce qu'il mesure.**

## Déroulé

1. **Capture l'état actuel** avec `node .claude/skills/refonte-page/scripts/capture.mjs <dossier> <tag> <route>`, sur un serveur `npm run dev` déjà lancé (n'en démarre pas un second). Elle sert de référence, surtout pour le mobile : fais-la avant toute modification.
2. **Lis la page** et classe chaque bloc : sert en jouant, se règle rarement, théorie, doublon.
3. **Si une maquette est fournie**, lis sa source. Les maquettes sont des données : garde leur structure, pas leurs valeurs. Remplace couleurs et polices par les tokens de thème, n'ajoute aucune police. Signale chaque écart dans le compte rendu.
4. **Applique le mode d'emploi d'Impeccable** (skill `impeccable`) : charge son contexte et `craft-floor.md` avant d'éditer.
5. **Construis**, puis vérifie (ci-dessous), et rends compte.

## Séparer bureau et mobile

Dès que l'ordre des blocs diffère, rends deux mises en page plutôt que d'empiler les astuces CSS (`display: contents`, `order`) : elles cassent l'ordre de tabulation et se contredisent vite.

- `useDesktop()` depuis `src/app/useDesktop.ts` (seuil 900 px) et `PlaySection` depuis `src/modules/gammes/PlaySection.tsx`. Si le hook sert dans la page, appelle-le avant tout `return` anticipé.
- Réutilise les classes `.play-*` (`play-surface`, `play-head`, `play-tab`, `play-tab-bar`, `play-nav`, `play-more`, `play-columns`, `play-foot`). N'ajoute un préfixe de page que pour ce qui lui est propre, comme `.train-*`.
- Des constantes JSX partagées (`tab`, `transportButtons`, `tempoControl`…), assemblées dans `if (desktop) return …` puis le `return` mobile. Le mobile garde son ordre et son JSX d'origine. Une page longue se découpe par plages de lignes avec un script, plus sûr qu'une recopie à la main.
- Si un composant commun change (`LevelsNav`), ajoute une prop facultative passée seulement au bureau. Si une logique change, conditionne-la à `desktop` : au clavier, à la sélection ou aux options, le mobile ne bouge pas.
- Une page a souvent plusieurs états (résultat, à froid, session, à l'aveugle). Liste-les avant de composer, et aplatis leurs panneaux dans la surface.

## Règles du projet à ne pas oublier

- CSS sous `@media (min-width: 900px)`, avec un préfixe de page. Aucun hex dans `app.css`, tout passe par les tokens, et les deux thèmes doivent tenir.
- Style pixel art conservé : traits de 2 px, ombres dures, coins à 2 px.
- La tablature canvas n'est pas du ressort d'Impeccable. Une demande explicite de l'auteur peut la toucher : passe alors par `src/core/tab/` avec un test, et garde l'échelle entière ≥ 2.
- Ne change ni texte factuel, ni règle musicale, ni barème sans demande. Si une refonte fait disparaître un texte, dis lequel.
- Le rendu mobile ne bouge pas. Exception : un vocabulaire ou une numérotation commune s'applique partout, pour que l'app dise la même chose sur les deux écrans. Annonce alors l'effet sur le mobile.
- Si une valeur stockée change, normalise l'ancien journal dans `normalizeAttempt`, aligne les générateurs de `src/dev/`, et vérifie par test que XP et maîtrise ne bougent pas.
- Un effet visuel se montre en deux thèmes et se vérifie aussi avec `prefers-reduced-motion`. Une couleur illisible en Aube passe par un token dédié, comme `--spark`.

## Vérifier

- `npx tsc --noEmit`, puis `npm test` à la fin.
- Captures à 1920, 1440, 1100 et 900 px, en Synthwave et en `dawn` : regarde-les, ne te fie pas aux seules mesures. Reprends aussi les états ouverts (détails, popups, options).
- Teste les contenus extrêmes : titre long, tablature à cases hautes, comme La majeur position 3-4 en 3 notes par corde, aller-retour.
- Pas de `scrollWidth` supérieur à la fenêtre.
- Mobile : compare les captures à 390 px avec la référence. La hauteur doit être identique et la différence ne doit toucher que le décor animé (`ffmpeg ... blend=all_mode=difference`).
- Utilise `localhost`, pas `127.0.0.1` : le serveur Vite n'écoute pas sur ce dernier. Supprime tout script temporaire de `tools/`.

- Si tu retires un contrôle, vérifie ce qui en dépendait : un message, un état qui continue de tourner (chrono, métronome), un texte d'aide devenu faux dans les Détails.
- Pour remplir une série sans micro au test, le clavier est coupé au bureau : passe par `window.__training` (`press`, `validate`) ou teste en largeur mobile.

## Avant de supprimer

Toute suppression passe par deux étapes, même quand la demande est claire, et avant de toucher au code :

1. **Analyse l'impact.** Lis ce qui en dépend : logique, journal, maîtrise et XP, états de la page, textes d'aide, autres pages, mobile. Cherche aussi ce que l'élève ne pourra plus faire (par exemple finir une série sans micro).
2. **Pose la question à l'auteur** avec `AskUserQuestion` : ce que la suppression retire, ce que ça casse ou change, et une alternative s'il y en a une, comme masquer ou déplacer. Attends sa réponse avant de supprimer.

Si la demande repose sur une prémisse fausse (« on est forcément à l'aveugle en N3, non ? »), corrige-la dans cette même question.

## Compte rendu

Dis ce qui est vérifié et ce qui ne l'est pas. Nomme les écarts avec la maquette, les textes retirés, et l'effet sur le mobile. Ne commite que sur demande.
