# PROJECT.md — Fretwave (nom de travail) : apprendre la guitare, en tablature, en pixel art

**Statut : phases 0, 1a, 1b, 1c, 1d et 2 terminées · 2 = progression unifiée (journal de tentatives, maîtrise, Leitner) + XP / série / badges + niveaux 2 (trous) et 3 (rappel) + grille rythmique + session mélangée + export/import JSON · D1-D34 tranchées (D13 écartée, D7 remplacée par D14) · aucune décision en attente · 371 tests.**
Documents liés : `BRIEF.md` (cahier des charges), `MUSIC_DESIGN.md` (conventions musicales, curriculum, avis de prof).
**Repères** : *État exact* juste en dessous · **hypothèses** §8 (1-62) et §8 bis (ce qui a changé) · **plan des phases** §9 · **décisions** §10 (D1-D34) · **prochaine étape** §12. Pages de l'app (hash) : `#/hub`, `#/gammes`, `#/gammes/jouer`, `#/gammes/entrainement`, `#/gammes/revision`, `#/reglages`, plus les outils de contrôle `#/tab`, `#/audio`, `#/theorie`. `npm run dev` → http://localhost:5173/ (un seul serveur à la fois : deux instances Vite sur le même port servent une version périmée du CSS).
Légende : **[HYP]** hypothèse prise sans te bloquer · **[À TRANCHER]** décision qui t'appartient · **[RISQUE]** voir section 7.

---

## État exact (dernière mise à jour : après la phase 2)

**Git** (branche `master`) : `183eacc` Phase 0 · `5797333` Phase 1a · `823fbbd` Phase 1b · `971be8c` Phase 1c · `ee0f82e` + `a7cb1bd` + `354d20a` + 4 commits de mise en page (1d, jusqu'à `264b7d9`) · **`d76e78a` Phase 2** + `3a9e049` seconde passe (grille, session mélangée, pondération). **371 tests (370 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK.** Aucun remote, arbre propre.

**Fait et vérifié (2 — progression, répétition espacée, niveaux 2-3)**
- **Journal de tentatives** (`src/core/progress/journal.ts`) : un événement par tentative — `id`, `ts`, `kind` (`listen` / `holes` / `recall`), gamme, tonique, accordage, système, position, `formIndex`, `level`, `strings`, **`correct`/`total` au premier essai**, `seconds`, `fretMin` (zone du manche), **`missedStrings`** (cordes où une case a été manquée). Clé `fretwave.attempts.v1`, **plafond 2 000** (D25), lecture tolérante (`normalizeAttempt` borne et écarte), **migration unique du journal d'écoute de la 1d** (la clé d'origine n'est pas effacée).
- **Maîtrise** (`mastery.ts`) : nœud = `gam:lecture:{gamme}:{système}:{formIndex}` — **la forme et le mode, jamais la tonique** (une même forme se révise une fois, pas douze : la tonique est une preuve séparée, D28). États disponible → en apprentissage → apprise → maîtrisée ; réussite = ≥ 80 % au premier essai ; **apprise = 2 réussites sur 2 jours différents** ; maîtrisée = apprise + boîte de Leitner ≥ 5 + dernière tentative réussie. Score de maîtrise = 0,5 × meilleure + 0,3 × moyenne des 3 dernières + 0,2 × couverture des jours.
- **Répétition espacée** (`scheduler.ts`) : **Leitner à 6 boîtes** (10 min, 1 j, 3 j, 7 j, 16 j, 35 j) derrière une interface `Scheduler` ; réussite nette +1 boîte, réussite lente sur place, échec −2 ; **gigue ±15 % déterministe** (hachage du nœud, pas de `Math.random` : le calcul est rejouable) ; **cartes recalculées depuis le journal** (aucun état dupliqué, on peut changer d'algorithme sans perdre l'historique) ; **plafond 8 cartes dues** par session.
- **XP, série, badges** (`rewards.ts`) : XP = 10 × précision (trous) ou 15 × précision (rappel), **+5 seulement à ≥ 95 %** ; **une écoute ne rapporte aucun XP** (non vérifiée) ; **plafond 120 XP par jour** ; série = jours consécutifs d'activité, vivante tant que la veille compte ; 8 badges, chacun dérivé du journal et affiché avec sa raison.
- **Niveau 2 « trous »** : ~35 % des notes masquées, **au moins 2, jamais toutes** (un exercice à un trou ne prouve rien) ; **niveau 3 « rappel »** : toutes les notes, chronomètre au premier geste. Cinq découpages : 1 corde / 2 / 3 / position entière / aller-retour. Saisie **au pavé numérique pixel (48 px de haut, ≥ 44 px partout) ou au clavier physique** ; validation par case ; **2ᵉ erreur sur un trou = case révélée** (comptée fausse) ; le trou désigné reçoit l'anneau du curseur (visible même vide) ; une case trouvée **reprend sa couleur de fonction** (la pastille cesse d'être en pointillés).
- **Écrans** : `#/gammes/entrainement` (nouveau), hub refondu (« Aujourd'hui », « Révision du jour » + prochaine échéance, « Niveau » avec XP/série/maîtrise/corde à travailler/**transposition suggérée**, badges), réglages avec **export / import JSON** (fusion par identifiant), bouton « Se tester » depuis le niveau 1 et depuis la sélection.
- **Diagnostic pédagogique** : corde la plus coûteuse (« La — 1 case manquée sur 1 tentative ») et **proposition de la même forme dans une tonique jamais vue** (`transpose.ts`, orthographe décidée par `tonicSpellings`).
- **Grille rythmique** (`tempoGrid` dans `exercise.ts`) : **un temps par trou**, en mesures entières, **score de silences** — le métronome de la 1c clique sans qu'aucune note ne sonne (il ne donne donc pas les réponses). 30-120 BPM, 50 par défaut ; le chrono **repart du lancement de la grille**. Étoiles : ★ dès 80 %, **★★ seulement si la grille est tenue** et ≥ 95 %, ★★★ sans erreur ni révélation **et** dans la grille ; grille manquée = ★ au mieux, jamais zéro si la précision est bonne. Tentative : `tempoOk`.
- **Session mélangée** (`review.ts`, route `#/gammes/revision`) : 3 à 5 formes **différentes** enchaînées sans repasser par le hub. Ordre : cartes **dues** (échéance croissante) → formes les plus **fragiles** → celles vues dans **une seule zone** ; niveau N3 si la boîte est ≥ 3, N2 sinon ; **alternance gamme × système** (deux formes voisines ne se suivent pas quand une alternative existe). Bilan de session : formes, précision moyenne, XP.
- **Pondération** : une case écrite **de mémoire** (N3) pèse **1,5** dans la moyenne récente de maîtrise, un trou comblé (N2) pèse 1 — un N2 se devine en comptant les cases depuis une note voisine. **Taux de trous réglable** (20 / 35 / 50 %, défaut 35) et **tempo de grille réglable**, tous deux dans Réglages.
- **Vérifié dans Chromium piloté par CDP (390×844 @3 et 1440×900 @1)** : clic réel sur un trou → pavé → validation → série terminée → **tentative écrite** ; rechargement → hub à jour (1 écoute · 3 exercices, 64 XP, maîtrise 87 %) ; **révision** : carte due affichée avec sa boîte et son score, « Réviser maintenant » ouvre la bonne gamme **et la bonne position** ; **transposition** : « Même forme en Do » ouvre « Do dorien · Position 7 · cases 6–11 » ; **export/import** : aller-retour de 2 tentatives, import par le champ fichier (+1), réimport sans doublon (0 ajoutée) ; N3 masque **toutes** les notes du segment ; chemin d'erreur (2ᵉ essai → révélation + message) ; écoute du niveau 1 journalisée (`kind: listen`, 15 s) sans XP ; aucun débordement horizontal.
- **Seconde passe, vérifiée de la même façon** : **grille** lancée au clic réel → 4 clics à 50 BPM, `grid` passe à « over » après 4,8 s, série répondue en 1 s → `tempoOk: true`, ★★★ ; grille manquée (réponse après la fin) → `grid: "missed"`, ★ seulement, `tempoOk: false` ; **session mélangée** depuis le hub (« Session mélangée (5) ») → file de 5 formes (dorian, ionian, aeolian, pentatonic…), enchaînement des 4 premières par « Suivant · … », bilan « 5 formes · 100 % · 75 XP » ; **taux de trous** 20 % → 4 trous sur 18 notes, 50 % → 3 sur 6 (réglage persistant) ; pas de débordement à 390 ni à 1 440, pavé collant, 48 px.

**Mesures de la 2**
- Pavé numérique : **102 × 48 px CSS** à 390 (48 px de haut partout), **159 × 48** à 1 440 ; panneau collant sous 900 px (reste à 0–384 px pendant qu'on lit la tablature).
- Tablature en mode exercice : **347 px** de large à 390, **1 040 px** centrée à 1 440 (hauteur 242 px).
- Panneaux à 1 440 : colonne **1 296 px**, 528 / 748 px, **hauteurs de rangée identiques** (253/253, 301/301).
- `dist` : `index` **446,5 ko (141,8 ko gzip)** — +49,3 ko (+15,1 ko gzip) pour tout le module de progression (journal, maîtrise, Leitner, session mélangée, grille), le chunk Tone inchangé (340,8 ko / 79,4 gzip) et le CSS à **25,2 ko (5,9 gzip)**.
- Grille : 4 temps à 50 BPM = **4,8 s** mesuré (4 clics), tolérance **0,3 s** (un dixième de temps) ; rangée de commande **708 × 44 px** à 1 440.
- Lisibilité (après correction) : contraste **minimum 5,2:1** au hub, 4,7 à la sélection (compteur de gamme de la ligne choisie), 5,2 à l'entraînement et aux réglages ; **aucun texte sous 4,5**. Rangées du hub à 1 440 : **236/236, 276/276, 425/425, 645/645** (les cartes d'une rangée ont la même hauteur).
- Journal : une tentative pèse ≈ 190 octets de JSON → **2 000 tentatives ≈ 380 ko** (mesuré sur le journal réel produit par les essais ci-dessus).

**Pas fait (2)**
- **La grille mesure la rapidité à écrire, pas à jouer** : tant que la validation passe par le pavé, `★★` récompense un geste de saisie dans le temps du métronome. C'est honnête (et écrit dans l'UI), mais ce n'est pas encore du rythme ; la phase 3 (micro) rendra la mesure réelle.
- **Pas de réglage de longueur de session mélangée** (5 formes en dur) ni de tirage aléatoire : l'ordre est déterministe (dues, puis fragiles).
- **IndexedDB non utilisée** (D25) : localStorage plafonné ; à revoir quand l'entrée audio produira beaucoup plus d'événements (phase 3).
- Pas de page « Progression » (heatmap des formes / toniques), pas de badges de transitions, pas de révision mélangée entre formes.
- Le diagnostic par corde **ne distingue pas les accordages** (index de corde seulement) ; un accordage alternatif fausse la lecture du nom affiché.
- Toujours non vérifiés : le timbre (pas d'écoute), Safari / iOS, un vrai téléphone, la latence acoustique.
- Niveaux 4 (improvisation) : phase 7. Doigtés d'accords : phase 4.

## État exact de la phase 1d (rappel, après le commit de la 1d)

**Git** (branche `master`) à l'époque : `ee0f82e` Phase 1d, puis `a7cb1bd`, `354d20a` et les commits de mise en page jusqu'à `264b7d9`. **314 tests (313 verts, 1 ignoré) au terme de la 1d**, `tsc --noEmit` propre, `vite build` OK. *(Depuis : `d76e78a` phase 2, `3a9e049` seconde passe, 371 tests — voir le bloc ci-dessus.)*

**Fait et vérifié (1d — hub, thème, module Gammes N1)**
- **Thème par design tokens** (`src/core/themes/`) : `tokens.ts` (contrat : palette, scène, panneau de tab, polices, UI), `synthwave.ts` (un fichier = un thème), `registry.ts` (`applyTheme` pose 22 variables CSS + `data-theme` sur `<html>`, thème par défaut sans attribut), `scene.ts` (dessin pur, testable sans canvas). **Aucun hex n'est recopié dans `app.css`** : la feuille ne contient qu'une palette de secours `:root` pour le premier rendu. Les **couleurs d'intervalle restent hors thème** (`core/tab/colors.ts`).
- **Mise en page grand écran** (≥ 900 px) : **grille de 12 colonnes sur 90 % de la largeur** (max 1 560 px), gouttières de 20 px, **rangées de même hauteur** (`align-items: stretch`) ; les panneaux prennent 4, 5, 6, 7 ou 8 colonnes (`.span-*`), ce qui garantit que les bords supérieurs et inférieurs s'alignent. **Barre de navigation en haut** (56 px, mot-symbole à gauche, onglets à droite) au lieu de la barre du bas. Tablature, bande d'exercice et navigation de positions **centrées sur 1 040 px** (largeur de lecture). Sur téléphone : une colonne de 560 px max, barre en bas — inchangé. Mesuré à 1 440 : colonne **1 296 px**, colonnes de panneaux **528 / 748 px**, hauteurs de rangée identiques.
- **Captures de vérification** : `npm run shots` (Playwright, Chromium) → `.shots/<page>-<largeur>x<hauteur>.png` et `-full.png` ; `--only n1 --width 1440` pour cibler. Outil de développement, jamais exécuté par les tests ; Playwright est une dépendance de dev (~120 Mo de navigateur, hors dépôt).
- **Scène pixel** : ciel en bandes avec tramage, étoiles déterministes (graines fixes) qui scintillent, soleil rayé à trois zones, deux crêtes de montagne, horizon lumineux, **lignes de grille horizontales qui avancent** (14 lignes, perspective en d², 30 img/s). Deux variantes : **`poster`** (hub, horizon à 38 %, soleil 26 % de la largeur borné à 11 % de la hauteur) et **`calm`** (écrans de travail : ciel + étoiles seulement). Parallaxe = décalage vertical borné à 40 px au défilement. Échelle **2 px CSS par pixel logique** (3 au-delà de 1 500 px), `image-rendering: pixelated`.
- **Rayons verticaux de la grille : non dessinés** (D19). Mesuré : à 195 px logiques de large, 17 rayons convergent en une hachure de 3 px autour du point de fuite ; à 9 rayons le fan reste un pâté de 30 px. Les horizontales qui se resserrent portent la perspective.
- **Polices** : Press Start 2P (mot-symbole seulement) et Silkscreen 400/700 (étiquettes, badges, onglets) sont auto-hébergées dans `public/fonts/` (sous-ensemble latin, **OFL 1.1**, `README.md` de provenance) ; VT323 reste embarquée mais n'est plus utilisée par le DOM. **Tout le texte courant, les titres de page et les contrôles sont en sans-serif système** (aucun téléchargement) : voir D24. La tablature n'utilise aucune de ces polices (police bitmap maison 5×7 avec ♯ ♭ 𝄪 𝄫 dessinés).
- **Hub** (`#/hub`) : poster + objectif du jour + « reprendre » + trois portes d'entrée + état des quatre modules. Les chiffres viennent du **journal de pratique local** (D22), pas d'un compteur décoratif : « 1 / 3 · 1 gamme écoutée · 10 s » après une écoute réelle.
- **Réglages** (`#/reglages`) : notation des notes (solfège/anglo), des accords (`Am7`/`Lam7`/`A-7`), ambiance (un thème en 1d), « réduire les animations », scanlines, rangée de degrés, instrument, mixeur 4 canaux, accès aux outils de contrôle, **effacement des données locales** avec confirmation.
- **Module Gammes — sélection** (`#/gammes`) : 5 familles, 31 gammes, **tonique avec les deux orthographes quand le coût est égal** (Ré♯/Mi♭), mode parent affiché (« mode parent : Do majeur (2e degré) », « mêmes notes que Do majeur », « 6 transpositions distinctes »), 9 accordages, **table de compatibilité gamme ↔ systèmes** (5 systèmes listés, les incompatibles grisés **avec leur raison**), positions.
- **Module Gammes — niveau 1 Découverte** (`#/gammes/jouer`) : montée / descente / aller-retour, 4 annotations (notes, degrés, intervalles, doigtés), sens, tempo (40-200 par pas de 5), drone (par défaut), métronome, boucle, position précédente/suivante, **légende des couleurs par fonction** avec le nom français de l'intervalle, note caractéristique signalée, phrase de prof par gamme (31 textes rédigés), instrument.
- **Calque « notes de l'accord »** (D23) : `TabNote.chordTone` renseigné par le générateur (`markChordTones`), `LayoutOptions.emphasizeChordTones`, `PillLayout.dim`, rendu par **mélange avec la couleur du panneau** (pas d'alpha : net en pixel art) à 78 % pour le fond, 62 % pour le chiffre. Vérifié : sur La mineure pentatonique + Am7, **seules les 4tes sont estompées** (`dim = ['4','4','4','4']`), les 1, ♭3, 5, ♭7 restent vives.
- **Cinq aides pédagogiques livrées en 1d** (MUSIC_DESIGN §3.9, §12.3) : **fondamentales seules** (1 et 5), **découpage par cordes** (2/3/4/toutes), **exercice « montre-moi la … »** (on touche la pastille ; en cas d'erreur, toutes les pastilles de la fonction visée s'allument 1,8 s ; cibles limitées aux fonctions affichées), **comparaison de deux modes voisins** (5 paires + pentatonique/blues ; même forme, la note qui change pulse des deux côtés), **rythme masqué par défaut**. `filterPosition` (positions.ts), `hideRhythm` + `highlightFn` (layout), `onPick` avec test de toucher (TabView), `compare.ts`.
- **Doigtés** (D20) : `core/theory/fingerings.ts` — règle par corde (index sur la note la plus basse, auriculaire sur la plus haute, 1-2 / 1-3 / 1-4 à deux notes, 1-2-4 / 1-3-4 à trois notes selon l'espacement, 1-2-3-4 à quatre, **aucun doigté au-delà**). Testé sur **toutes les positions du catalogue** (31 gammes × 12 toniques × systèmes compatibles, > 1 000 positions) : ≤ 4 doigts, aucun croisement, index toujours sur la note la plus grave de la corde.
- **CAGED exposé** dans l'UI (ta demande en 1d vaut feu vert) et **relu sur Do, Sol, La** (condition D12) : pour chaque forme, la fenêtre contient la triade, ≤ 3 notes par corde, et la fondamentale tombe sur la corde de la forme. Do majeur : C 0-4 · A 2-6 · G 5-9 · E 7-10 · D 9-13. Sol : G 0-4 · E 2-5 · D 4-8 · C 7-11 · A 9-13. La : A 0-3 · G 2-6 · E 4-7 · D 6-10 · C 9-13. **Aucune correction** ; limite assumée : « forme de Mi » nomme la forme d'accord qui ancre la fenêtre, pas l'endroit de la tonique (elle change de corde d'une forme à l'autre).
- **Signature rythmique réparée** : elle était dessinée **au milieu des cordes** en deux chiffres de 15 px ; elle est maintenant petite (`4/4`), **en tête de portée**, sur la première ligne, avec un fond de panneau. Testé (`timeSig.y = stringYs[0] - 3`).
- **Routeur par hash** (`#/hub`, `#/gammes`, `#/gammes/jouer`, `#/reglages`) avec **compatibilité des anciennes URLs** (`#tab`, `#audio`, `#theorie`) et repli sur le hub pour une URL inconnue — testé. Les pages de contrôle de 1a-1c restent joignables depuis les réglages.
- **Vérifié dans Chromium piloté par CDP (390×844 @2-3, 1440×900 @1)** : poster du hub (soleil, montagnes, grille), sélection (31 gammes, table de compatibilité), N1 (tablature, 4 annotations, légende), calque d'accord, réglages, et **lecture réelle** : un geste souris vrai (`Runtime.evaluate` avec `userGesture`) démarre le contexte audio, **23 notes déclenchées pour 12 notes aller-retour**, état « terminé », **entrée de journal écrite** (`~10 s`), hub à « 1 / 3 ».
- **Poids** : `dist` — `index` **397,2 ko (126,7 ko gzip)** + chunk Tone **340,8 ko (79,4 ko gzip)** + CSS **18,0 ko (4,4 ko gzip)** + polices 46,3 ko + échantillons 12,1 Mo.

**Mesures de la 1d**
- Contraste des tokens (test) : texte et texte atténué ≥ **4,5** sur `bg`, `surface` et `surfaceHi` (le plus faible : texte atténué sur `surface` = 8,2 ; texte atténué sur `surface-hi` = 6,3).
- Tablature N1 (La mineure pentatonique, box 1, aller-retour) : **181 × 375 px logiques** (rythme masqué ; 420 avec le rythme), 3 systèmes, 24 colonnes, **≈ 750 px CSS** de haut à S=2 ; **121 px logiques par système** sans rythme (136 avec), pastille **22 px CSS** de large (11 logiques × 2).
- Scène : canvas **390 × 844 CSS** (195 × 422 logiques) sur téléphone, **1440 × 900** sur bureau (720 × 450 logiques) ; couche animée 14 lignes + 16 étoiles, une passe de dessin par image, **30 img/s**.
- Journal : une entrée `{scaleId, tonic, system, positionId, seconds}`, plafond **400 entrées**, résumé du jour en secondes et gammes distinctes.

**Pas fait (1d)**
- **Aucune écoute du timbre** ni vérification sur vrai téléphone / Safari iOS (inchangé depuis 1c).
- **Thème unique** : l'architecture accepte un fichier de plus, mais les ambiances Cyber City / Lo-fi / Arcade sont en phase 8.
- **Niveaux 2 à 4** du module Gammes (trous, rappel, improvisation) : phases 2 et 7 ; les onglets ne sont pas affichés du tout (pas de faux boutons).
- **Vue manche optionnelle** : toujours proposée, toujours pas implémentée (contraire au brief tel qu'écrit ; attend un accord explicite).
- **Doigtés** : heuristique par corde, non relue position par position ; les doigtés d'accords restent vides (phase 4).
- Boîte d'accord (D1, phase 4).
- XP, séries, répétition espacée, badges, heatmap : phase 2 pour les quatre premiers (**livrés**), heatmap en phase 8.
- PWA (manifest, service worker), i18n, défilement des scores très longs.

## État exact de la phase 1c (rappel, après le commit `971be8c`)

**Git** (branche `master`) : `183eacc` Phase 0 · `5797333` Phase 1a · `823fbbd` Phase 1b · `971be8c` Phase 1c (174 fichiers : 11 fichiers de `core/audio/`, 5 fichiers de test, `public/samples/` 12,1 Mo, `tools/`) · `5818e8b` docs. La mise à jour ci-dessous est le commit courant. **Arbre propre, 274 tests verts, `tsc` propre, build OK.** Aucun remote.

**Fait et vérifié (1c — moteur audio de sortie)** — périmètre redéfini par toi : audio seulement (hub, thème Synthwave et module Gammes N1 → 1d, D18).
- **Échantillons** (`public/samples/`, produits par `tools/build-samples.mjs`) : deux banques **CC0 1.0**, provenance, licence, modifications et empreintes dans `manifest.json` + `LICENSE.txt` + `SOURCE-README.txt` + `public/samples/README.md` :
  - **nylon** (défaut) : FreePats « Spanish Classical Guitar » 2019-06-18, 48 FLAC (G1 → C6, un par demi-ton ou presque), **5,3 Mo** ; fichiers **identiques octet pour octet** à l'archive d'origine (seuls les noms changent, `#` → `s`).
  - **electric** : Karoryfer « Emilyguitar » (D. Smolken), commit `b4920dc`, 90 FLAC (Ré♭2 → Ré6, une note sur trois environ, écarts de 2-3 demi-tons ; couches p, mf ×3 répétitions, f), **6,8 Mo** ; WAV 24 bits → FLAC 16 bits (dither triangulaire) + fondu de sortie de 80 ms.
  - **`tonejs-instruments` écartée** (D14) : chaîne de licences invérifiable (page Freesound du nylon → 404, source « Iowa » de l'acoustique incohérente). Génération **déterministe** : les 138 empreintes SHA-256 ont été retrouvées identiques à la seconde génération.
- **Hauteur et niveau mesurés, pas supposés** : écart de hauteur de chaque fichier mesuré par autocorrélation (**−12,5 à +17,3 cents**), corrigé **à la lecture** (vitesse = 2^(cents/1200)) ; gain de nivellement par échantillon (médiane de sa couche) et `trimDb` par banque (électrique **+7 dB**) : changer d'instrument ne change pas le volume.
- **Choix de l'échantillon** (`sampleBank.ts`, pur, testé) : note la plus proche à ±4 demi-tons (nylon) / ±3 (électrique), sinon **repli Karplus-Strong** (jamais de note muette, hauteur à ±8 cents de E1 à E7, testé) ; **couche de vélocité choisie par l'événement** (toutes les cordes d'un strum gardent le même timbre), gain par note ; **round-robin** (3 variantes mf de l'électrique) ou désaccord de ±3 cents.
- **Jeu** (`guitar.ts`) : une voix par corde (rejouer une corde coupe la précédente en 25 ms), attaque 2 ms, relâchement exponentiel avant l'arrêt de la source. Mesuré hors ligne sur un sinus de contrôle : saut maximal entre échantillons **0,73 ×** la pente normale (note relâchée, fin naturelle, arrêt général), **1,24 ×** (corde rejouée : deux voix se superposent), **0,99 ×** (coupure pendant l'attaque) — plus aucun saut de type clic (le défaut initial mesurait **12 ×**).
- **Expression** (`core/tab/playback.ts`, pur) : strum à écart moyen réglable (14 ms par défaut, 4-40) qui s'accélère en fin de geste, vélocité décroissante du côté d'où part la main, montant 12 % plus doux, accent début de mesure / temps / contretemps, **humanisation déterministe** (graine = tick), balayage ≤ **35 %** de la durée de l'événement. **Tenue** : accord et progression → jusqu'à la fin de la mesure ; arpège → 2 × la note (legato) ; gamme et position → étouffées en fin de note. Le journal des notes déclenchées permet la vérification « son = tablature ».
- **Drone** (`drone.ts`) : fondamentale Mi2-Ré♯3 + quinte + octave (**jamais de tierce**), deux triangles désaccordés par note + sinus grave, filtre lent, fondu 1,2 s / 0,9 s ; pas de drone sur une progression (pas de fondamentale unique).
- **Métronome** (`metronome.ts`, planification pure, testée) : 1 clic par temps, accent de mesure, **groupes de trois croches** en 6/8, 9/8, 12/8, subdivision optionnelle ; programmé sur `Tone.Transport` avec les notes ; réglable en cours de lecture.
- **Bus master** (`master.ts`) : sommation → passe-haut 30 Hz → compresseur (−18 dB, 3:1, 12/220 ms) → limiteur −1 dBFS → **plafond dur** (courbe de saturation : identité sous −3,1 dBFS, asymptote à −1 dBFS, dérivée continue, suréchantillonnage 2×) → **volume général après le plafond** → sortie. Réverbération stéréo de 1,3 s calculée une fois (déterministe, énergie normalisée), envoi réglable.
- **Volumes séparés** (général, guitare, drone, métronome), réverbération, écart de strum, humanisation et instrument **mémorisés** (`localStorage`, `fretwave.audio.v1`) ; valeurs par défaut 0,95 / 0,9 / 0,8 / 0,85 ; lecture tolérante (absent, illisible ou hors plage → défaut, sans exception).
- **Préchargement et geste** : écran de chargement pixel art (barre de 19 blocs, soleil rayé, grille en perspective, `fitText`, états erreur + « Réessayer » + « Continuer sans le son ») ; le contexte reste `suspended` jusqu'au premier geste, `engine.unlock()` appelé **en premier** dans le gestionnaire de clic ; téléchargement et décodage faits contexte suspendu.
- **Page Audio** (`#audio`) : état du contexte (latence de sortie, lookAhead, PPQ, version de Tone), mixeur, mesure crête / RMS / réduction du compresseur et du limiteur (maintien de crête 1,5 s), une note (corde × case × vélocité, plan affiché : fichier, couche, vitesse, gain), 6 cordes à vide, hors plage (synthèse), 3 gammes avec drone, 5 accords (↓ ↓ ↓ ↓, ↓↑ en croches, motif universel, arpégé, test du limiteur), drone et métronome, **vérification « son = tablature »** après chaque lecture, tableau des échantillons (couches, écart mesuré, gain, durée, écoute), crédits et licences.
- **Curseur** : même principe que la 1b (tick du Transport, latence de sortie retranchée), remesuré avec le son final : pente **639,6 ticks/s** pour 640 attendus, résidu hors démarrage **1,1 tick** (≈ 1,7 ms), écart des notes à la grille idéale **0 ms**.
- **Tests** : **274 verts** (1b : 204), `tsc --noEmit` propre, `vite build` OK. Nouveaux : `samples` (manifeste, empreintes SHA-256, en-têtes FLAC, étiquetage, couverture du manche pour 9 accordages, gains par couche), `audio` (courbes de volume, réglages mémorisés, drone, métronome, réponse impulsionnelle, plafond, vérification), `strum` (humanisation, accents, bornes, tenue, PRNG, couche unique par strum), `karplus` (hauteur, déterminisme, décroissance, fin à zéro), `loading` (barre proportionnelle, palette, débordements, `fitText`).
- **Trouvé en route, corrigé** : (1) clic quand une corde est rejouée pendant ses 2 ms d'attaque → coupure reportée de ≤ 2,5 ms ; (2) Tone rappelle parfois **le même** événement à la même heure audio (≈ 1 lecture sur 10 après un arrêt, sur un début de mesure) → garde-fou par événement, compteur `duplicateCallbacks` ; (3) la couche de vélocité basculait d'une note à l'autre → seuils 0,5 / 0,85, vélocité de base 0,70 au milieu de mf, couche choisie par événement ; (4) `Tone.Limiter` laissait passer **+2,2 dBFS** sur un strum fort → plafond dur ; (5) l'électrique sortait 6-7 dB sous le nylon → `trimDb` ; (6) Tone était chargé au premier « Lecture » : le préchargement l'exige au démarrage.

**Mesures de la 1c** (rendu hors ligne dans le navigateur : même chaîne master, même échantillonneur, 48 kHz, réglages par défaut)

| Essai | crête | RMS | RMS actif |
|---|---|---|---|
| nylon, progression ↓·↓↑·↑↓↑ | −4,0 | −16,6 | −16,1 |
| nylon, pentatonique montée + descente | −4,5 | −18,6 | −18,1 |
| nylon, accord arpégé | −6,2 | −20,7 | −18,9 |
| électrique, progression | −3,8 | −18,4 | −17,9 |
| électrique, gamme | −4,5 | −21,0 | −20,5 |
| drone (La : fond + quinte + octave) | −15,3 | −26,9 | −26,8 |
| métronome (par clic) | −11,3 | — | −27,7 |
| cas extrême : tout à 1, accord de Fa barré à 170 BPM, humanisation max | **−1,2** (plafond tenu) | −15,4 | −10,8 |

- **Poids** : `dist` 13 Mo dont **12,1 Mo d'échantillons** ; code : `index` **351,3 ko (112,7 ko gzip)** + chunk Tone **340,8 ko (79,4 ko gzip)** chargé **au démarrage** (préchargement) + CSS 4,2 ko. Premier lancement : 5,3 Mo (nylon) ; l'électrique (6,8 Mo) seulement s'il est choisi. Chargement local de 90 fichiers : **1,7 s**.
- **Vérifications dans Chromium piloté par CDP (390×844 @3, pas un vrai téléphone)** : 48 puis 90 fichiers chargés ; lecture avec son = tablature (23/23 pentatonique, 18/18 Ré dorien, 35/35 Do majeur 3NPS, 24/24 ↓↓↓↓, 36/36 motif universel, 6/6 arpégé) ; métronome 18 clics sur 10 s à 80 BPM ; drone activé avec la gamme et coupé en pause ; boucle qui repart sans doublon ; matrice de clics sur sinus de contrôle ; erreur réseau simulée (manifeste bloqué) → écran d'erreur puis « Réessayer » qui aboutit ; plafond tenu sur un strum extrême.

**Fait et vérifié (1b — rappel)**
- **Positions** (`src/core/theory/positions.ts`) : 3 notes par corde (7), boxes pentatoniques (5), CAGED (5), motifs symétriques (période 2 / 3 / 4), blues (box + note de blues), bebop (3NPS + note de passage). Générique sur l'accordage et le nombre de cordes ; CAGED seulement si les 6 cordes aiguës sont en standard (refus avec raison). Option `register` (+12 cases), `formIndex` (identité de forme indépendante du mode), étiquettes « Position 3 · cases 7–10 ». Règles exactes : `MUSIC_DESIGN.md` §3.7.
- **`TabScore`** (`src/core/tab/model.ts`) : ticks entiers PPQ 480, `startTick` relatif à la mesure, valeurs de notes (pointées, triolets), fonctions d'intervalle, `validateScore` (durées = signature, `midi = accordage + case`, nom de note cohérent, cordes, cases 0-24…).
- **Générateurs → TabScore** (`generators.ts`) : gamme, position (montée / descente / aller-retour), arpège dans une position, accord (plaqué, arpégé, les deux, 3 motifs de strum), progression, accord « dérivé de la gamme ». Les notes de l'accord affiché = celles du voicing (testé sur les 43 formes + 120 barrés mobiles).
- **Layout pur** (`layout.ts`, testé sans canvas) : mesures, barres, colonnes proportionnelles au temps, piles d'accord avec « simile », X sur les cordes non jouées, barré, flèches ↓↑, rythme (hampes, ligatures 1-3 niveaux, points, triolets, silences), noms d'accords + chiffrage romain + libellé, 4 annotations (note, degré, intervalle, doigté), `cursorAt(tick)`. Deux dispositions : défilement continu (étiquettes de cordes fixes) et retour à la ligne justifié.
- **Police bitmap 5×7** maison (`font.ts`, 90 glyphes dont ♯ ♭ 𝄪 𝄫 ø Δ ° ↓ ↑ ♩, + 5 silences) ; un test vérifie qu'elle couvre **tout** ce que l'app peut afficher dans la tab.
- **Rendu pixel** (`render.ts`, `surface.ts`) sur une interface `Surface` : Canvas 2D (échelle entière) ou tampon mémoire (tests pixel par pixel, export PNG). Pastilles 11×13 / 17×13, fondamentale à coins coupés, encoche ♭/♯, glow pulsé des notes caractéristiques, notes passées estompées, curseur.
- **Lecture** : `playback.ts` (pur : mêmes notes que l'écran, strum 14 ms) + `core/audio/tabPlayer.ts` (Tone.Transport, PPQ 480, **son provisoire** : une corde Karplus-Strong `PluckSynth` par corde de la guitare). Tone est chargé à la demande (chunk séparé). *(Remplacé en 1c : échantillons, bus master, drone, métronome.)*
- **Page de contrôle** (`src/app/TabPage.tsx`, `TabView.tsx`) : tous les générateurs, 9 accordages, 31 gammes, 4 annotations, 2 notations, 3 échelles + auto, lecture / pause / stop / boucle / tempo en direct, « réduire les animations ». L'explorateur de théorie de la 1a est conservé (onglet « Théorie »).
- **Tests** : **204 verts** (1a : 61) + un générateur de captures PNG (`FRETWAVE_PNG_DIR=… npx vitest run tests/snapshots.test.ts`). `tsc --noEmit` propre. `vite build` OK : **312 ko (99,7 ko gzip)** + chunk Tone de 341 ko (79,4 ko gzip) chargé seulement au premier « Lecture ». *(Chiffres de la 1b : depuis la 1c, 274 tests, Tone et les échantillons sont chargés au démarrage — voir ci-dessus.)*

**Mesures (Chromium piloté par CDP, viewports émulés 390×844 @3, 412×915 @2,625, 1440×900 @1 — pas un vrai téléphone)**
- **Synchronisation** : à 80 BPM, pente du tick lu = **640,01 ticks/s** (attendu 640) sur 330 images, écart max à la droite 3,9 ticks (≈ 6 ms), rms 1,8 ticks ; à 160 BPM 1280,1 (attendu 1280) ; boucle : retour à 0 vérifié ; changement de tempo en lecture pris en compte. Notes déclenchées : 23 / 23, écart max à la grille de ticks idéale **0,0 ms**. Le curseur est **exact au pixel** (cœur blanc à `round(cursorAt(tick).x) × k`), ancré à 30 % de la largeur en défilement. Latence de sortie annoncée par le navigateur : 11 ms, retranchée du tick lu — **non vérifiée acoustiquement** (pas de micro de mesure) ; à recalibrer sur appareil réel (R2).
- **Performance** : dessin statique 0,2 à 10,7 ms (une fois par disposition), couche animée 0,06 à 0,27 ms par image (max 7 ms à la 1re), 241 à 469 images par essai, **0 image > 25 ms**, écart max entre images 16,8 ms (60 Hz).
- **DPR non entier (R5)** : à 2,625, k = 5 pixels physiques par pixel logique ; largeur du canvas 985 px = 984,99 px (CSS × DPR) → pixels tous identiques.
- **Lisibilité** : contraste chiffre / pastille ≥ 4,5 pour les 23 fonctions testées (chiffre sombre ou blanc selon le meilleur contraste). Daltonisme (Machado, ΔE76 entre les 7 familles) : minimum **12,9** protanopie (1/4), **17,7** deutéranopie (2/4), **12,0** tritanopie (3/7). Mais **à l'œil** (capture `11-daltonisme…`), orange / magenta / vert se rapprochent en protanopie et deutéranopie : la couleur seule ne tient pas, ce sont la forme (fondamentale), l'encoche (♭/♯) et la rangée de degrés qui portent l'information.
- Hauteur d'une ligne de 6 cordes : **136 px logiques** (gamme + annotation sous la tab), **137** (accord plaqué avec flèches) ; +14 par corde supplémentaire (7 cordes : +14, 8 : +28, testé).

**Pas fait**
- **Écoute réelle du timbre** : je n'ai pas d'oreille ici — le son n'a été vérifié que par la mesure (niveaux, hauteur, clics, synchronisation). Reste à écouter : la page Audio, puis une gamme depuis l'onglet Tablature.
- **Safari / iOS** : décodage FLAC, interrupteur silencieux qui coupe le Web Audio, reprise du contexte après geste — non testés (R3) ; téléphone réel et latence acoustique non mesurés.
- **Sons manquants** : compte à rebours avant lecture, bus **backing** et **SFX** (aucun son de gamification, aucun backing track en 1c), La de référence réglable dans l'UI (`tuningCents` existe dans l'échantillonneur, rien ne l'alimente), techniques de jeu jouées (h/p, bend, slide), mise en valeur de la basse d'un accord slash.
- Hub, thème Synthwave complet (scène, parallaxe), module Gammes N1, routeur et réglages globaux (→ **1d**, D18). La page Audio et l'écran de chargement, eux, sont livrés.
- **Doigtés** (aucun n'est généré : la donnée est vide, la rangée « doigté » n'affiche que ce qui existe) ; marqueur de **basse** des accords slash ; doigt du barré affiché (seuls « B1 » et le repère le sont) ; boîte d'accord (D1 : phase 4).
- Tempo **par mesure** (modélisé et validé, pas joué) ; triolets : rendu et lecture sur fixture, **aucun générateur** ne les produit ; techniques (h p / \ b ~) modélisées, pas dessinées.
- Saisie sur la tab (cases cliquables, pavé numérique) : **livrée en phase 2** ; défilement des scores très longs (garde-fou `tooWide` > 16 000 px de canvas, pas de découpage en tuiles) ; test sur appareil réel et Safari iOS.
- Persistance, progression, SRS, entrée audio, PWA, i18n, routeur : phases suivantes.

**Écarts entre ce document (rédigé en phase 0 / 1a) et la réalité**
- Hauteur d'une ligne 6 cordes : **136-137 px** et non 144 (§4.9, corrigé).
- La pile d'accord est redessinée **au début de chaque mesure** et au changement d'accord (et non seulement au changement) : une ligne qui revient à la ligne reste lisible sans état caché (H21).
- `TabNote.pitch` du §4.4 devient `midi` + `note` (nom orthographié) ; `ChordRef` devient le symbole du modèle (chaîne) ; ajouts : `unplayed`, `barre`, `characteristic`, `passing`, `TabScore.kind`, `TabScore.meta`.
- Positions boxes : en La m, la box 4 est écrite **cases 0-3** (instance la plus basse) ; l'instance « 12-15 » du curriculum s'obtient avec `register: 1` ; la box 3 couvre 9-13 (et non 9-12). `MUSIC_DESIGN.md` §3.2 corrigé.
- Données : `F-133211`, `F-xx3211`, `Bm-x24432` et les formes mobiles déplacées portent maintenant un champ `barre`, validé par `validateVoicing`.
- Dépendances : **Tone 15.1.22** installé (chargé à la demande en 1b) ; `@types/node` ajouté (helper PNG des tests) ; `tsconfig` : `types: ["vite/client", "node"]`.
- **1c — D7 remplacée (D14)** : les échantillons ne sont pas ceux de `tonejs-instruments` mais deux banques CC0 (FreePats nylon, Karoryfer électrique) ; `tonejs-instruments` est écartée pour licence invérifiable, pas pour qualité.
- **1c — Tone n'est plus chargé « à la demande »** : le préchargement du son exige le contexte au démarrage (79,4 ko gzip avant l'écran d'accueil, mesure faite).
- **1c — `scoreToPlayEvents`** (`core/tab/playback.ts`) produit aussi **vélocité, tenue et humanisation** : le modèle `TabScore` est inchangé, mais un score ne décrit plus à lui seul la lecture (des options de jeu s'y ajoutent).
- **1c — périmètre** : l'ancienne phase 1c (hub, thème, module Gammes N1, page debug) n'est livrée qu'en partie (page Audio, écran de chargement) ; le reste est proposé en 1d (D18).

---

## 0. En une page

| Sujet | Décision (phase 0, amendée depuis : voir §10) |
|---|---|
| Framework | **Vite + TypeScript + React 19.** Le temps réel (audio, canvas) vit dans des classes TS hors React ; React ne gère que l'UI (hub, menus, réglages). |
| Rendu pixel | **Canvas 2D**, **un seul « pixel logique » pour toute l'app** (facteur entier S ≥ 2), canvas de largeur variable ; **pas de PixiJS**. |
| Tablature | **Moteur maison** (modèle `TabScore` + layout pur + rendu canvas). **alphaTab écarté** pour le rendu (justification 3.3). |
| Théorie | `tonal` + couche guitare maison ; **une seule couche d'affichage** anglo↔solfège. |
| Audio sortie | Web Audio + Tone.js ; **deux banques CC0** (nylon FreePats, électrique Karoryfer) + repli Karplus-Strong ; hauteur et niveaux mesurés ; attribution affichée quand même (D14). |
| Pitch mono | `pitchy` (McLeod) dans un AudioWorklet, fenêtre adaptée à l'accordage. |
| Polyphonique | **Moteur maison « accord attendu »** (peignes d'harmoniques + soustraction), **pas essentia.js (AGPL-3.0)**, pas de chromagramme seul. Verdict = **niveau de confiance**, jamais binaire. |
| Persistance | localStorage (réglages, journal) + export/import JSON. *(Phase 0 prévoyait IndexedDB : révisé en phase 2, D25 ; `navigator.storage.persist()` pas encore demandé.)* |
| Modules | `Gammes` et `Accords` au MVP ; **un module `Fondations` (onboarding, accordeur) en plus** ; `Rythmique` préparé dès le modèle. |
| Écart majeur avec le brief | Gammes débutent par la **pentatonique mineure**, pas la majeure ; Am n'est **pas** un accord à 1-2 doigts ; le **verdict par corde en strum est irréaliste** ; **boîte d'accord** : D1 = B (étapes Découvrir/Construire seulement, §7.1 de `MUSIC_DESIGN.md`). |

---

## 1. Points du cahier des charges à challenger

Ce qui, tel quel, serait irréaliste, trompeur ou frustrant — avec l'alternative.

1. **Diagnostic par corde en plaqué** (« corde étouffée, grésille, mauvaise note ») : irréaliste. Le diagnostic précis est **réservé au mode arpège** ; en strum, niveau de confiance global + indices (voir 7.2).
2. **Am en « 1 à 2 doigts »** : faux (3 doigts). Voir curriculum révisé, `MUSIC_DESIGN.md` §4.
3. **Gammes : « majeure/mineure d'abord »** : théoriquement propre, mais la pentatonique donne un 1er succès bien plus vite. Je propose de changer l'ordre (§3.2 de `MUSIC_DESIGN.md`).
4. **1 248 nœuds de gamme** si on suit le brief au pied de la lettre : intenable en révision. Modèle « formes + lectures + tonalités échantillonnées » (3.1 de `MUSIC_DESIGN.md`) : ≈ 17 formes, ≈ 104 lectures.
5. **Tab seule pour les accords** : limite réelle pour un débutant (la forme de la main). Je propose une **boîte d'accord limitée aux étapes Découvrir/Construire** — **tranché : D1 = B**, implémentation en phase 4.
6. **« Niveau 3 : rejouer toute la gamme de mémoire au pavé numérique »** : 36 saisies = abandon. Découpage en segments.
7. **4-5 ambiances × backing tracks de styles différents** : surtout un travail de contenu musical, pas de code. Proposition : 1 style très soigné par thème, **2 thèmes jouables complets (Synthwave, Lo-fi) en phase 7**, les autres en habillage + SFX seulement d'abord.
8. **Qualité sonore « studio » avec échantillons libres** : plafond réel = celui des échantillons disponibles. **Tranché en 1c (D14)** : deux banques CC0 documentées, hauteur et niveaux mesurés ; le timbre reste à juger à l'oreille (moi, je ne l'entends pas). Un pack acheté/enregistré reste possible sans changer de code.
9. **Accords en accordage alternatif** : seules les formes mobiles ou recalculées par un solveur testé sont proposées.
10. **Ordre du brief « tout dans la phase 1 »** : la phase 1 est énorme (théorie + voicings + moteur de tab + audio + hub + thème + module Gammes N1 + positions). Je propose de la découper en 1a / 1b / 1c / 1d (§9 ; D10 et D18), sans changer l'ordre global.

---

## 2. Découpage en modules — avis

Le brief propose Gammes + Accords. **Je garde ces deux modules**, avec ces écarts :

- **Un module `Fondations`** (≈ 1 séance) : noms des cordes, lecture de la tab, accordeur, posture, premiers sons. Il valide au passage tout le matériel audio. Sans lui, « partir de zéro » casse à l'étape « qu'est-ce qu'une corde 1 ? ».
- **Le strumming et le rythme** : transversaux dans le MVP, **mais modélisés comme un module `rythmique`** (déclaré, vide) pour pouvoir l'extraire sans toucher au cœur — le rythme est la 1re cause d'abandon après les accords.
- **L'ear training n'est pas un module mais un type d'exercice** (`ExerciseInstance` sans `TabScore`, audio seul) disponible dans chaque module ; il devient un module propre plus tard.
- **Harmonisation / progressions** : vit dans `Accords` ; **le moteur de progressions est un service partagé** (consommé par le Défi Accords et par l'improvisation des Gammes).
- **Pont CAGED** : les accords ouverts C-A-G-E-D ↔ les 5 formes CAGED du module Gammes partagent les mêmes données de forme ; un lien de prérequis « souple » existe entre les deux arbres (on suggère, on ne bloque jamais).

---

## 3. Stack et justifications

### 3.1 Versions (npm au moment de la phase 0)
**Installées (`package.json`)** : Vite 8.3.5 · React / React DOM 19.3.1 · TypeScript 7.0.2 · Vitest 5.0.5 · `@vitejs/plugin-react` 6.1.2 · `tonal` 6.5.1 · **Tone 15.1.22 (1b, import dynamique)** · types React 19.3.0 · `@types/node` 24 · Node 24.22.1 (système : v18, trop ancien). **Outils hors runtime ajoutés en 1c** : ffmpeg 9.0.1, 7z, curl pour `tools/build-samples.mjs` (génération des échantillons, jamais exécutée par `npm test`). **Contenu ajouté** : `public/samples/` 12,1 Mo (CC0, pas une dépendance npm). **À installer plus tard** : pitchy 4.1.0 (phase 3) · vite-plugin-pwa 2.0.0 (phase 8). **`idb` 8.0.4 écarté** : journal en localStorage (D25).

### 3.2 React vs Svelte
**React 19.** Raison : écosystème de test et d'accessibilité, familiarité, et surtout **le framework est presque neutre ici** : les parties critiques (audio, tab, pitch) sont des modules TS purs sans dépendance au framework. Svelte serait plus léger ; le gain ne justifie pas de changer d'outil pour un projet solo. État global léger (Zustand ou équivalent) ; routage minimal par hash (compatible PWA hors ligne). **[HYP]**

### 3.3 Tablature : alphaTab ou rendu maison ? **Rendu maison.**
alphaTab (1.8.4, **MPL-2.0**, ≈ 13,7 Mo dépaquetés) fait très bien : import Guitar Pro, rendu notation + tab, lecture synchronisée. Mais ce projet exige :
- un **vrai rendu pixel art** (résolution logique basse, entiers, aucun lissage, police bitmap, pastilles colorées avec contour et glow). alphaTab rend en **vectoriel anti-aliasé** (SVG/canvas, police musicale SMuFL) et n'est pas conçu pour produire des pixels nets à résolution logique basse (**non testé en phase 0**, d'après sa documentation et son modèle de rendu) ;
- des **interactions de jeu** (case vide à toucher, trous, masquage de numéros, états par note, particules, curseur custom) qui demanderaient de contourner son modèle ;
- des **piles d'accords colorées par fonction d'intervalle** et des couches d'annotation (degré/doigté/intervalle) qui ne sont pas son cas d'usage.
Alternative écartée : alphaTab pour le rendu + overlay → deux systèmes de coordonnées à synchroniser, résultat flou, pour économiser un moteur de layout qui reste de toute façon à écrire pour le pixel art. **Garde-fou** : le modèle `TabScore` est conçu pour pouvoir **importer** un score alphaTab/Guitar Pro plus tard (hors chemin critique, idée en attente).

### 3.4 Rendu : Canvas 2D, pas PixiJS
La tab est un dessin 2D surtout statique (+ curseur, particules, scène de fond) : Canvas 2D avec **couches pré-rendues en cache** suffit, avec moins de dépendances (PixiJS est une grosse dépendance — plusieurs dizaines de Mo dépaquetés — pour du WebGL dont on n'a pas besoin). Si les performances sur mobile faiblissaient avec les particules/parallax, WebGL pourra être réévalué ; c'est un **[RISQUE]** faible. **[HYP]**

### 3.5 Audio sortie : Tone.js + échantillons — **réalisé en 1c**
- Tone.js : Transport (timing précis), `Offline` (mesures hors ligne et tests de clics), `Filter` / `Compressor` / `Limiter` / `WaveShaper` / `Convolver` pour le bus.
- **Échantillons retenus (D14)** : FreePats « Spanish Classical Guitar » (nylon, CC0, 5,3 Mo, un demi-ton par fichier de G1 à C6) et Karoryfer « Emilyguitar » (électrique direct, CC0, 6,8 Mo, couches p / mf ×3 / f). **`tonejs-instruments` écartée** : sa chaîne de licences n'est pas vérifiable. Écartés aussi : FluidR3 (provenance non documentée), Musyng Kite et FatBoy (**CC BY-SA**), FreePats FSS steel-string (**GPL v3**). Preuves et tableau complet : `MUSIC_DESIGN.md` §11.1.
- **Échantillonneur maison** (Web Audio natif), et non `Tone.Sampler` : il faut une voix par corde (couper la corde rejouée), une couche de vélocité **par événement**, des répétitions, une **correction de hauteur par échantillon** (écarts mesurés de −12,5 à +17,3 cents) et un repli Karplus-Strong hors plage.
- **Deux niveaux d'échantillons ?** Non en 1c : la banque nylon est déjà la version légère ; une « haute qualité » téléchargeable reste une option (R4), pas un besoin mesuré.

### 3.6 Entrée audio mono : `pitchy`
McLeod (MPM), pur JS, MIT. Exécuté **dans un AudioWorklet** (anneau de 128 échantillons assemblé en fenêtres), résultats par `postMessage` (f0, clarté, RMS, horodatage). **Taille de fenêtre déduite de la note la plus grave de l'accordage** (≥ 3 périodes) :

| Plus basse note | f₀ | Période @48 kHz | 3 périodes | Fenêtre retenue |
|---|---|---|---|---|
| E2 (standard) | 82,41 Hz | 582 éch. | 1 747 | 2 048 (43 ms) |
| D2 (Drop D) | 73,42 Hz | 654 | 1 961 | 2 048 |
| B1 (7 cordes) | 61,74 Hz | 778 | 2 333 | 4 096 (85 ms) |
| A1 (baryton) | 55,00 Hz | 873 | 2 618 | 4 096 |

Haut de plage : E6 = 1 318,5 Hz (période 36 éch.) : sans problème. Garde-fous : seuil de clarté, **continuité temporelle** (anti-sauts d'octave), vérification d'énergie à f₀/2 pour les basses sur micro de téléphone.

### 3.7 Entrée audio polyphonique : options comparées

| Option | Précision | Poids | Latence | Verdict |
|---|---|---|---|---|
| Chromagramme `Meyda` (MIT) | moyenne : 12 classes de hauteur, repliement d'octave, FFT courte → mauvaise résolution sur les graves | léger | faible | **insuffisant seul** : perd la basse (slash), ne distingue pas Em/E fiablement |
| `essentia.js` | bonne (algos MIR complets) | ≈ 10 Mo (WASM) | moyenne | **Écarté : licence AGPL-3.0** (contraignante si l'app est un jour distribuée) et poids |
| FFT + analyse « accord attendu » **maison** | bonne *pour vérifier un accord connu* | très léger | ≈ 0,2-0,35 s par accord | **Retenu** |

Principe retenu (cf. `MUSIC_DESIGN.md` §6) : puisqu'on connaît l'accord demandé, on **teste des hypothèses** plutôt que de reconnaître :
1. détection d'attaque (flux spectral, ~10 ms) ;
2. fenêtre longue **après** l'attaque (FFT 8 192-16 384 → 5,9-2,9 Hz/bin à 48 kHz, soit 171-341 ms ; résolution requise : E2/F2 = 4,9 Hz d'écart) ;
3. pour chaque note attendue : **somme pondérée des amplitudes à ses harmoniques 1-6** (±25 cents), avec **soustraction itérative** des harmoniques déjà expliqués par les notes plus graves (idée de Klapuri) ;
4. comparaison avec les **hypothèses concurrentes** (Em vs E, sus2/sus4, slash…) ;
5. sortie : confiance 0-1 par note attendue, agrégée en 3 bandes ; messages ciblés (« Sol♯ détecté au lieu de Sol »).
Pour les cordes graves en croches rapides (fenêtre courte), on s'appuie sur les harmoniques 2-4 (ex. 2·E2 vs 2·F2 = 9,8 Hz d'écart) car la fondamentale n'est plus résolue.

### 3.8 Persistance
*(Tel que construit en phase 2 : une seule clé `fretwave.attempts.v1` en localStorage, source de vérité unique — les agrégats sont **recalculés**, jamais stockés. IndexedDB et `navigator.storage.persist()` restent la cible si le journal dépasse quelques dizaines de milliers d'événements : D25.*) Sans backend, **perdre l'historique est le pire risque produit** (voir R7) : d'où l'export JSON.

### 3.9 PWA et tests
`vite-plugin-pwa` (Workbox) ; échantillons en cache (deux banques statiques de 12,1 Mo, téléchargées au premier lancement ; pas de jeu « haute qualité » séparé en 1c). Tests : Vitest (logique pure), tests de propriétés sur la théorie (orthographe, voicings), tests de signaux synthétiques pour l'audio, captures d'écran pour le rendu (phase 1+).

---

## 4. Architecture

### 4.1 Arborescence cible
```
guitare/
  PROJECT.md  MUSIC_DESIGN.md  BRIEF.md
  public/        samples/  fonts/  icons/  manifest
  src/
    app/         shell, routeur, hub, réglages, page debug audio, crédits/licences
    core/
      theory/    notation(fr/en) · orthographe · tunings · fretboard (freq↔corde/case)
                 scales · systems (3NPS, CAGED, boxes, symétriques) · chords · harmony · key-policy
      tab/       model (TabScore) · generators/ · layout/ · render/ · cursor · slots (saisie)
      audio/     engine · mixer · instruments (guitare, basse, batterie, pads) · strum · backing/ · sfx/ · metronome
      input/     mic · worklets/ · pitch (mono) · poly (accord attendu) · onset · calibration · tuner · mapper
      progress/  journal · mastery · srs/Scheduler · xp · streaks · badges · exportData   (localStorage, D25)
      themes/    tokens · registry · scene (parallaxe) · particles
      ui/        composants pixel · pavé numérique · accessibilité
    modules/
      fondations/  gammes/  accords/  rythmique/ (déclaré)
      registry.ts  (import.meta.glob('./*/module.ts'))
    data/        voicings.json · progressions.json · skill-graphs/
  tests/
```
**Ajouter un module = ajouter un dossier avec `module.ts` ; ajouter un thème = ajouter un fichier de config + assets.** Le cœur ne change pas.

*État (fin 1c) : `src/app/` (onglets **Tablature**, **Audio**, **Théorie** ; écran de chargement ; crochets de mesure `devHooks`), `src/core/theory/`, `src/core/tab/`, **`src/core/audio/` complet** (`engine`, `master`, `mixer`, `sampleBank`, `guitar`, `karplus`, `drone`, `metronome`, `tabPlayer`, `verify`), `src/data/voicings.ts`, **`public/samples/`** (2 banques CC0 + `README.md`) et **`tools/build-samples.mjs`**. À créer : hub et routeur, thèmes, `modules/`, progression, entrée audio, SFX et backing, UI pixel.

### 4.2 Interface `LearningModule` (contrat, pas du code livré)
```ts
interface LearningModule {
  id: ModuleId;
  meta: { title: I18n; icon: SpriteRef; accent?: ThemeToken };
  skillGraph(): SkillGraphSpec;                  // nœuds + prérequis (durs et « souples »)
  mastery: MasteryModel;                         // axes, seuils, dérivation d'état
  exerciseTypes: ExerciseType[];                 // déclaratif (QCM, trous, rappel, jeu, défi, ear…)
  generate(req: ExerciseRequest): ExerciseInstance;     // → TabScore (optionnel) + consigne + attentes
  validate(inst: ExerciseInstance, ev: Evidence): ValidationResult; // saisie | mono | poly | auto-éval
  recommend(ctx: ProgressSnapshot): SessionPlanItem[];  // alimente la session du hub
  screens: Record<string, LazyComponent>;
}
// Evidence.source ∈ 'tap' | 'qcm' | 'mono' | 'poly' | 'self'  (vérification : none/self/arpège/plaqué)
```
`ExerciseInstance.score` est optionnel : un exercice d'oreille n'a pas de tab.

### 4.3 Modèle de progression unifié
```ts
type NodeState = 'locked'|'available'|'learning'|'learned'|'mastered';
interface SkillNode {
  id: SkillId;                 // ex. acc:accord:Em-open-1 · acc:transition:Em-open-1>Am-open-1 · gam:lecture:boxes:1:minpent
  moduleId: ModuleId; kind: string; label: I18n;
  prereqs: { hard: SkillId[]; soft: SkillId[] };
  equivalenceKey?: string;     // collection de hauteurs canonique (gammes symétriques, Fa♯/Sol♭, etc.)
  axes: Record<AxisId, AxisProgress>;   // accords : forme · transition · tempo ; gammes : lecture · vitesse
}
interface AxisProgress {
  score: number;               // moyenne mobile 0-1 + effectif
  cleanCount: number; days: string[];          // jours distincts de réussite
  verification: 'none'|'self'|'arpeggio'|'strum';   // distingue le non vérifié
  srs: SrsState;               // gérée par l'interface Scheduler (Leitner d'abord, FSRS possible)
}
```
Journal `attempts` : `{ts, nodeId, axis, exerciseType, outcome, durationMs, evidence, context}`. Les agrégats se **recalculent** à partir du journal.

### 4.4 Modèle `TabScore` (indépendant du rendu ; consommé par rendu **et** audio) — *tel que construit en 1b* (`src/core/tab/model.ts`)
```ts
interface TabScore { id; kind: 'scale'|'position'|'arpeggio'|'chord'|'progression'|'exercise';
                     tuning: Tuning; stringCount: number; ppq: 480; tempo: number; timeSig: [number, number];
                     measures: Measure[]; meta?: { scaleId?; tonic?; positionId?; system?; chord? } }
interface Measure  { timeSig?; tempo?; label?: { chord?: string; roman?: string; text?: string }; events: TabEvent[] }
interface TabEvent { startTick: number /* RELATIF à la mesure */; durTick: number; tuplet?: { actual; normal };
                     kind: 'notes'|'rest'; notes: TabNote[]; chord?: string /* symbole du modèle, anglo */;
                     strum?: { dir: 'D'|'U'; spreadMs? }; unplayed?: number[] /* X de la pile */;
                     barre?: { fret; fromString; toString; finger } }
interface TabNote  { string: number /*0 = grave*/; fret: number; midi: number /*son réel*/; note: NoteName /*orthographe, sans octave*/;
                     fn: DegreeLabel /*« 1 », « b3 », « #4 », « 9 » : relatif à la fondamentale du contexte*/;
                     muted?; technique?: 'h'|'p'|'/'|'\\'|'b'|'~'; finger?: 0|1|2|3|4|'T';
                     hidden?: boolean /*trous niveau 2*/; characteristic?: boolean /*glow*/; passing?: boolean /*blue note, passage*/ }
```
- Les **ticks entiers** (PPQ 480) évitent les erreurs de flottants (croche de triolet = 160) ; conversion vers le Transport de Tone en **un seul endroit** (`tabPlayer.ts` : `` `${tick}i` ``).
- `validateScore` = les invariants testés : durées de chaque mesure = signature (événements contigus, silences explicites), `midi = accordage[corde] + case`, `note` cohérente avec `midi`, cordes / cases dans la plage, une note par corde et par événement, durées « notables » (noire pointée, triolet… sinon refus), `strum` seulement sur ≥ 2 notes.
- Générateurs `théorie → TabScore` livrés : gamme, position, arpège, accord (plaqué / arpégé), progression. À venir : exercice (séquences), backing.
- **La fonction `fn` est relative au contexte** : fondamentale de la gamme pour une position, fondamentale de l'accord pour un arpège ou un accord (Cmaj7 joué dans une position de La mineur : 1 3 5 7, pas 3 5 7 1♭3…).
- Lecture : `scoreToPlayEvents` (pur) → Tone. **Le son joué = les notes du score** (testé sur 6 types de scores, cordes × cases × hauteurs). Depuis la 1c, ce module porte aussi la **vélocité, la tenue et l'humanisation** (§4.7 ; `MUSIC_DESIGN.md` §11.5) — le modèle `TabScore` et le rendu n'en dépendent pas. Strum : ↓ grave → aigu, ↑ aigu → grave, 14 ms entre cordes par défaut.

### 4.5 Base de voicings
```ts
interface Voicing { id; chord: { root; quality; bass? }; tuning: TuningId; frets: (number|null)[];  // 0 = grave
                    fingers: (0|1|2|3|4|'T'|null)[]; barre?: { fret; from; to; finger };
                    family: 'open'|'open7'|'sus'|'add'|'power'|'barre-E'|'barre-A'|'triad3'|'drop2'|'drop3'|'ext';
                    difficulty: 1|2|3|4|5; simplifiedOf?: VoicingId; omitted: Degree[];
                    caged?: 'C'|'A'|'G'|'E'|'D'; mobile?: { shape; rootString } }
```
**Chaque voicing est testé automatiquement** (notes produites = formule de l'accord moins omissions déclarées ; basse ; orthographe ; étendue ; formes mobiles sur 13 fondamentales). En phase 0, les 43 formes et 10 formes mobiles de `MUSIC_DESIGN.md` §4.3 ont déjà été vérifiées par calcul : **0 erreur**.

### 4.6 Thèmes (design tokens + config)
Un thème = `theme.config.ts` + assets : palette, scène animée (couches de parallaxe), police d'accent, style de particules, ambiance sonore, SFX, backing tracks. **Les couleurs d'intervalle sont hors thème** (constantes globales) : seule l'habillage change. Changement à chaud, mémorisé. **Règle de lisibilité** : la tab est toujours dessinée sur un **panneau opaque sombre** ; scanlines/CRT s'appliquent à la scène, jamais aux chiffres (réglable, off par défaut sur le panneau).

### 4.7 Pipeline audio de sortie — *tel que construit en 1c* (`src/core/audio/`)
```
GuitareSampler (1 voix / corde : échantillon + couche + round-robin, correction de hauteur, repli Karplus-Strong)
   → bus guitare ──┬──────────────────────────────┐
                   └→ envoi réverb → Convolver ──┤
Drone (3-4 oscillateurs, filtre lent) ───────────┼→ mix → HP 30 Hz → compresseur (−18 dB, 3:1)
Métronome (clic sinus court) ────────────────────┘        → limiteur −1 dBFS → plafond dur (tanh, 2×)
                                                          → volume général → destination
```
- **Gain staging mesuré** (hors ligne, 48 kHz, réglages par défaut) : crête −3,8 à −6,2 dBFS sur les contenus joués, drone 10 dB sous la guitare, métronome 7 dB sous la crête ; cas extrême (tout à 1, strum à 170 BPM) **−1,2 dBFS**. Tableau complet dans `MUSIC_DESIGN.md` §11.4.
- **Le limiteur seul ne suffit pas** : `Tone.Limiter` (compresseur 20:1, attaque 3 ms) laisse passer les crêtes plus rapides que son attaque (mesuré : +2,2 dBFS) ; le plafond qui suit garantit |sortie| ≤ −1 dBFS, dérivée continue au genou (aucune distorsion audible sous −3,1 dBFS).
- **Strum et tenue** : voir §11.5 de `MUSIC_DESIGN.md` (écarts 4-40 ms, accélération, accents, humanisation déterministe, tenue par type de score). Les notes jouées sont **celles du TabScore** (journal `triggered`, vérification corde par corde dans la page Audio).
- **Chargement** : Tone (chunk séparé) puis manifeste puis 6 fichiers en parallèle, décodage pendant que le contexte est `suspended` ; écran de chargement avec progression en octets ; l'ancienne banque reste en mémoire quand on change d'instrument.
- **Métronome et drone** : programmés / démarrés par `TabPlayer` sur la même horloge que les notes ; réglables en cours de lecture (les clics sont programmés une fois et ne sonnent que si le métronome est actif).
- **Compte à rebours, backing, SFX** : pas en 1c (voir §12).
- **Prévu pour la suite** (phase 7) : bus **backing** (basse, batterie, pads) et bus **SFX** branchés sur le même `mix` ; séquencement par `Tone.Transport`, lignes de basse et voicings avec conduite de voix, motifs de strumming par style **en données** — la chaîne actuelle les accepte sans modification.

### 4.8 Pipeline audio d'entrée
```
getUserMedia({ deviceId, echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1 })
  → vérifier track.getSettings() (certains navigateurs mobiles ignorent les contraintes → avertir)
  → AudioWorklet « capture » : anneau + RMS + détection d'attaque
        ├─ pitch mono (pitchy, fenêtre adaptée) → mapper f→(corde,case) avec désambiguïsation par la position attendue
        └─ blocs transférés (postMessage, pas de SharedArrayBuffer : COOP/COEP non garantis) → Worker « accord attendu »
  → calibration : niveau, seuil de bruit, **latence mesurée en jouant sur des clics** (décalage médian), seuils séparés mic/USB
```
Casque recommandé pour le Défi (le micro capterait le backing).

### 4.9 Rendu pixel et tablature
**Un seul pixel logique pour toute l'app.** Facteur d'échelle entier `S` (CSS px par pixel logique), `canvas.width = largeur_css × dpr` arrondie à un multiple de `S × k` quand c'est possible ; rendu à `image-rendering: pixelated`, `imageSmoothingEnabled = false`.
- **480×270 n'est pas adapté** : une tab de 6 cordes + en-têtes + rythme + annotations demande ≈ 144 pixels logiques de haut (53 % de 270), et un téléphone portrait (390 px) n'a pas de rapport entier avec 480.
- **Chiffres de frettes** : police bitmap maison **5×7** (≥ 2 chiffres lisibles), pastille 1 chiffre = 11×13, 2 chiffres = 17×13 pixels logiques (contour 1 + remplissage 2). Pas entre cordes : **14** (pastille 13 → 1 px d'air, piles d'accords sans chevauchement).
- **Hauteur d'une ligne de tab 6 cordes = 136-137 px logiques** (mesuré en 1b ; l'estimation de la phase 0 était 144) : marge + nom d'accord 3 + 10 ; libellé / chiffrage 10 ; + 3 ; cordes et pastilles 83 ; flèches de strum 2 + 7 (accords seulement) ; rythme 2 + 13 (+ 8 si triolets) ; annotation 1 + 7 (notes seules) ; marge basse 4. Une rangée absente de tout le score disparaît pour toutes les lignes. **7 cordes : +14, 8 cordes : +28** (testé).
- **Échelle `S` automatique** : `S = clamp(⌊min(largeur/190, hauteur×0,38/144)⌋, 2, 4)` : téléphone 390×844 → **S=2** (chiffre 14 px CSS de haut, pastille 26×34 CSS, bien lisible) ; bureau 1440×900 → S=2 (S=3 en réglage) ; 4K → S=4. Largeur logique = largeur écran/S (**195 px logiques en portrait**). *1b : implémenté tel quel (`autoScale`) ; `k = round(S × dpr)` pixels physiques par pixel logique, canvas dimensionné à `largeur × k` ; en défilement continu les étiquettes de cordes restent fixes, le curseur est ancré à 30 % ; au-delà de 16 000 px de canvas : drapeau `tooWide` (pas de tuiles).*
- **Scène de fond** : même grille de pixels (taille = viewport/S), couches pré-rendues, parallaxe légère, étoiles qui scintillent ; limitée à 30 images/s.
- **DPR non entier** (ex. 2,625) : le facteur d'agrandissement final doit rester entier sur le *pixel physique* ; sinon pixels inégaux (voir R5).
- **Mobile portrait : défilement horizontal continu avec curseur fixe (≈ 30 % de la largeur)** pour tout ce qui est « jeu » (Défi, improvisation, lecture) ; **retour à la ligne** (systèmes empilés) pour l'étude statique et le grand écran/paysage. La position complète d'une gamme (36 notes) s'affiche en **liste verticale de systèmes**.
- **Accessibilité** : marqueur de forme en plus de la couleur (daltonisme), option « réduire les animations », texte alternatif lu à l'écran (nom de l'accord et notes).
- Tap target : une case de la tab fait ≈ 28×34 px CSS à S=2, **en dessous des 44 px recommandés** : en saisie, **zoom d'édition** (S+1) et pavé numérique DOM de grande taille.

---

## 5. Direction artistique — moodboard texte

**Identité** : *synthwave pixel art, nocturne, lisible d'abord.* Soleil rayé orange→magenta, grille en perspective cyan/rose, silhouettes de montagnes, étoiles, scanlines légères. La tab est une **console lumineuse** posée devant le décor : panneau sombre quasi opaque, lignes de cordes en néon fin, pastilles à contour net.

### 5.1 Palettes (indicatives, à valider sur écran réel en phase 1)
| Thème | Fond | Surfaces | Accents |
|---|---|---|---|
| **Synthwave Neon** (défaut) | #0D0221 · #1A0B3B | #261447 · #3A1C71 | magenta #FF2A6D · cyan #05D9E8 · orange #FF9E3D · jaune #F9F871 |
| **Cyber City Night** | #050B1E · #0A1633 | #0F2A5F · #17214A | bleu #3D5AFE · violet #B026FF · cyan #00E5FF · pluie #6EC1FF |
| **Chill Lo-fi Room** | #2B1D2E · #3A2A3A | #4A3548 · #5C4056 | pêche #E8A87C · rose #C38D9E · turquoise #41B3A3 · crème #F5E6C8 |
| **Arcade Classic** | #0F380F | #306230 | 4 tons « Game Boy » : #0F380F #306230 #8BAC0F #9BBC0F |
| *(option)* **Rock Stage / Lava** | #1A0505 · #2B0A0A | #4A1008 · #7A1F0F | rouge #FF3B1F · orange #FF7A00 · ambre #FFB000 |

### 5.2 Couleurs d'intervalle (identiques dans tous les thèmes)
**La teinte porte le degré, l'altération module la luminosité et ajoute une encoche.** Proposition de départ :
1 fondamentale jaune **#FFD23F** · 2/9 orange **#FF8A3D** · 3 magenta **#FF3CAC** · 4/11 vert **#7CFF6B** · 5 cyan **#3CE6FF** · 6/13 violet **#A86BFF** · 7 corail **#FF5C5C**.
Chiffre sombre (#120A2A) sur pastille claire. **Contraste et daltonisme à tester en phase 1** (simulation protanopie/deutéranopie), sans quoi la règle « la couleur est l'information » ne tient pas.

**Lisibilité d'abord (corrigée en phase 2, à ta demande).** Tout bloc de texte vit sur une **surface opaque** : le décor ne passe jamais derrière un paragraphe. Hiérarchie des surfaces : `bg` **#0D0221** (fond) < `surface` **#150A33** (panneau) < `surface-hi` **#201048** (carte : entrée, module, ligne de liste, touche de pavé) ; le fond perdu (`--bg`) sert aux cartes « en creux » (badge verrouillé, module prévu). Texte secondaire éclairci : `muted` **#C4B6E4**, `dim` **#A99BCF**. Le titre d'un module est en `text` et son repère de couleur passe en **filet latéral de 4 px** : un titre ne doit pas dépendre d'une teinte saturée pour se lire. Seuils tenus par test (`theme.test.ts`) : `muted` ≥ 7:1, `dim` ≥ 5,5:1 sur les trois surfaces ; contraste réel mesuré au navigateur sur les quatre écrans : **minimum 5,2:1, aucun texte sous 4,5**.

### 5.3 Typographie
- **Police bitmap maison 5×7** pour tout ce qui est dans la tab (chiffres, notes, degrés, ♯ ♭ 𝄪 𝄫, ↓ ↑, °, ø, Δ) : aucune police existante ne couvre ces glyphes en pixel net.
- UI (DOM) : **Silkscreen** (étiquettes de panneau, badges, tags, onglets — capitales épaisses, courtes) et **sans-serif système** (titres, texte, boutons, segments, chips). Press Start 2P ne sert plus qu'au mot-symbole. Les polices pixel sont sous licence OFL, auto-hébergées pour le hors-ligne.
- Tailles toujours multiples du pixel logique ; pas de lissage.

### 5.4 Mouvement
Peu d'images par animation (rétro assumé), transitions pixelisées (dissolution en blocs), particules pixel + glow sur bonne note, **shake + flash rouge sur erreur** (réglable, jamais agressif), SFX chiptune/synthwave propres.

---

## 6. Maquettes ASCII (téléphone portrait, S=2)

Légende des pastilles : la couleur d'intervalle n'existe pas en ASCII ; elle est rappelée sous la tab.

### 6.1 Hub
```
+--------------------------------------------------------+
| FRETWAVE                           Niv.4 · 1 240 XP    |
| Série : 6 jours  [#][#][#][#][#][#][ ]                 |
+--------------------------------------------------------+
| OBJECTIF DU JOUR   12 min  [########----] 8/12         |
|                                                        |
| SESSION RECOMMANDÉE · 11 min              [ ▶ GO ]     |
|  1 Échauffement : cordes à vide + Em         2 min     |
|  2 Révision     : Em → Am  (due)             2 min     |
|  3 Nouveau      : Asus2 (forme)              3 min     |
|  4 Gamme        : La min. pent. · box 1      4 min     |
+--------------------------------------------------------+
| +----------------------+ +----------------------+      |
| | ACCORDS              | | GAMMES               |      |
| | 7 / 42 appris        | | 3 / 58 vues          |      |
| | prochain : Asus2     | | prochain : box 2     |      |
| | [##########--------] | | [###---------------] |      |
| +----------------------+ +----------------------+      |
| bientôt : Rythme · Oreille · Morceaux  (verrouillés)   |
+--------------------------------------------------------+
|     [ Hub ]  [ Progrès ]  [ Accordeur ]  [ Réglages ]  |
+--------------------------------------------------------+
```

### 6.2 Sélection de gamme
```
+--------------------------------------------------------+
| < GAMMES                                  [ Réglages ] |
|                                                        |
| TYPE     [ Pentatonique mineure                v ]     |
|          majeure · min. naturelle · pentatoniques      |
|          blues · modes · harm. · mél. (jazz)           |
|                                                        |
| TONIQUE  Do  Do♯  Ré  Mi♭  Mi  Fa  Fa♯/Sol♭            |
|          Sol  La♭  [La]  Si♭  Si                       |
|          (Fa♯ et Sol♭ : 6 altérations → les deux)      |
|                                                        |
| MODE     « Ré dorien » : tonique Ré,                   |
|          mode parent : Do majeur                       |
|                                                        |
| ACCORDAGE  [ Standard   Mi La Ré Sol Si mi    v ]      |
| CORDES     [ 6 ]      (4 à 8 selon l'accordage)        |
|                                                        |
| SYSTÈME    (•) Boxes (5)                               |
|            ( ) CAGED : lien avec les accords           |
|            ( ) 3 notes/corde  (indispo : 5 notes)      |
| ANNOTATION ( ) notes (•) degrés ( ) interv. ( ) doigts |
+--------------------------------------------------------+
| [1 Découverte ★★☆]  [2 Mémo]  [3 Rappel]  [4 Impro]    |
| (niveaux 2-4 recommandés après le 1 ; tout se débloque)|
+--------------------------------------------------------+
```

### 6.3 Gamme — niveau 1 « Découverte » (La mineur pentatonique, box 1, montée)
```
+--------------------------------------------------------+
| < La mineur pentatonique · Box 1  (cases 5-8)          |
| ♩=60 [-][+]   drone La [on]   [▶] [||] [boucle]        |
+--------------------------------------------------------+
|  Am                                                    |
|                 ▼                                      |
| e|--------------------------------5--8|                |
| B|--------------------------5--8------|                |
| G|--------------------5--7------------|                |
| D|--------------5--7------------------|                |
| A|--------5--7------------------------|                |
| E|--5--8------------------------------|                |
|     1 b3  4  5 b7  1 b3  4  5 b7  1 b3                 |
|     ♪  ♪  ♪  ♪  ♪  ♪  ♪  ♪  ♪  ♪  ♪  ♪   (croches)     |
+--------------------------------------------------------+
| [Montée] [Descente] [Arpège Am7]   Notes : degrés v    |
| pastilles : 1 fondamentale · b3 tierce · 4 · 5 · b7    |
| b3 (pulse) = la couleur « mineure » de la gamme        |
+--------------------------------------------------------+
```
Curseur ▼ synchronisé sur Tone.Transport ; défilement horizontal continu ; notes passées estompées. Le motif de la box est lisible sur la diagonale ; **limite assumée** : la « forme » d'ensemble reste moins visible qu'avec un diagramme.

### 6.4 Improvisation (ii–V–I en Do, position cases 5-8 en rappel)
```
+--------------------------------------------------------+
| < Impro · Do majeur · ii–V–I · ♩=80      [||]          |
| position : cases 5-8 (rappel)       [voir tout]        |
+--------------------------------------------------------+
|   Dm7          G7           Cmaj7                      |
|   ii7          V7           Imaj7                      |
|                        ▼                               |
| e|--5--7--8---|--7-----8--7|-----6--5---|              |
| B|------------|-----6------|--5---------|              |
| G|------------|------------|------------|              |
| D|------------|------------|------------|              |
| A|------------|------------|------------|              |
| E|------------|------------|------------|              |
|     c  t  c      c  c  !  c   c  x  t                  |
|  c accord · t couleur · p passage · ! à éviter · x hors|
+--------------------------------------------------------+
| Score 74    notes d'accord 58 %    hors gamme 8 %      |
| G7 : le Do (4te) tenu frotte avec le Si (tierce).      |
|      Résous-le : Do → Si.                              |
+--------------------------------------------------------+
```
Les notes jouées s'inscrivent à la position du curseur et sont classées (c, t, p, !, x) selon l'accord en cours.

### 6.5 Leçon d'accord (Am, étape « Construire » puis « Vérifier »)
```
+--------------------------------------------------------+
| < Accords · Am  (La mineur)          étape 2 / 7       |
| Découvrir > CONSTRUIRE > Vérifier > Plaquer >          |
| Fixer > Enchaîner > Intégrer                           |
+--------------------------------------------------------+
|    Am      La · Do · Mi      1  b3  5                  |
|                                                        |
|    e|-0-|   à vide                                     |
|    B|-1-|   1 index       ← à placer maintenant        |
|    G|-2-|   3 annulaire    (à venir)                   |
|    D|-2-|   2 majeur       (à venir)                   |
|    A|-0-|   à vide                                     |
|    E|-x-|   ne pas jouer                               |
|         ↓ ↓ ↓ ↓      [♪ plaqué]  [♪ arpégé]            |
+--------------------------------------------------------+
| Pouce derrière le manche, doigts arrondis,             |
| pointe près de la frette.                              |
| [ Doigt suivant ]          [ Version plus simple ]     |
+--------------------------------------------------------+
| VÉRIFIER (arpège)    La ✓   Ré ✓   Sol ✓   Si ✗   mi ✓ |
| « Ta corde de Si est étouffée : arrondis l'index,      |
|   pointe près de la frette. »                          |
| confiance ■■■■□     [ Je l'ai bien joué (non vérifié) ]|
+--------------------------------------------------------+
```
Un doigt à la fois ; les doigts à venir apparaissent en pointillé. Le diagnostic par corde n'existe qu'en **arpège**.

### 6.6 Défi Accords (Setlist)
```
+--------------------------------------------------------+
| DÉFI · Setlist · 3 accords · ♩=80 · ordre aléatoire    |
| ♥ ♥ ♥                                 XP +0   ★ ☆ ☆    |
+--------------------------------------------------------+
|    Em               Am               D                 |
| e|-0--------------|-0--------------|-2--------------|  |
| B|-0--------------|-1--------------|-3--------------|  |
| G|-0--------------|-2--------------|-2--------------|  |
| D|-2--------------|-2--------------|-0--------------|  |
| A|-2--------------|-0--------------|-x--------------|  |
| E|-0--------------|-x--------------|-x--------------|  |
|    ↓ · ↓ ↑ · ↑ ↓ ↑  ↓ · ↓ ↑ · ↑ ↓ ↑  ↓ · ↓ ↑ · ↑ ↓ ↑   |
|            ▲  curseur (mesure 1, temps 3)              |
+--------------------------------------------------------+
| Em  ■■■■■ haute      timing −12 ms   ✓                 |
| Am  ■■■□□ moyenne    « Do ou La ? »  ?   (ambigu)      |
| Casque conseillé · latence mesurée : 38 ms             |
| [ Je l'ai joué (non vérifié) ]            [ Pause ]    |
+--------------------------------------------------------+
```
Pile dessinée **au changement d'accord** (répétition « simile »), flèches de strum à chaque frappe ; **jamais de verdict binaire** : barres de confiance + « ambigu » assumé ; auto-évaluation clairement marquée « non vérifié ».

*(Sur grand écran : mêmes composants, retour à la ligne des mesures, rail latéral pour la progression.)*

---

## 7. Analyse des risques techniques

### 7.1 Tableau (probabilité × impact, 1-3)

| # | Risque | P | I | Mitigation |
|---|---|---|---|---|
| R1 | **Détection polyphonique** insuffisante (faux positifs Em/E, sus/add, harmoniques de basses, micro de téléphone) | 3 | 3 | Mode arpège = référence ; strum = confiance + bandes ; soustraction d'harmoniques ; **tests sur signaux synthétiques d'abord**, chiffrés (7.2) ; validation manuelle de secours |
| R2 | **Latence** entrée/sortie sur Android/Bluetooth ; timing Défi injuste | 3 | 2 | Casque filaire conseillé ; latence **mesurée** par calibration (jeu sur clics, décalage médian) ; fenêtres de tolérance réglables ; Bluetooth déconseillé (profil mains-libres dégrade le micro) |
| R3 | **iOS/Safari** : contexte audio suspendu, interrupteur silencieux qui coupe le Web Audio, contraintes de capture ignorées | 2 | 3 | Démarrage sur geste ; session audio « playback » ou astuce `<audio>` silencieux (**à tester sur appareil**) ; avertir si `getSettings()` révèle un AGC/NS actif |
| R4 | **Échantillons** : qualité « studio » inatteignable avec les packs libres ; licences | 2 | 2 | **Traité en 1c (D14)** : deux banques CC0 documentées, attribution affichée quand même, repli Karplus-Strong, hauteur et niveau mesurés. Reste : le timbre jugé à l'oreille, pas par moi |
| R5 | **Pixels inégaux** (DPR non entier, redimensionnement) | 2 | 2 | Échelle entière sur pixel physique ; test de rendu à 5-6 DPR ; captures de non-régression |
| R6 | **Moteur de layout de tab** (rythme : ligatures, triolets, doubles croches, piles) plus long que prévu | 2 | 3 | Périmètre incrémental : noires/croches/doubles d'abord, triolets ensuite ; layout pur testé ; modèle complet dès le départ |
| R7 | **Perte de données** (stockage purgé par iOS pour un site non installé après ~7 jours d'inactivité ; vidage manuel) | 2 | 3 | PWA installée + `persist()` ; **export/import JSON** proposé à chaque palier ; journal d'événements |
| R8 | **Perf mobile** (canvas plein écran + particules + audio) | 2 | 2 | Couches pré-rendues, scène à 30 fps, curseur seul redessiné ; profilage dès la phase 1 |
| R9 | **Contenu** : volume de voicings, progressions, patterns de backing ; erreurs de transcription | 2 | 3 | Tests automatiques sur chaque forme ; données séparées du code ; relecture « prof » des doigtés en phase 4 |
| R10 | **Dérive de périmètre** : le brief est très large | 3 | 3 | Phases séquencées, définition de « terminé » par phase, phase 1 découpée 1a / 1b / 1c / 1d |
| R11 | Contraintes d'**autorisation** (HTTPS requis pour le micro) | 1 | 2 | `localhost` pour le dev ; HTTPS pour le déploiement ; messages d'erreur dédiés (refusée, aucun périphérique) |
| R12 | Taille du bundle (Tone.js ≈ 5,4 Mo dépaquetés) | 1 | 1 | **Mesuré en 1c** : 112,7 ko gzip (app) + 79,4 ko gzip (Tone, au démarrage) ; échantillons hors bundle, téléchargés à la demande (5,3 Mo nylon) |

### 7.2 La détection polyphonique en détail
**Pourquoi c'est dur** (chiffres calculés en phase 0, 48 kHz) :
- Résolution : FFT 4 096 → 11,7 Hz/bin (85 ms) ; 8 192 → 5,9 Hz (171 ms) ; 16 384 → 2,9 Hz (341 ms). Sol♯3 − Sol3 = 11,7 Hz ; Mi2 − Fa2 = **4,9 Hz** → il faut ≥ 8 192 (idéalement 16 384) pour séparer les basses sans astuce.
- **Chevauchement d'harmoniques** : 5·E2 = 412,0 Hz, à **−14 cents** de Sol♯4 → un Mi grave seul « ressemble » à un Mi majeur (faux Sol♯) ; 3·A2 = 330,0 Hz ≈ Mi4 (+2 cents) → faux Dsus2 si la corde de La résonne.
- Étouffement : l'**absence** d'une corde est beaucoup plus difficile à prouver que sa présence (bruit, cordes à vide qui résonnent par sympathie, réverbération de la pièce).
- Micros de téléphone : filtrage des graves, compression automatique, écho de la pièce ; le signal d'une interface USB est bien plus propre.

**Protocole de test (phase 5), avant toute vraie guitare** :
- Générateur : superposition de notes avec **harmoniques décroissantes + inharmonicité légère + bruit d'attaque**, décalage de strum 10-40 ms, désaccord global ±0/15/30 cents, bruit de fond à SNR 30/20/10 dB, corde étouffée simulée (courte decay) et corde à vide parasite.
- Ensemble : Em, E, Am, A, C, G, D, Dsus2, Dsus4, Dm, Am7, Cmaj7, G/B, D/F♯… ; **matrice de confusion** pour les paires proches.
- Métriques : taux d'acceptation de l'accord correct, taux de faux positifs vers chaque voisin, distribution de la confiance.
- **Cibles hypothétiques (à valider, pas des promesses)** : ≥ 90 % d'acceptation correcte à SNR 20 dB ; ≤ 10 % de faux positifs entre voisins courants ; résultats **publiés tels quels**, y compris les échecs.
- Puis seulement : guitare réelle, interface USB d'abord, micro de téléphone ensuite ; seuils séparés par source.

**Repli produit** si les cibles ne sont pas tenues : le strum reste « confiance + validation manuelle », l'arpège porte la validation d'apprentissage ; le Défi garde sa valeur (timing + score de confiance), pas la certitude.

---

## 8. Hypothèses prises (sans te bloquer)

**Issues de la phase 0**
1. Droitier, accordage standard, La = 440 Hz. **[HYP]**
2. Français uniquement ; textes dans un catalogue i18n pour une éventuelle traduction. **[HYP]**
3. Pas de backend ; données locales ; aucun compte.
4. Corde grave = index 0 dans le modèle ; « corde 1 » = aiguë côté affichage.
5. PPQ 480 en interne (`TabScore`, construit en 1b).
6. Leitner à 6 boîtes derrière une interface `Scheduler` (FSRS possible).
7. Défi : x accords de 2 à 6.
8. Latence : mesurée par calibration, pas estimée.
9. Notation : **notes en solfège** par défaut, **accords en anglo** (`Am7`, décision D8) ; deux réglages distincts (`noteNotation`, `chordNotation`).

**Prises en phase 1a**
10. **Mélodique = convention jazz** (1 2 ♭3 4 5 6 7 montée et descente) ; la variante classique n'est pas encore implémentée (option documentée dans `MUSIC_DESIGN.md` §1.5).
11. **Tons entiers écrits avec ♭7** (Do Ré Mi Fa♯ Sol♯ Si♭), pas La♯ : on garde la fonction de degré.
12. **Altérée = 1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7** (la tierce s'écrit ♭4 pour garder une note par lettre) ; dim7 = 1 ♭3 ♭5 𝄫7 ; `dim` = triade.
13. Une altération juste après la lettre fait toujours partie de la fondamentale : `Bb5` = Si♭ power chord, `Bbb5` = Si𝄫 power chord.
14. Les 7 modes diatoniques de la majeure, de l'harmonique et de la mélodique sont dans le catalogue ; les noms français des modes dérivés sont provisoires.
15. Les **difficultés (1-5)** et les paliers des voicings sont des **heuristiques** (non calibrées) ; les **doigtés** ne sont pas saisis (phase 4, relecture « prof »).
16. Les voicings curés sont **limités à l'accordage standard** ; les accordages alternatifs passeront par des formes mobiles ou un solveur validé (D9, plus tard).
17. Étiquettes de cordes en solfège : `Mi` grave / `mi` aigu (casse), comme `E`/`e`.
18. `parentMajorTonic` renvoie la transposition brute : elle peut donner un parent à 7 altérations ou à doubles altérations (ex. Ré♯ locrien → Mi♯ majeur). L'UI devra le présenter comme une information, pas comme une tonalité jouable (à traiter en 1c).
19. Le nom « Fretwave » est un **nom de travail**.
20. Le dépôt n'a pas de remote ; les commits sont locaux.

**Prises en phase 1b**
21. **Position n = rang du degré de départ sur la corde grave** (Position 1 = la tonique) ; chaque position est placée à l'**instance la plus basse du manche** (cases 0-24) ; `register: 1` donne l'instance 12 cases plus haut (une position qui dépasserait la case 24 est omise, jamais tronquée). Les numéros ne suivent donc pas l'ordre sur le manche. **[HYP → décision D11 : acceptée]**
22. **CAGED = fenêtre de 5 cases autour de la forme d'accord** (Mi / La / Ré : l'accord ± 1 case ; Do / Sol : de 3 cases sous la fondamentale à 1 au-dessus). Définition **maison**, non comparée à une source ; testée : 5 formes pour la majeure, ses 6 modes et les 2 pentatoniques, 2-3 notes par corde, accord majeur toujours présent, fenêtres qui se recouvrent sur 13 tonalités. CAGED des modes et des pentatoniques = fenêtres de la majeure parente. **[HYP → décision D12 : acceptée ; relecture par toi de 3 tonalités (Do, Sol, La) avant d'exposer CAGED dans l'UI 1c]**
23. **Symétriques** : un motif par case de la période (2, 3, 4), fenêtre de 5 cases. **Blues / bebop** = position de la gamme de base (pentatonique / mixolydien / ionien) + les notes ajoutées qui tombent dans sa fenêtre, marquées `passing`.
24. **Pile d'accord redessinée au début de chaque mesure** et à chaque changement de forme (les frappes suivantes : flèche seule, « simile ») ; `stacks: 'all'` dessine une pile par frappe.
25. Strum : ↓ cyan, ↑ rose. Le « motif universel » ↓ · ↓ ↑ · ↑ ↓ ↑ est écrit en durées jusqu'à la frappe suivante (noire, croche, noire, croche, croche, croche), sans silences.
26. Annotation : une rangée sous la tab pour les notes seules ; pour une pile, à droite de chaque pastille sur un fond de panneau (la ligne de corde ne traverse pas le texte).
27. Barré : repère vertical à gauche de la pile, `B{case}` dans la rangée du libellé ; formes mobiles : barré dès qu'elles quittent le sillet.
28. Couleurs d'intervalle : bémol = −22 % de luminosité + encoche en bas à droite, dièse = +30 % de blanc + encoche en haut à droite, fondamentale = coins coupés ; chiffre sombre ou blanc selon le meilleur contraste.
29. **Son provisoire** = une corde `PluckSynth` par corde de la guitare, sans échantillons. Fin de morceau : arrêt par minuterie, **pas** `transport.stop(time)` (Tone rejoue alors le tick 0 : une note parasite sonnait après la fin, constaté dans le navigateur).
30. Tempo constant pendant la lecture d'un score (`measure.tempo` est validé, pas joué).

**Prises en phase 1c**
31. **Nylon par défaut**, électrique en second choix (D14) ; le choix est mémorisé et survit au rechargement.
32. **Vélocité de base 0,70** ; accents ×1,04 à ×1,06 (notes seules / strum), montant ×0,88, corde d'arrivée du strum ×1,0 à ×0,82 ; seuils de couche **p < 0,5 ≤ mf < 0,85 ≤ f** : l'humanisation et les accents ne font pas changer de timbre d'une note à l'autre.
33. **Strum** : écart moyen 14 ms (4-40 réglable), accélération de 25 % au plus en fin de geste, gigue ±20 % de l'écart × humanisation, balayage total ≤ 35 % de la durée de l'événement.
34. **Tenue automatique par type de score** : `ring` (fin de mesure) pour accords et progressions, `legato` (2 × la note) pour les arpèges, `damp` pour gammes et positions ; surchargeable par option.
35. **Humanisation déterministe** (graine = tick + option `seed`), 50 % par défaut : rejouer donne exactement le même son.
36. **Drone** : fondamentale Mi2-Ré♯3 + quinte + octave, **jamais de tierce** ; pas de drone sur une progression (pas de fondamentale unique).
37. **Métronome** : un clic par temps, un par groupe de trois croches en 6/8, 9/8, 12/8 ; accent sur le premier temps de la mesure ; niveau −11 dBFS crête.
38. **Mixage** : volumes par défaut 0,95 / 0,9 / 0,8 / 0,85 (général, guitare, drone, métronome), réverbération 50 %, trim guitare −2 dB, `trimDb` électrique +7 dB, plafond dur à −1 dBFS après le limiteur.
39. **Deux banques seulement** en 1c : pas de réglage « qualité standard / haute » (le nylon est déjà la banque légère) ; une banque haute qualité reste une option (§11.1 de `MUSIC_DESIGN.md`).
40. **« Continuer sans le son »** plutôt que blocage : si les échantillons ne se chargent pas, l'app s'ouvre et la lecture est silencieuse (erreur affichée et conservée dans le moteur).
41. **Statut des phases** : l'ancienne phase 1c du plan est découpée — **1c = moteur audio** (fait, commité), **1d = hub + thème + module Gammes N1** (proposé, D18).

**Prises en phase 1d**
42. **Objectif du jour = 3 écoutes**, non réglable avant la phase 2 (aucun écran de réglage de série/objectif).
43. Une **écoute** est journalisée si la lecture réelle dépasse **3 s** ; la durée est mesurée entre « lecture » et pause / stop / fin, jamais estimée.
44. La sélection de gamme est **mémorisée et normalisée** : gamme inconnue, tonique mal orthographiée, système indisponible ou position hors plage retombent sur une valeur valide — l'écran ne jette jamais.
45. **CAGED exposé en 1d** (ta demande vaut feu vert pour la condition D12) ; fenêtre = forme d'accord ± 1 case (Do/Sol : de 3 cases sous la fondamentale à 1 au-dessus) ; relu sur Do, Sol, La sans correction.
46. **Doigtés** : heuristique par corde (D20) ; une corde à 5 notes ou plus n'a **aucun** doigté affiché (démanché nécessaire) plutôt qu'un doigté faux.
47. **Scène** : échelle 2 px CSS par pixel logique (3 au-delà de 1 500 px), horizon à 38 % (poster) / 30 % (calme), soleil borné à 11 % de la hauteur, parallaxe ≤ 40 px, 30 img/s. Pas de garde `document.hidden` sur l'intervalle : le navigateur limite déjà les onglets masqués, et la garde laissait la couche animée vide au retour.
48. **Polices** : sous-ensemble latin de Google Fonts, OFL 1.1, auto-hébergées (46,3 ko au total), provenance et licences dans `public/fonts/README.md`.
49. La **signature rythmique** est écrite en petit (`4/4`) en tête de portée, et non en deux chiffres de 15 px au milieu des cordes.

**Prises en phase 2**
50. **Journal en localStorage plafonné à 2 000 tentatives** (≈ 380 ko mesurés), pas en IndexedDB (D25) : la promesse du `idb` de la phase 0 est **écartée sciemment**, pas oubliée.
51. **Un nœud = une forme × un mode, jamais une tonique** (D28) : la tonique est une preuve séparée (`tonics`, `zones`) qui sert à proposer la transposition, pas à multiplier les cartes.
52. **Leitner 6 boîtes** avec gigue déterministe ±15 %, échec −2 boîtes, plafond **8 cartes dues** (D26) ; seuils **80 %** de réussite, **2 jours distincts** pour « apprise », boîte ≥ 5 pour « maîtrisée ».
53. **XP** 10 × précision (trous) / 15 × précision (rappel), +5 à ≥ 95 %, **plafond 120/jour** ; **écoute = 0 XP** (D27).
54. **Série** = jours consécutifs d'activité (écoute comprise), **vivante tant que la veille compte** : la série ne casse pas à minuit avant que l'utilisateur ait joué (D27).
55. **Niveau 2 = ~35 % de trous, minimum 2, jamais toutes** ; niveau 3 = toutes les notes du segment (D29). Le découpage se fait par cordes, pas par mesures.
56. **2ᵉ erreur sur un trou = case révélée**, comptée fausse ; la tentative est enregistrée quand même (D29).
57. **Le pavé numérique reste collant sous 900 px** : sur téléphone, il faut voir la tablature **et** les touches sans faire défiler deux fois.
58. **Diagnostic par corde** = index de corde, **tous accordages confondus**, avec un nom affiché en accordage standard. **[HYP fragile]** : deux accordages différents dans le même compteur.

**Prises en phase 2 (seconde passe)**
59. **Grille rythmique = un temps par trou**, en mesures entières de 4/4, 30-120 BPM (50 par défaut), tolérance **0,3 s** (un dixième de temps) ; la grille est un **score de silences** joué par le métronome de la 1c, donc **aucune note n'est jouée** (D31). Le chrono repart du lancement de la grille.
60. **Session mélangée** : 5 formes au maximum, **dues d'abord** puis maîtrise croissante, **alternance gamme × système**, niveau N3 si la boîte ≥ 3 (D32). La file est recalculée à chaque démarrage depuis le journal.
61. **Le N3 pèse 1,5 et le N2 pèse 1** dans la moyenne récente de maîtrise (D33). À scores égaux, la pondération ne change rien (testé) : elle ne joue que lorsque les niveaux diffèrent.
62. **Taux de trous 20 / 35 / 50 %** (défaut 35) et **tempo de grille réglables** dans Réglages ; au moins 2 trous et jamais toute la position quel que soit le taux (D33).

**Hypothèses les plus fragiles** (ce qui pourrait encore bouger — rien n'est verrouillé) :
**Hypothèses les plus fragiles** (ce qui pourrait encore bouger — rien n'est verrouillé) :
- **32-35 et 38** (vélocité de base, strum, tenue, humanisation, niveaux) sont réglées **par calcul et par mesure, pas par écoute** : un ajustement à ton oreille est probable, et c'est normal.
- **22** (CAGED maison, D12) : définition non comparée à une source ; ta relecture de Do, Sol, La conditionne son exposition.
- **15** (difficultés 1-5 des voicings) : heuristique non calibrée, à corriger avec des données réelles en phase 4.
- **18** (mode parent à 7 altérations) : **traité en 1d** — l'UI l'affiche comme une information (« couleur à écouter, pas une tonalité jouable »).
- **42** (objectif de 3 activités) et **46** (doigtés heuristiques) : réglés par raisonnement, pas par usage réel ; à revoir après quelques sessions.
- **52** (intervalles de Leitner et seuils 80 %/2 jours) : ce sont les valeurs classiques, **non calibrées sur un vrai débutant**. Un élève qui rate trois soirs de suite sort de « en apprentissage » sans progression visible : à mesurer.
- **55-56** (35 % de trous, révélation à la 2ᵉ erreur) : choix de prof, pas de mesure. Le bon chiffre dépend de la forme (une box à 2 notes par corde se lit, une position 3NPS de 18 notes non).
- **58** (diagnostic par corde) : index de corde seul, accordages mélangés — honnête pour le standard, faux dès qu'on change d'accordage.
- **50** (localStorage) : quota et purge iOS non testés sur un vrai appareil ; la perte silencieuse d'une écriture (quota plein) n'a pas d'alerte dans l'UI.
- **59** (grille) : un temps par trou est une convention, pas une mesure ; à 50 BPM, 4,8 s pour 2 trous est atteignable au pavé mais ne dit rien des doigts. Le bon tempo reste à ton oreille.
- **61** (poids 1,5 du N3) : choix de prof, non calibré sur des journaux réels ; il suppose que le N3 est plus difficile que le N2, ce qui est vrai sur une 3NPS et discutable sur une box à 4 notes.
- **60** (ordre de la session) : déterministe pour être testable ; un tirage aléatoire serait plus varié à l'usage.
- **Composition du poster** (soleil à 26 % de la largeur, titre hors du disque) : calibrée pour 390×844 ; à revoir sur un vrai téléphone en portrait étroit (360 px) et en paysage.

---

## 8 bis. Ce qui a changé depuis la phase 0 (rappel, pour ne pas relire tout)

| Point | Phase 0 | Aujourd'hui |
|---|---|---|
| Échantillons | `tonejs-instruments` (CC BY, licences à vérifier) | deux banques **CC0** mesurées (D14) |
| Chargement audio | à la première lecture | **au démarrage**, avec écran de chargement (D15) |
| Phase 1 | 1a / 1b / 1c | 1a / 1b / 1c (audio) + **1d** (écrans, D18) |
| Progression | journal d'écoute local, hub sans XP | **journal de tentatives** + maîtrise + Leitner + XP plafonné + badges (phase 2) |
| Persistance | « localStorage/IndexedDB » (brief) | **localStorage plafonné** (D25) ; IndexedDB différée |
| Niveaux Gammes | N1 seul | **N1 (écoute) + N2 (trous) + N3 (rappel)** |
| Rythme dans les exercices | absent | **grille rythmique** (un temps par trou, ★★ conditionné) |
| Ordre des exercices | une forme, puis retour au hub | **session mélangée** de 5 formes différentes |
| Boîte d'accord | à trancher | **D1 = B** (Découvrir/Construire) |
| Feuille de route | « son final + hub + thème + module » en 1c | 1c = audio seul ; les écrans en 1d |

---

## 9. Plan des phases (affiné)

| Phase | Contenu | « Terminé » = |
|---|---|---|
| **1a** ✔ `5797333` | Moteur de théorie (gammes, accords, orthographe, enharmoniques, conversion solfège), accordages/nb de cordes, base de voicings + tests | Tous les tests de `MUSIC_DESIGN.md` verts ; couverture des 13+13 tonalités — **atteint** (61 tests) |
| **1b** ✔ `823fbbd` | Positions (3NPS, boxes, CAGED, symétriques, blues, bebop), `TabScore`, générateurs, layout, police bitmap, rendu pixel, curseur synchronisé sur Tone.Transport (son provisoire) | Captures lisibles à S=2 sur 390×844 ; chiffres à 2 chiffres nets ; piles d'accords nettes ; 7 cordes, solfège / anglo, Drop D ; daltonisme ; coût de rendu — **atteint** (204 tests, mesures dans « État exact ») |
| **1c** ✔ `971be8c` | Moteur audio de sortie : échantillons CC0 (nylon, électrique) + repli synthèse, choix/couches/round-robin, bus master (compresseur + plafond), drone, métronome, volumes mémorisés, préchargement, page Audio | « Son = tablature » vérifié (6 types de score), drone, métronome, plafond tenu, page Audio — **atteint** (274 tests, mesures dans « État exact ») |
| **1d** ✔ (commit en fin de phase) | Hub + routeur par hash, thème Synthwave (tokens, scène, parallaxe, scanlines), module Gammes N1 (sélection, annotations, calque d'accord), positions CAGED / 3NPS / boxes, réglages globaux, journal de pratique local | Choisir une gamme, la voir et l'entendre avec le son final ; captures 390×844 **et** 1440×900 — **atteint** (314 tests, mesures dans « État exact ») |
| **2** ✔ `d76e78a` + `3a9e049` | Journal de tentatives, maîtrise par forme, Leitner 6 boîtes, XP/série/badges, Gammes N2 (trous) et N3 (rappel) avec pavé numérique, diagnostic par corde, transposition suggérée, export/import JSON, **grille rythmique (★★ au tempo)**, **session mélangée (interleaving)**, **pondération N3 et taux de trous réglable** | Faire une série de trous, voir la maîtrise bouger, fermer l'onglet et retrouver son état ; grille tenue/manquée distinguée ; session de 5 formes enchaînée ; export/import vérifié — **atteint** (371 tests, mesures dans « État exact ») |
| 3 | Entrée mono, calibration, accordeur, affichage live | Test sur guitare réelle |
| 4 | Accords A : curriculum, tab accords, leçon guidée, QCM/auto-éval, validation arpège, recommandation | Parcours P0-P4 jouable |
| 5 | Polyphonique, onset, timing, transitions | Résultats chiffrés publiés |
| 6 | Défi Accords, strumming, familles d'accords, harmonisation | Setlist complète |
| 7 | Improvisation + backing tracks + classification | Synthwave + Lo-fi jouables |
| 8 | Thèmes, ear training, dashboard, badges, PWA, polish | — |
À chaque phase : l'app tourne (`npm run dev`), code typé, tests unitaires ; captures d'écran ; bilan en fin de phase + 3 à 5 propositions pédagogiques.

---

## 10. Décisions

| # | Décision | Prise |
|---|---|---|
| D1 | Boîte d'accord | **B** : boîte uniquement aux étapes Découvrir/Construire du module Accords, désactivable (non implémentée avant la phase 4) |
| D2 | Ordre des gammes | **Pentatonique mineure d'abord** |
| D3 | Curriculum Accords révisé | **Accepté** (P1 Em/Em7/Asus2/Am7 ; Am en P2 ; C et G en P4 avec marchepieds) |
| D4 | Power chords | **Branche optionnelle dès P2** |
| D5 | Critères « appris » | **3 arpèges vérifiés sur ≥ 2 jours + rappel à froid** (seuils réglables) |
| D6 | Modules | **`Fondations` ajouté, `Rythmique` déclaré** |
| D7 | Échantillons | **`tonejs-instruments` (CC BY 3.0, attribution) + Karplus-Strong** ; à revoir si la qualité est insuffisante (licences non vérifiées : *à vérifier* avant embarquement) → **remplacée en 1c par D14** |
| D8 | Affichage des accords | **`Am7` (anglo)** — *changé par toi* (ma reco était `Lam7`) ; solfège/jazz en option |
| D9 | Solveur de voicings (accordages alternatifs) | **Plus tard**, après P4 |
| D10 | Phase 1 | **Découpée en 1a / 1b / 1c**, puis le reste en 1d (D18) |
| D11 | Numérotation des positions (1b) | **Par degré de départ** (Position 1 = la tonique, même forme dans toutes les tonalités) ; les cases sont toujours affichées ; l'écran du module (1d) pourra trier par cases |
| D12 | Définition de CAGED (1b) | **Fenêtre de 5 cases autour de la forme d'accord** (générique). **Condition : tu relis 3 tonalités (Do, Sol, La) avant que le module Gammes (1d) expose CAGED dans l'UI** |
| D13 | Daltonisme : « aide daltonisme » (1b) | **Écartée** : pas de réglage dédié ; forme de la fondamentale, encoche ♭/♯ et rangée de degrés optionnelle restent les seules aides (limite assumée, `MUSIC_DESIGN.md` §2.1) |
| D14 | Échantillons (1c) | **Deux banques CC0** : FreePats « Spanish Classical Guitar » (nylon, défaut) + Karoryfer « Emilyguitar » (électrique direct) ; `tonejs-instruments` **écartée** (chaîne de licences invérifiable) ; repli Karplus-Strong conservé. Attribution affichée bien que non obligatoire |
| D15 | Chargement de Tone (1c) | **Au démarrage** (préchargement), et non au premier « Lecture » : +79,4 ko gzip avant l'écran d'accueil, en échange d'une lecture instantanée ensuite |
| D16 | Échec de chargement (1c) | **Écran d'erreur avec « Réessayer » et « Continuer sans le son »** : jamais de blocage de l'app |
| D17 | Règles de jeu (1c) | **Tenue automatique par type de score** (fin de mesure pour accords/progressions, legato pour arpèges, étouffé pour gammes), **humanisation déterministe**, couche de vélocité choisie **par événement** |
| D18 | Découpage du reste de la 1c | **Tranchée** : 1c = moteur audio ; **1d = hub + thème + module Gammes N1** (livrée) |
| D19 | Grille de la scène (1d) | **Pas de rayons verticaux** : à 195 px logiques, ils convergent en hachure. Horizontales animées seules. Deux variantes de décor : `poster` (hub) et `calm` (écrans de travail) |
| D20 | Doigtés de position (1d) | **Heuristique par corde** (index sur la note la plus basse, auriculaire sur la plus haute, 1-2-4 / 1-3-4 à trois notes), testée sur toutes les positions ; **aucun doigté** au-delà de 4 notes par corde. Non relue position par position |
| D21 | Où vivent les tokens | **En TypeScript** (`core/themes/*.ts`), posés en variables CSS par `applyTheme` : un thème = un fichier, testable (contrastes) et sans hex dupliqués dans le CSS |
| D22 | Progression en 1d | **Journal d'écoute local seulement** (gamme, tonique, système, position, secondes, plafond 400). **Pas de XP, pas de série, pas de compteur décoratif** : ces chiffres arrivent avec la répétition espacée (phase 2) |
| D23 | Notes de l'accord superposables | **Calque qui estompe les notes étrangères** (mélange avec le panneau, jamais d'alpha), activable en N1 ; sur La m pent + Am7, seules les 4tes s'effacent |
| D24 | Typographie (1d) | **Silkscreen** (capitales épaisses) pour les étiquettes de panneau, badges, tags et onglets ; **sans-serif système** pour les titres, le texte, les boutons et les segments ; Press Start 2P pour le mot-symbole seul. Une police pixel à 10-23 px perd ses accents et sa hauteur d'x : l'identité passe par le décor et la tablature bitmap, pas par le paragraphe (MUSIC_DESIGN §12.1) |
| D25 | Où vit le journal de progression (2) | **localStorage, `fretwave.attempts.v1`, plafond 2 000** (≈ 380 ko mesurés), migration unique du journal d'écoute de la 1d. **IndexedDB écartée** : la contrainte du brief est « localStorage/IndexedDB », le gain d'un `idb` asynchrone ne paie pas pour 2 000 événements, et la purge iOS vise IndexedDB. À rouvrir en phase 3 (entrée audio = beaucoup plus d'événements) |
| D26 | Modèle de maîtrise et de révision (2) | **Leitner 6 boîtes** (10 min / 1 / 3 / 7 / 16 / 35 j), gigue déterministe, échec −2, plafond 8 cartes dues. « Apprise » = 2 réussites ≥ 80 % sur **2 jours distincts** ; « maîtrisée » = apprise + boîte ≥ 5 + dernière tentative réussie |
| D27 | XP, série (2) | **XP seulement sur les exercices vérifiés** (10 / 15 × précision, +5 à ≥ 95 %), **plafond 120/jour** ; une écoute vaut 0 XP mais compte pour la série ; série = jours consécutifs, vivante si la veille compte |
| D28 | Identité d'un nœud de progression (2) | **Forme × mode × système**, indépendante de la tonique (`formIndex`) : une forme se révise une fois, la tonique est une preuve séparée qui déclenche la proposition de transposition |
| D29 | Niveaux 2 et 3 (2) | N2 : ~35 % de trous, **min 2, jamais toutes** ; N3 : tout. Cinq découpages par cordes ; **révélation après 2 erreurs** (comptée fausse) ; tentative enregistrée une fois la série finie, avec les trous justes **au premier essai** |
| D30 | Diagnostic par corde (2) | `Attempt.missedStrings` (index de corde) plutôt qu'un journal de chaque réponse : même valeur pédagogique, 20 fois moins d'octets. Nom affiché en accordage standard, limite documentée |

| D31 | Grille rythmique (2, seconde passe) | **Un temps par trou**, mesures entières de 4/4, 30-120 BPM, tolérance 0,3 s ; jouée par le **métronome sur un score de silences** (aucune note, donc aucune réponse donnée) ; grille manquée = ★ au mieux, jamais 0 si la précision est bonne |
| D32 | Session mélangée (2, seconde passe) | **3 à 5 formes différentes** (5 en dur), dues d'abord, puis maîtrise croissante, **alternance gamme × système**, N3 si boîte ≥ 3 ; bilan de session (formes, précision moyenne, XP) ; file recalculée à chaque démarrage |
| D33 | Pondération et réglages d'exercice (2, seconde passe) | **N3 pèse 1,5 / N2 pèse 1** dans la moyenne récente ; **taux de trous 20/35/50 %** (défaut 35, min 2, jamais toutes) et **tempo de grille** réglables et mémorisés |

| D34 | Surfaces et contraste (2, correction) | **Aucune carte translucide** : panneau = `surface`, carte = `surface-hi`, creux = `bg` ; les sections du hub posées à même le décor (Par où commencer, Badges, Modules, Le code couleur) deviennent des **panneaux** ; `muted` #C4B6E4 (≥ 7:1) et `dim` #A99BCF (≥ 5,5:1) ; titre de module en `text` + filet d'accent. Mesuré : contraste minimum 5,2:1 sur 207 textes, rangées du hub alignées |

**D1-D34 tranchées** (D13 écartée ; D7 remplacée par D14 ; D18 tranchée ; **D24 = la typographie de la 1d**, ajoutée au journal). **Aucune décision en attente** : la suite (phase 3) est décrite au §12.

---

## 11. Journal d'avancement

- **Phase 0** (terminée, commit `183eacc`) : lecture complète de `BRIEF.md` (40 513 octets) ; versions/licences de paquets vérifiées via `npm view` ; calculs de fenêtres FFT, harmoniques et périodes ; vérification par script de 43 voicings et 10 formes mobiles (0 erreur) ; rédaction de `PROJECT.md` et `MUSIC_DESIGN.md`. Validée par l'utilisateur : D1-D10 acceptées, **D8 changée en `Am7`**.
- **Phase 1a** (terminée, commit `5797333`) : projet Vite + React + TypeScript + Vitest ; moteur de théorie, base de voicings et page de contrôle (détail dans « État exact »). 61 tests verts, `tsc` propre, build OK, rendu vérifié dans un navigateur. Corrections de la documentation trouvées par les tests : règle de coût d'orthographe « coût égal → les deux » ; `dim` = triade / `dim7` à part.
- **Phase 1b** (terminée, commit `823fbbd`, validée : D11 et D12 acceptées, D13 écartée) : positions, `TabScore`, générateurs, layout, police, rendu, lecteur Tone, page de contrôle (détail dans « État exact »). 204 tests verts, `tsc` propre, build OK. Vérifié dans Chromium piloté par CDP à 3 viewports : lecture, boucle, tempo en direct, curseur exact au pixel, défilement et retour à la ligne, DPR 2,625. **Trouvé en route** : (1) `transport.stop(time)` dans l'événement de fin rejoue le tick 0 (une note parasite) → arrêt par minuterie ; (2) contraste chiffre / pastille insuffisant sur les couleurs de bémols (3,6-4,0) → chiffre blanc automatique ; (3) les tests ont corrigé `MUSIC_DESIGN.md` §3.2 (box 3 de La m = cases 9-13) ; (4) onglet de test masqué : `requestAnimationFrame` s'arrête (le curseur ne bouge pas) — sans effet pour l'utilisateur, mais le banc de mesure doit mettre la page au premier plan ; (5) simulation de daltonisme : voir D13.
- **Phase 1c** (terminée, commit `971be8c` ; échantillons compris, 12,1 Mo) : moteur audio de sortie seul (périmètre redéfini par toi) — détail dans « État exact ». 274 tests verts, `tsc` propre, build OK. Vérifié dans Chromium piloté par CDP (390×844 @3) : chargement (48 puis 90 fichiers), son = tablature sur 6 types de score, curseur 639,6 ticks/s (résidu 1,1 tick hors démarrage), métronome 18 clics / 10 s, drone activé et coupé en pause, boucle sans doublon, matrice de clics sur sinus de contrôle, erreur réseau puis « Réessayer », plafond tenu sur un strum extrême (−1,2 dBFS). **Trouvé en route** : 6 défauts (clic à la reprise de corde, rappel d'événement en double par Tone, couche de vélocité qui basculait, limiteur qui laissait passer +2,2 dBFS, écart de 6-7 dB entre banques, Tone chargé trop tard), tous corrigés par un test ou une mesure. **Non vérifié** : le timbre (pas d'écoute), Safari/iOS, téléphone réel, latence acoustique.
- **Phase 1d** (terminée, commit en fin de phase) : thème par tokens, scène pixel (poster/calm), polices auto-hébergées, hub, réglages, routeur par hash, sélection de gamme, N1 Découverte, doigtés, calque d'accord, journal de pratique — détail dans « État exact ». **314 tests** (313 verts, 1 ignoré), `tsc` propre, build OK. **Trouvé en route, corrigé** : (1) la légende marquait **toutes** les fonctions comme « caractéristique » (jeu de degrés complet au lieu des seules notes du mode) ; (2) la signature rythmique était dessinée **au milieu des cordes** en gros chiffres → petite, en tête de portée ; (3) le calque d'accord était calculé mais **invisible** (estompage à 55 % → 78 %) ; (4) **deux serveurs Vite** sur le même port servaient un CSS périmé (cause des « mes modifications ne s'appliquent pas ») ; (5) le soleil passait **derrière le titre** sur grand écran (rayon borné par la hauteur) ; (6) la grille en rayons verticaux faisait une **hachure** à 195 px logiques → horizontales seules ; (7) la barre de navigation s'étalait sur 1 440 px → bornée à 620 px et centrée ; (8) `degreeName` recevait des glyphes (« ♭3 ») et renvoyait « ♭3 » au lieu de « tierce mineure » → normalisation ASCII ; (9) la mise en évidence de l'exercice ne s'appliquait pas (comparaison `b7` vs `♭7`) → cibles en ASCII, affichage en glyphes ; (10) le crochet de vérification `__fretwave` était écrasé par les tablatures de comparaison → seule l'instance qui joue l'installe. **Non vérifié** : le timbre (pas d'écoute), Safari/iOS, vrai téléphone, latence acoustique.
- **Mise à jour d'état (après le commit)** : ligne Git et santé du dépôt, bloc « Repères » en tête, §0 et §1 (décisions désormais tranchées : boîte d'accord D1, échantillons D14, découpage 1d), R10, D10-D12 (l'écran des positions et CAGED passent en 1d), « hypothèses les plus fragiles » et tableau « ce qui a changé depuis la phase 0 ».
- **Phase 2** (terminée, commit `d76e78a`, seconde passe dans la même phase) : journal de tentatives, maîtrise par forme, Leitner 6 boîtes, XP/série/badges, niveaux 2 et 3 (trous, rappel) avec pavé numérique, diagnostic par corde, transposition suggérée, export/import — détail dans « État exact ». **359 tests** (358 verts, 1 ignoré) à la première passe, **371** après la seconde, `tsc` propre, build OK. Vérifié dans Chromium (390×844 @3, 1440×900 @1) : trou touché au clic réel, pavé, validation, série terminée, tentative écrite, rechargement, hub à jour ; révision qui rouvre la bonne position ; export → import → réimport sans doublon ; écoute du niveau 1 journalisée sans XP. **Trouvé en route, corrigé** : (1) un exercice à **1 trou** (35 % de 4 notes = 1,4) ne testait rien → minimum 2 trous, jamais tous ; (2) le libellé du pavé affichait **la fonction de la note** visée (« tierce mineure ») — c'est-à-dire une partie de la réponse → retiré ; (3) le pavé sortait de l'écran dès qu'on lisait la tablature sur téléphone → panneau collant sous 900 px ; (4) le résultat annonçait « 0 XP : il faut 80 % » alors que l'XP est proportionnel (60 % = 6 XP) → texte corrigé ; (5) un exercice masqué gardait son **annotation** dans le modèle de layout (le rendu la supprimait, le test non) → vérifié par test pixel. **Non vérifié** : timbre, Safari/iOS, vrai téléphone, latence ; claviers physiques testés par événement DOM, pas par frappe CDP.
- **Phase 2 — seconde passe** (commit `3a9e049` ; tes trois propositions, livrées dans la même phase) : grille rythmique (métronome sur score de silences, ★★/★★★ conditionnés), session mélangée (file calculée, enchaînement, bilan), pondération N3 (1,5) et taux de trous réglable (20/35/50 %) + tempo mémorisé. **371 tests** (370 verts, 1 ignoré), `tsc` propre, build OK. Vérifié au navigateur : 4 clics / 4,8 s puis `grid: "over"`, série en 1 s → `tempoOk: true` et ★★★ ; grille manquée → ★ et `tempoOk: false` ; session de 5 formes enchaînées et bilan « 5 formes · 100 % · 75 XP » ; taux 20 % → 4 trous sur 18 notes, 50 % → 3 sur 6. **Trouvé en route, corrigé** : (1) la grille ne relançait pas le chrono (une grille abandonnée comptait dans la tentative : 19 s pour une série de 1 s) ; (2) le bilan de session affichait **3 formes sur 4** et 45 XP — le résumé remplaçait le résultat de la dernière forme avant son agrégation → accumulateur en `ref`, bilan au dernier clic ; (3) la session mélangée ne démarrait pas depuis l'URL : React réutilisait l'instance de l'écran d'entraînement → **clés distinctes** dans le routeur ; (4) la grille exige un **geste réel** (AudioContext) : un appel de fonction depuis le crochet de dev ne démarre rien — la vérification passe par un clic souris ; (5) une hypothèse de test fausse sur la pondération (à scores égaux, le poids ne se voit pas) → test corrigé, pas le code.
- **Correction de lisibilité** (ta remarque : « les cartes n'ont pas de fond, le contraste est vraiment faible ») : les quatre sections du hub (**Par où commencer, Badges, Modules, Le code couleur**) étaient posées **à même le décor**, sans panneau ; plusieurs cartes étaient **translucides** (`rgba(…, 0.5-0.72)`) ou de la **même couleur que leur panneau** (touches du pavé, cartes de module, lignes de liste), donc invisibles en tant que cartes ; le texte secondaire (`--dim`) tombait à **4,6:1** sur une carte. Corrigé (D34) : panneaux partout, cartes en `surface-hi` opaque, creux en `bg`, `muted`/`dim` éclaircis, seuils relevés dans `theme.test.ts`, titre de module en `text` + filet d'accent, colonne de gauche tendue à la hauteur de sa rangée. Vérifié au navigateur : contraste minimum **5,2:1** (207 textes sur quatre écrans), aucun sous 4,5, rangées alignées. **Trouvé en route** : le serveur Vite de la session servait un **CSS périmé** (le fichier sur disque était bon, la feuille servie gardait `--accent` sur les titres de module) → serveur redémarré ; `curl http://127.0.0.1:5173/src/app/app.css` le montre en une commande (même piège qu'en 1d).
- **Mise à jour de ce document (après la 2)** : « État exact » (bloc 2 + rappel 1d), hypothèses 50-62 et fragiles, §8 bis (progression, persistance, rythme, session), §3.8 (persistance révisée), §4.1 (arborescence `progress/`), §4.3 (stores), plan (2 ✔ + seconde passe), décisions **D24-D33** (D25 écarte IndexedDB), journal (défauts trouvés), §12 « Prochaine étape » réécrite pour la phase 3.
- **Mise à jour de ce document (après 1c)** : « État exact » (bloc 1c, mesures, pas fait, écarts), §3.1 (outils de build), §3.5 (échantillons et échantillonneur maison), §4.1 (arborescence), §4.7 (pipeline tel que construit), R4 et R12 (traités / mesurés), hypothèses 31-41, plan (1c fait, 1d proposée), décisions **D14-D18** (D7 remplacée), journal, §12 « Prochaine étape ».

---

## 12. Prochaine étape : phase 3 (entrée audio monophonique, calibration, accordeur)

**Objectif** : faire passer la validation de la **saisie au pavé** à la **guitare réelle** — une note isolée, puis une corde d'accord, avec un diagnostic par corde.

**Livrables**
1. `getUserMedia` avec choix du périphérique, `echoCancellation/noiseSuppression/autoGainControl` désactivés, plage de détection **dérivée de l'accordage** (E2 82,41 Hz → ~73 Hz en Drop D, ~62 Hz pour un Si1 de 7 cordes, haut de plage à la case 24).
2. `pitchy` (McLeod) dans un AudioWorklet, note + écart en cents, **désambiguïsation corde/case** selon la position active (une hauteur existe à plusieurs endroits).
3. Écran de calibration (niveau d'entrée, seuil de bruit, latence mesurée) + accordeur ; réglages séparés micro / interface USB.
4. **Validation d'une corde** dans les niveaux 2-3 : le pavé devient un secours, la note détectée remplit le trou — la tentative enregistrée garde le même format (`kind`, `correct`, `total`, `missedStrings`).
5. Gestion propre : permission refusée, aucun périphérique, note qui s'éteint, bend/vibrato, mode casque recommandé.

**« Terminé » =** jouer quelques notes d'une position sur une vraie guitare et voir la tablature se remplir correctement, avec un diagnostic par corde et une tentative journalisée ; calibration et accordeur vérifiés sur au moins deux sources (micro intégré, interface USB).

**Points à surveiller** : octave fausse sur les deux cordes graves au micro de téléphone (peu d'énergie < 100 Hz), latence acoustique **non mesurable** sans micro de référence, et un journal qui grossit vite (rouvrir D25 : IndexedDB probable).

**Dette technique assumée à reprendre** : doigtés non relus position par position, vue manche optionnelle (attend un accord explicite), page « Progression » (heatmap), tempo/rythmique dans les exercices, `#/tab` encore en page de contrôle.
