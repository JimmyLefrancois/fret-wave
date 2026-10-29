# PROJECT.md — Fretwave (nom de travail) : apprendre la guitare, en tablature, en pixel art

**Statut : phases 0, 1a, 1b, 1c, 1d, 2, 3, 4a et 4b terminées, **refonte d'interface terminée et mergée sur `master`**, déploiement GitHub Pages câblé, **phase 5 : écoute polyphonique livrée** (accord plaqué écouté, matrice publiée), **phase 7 : improvisation livrée** (accompagnements synthwave et lo-fi, classification harmonique, notes allumées sur la position), **lot « mémoire et vitesse » (module Gammes) livré sur la branche `gammes/memoire-vitesse`, à merger** (rappel à froid, « apprise » sur la position entière, série à l'aveugle, séquences au palier, aller-retour par défaut) · 4b = module Accords, partie B : les **sept étapes** du cycle du brief sont là (Découvrir → Construire → Vérifier → Plaquer → **Fixer** (pose à froid chronométrée) → **Enchaîner** (changement mesuré entre deux notes repères) → **Intégrer** (progression + strum)), plus le **QCM sans matériel**, l'**accordage guidé corde par corde** et les paliers **P5-P7** (couleurs, slash, Fa et Si m) · « appris » exige enfin une pose à froid · **tour complet des pages** (19 écrans, largeurs et alignements mesurés) · D1-D77 tranchées (D13 écartée, D7 remplacée par D14) · aucune décision en attente · **606 tests (605 verts, 1 ignoré)**.**
Documents liés : `BRIEF.md` (cahier des charges), `MUSIC_DESIGN.md` (conventions musicales, curriculum, avis de prof).
**Repères** : *État exact* juste en dessous · **hypothèses** §8 (1-88) et §8 bis (ce qui a changé) → `docs/HYPOTHESES.md` · **plan des phases** §9 · **propositions pédagogiques placées** §9.1 (phase 3) et §9.2 (phase 5) · **décisions** §10 (D1-D94) → `docs/DECISIONS.md` · **prochaine étape** §12. Pages de l'app (hash) : `#/hub`, `#/gammes`, `#/gammes/jouer`, `#/gammes/entrainement`, `#/gammes/revision`, `#/gammes/impro`, `#/accords`, `#/accords/lecon`, `#/accords/qcm`, `#/accordeur`, `#/reglages`, plus les outils de contrôle `#/tab`, `#/audio`, `#/theorie` (la page « Son » a quitté la barre de navigation en phase 3 : elle reste joignable depuis les réglages). `npm run dev` → http://localhost:5173/ (un seul serveur à la fois : deux instances Vite sur le même port servent une version périmée du CSS).
Légende : **[HYP]** hypothèse prise sans te bloquer · **[À TRANCHER]** décision qui t'appartient · **[RISQUE]** voir section 7.

**Correspondance des sections déplacées** : §1-7 → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · §8 et §8 bis → [`docs/HYPOTHESES.md`](docs/HYPOTHESES.md) · §10 → [`docs/DECISIONS.md`](docs/DECISIONS.md) · §11 → [`docs/archive/JOURNAL.md`](docs/archive/JOURNAL.md) · états exacts des phases 1c à 4a et de la refonte d'interface → [`docs/archive/PHASES.md`](docs/archive/PHASES.md) · §9 et §12 restent ici.
---


## État exact du lot « mémoire et vitesse » (branche `gammes/memoire-vitesse`, module Gammes)

**Pourquoi** : ton signalement — une forme devenait « apprise » sans jouer la gamme entière. Vérifié dans le code : le nœud `gam:lecture:*` ignorait le segment et le niveau ; deux séries par défaut (2 cordes, N2 à 35 % ≈ **2 trous**) sur deux jours suffisaient ; la révision restait en N2 sous la boîte 3 et sur 2 cordes. Principe du lot : **un essai fait juste après avoir vu la réponse ne prouve rien ; ce qui prouve, c'est le rappel à froid et le geste joué à tempo.**

**Git** : branche `gammes/memoire-vitesse`, **poussée sur `origin`** (le déploiement GitHub Pages ne part que de `master`) — lot : `7f9ddce` rappel à froid · `7a1f87e` apprise/maîtrisée · `fb8b51e` série à l'aveugle · `4c6dd83` séquences + docs · `6d78237` aller-retour par défaut ; puis **12 commits de passe de design** (`f1ebae5` → `67b204a`, voir ci-dessous). **À la dernière mesure : 707 tests (706 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK** — `index` **653,3 ko (207,1 ko gzip)**, CSS **60,7 ko (12,3 ko gzip)**.

**Fait et vérifié**
1. **Rappel à froid des cartes dues** (`review.ts`, `coldReview.ts`, D87) : N3 sur la position entière en aller-retour, sans annotation ni légende ni « Écouter d'abord » ; seul cet essai compte. Sous 80 % : « Regarde la forme » (10/20/30 s, défaut 20) puis rattrapage `afterReveal` (pratique du jour, hors Leitner/maîtrise/XP, sans étoiles). « Passer » à chaque étape. Réglages `coldReview` (activé) et `lookSeconds`. Correctif au passage : une prise d'impro servait de « dernière tentative » d'une forme en révision.
2. **« Apprise » / « maîtrisée » plus exigeantes** (`mastery.ts`, D85, D86, D88) : réussite **forte** exigée (position entière, N3 ou N2 au micro) ; vitesse `speedVerified` (N3 au micro propre, grille tenue à 2 × cible notes/min, ou séquence validée) ; « maîtrisée (vitesse non vérifiée) » sinon. Journal : `mic`, `fullPosition`, `gridNpm`, `blind`, `afterReveal` (optionnels, lecture tolérante). Grille en **croches** et borne **200 BPM** ; tempo cible réglable (80 BPM en croches). Le **hub annonce les formes repassées en apprentissage** ; l'exercice dit **ce qui manque** pour « apprise ».
3. **Série à l'aveugle** (`blind.ts`) : option du N3 active seulement micro ouvert ; **aucune tablature montée** pendant la série (0 canvas mesuré), décompte d'une mesure, niveau d'entrée, Terminer ; verdict d'un coup à la fin.
4. **Séquences avec palier** (`sequenceToScore`, `sequence.ts`, `SequencePage.tsx`, `#/gammes/sequences`, D84, D90) : par 3, par 4, tierces, quartes ; passe jugée en justesse **et en place** ; +4 / −5 / plancher au départ / 40-200 ; une tentative par session ; sans micro, tempo manuel non vérifié. Liens depuis l'écoute et l'entraînement.
5. **Aller-retour par défaut** (D91, ta demande) : l'écran d'exercice, la révision ordinaire et le rappel à froid ouvrent sur la position entière, montée puis descente — sur la box 1, le N2 pose 8 trous sur 23 notes (2 sur 4 auparavant). Les segments 1/2/3 cordes et « montée » restent dans les réglages de la série, pour s'échauffer.

**Passe de design du module (deux critiques Impeccable : 22/40 puis 27/40, archivées dans `.impeccable/critique/`)**
1. **Bugs** : la légende « Couleurs = fonctions » et `TabLegend` peignaient tout degré altéré (♭3, ♭7, ♯4…) en gris de secours (`legendFor` passait le glyphe « ♭3 » à `intervalStyle`) ; le nom accessible du canvas énumérait les notes des trous (réponses du N3 lues au lecteur d'écran → `describeScore`, trous lus « ? ») ; hooks appelés après un `return` anticipé ; chrono « -1:-2 ».
2. **Entraînement** : premier trou présélectionné, flèches ← → entre trous ; verdict en 20 px **sous la tablature** (✓/✕) ; micro + pavé réunis dans « Réponse » ; cases révélées sans être trouvées en **contour pointillé** + résumé par corde ; **fin de série ratée = écran calme** (D92) et le résultat **remplace** le pavé, prend le focus, Entrée rejoue ; « Nouvelle série » jamais en action principale ; barème replié dans « Comment c'est noté ? » (texte inchangé).
3. **Téléphone** : **barre de réponse fixe** au-dessus de la navigation (corde visée, chiffres, ✓/✕, pavé 6×2) — tablature et réponse à l'écran ensemble ; le pavé du panneau y est masqué.
4. **Séquences** : bandeau au-dessus de la tablature (tempo en grand, décompte, verdict de passe, palier ↑ +4 / ↓ −5, bouton). **Jouer** : « Montre-moi la note » à côté de « M'écouter ». **Impro** : titre de page, micro avant Démarrer.
5. **Texte et typo** : « fondamentale » (au lieu de « unisson juste »), « Position 2 » (au lieu de « Box 2 »), « à revoir · palier 1 sur 6 » (au lieu de « due · boîte »), « Série tenue » seulement grille tenue (D93) ; erreur micro en français ; consignes, question du quiz, formules, compteurs, tempo et touches du pavé en texte courant (plus de pixel 11 px pour ce qui se lit en jouant) ; un seul halo d'accent par écran ; 2 hex retirés d'`app.css`.
6. **Troisième critique (28/40)** : une seule suite principale après un résultat (`nextStepFor`, D94) — la même sur l'écran de fin et le panneau, « Changer de gamme » / « Accueil » en liens ; texte du verdict dans la barre de réponse du téléphone (~1,6 s) ; consigne « Corde de La · case ? » en 30 px sous la tablature (place réservée, plus de saut du pavé), pavé replié en « Pavé de secours » micro ouvert ; Jouer : tablature en tête (ordre du DOM) et « S'exercer / Improviser / Séquences » sur une ligne (libellés longs en `title` + `aria-label`, vérifiés de 320 à 1 280 px). **Échelle 3 de la tablature** : prop `minScale`, appliquée seulement sur écran ≥ 880 × 1 100 px — à 1 280 × 800 elle chasse consigne et réponse sous la ligne de flottaison (mesuré), donc **pas appliquée sur un écran courant**.
7. **Non fait** : statut par position sur la sélection, signal sonore au palier, tailles de police hors échelle d'`app.css` (39, tout le site), rebonds de la célébration. `tools/mic-check.mjs` lit le verdict dans `.verdict` (non relancé).

**Trouvé en route, corrigé**
1. **Le masque des clics effaçait les notes jouées sur le temps** (D89) — mesuré au micro simulé, 3 / 12 perdues à 60 BPM ; masque désormais par temps **et** hauteur du clic → 12 / 12. Le défaut existait depuis la phase 3 sur la grille N3 au micro.
2. Une étiquette de séquence trop longue était coupée à 390 px → étiquette courte, la position reste dans l'en-tête.
3. Un rattrapage affichait ★★★ → pas d'étoiles sur ce qui ne prouve rien (§17.1).

**Mesures**
- **Mise en page** (`tools/tour-check.mjs`, 390 × 844 et 1 440 × 900, 21 pages dont `#/gammes/sequences`) : **aucun débordement**, **aucun texte < 11 px**, **aucune erreur console**. Les états hors tour (« Regarde la forme », série à l'aveugle, résultat) ont été capturés à 390 px.
- **Navigateur** (`tools/memoire-vitesse-check.mjs`) : carte due → N3 position entière en aller-retour « à froid » ; tout faux → « Regarde la forme » → rattrapage 23/23 écrit `afterReveal: true`, 0 XP, aucune fête ; hub « 1 forme repassée en apprentissage » ; ligne d'état « en apprentissage » sur l'exercice ; journal vide → l'exercice s'ouvre en N2 « position entière, aller-retour ».
- **Micro simulé** (`tools/make-memoire-fixtures.mjs` + `tools/memoire-vitesse-mic.mjs`, sons **synthétiques** datés) : aveugle juste **12/12, grille tenue**, tentative `mic`+`blind`+`fullPosition`+`gridNpm` ; aveugle avec une fausse (Fa3 pour Mi3) et une oubliée (Do4) **10/12, cordes fautives [1, 3]** ; aveugle trois fois trop lent **12/12 mais hors grille** (★ au plus) ; séquence en tierces **38/38 en place** au micro, passe suivante sur silence **0/38** ; palier injecté **60 → 64** après deux passes propres puis **64 → 60** après deux passes qui traînent (59 refusé : sous le départ) ; une seule tentative `sequence` écrite, prochain départ à 60.

**Pas fait / non vérifié** — à dire tel quel
- **Vraie guitare, vrai micro, vrai téléphone, Safari/iOS** : rien de tout cela. Les fixtures de ce lot sont des **sons de synthèse** (les échantillons nylon n'étaient pas accessibles à l'outil) : ils prouvent la chaîne et la notation, pas la détection sur un instrument.
- **Le masque par hauteur suppose le clic de l'app** : un métronome externe, ou un haut-parleur qui déforme le clic, n'est pas couvert. La tenue de 160 notes/min au micro réel n'est pas mesurée.
- **L'aveugle et les séquences ne savent pas sur quelle corde** la note a été jouée (limite du micro, `match.ts`) : une même hauteur jouée sur une autre corde compte juste.
- **Bonus « à l'aveugle »** : proposé (D84), non codé.

## État exact (dernière mise à jour : après la phase 4b)

**Git** : remote `origin` = `git@github.com:JimmyLefrancois/fret-wave.git`. `master` : `183eacc` Phase 0 · `5797333` 1a · `823fbbd` 1b · `971be8c` 1c · `ee0f82e`…`264b7d9` 1d · `d76e78a` + `3a9e049` Phase 2 · `688aff7` lisibilité · phase 3 · `2c447d6` phase 4a · **`8cda4a8` phase 4b** · `2f34d6e` tour des pages. La **refonte d'interface** (`ui/simplification`) est **mergée en fast-forward** : `master` porte désormais tout — `33a172d` accords, `ae5baf8` thème Aube, `8f7aa62` accomplissements, `bce3d90` comètes, `53a42ca` rythme vertical, `532b52f` Pages, `b7cad3b` deux portes, `78b96e2` aération des cartes · **D66**. L'**accueil lanceur** (`ui/hub-lanceur`, D78-D82) est **mergé en fast-forward** : `903cb7a` 2e passe · `598ef52` 3e passe · **`7f5c0c8`** 4e passe et règle d'écoute (D81). Menu de la maquette `accueil-v2` et affiche en une plaque translucide (D83). **À la dernière mesure : 642 tests (641 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK.**

**Le cycle des sept étapes est complet** — et il est complet *dans l'écran*, pas seulement ici : sept boutons d'étape, dont les trois derniers (Fixer, Enchaîner, Intégrer) sont ceux qui manquaient à la 4a.

**Fait et vérifié (4b)**
- **Fixer** (`modules/accords/fixer.ts`) — pose à froid **chronométrée** : 8 s → 5 s → 3 s (le palier donne le plafond, chaque réussite resserre d'un cran, jamais sous 3 s). Le chrono s'arrête à la **première corde juste** ; la vérification des six cordes continue ensuite **sans limite**, car c'est la propreté qu'on juge après la vitesse. Verdict : il faut le **temps ET ≥ 80 % des cordes** — « rapide mais sale » n'est pas une pose, « propre mais lent » est un manque de réflexe, et l'écran dit lequel des deux.
- **« Appris » tient sa promesse** : 3 arpèges propres sur 2 jours **et** une **pose à froid réussie** (D45). Un rappel le **même jour** ne compte qu'après **10 minutes** (MUSIC_DESIGN §4.4) ; une pose à 8,1 s est écrite **9** (arrondi au supérieur) pour ne jamais passer pour 8.
- **Enchaîner** (`transitions.ts`) — exercice « changements en 30 s » : on horodate une **note repère** par accord, et l'écart entre deux repères **est** le temps de changement. La basse quand elle change ; sinon la **première corde qui diffère** (Em → Em7, F 4 cordes → F barré gardent la même basse : écouter la basse y mesurerait une note tenue). La latence **s'annule** dans la différence : aucune compensation à supposer. Résultat : changements, médiane, changements/minute, part de changements « propres » (≤ 2 s) et « fluides » (≤ 1,5 s), avec les repères de prof (20/min = correct, 30-40 = fluide). Tentative `kind: 'transition'`, nœud `acc:transition:{a}>{b}`, `changeMs` médian au journal.
- **Intégrer** (`progressions.ts`) — **8 progressions** en données (I–IV–V, I7–IV7–V7, vi–IV–I–V, I–vi–IV–V avec Fmaj7, folk en Sol…), classées par nombre d'accords inconnus, **aucune avec un barré complet**. Tablature (`progressionToScore`), motif de strum (↓, ↓↑, motif universel) et métronome (Tone.Transport). La déclaration s'écrit sous `acc:progression:{id}` avec `correct: null` : une activité, jamais une preuve.
- **QCM sans matériel** (`quiz.ts`, `#/accords/qcm`) — trois types : **reconnaître** l'accord d'une tablature **anonyme** (sans son nom au-dessus de la portée), **reconstituer** ses notes, **retrouver** une case masquée dans la pile. Les distracteurs sont les **confusions réelles** (Em/E, Am/C, G/Em, D/Dsus2, D/F♯/D), deux au maximum par question puis complétées par le parcours. Tirage **déterministe** (graine), vivier limité aux accords **déjà rencontrés**. Nœud `acc:savoir:{voicingId}` : **le QCM ne rend jamais un accord « appris »** (D47).
- **Accordage guidé corde par corde** (`core/input/tuningGuide.ts`, P4 de la phase 3) — les six cordes dans l'ordre (6 → 1), **±5 cents tenus 400 ms**, corde suivante automatique, enregistrement du dernier accordage et **rappel dans la leçon** au-delà de 3 jours.
- **Curriculum P5-P7** — septièmes et couleurs (10 accords), premiers slash (G/B, D/F♯, C/G, présentés dans leur ligne de basse), Fa et Si m **par paliers** (Fmaj7 → mini-barré → barré, Bm7 → Bm). **35 accords** au parcours principal.
- **Journal unifié étendu** : `kind` gagne `cold`, `transition`, `qcm` ; champs `chordIdB`, `progressionId`, `limitSec`, `changeMs` ; nœuds `acc:transition:*`, `acc:savoir:*`, `acc:progression:*` à côté de `acc:accord:*`. Même Leitner, même XP, hub filtré par module.
- **XP** : pose à froid 15 (mémoire), transition 10, QCM **6 sans bonus de vitesse** — un QCM juste ne doit pas payer comme une gamme jouée.
- **Degrés** : `fmtDegree` vit désormais dans le cœur (`core/theory/notation.ts`) ; plus aucun « b3 » dans un paragraphe.

**Mesures de la 4b**
- **Tests** : **558 (557 verts, 1 ignoré)**, dont **69 nouveaux** (fixer, transitions, QCM, progressions, accordage guidé) ; 40 fichiers de test + 1 ignoré. `tsc --noEmit` propre, `vite build` OK.
- **Poids** : `index` **580,9 ko (183,9 ko gzip)** — **+47,5 ko (+14,9 gzip)** pour la phase (trois étapes, QCM, accordage guidé, P5-P7) ; CSS **34,5 ko (7,5 gzip)** (+1,6 ko).
- **Mise en page** (`tools/phase4b-check.mjs`, 390 × 844 et 1 440 × 900, captures dans `.shots/4b/`) : **aucun débordement** horizontal aux deux tailles, **aucune erreur console**. Les **sept étapes tiennent en deux rangées** (4 + 3). L'**action principale est au-dessus de la barre du bas** sur les sept écrans : Découvrir 772, Construire 727, Vérifier 764, Plaquer 482, **Fixer 607**, **Enchaîner 669**, **Intégrer 630** px pour une barre à 782.
- **Chemin complet au micro simulé** (Chromium, `--use-file-for-fake-audio-capture`, échantillons nylon CC0) :
  - **Enchaîner Em → Am** : **6 changements mesurés, médiane 1 749 ms, 24/min, 6 propres**, tentative `kind: 'transition'` journalisée (`correct: 6/6`, `changeMs: 1749`). Les 1 749 ms mesurées sont **exactement** l'espacement du fichier (1,3 s de note + 0,45 s de silence) : la mesure est juste, pas seulement plausible.
  - **Fixer** : arpège complet de Mi mineur en **8,1 s** → verdict « propre, mais 8,1 s pour 8 s accordées », tentative `kind: 'cold'` écrite `seconds: 9, limitSec: 8` — donc **pas** une pose à froid réussie. Le chemin d'échec est aussi vérifié que le chemin de réussite.
  - **Accordage guidé** : les **six cordes validées** (−1, +2, +1, −0, +1, −1 cents), enregistrement `{"tuningId":"standard","strings":6}` écrit, aucune erreur console. Premier essai **raté** et c'est instructif : le fichier brut rejouait des échantillons jusqu'à +17 cents hauts, donc une corde sur deux ne passait jamais — le comportement était **juste** (l'app refuse de valider une corde fausse) et la fixture a été corrigée en hauteur.
- **QCM** : six questions répondues au clic, correction affichée, **six tentatives `qcm`** au journal, aucun chiffre de justesse ailleurs.

**Pas fait (4b)** — à dire tel quel
- **Le plaqué n'est toujours pas écouté** : l'étape 4 et la progression restent déclarées (phase 5).
- **Le temps de changement est mesuré sur UNE note repère**, pas sur les six cordes : une corde étouffée au milieu de l'accord ne se voit pas. C'est pourquoi l'enchaînement **ne rend jamais un accord « appris »** à lui seul.
- **Le QCM n'entend rien** : il travaille la lecture, pas l'oreille (l'ear training est en phase 8). Il ne vérifie pas non plus qu'un doigté est *possible* : seulement qu'on sait le lire.
- **P8 (barrés mobiles) et P10 (drop 2/3, extensions) absents du parcours** : ils demandent des doigtés **saisis** pour les formes déplacées (D40), pas calculés — phase 6.
- **Pas de mode « sans matériel » depuis le hub** : le QCM s'ouvre depuis le module Accords et depuis la leçon. Pas de rappel du dernier accordage dans le hub non plus.
- Toujours non vérifiés : **vraie guitare**, **vrai micro**, **vrai téléphone**, Safari/iOS, le timbre, la latence acoustique.

**Trouvé en route, corrigé (4b)**
1. **Em → Em7 ne pouvait pas être mesuré** : les deux formes partagent la basse (Mi grave), donc l'alternance de basses comptait des notes tenues. Trouvé en pilotant l'exercice, pas en relisant le code → **notes repères** (la première corde qui diffère).
2. **Une pose à froid de 8,1 s s'écrivait 8 s** et passait pour réussie (`seconds <= limitSec` sur un entier arrondi) → arrondi **au supérieur** au journal.
3. `guideSteps` parcourait les cordes **de la plus aiguë à la plus grave** (l'index 0 est la corde grave dans le modèle) : l'accordage guidé demandait le mi aigu en premier. Trouvé par les tests.
4. **Les distracteurs du QCM étaient tirés au hasard** : « Em » pouvait se retrouver face à Do, Sol et Ré, ce qui ne teste rien → deux confusions réelles garanties, puis complément.
5. **Le QCM interrogeait des accords jamais ouverts** (Fmaj7 pour un débutant qui n'a pas vu Fa) → vivier limité aux accords rencontrés, ou aux six premiers du parcours.
6. **Le trou du QCM était percé quatre fois** (une par frappe du motif) : quatre cases masquées au lieu d'une → seulement la première pile, celle qui est dessinée.
7. **Les actions d'Intégrer et d'Enchaîner étaient sous le pli** (876 px pour une barre à 782) : le motif et le tempo passaient avant les boutons → actions d'abord, réglages ensuite (630 et 669 px).
8. **Sept boutons d'étape dans une grille de quatre** : la seconde rangée était là, mais sans `row-gap` → ajouté, mesures à l'appui.
9. **« b3 » s'affichait dans les paragraphes** de la leçon (degrés du modèle affichés bruts) → `fmtDegree` déplacé dans le cœur, une seule fonction d'affichage.
10. **La fixture d'accordage était transposée de deux demi-tons** : `asetrate` appliqué à 48 kHz sur des FLAC à 44,1 kHz. Corrigé en lisant le taux réel du fichier — et la correction de hauteur est indispensable, sinon « l'app ne valide pas » ressemble à un bug alors que c'est l'instrument du test qui est faux.
11. **Identifiants P6 faux** (`G/B-x20003` au lieu de `GoverB-x20003`) : le test « chaque accord du parcours existe dans la base » l'a arrêté immédiatement.

## 0. En une page

| Sujet | Décision (phase 0, amendée depuis : voir §10 de [`docs/DECISIONS.md`](docs/DECISIONS.md)) |
|---|---|
| Framework | **Vite + TypeScript + React 19.** Le temps réel (audio, canvas) vit dans des classes TS hors React ; React ne gère que l'UI (hub, menus, réglages). |
| Rendu pixel | **Canvas 2D**, **un seul « pixel logique » pour toute l'app** (facteur entier S ≥ 2), canvas de largeur variable ; **pas de PixiJS**. |
| Tablature | **Moteur maison** (modèle `TabScore` + layout pur + rendu canvas). **alphaTab écarté** pour le rendu (justification 3.3). |
| Théorie | `tonal` + couche guitare maison ; **une seule couche d'affichage** anglo↔solfège. |
| Audio sortie | Web Audio + Tone.js ; **deux banques CC0** (nylon FreePats, électrique Karoryfer) + repli Karplus-Strong ; hauteur et niveaux mesurés ; attribution affichée quand même (D14). |
| Pitch mono | `pitchy` (McLeod), fenêtre adaptée à l'accordage ; **capture dans un AudioWorklet, analyse sur le fil principal** (D35, 0,17-0,37 ms par fenêtre) ; note stabilisée sur 3 fenêtres ; **latence mesurée**, pas estimée. |
| Polyphonique | **Moteur maison « accord attendu »** (peignes d'harmoniques + soustraction), **pas essentia.js (AGPL-3.0)**, pas de chromagramme seul. Verdict = **niveau de confiance**, jamais binaire. |
| Persistance | localStorage (réglages, journal) + export/import JSON. *(Phase 0 prévoyait IndexedDB : révisé en phase 2, D25 ; `navigator.storage.persist()` pas encore demandé.)* |
| Modules | `Gammes` (N1-N3 livrés) et `Accords` (cycle complet en 7 étapes depuis la 4b, + QCM sans matériel) au MVP ; **l'accordeur est un écran de premier rang** (`#/accordeur`, phase 3) plutôt qu'un module `Fondations` séparé ; `Rythmique` préparé dès le modèle. |
| Écart majeur avec le brief | Gammes débutent par la **pentatonique mineure**, pas la majeure ; Am n'est **pas** un accord à 1-2 doigts ; le **verdict par corde en strum est irréaliste** ; **boîte d'accord** : D1 = B (étapes Découvrir/Construire seulement, §7.1 de `MUSIC_DESIGN.md`). |

---

## État exact de la phase 5 (écoute polyphonique)

**Demande** : passer à la phase 5 — entendre six cordes ensemble, pour que « plaqué » cesse d'être une déclaration.

**Livré et mesuré**
- **`core/input/poly.ts`** (D67) — attaque par flux spectral, FFT 16 384 après l'attaque, somme harmonique 1-6 par note attendue des graves vers les aiguës, **soustraction de la part modélisée** de chaque corde (et non du pic entier : sans ça, la fondamentale du Si aigu d'un Em était effacée par les harmoniques du Mi grave — mesuré 0,16 au lieu de 1,00 à 30 dB), plancher **relatif** (0,4 % du pic le plus fort), confiance logarithmique par corde, **pénalité d'inexpliqué** pour comparer les hypothèses.
- **`core/input/capture.ts`** (D68) — tampon de 1,5 s rempli par la queue de chaque bloc du Worklet ; refus sous 150 ms ; rien n'est analysé en continu.
- **Étape « Plaquer » écoutée** (D68, D69) — on arme, l'app attend la **vraie attaque**, laisse 380 ms, analyse 520 ms ; verdict en une phrase, **six lignes de confiance** (19 px, barre + pourcentage), corde manquante annoncée (« absente » + orange), **message ciblé** (« Sol♯ à la place de Sol (corde de Sol) »), bouton de secours « Je le déclare, sans micro » qui reste non vérifié.
- **Journal** — genre `pluck` avec `confidence` bornée par `normalizeAttempt` ; il compte comme une **vérification** de l'accord, sans remplacer l'arpège dans « appris ».

**Chiffres publiés** (`.shots/poly/matrix.json`, `tests/poly-matrix.test.ts`)
- **91 % d'accords reconnus parmi 11** dans les **7** conditions (propre, 30/20/10 dB, 15 et 30 cents de désaccord), marge médiane **+0,51** sur le second ; **224/224 cordes** entendues sur les quatre conditions réalistes.
- **Une seule confusion : G/B pris pour G**, dans toutes les conditions — G/B double la corde de Si et deux cordes à l'unisson font un seul pic. Le test **fige** cette confusion pour que personne ne « répare » le score en cassant autre chose.
- **Au navigateur, faux micro sur les vrais échantillons de la banque** (`tools/make-chord-fixtures.sh` + `tools/chord-poly-check.mjs`) : Em juste → « 6 cordes sur 6, confiance 80 % » (cordes de 73 à 100 %) ; Mi majeur au lieu de Em → « Sol♯ à la place de Sol (corde de Sol) » ; corde de mi étouffée → « la corde de mi n'a pas sonné ». Journal : `pluck`, `correct: 6, total: 6, confidence: 0,799`.

**Ce qui reste de la phase 5** — dit tel quel
- **Aucune validation sur une vraie guitare, un vrai micro, une interface USB, ni sur iOS/Safari.** Les chiffres ci-dessus sont un **plafond optimiste** : matrice synthétique, fixtures sans bruit de pièce. C'est la limite principale du lot.
- **Timing contre la grille** : l'instant d'attaque est mesuré dans la fenêtre (`onsetMs`), mais il n'est **pas** comparé aux clics du métronome — P5 de la phase 3 (« tu joues 40 ms avant le clic ») n'est pas livrée.
- **Étape « Intégrer »** (progression à quatre accords) : toujours **déclarée**. Il faudrait segmenter les quatre strums dans le temps et analyser chacun.
- **Seuils par source** : un seul jeu de seuils, calibré sur les échantillons ; la séparation interface USB / micro de téléphone n'est pas faite.
- L'analyse reste **mono** (un canal) : un micro stéréo n'apporte rien de plus ici, mais un vrai couple de micros serait à rééchantillonner.

## État exact de la phase 7 (improvisation)

**Demande** : passer à la phase 7 (module Gammes niveau 4) — improviser sur un accompagnement ; la phase 6 (Défi Accords) attendra.

**Livré et mesuré**
- **`core/audio/backing.ts`** (D71) — la musique est une **fonction pure** (`backingPattern` : quel son, quand, quelle hauteur, quelle durée) ; `BackingPlayer` ne fait que programmer ces événements sur le contexte audio, avec 250 ms d'avance. Bus **`backing`** ajouté au mixeur (volume séparé, trim −3 dB, pas de réverb : un accompagnement réverbéré noie la guitare).
- **`modules/gammes/impro.ts`** — **quatre accompagnements en données** (synthwave mineur/majeur, lo-fi mineur/ii–V–I), décrits **par degré** et non par nom : la même boucle se transpose sur n'importe quelle tonique. Le style ne change pas que le tempo : le synthwave a une caisse claire sur 2 et 4, le lo-fi **sur 3 seulement** (half-time).
- **`core/impro/classify.ts`** (D72) — cinq rôles par note (`chord`, `color`, `passing`, `avoid`, `out`), une table de tensions par qualité, un score **45 % notes d'accord + 20 % dans la gamme + 35 % d'accords sur les temps forts**, et **un seul** conseil (la faiblesse la plus urgente). Le temps ne change pas le rôle, il change le score.
- **`core/impro/locate.ts`** — une hauteur jouée est placée sur la **position affichée**, avec l'octave la plus proche à défaut d'exactitude, puis la plus proche de la note précédente.
- **Écran `#/gammes/impro`** (D73) — grille de quatre accords qui s'allume sur la mesure, tempo réglable, deux styles, `Démarrer` / `Arrêter`, commutateur micro, la position en tablature avec **la note jouée qui s'allume à sa place**, la prise en cours (notes classées, trois taux) et un bilan chiffré à l'arrêt.
- **P3 de la phase 3 livrée deux fois** (D73) : sur l'écran d'improvisation **et** sur la page Découvrir (bande « M'écouter » sous la tablature), où la note détectée allume la pastille de la position affichée.
- **Journal** (D74) — genre `impro`, niveau 4, nœud **distinct** `gam:impro:{gamme}:{système}:{forme}` : improviser ne doit ni doper ni plomber la maîtrise d'une forme jouée note à note. XP 12 × le taux de notes d'accord.

**Chiffres**
- **606 tests (605 verts, 1 ignoré)** dont 22 nouveaux : rôles harmoniques (quarte à éviter sur majeur, tensions, hors gamme), score et conseil, placement sur la position (octave la plus proche, continuité), accompagnements (transposition, half-time du lo-fi, basse de chaque mesure, pads tenus).
- `tsc --noEmit` propre, build `index` **612,0 ko (194,5 gzip)**, CSS **51,2 ko (10,7 gzip)**.
- **Balayage `tools/tour-check.mjs` : 0 problème sur les 20 écrans** aux deux tailles (la nouvelle route est dans la tournée), 0 erreur console.
- **Au navigateur avec micro simulé** (`tools/impro-check.mjs`, `.shots/mic/strings2.wav`) : la boucle tourne (mesure qui avance, accord courant surligné), **8 notes classées** (`chord`, `color`, `passing`), trois taux affichés (50 % d'accord · 100 % dans la gamme · 100 % sur les temps forts), bilan **78/100** avec son conseil, tentative `impro` au journal (`correct 4 / total 8`, niveau 4, 12 s).
- Écran mesuré : **1 395 px** sur téléphone, 949 px au bureau avec la grille à deux colonnes.

**Ce qui reste de la phase 7** — dit tel quel
- **Le son n'est pas vérifié par un test** : aucun test audio automatisé ne dit que la basse, les pads et la batterie *sonnent* juste. Ce qui est vérifié, c'est **ce qui est programmé** (les événements) et l'absence d'erreur navigateur.
- **Le rythme de la phrase n'est pas mesuré** : l'app sait *où* une note tombe dans la mesure, pas si elle est **jouée** au bon moment — le décalage attaque/clic (P5 de la phase 3) reste à faire.
- **La note blues (♭5) n'est pas neutralisée** et les approches chromatiques comptent comme `out`.
- **Pas de motifs à imiter, pas de « call and response », pas de contraintes créatives** (le brief les liste comme pistes, pas comme livrables de la phase).
- **Pas de vraie guitare, pas de vrai micro** : tout passe par un WAV rejoué par Chromium.

## 9. Plan des phases (affiné)

| Phase | Contenu | « Terminé » = |
|---|---|---|
| **1a** ✔ `5797333` | Moteur de théorie (gammes, accords, orthographe, enharmoniques, conversion solfège), accordages/nb de cordes, base de voicings + tests | Tous les tests de `MUSIC_DESIGN.md` verts ; couverture des 13+13 tonalités — **atteint** (61 tests) |
| **1b** ✔ `823fbbd` | Positions (3NPS, boxes, CAGED, symétriques, blues, bebop), `TabScore`, générateurs, layout, police bitmap, rendu pixel, curseur synchronisé sur Tone.Transport (son provisoire) | Captures lisibles à S=2 sur 390×844 ; chiffres à 2 chiffres nets ; piles d'accords nettes ; 7 cordes, solfège / anglo, Drop D ; daltonisme ; coût de rendu — **atteint** (204 tests, mesures dans « État exact ») |
| **1c** ✔ `971be8c` | Moteur audio de sortie : échantillons CC0 (nylon, électrique) + repli synthèse, choix/couches/round-robin, bus master (compresseur + plafond), drone, métronome, volumes mémorisés, préchargement, page Audio | « Son = tablature » vérifié (6 types de score), drone, métronome, plafond tenu, page Audio — **atteint** (274 tests, mesures dans « État exact ») |
| **1d** ✔ (commit en fin de phase) | Hub + routeur par hash, thème Synthwave (tokens, scène, parallaxe, scanlines), module Gammes N1 (sélection, annotations, calque d'accord), positions CAGED / 3NPS / boxes, réglages globaux, journal de pratique local | Choisir une gamme, la voir et l'entendre avec le son final ; captures 390×844 **et** 1440×900 — **atteint** (314 tests, mesures dans « État exact ») |
| **2** ✔ `d76e78a` + `3a9e049` | Journal de tentatives, maîtrise par forme, Leitner 6 boîtes, XP/série/badges, Gammes N2 (trous) et N3 (rappel) avec pavé numérique, diagnostic par corde, transposition suggérée, export/import JSON, **grille rythmique (★★ au tempo)**, **session mélangée (interleaving)**, **pondération N3 et taux de trous réglable** | Faire une série de trous, voir la maîtrise bouger, fermer l'onglet et retrouver son état ; grille tenue/manquée distinguée ; session de 5 formes enchaînée ; export/import vérifié — **atteint** (371 tests, mesures dans « État exact ») |
| **3** ✔ (commit en fin de phase) | Entrée mono (`pitchy`), note stabilisée, appariement hauteur → case, seuils par source, plancher de bruit mesuré, **latence mesurée**, accordeur 6 cordes, « Micro » dans les niveaux 2-3 | Détection vérifiée sur signaux synthétiques **et** sur un **micro simulé rejouant de vrais échantillons** (cases remplies, tentative journalisée) — **atteint, sauf le test sur guitare réelle** (431 tests) |
| **4a** ✔ `2c447d6` | Accords A : curriculum P0-P4 + branche rock, **doigtés saisis et relus**, boîte d'accord (D1=B), leçon Découvrir → Construire → Vérifier (arpège au micro) → Plaquer (déclaré), nœuds `acc:accord:*`, recommandation · **+ P1 (joue la case) et P2 (note morte)** | Apprendre Em puis Am depuis zéro, chaque corde validée au micro, tentative journalisée, prochain accord justifié — **atteint** (489 tests, mesures dans « État exact ») |
| **4b** ✔ `8cda4a8` | **Fixer** (pose à froid chronométrée), **Enchaîner** (changements mesurés entre notes repères), **Intégrer** (8 progressions + strum + métronome) · **QCM** sans matériel (3 types) · **accordage guidé** corde par corde (P4 de la phase 3) · paliers **P5-P7** | Cycle des 7 étapes complet **dans l'écran** ; Em enchaîné à Am avec un temps de changement mesuré (1 749 ms au micro simulé) ; QCM jouable sans guitare ; « appris » exigeant la pose à froid — **atteint** (558 tests, mesures dans « État exact ») |
| **Refonte UI** ✔ `532b52f`…`78b96e2` | Navigation simplifiée (accueil à deux portes, puis **lanceur à une action et bande « Parcours »** — D78-D82, Gammes en une liste, tablature en tête d'exercice), thème clair « Aube », panneau de réussite, dix accomplissements, comètes, **rythme vertical unifié** (D64), **aération du contenu** (D66), **déploiement GitHub Pages** | Balayage 0 problème sur 19 écrans aux deux tailles, écarts sur **cinq valeurs** (0/4/8/12/20), thème clair au contraste mesuré, `dist` vérifié servi sous `/fret-wave/` — **atteint** (567 tests) |
| **5** ✔ (livré, sauf les deux points ci-dessous) | **Analyse polyphonique** (`core/input/poly.ts`), **capture** (`capture.ts`), étapes **Plaquer** et journal (`pluck`) vérifiées · **+ P5 (phase 3, §9.1)** reste à faire | Matrice de confusion **publiée** (11 accords × 7 conditions : 91 %, 224/224 cordes) et **accord plaqué réellement écouté** dans le navigateur (faux micro sur échantillons de la banque : 6/6 à 80 %, « Sol♯ à la place de Sol », corde étouffée vue) — **atteint**. **Restent** : validation sur **vraie guitare / interface USB**, timing d'attaque **contre la grille** (l'onset est mesuré, la comparaison au clic n'est pas faite), et l'étape **Intégrer** (progression à quatre accords) toujours déclarée |
| 6 | Défi Accords, strumming, familles d'accords, harmonisation · **Q1, Q2, Q7** (§9.2) | Setlist complète |
| **7** ✔ (livré, sauf les points ci-dessus) | **Improvisation** (`#/gammes/impro`) : accompagnements **synthwave + lo-fi** en données et synthétisés, classification harmonique en cinq rôles, score et conseil, notes jouées allumées sur la position · **+ P3 (phase 3, §9.1) livrée** (écran d'impro **et** page Découvrir) | Synthwave et Lo-fi **jouables** (deux styles × deux modes), prise classée et résumée au navigateur avec micro simulé (8 notes, 78/100) — **atteint**. **Restent** : le son non vérifié par un test, le décalage attaque/clic (P5), la note blues et les approches chromatiques |
| 8 | Thèmes, ear training, dashboard, badges, PWA, polish | — |
À chaque phase : l'app tourne (`npm run dev`), code typé, tests unitaires ; captures d'écran ; bilan en fin de phase + 3 à 5 propositions pédagogiques.

### 9.1 Propositions pédagogiques de la phase 3 → phase où elles atterrissent

Les cinq propositions du bilan de la phase 3 (`MUSIC_DESIGN.md` §14.3) sont **placées**, pas seulement notées : chacune est rattachée à la phase dont elle partage déjà le moteur ou la dette. Aucune ne remplace un livrable existant.

| # | Proposition | Phase | Pourquoi cette phase |
|---|---|---|---|
| **P1** | **« Joue la case que je montre »** — la tablature allume une pastille, l'élève la joue, le micro valide. **✔ fait en 4a**, à l'étape « Construire » (chaque doigt est validé au micro). | **4** | Même moteur qu'un trou (`matchPitch` à une seule cible), et c'est **exactement** l'étape « Construire / Vérifier » de la leçon d'accord : la construire pour les gammes la rend gratuite pour les accords. C'est le pont manquant entre *lire un chiffre* et *poser un doigt*. |
| **P2** | **Diagnostic de note morte** — 15 à 40 cents bas **et** niveau faible → « la corde ne sonne pas : appuie juste derrière la frette » (au lieu de « accorde-toi »). **✔ fait en 4a** (règle testée ; non démontrée sur un vrai signal, voir « Pas fait »). | **4** | Sans lui, la validation **arpège corde par corde** de la phase 4 confond « doigt mal placé », « corde étouffée » et « guitare désaccordée ». Le niveau RMS par note existe déjà (phase 3), la règle est courte. |
| **P3** | **Affichage live de la note sur la position** (niveau 1) — la note détectée allume la pastille correspondante de la position affichée. | **7** | Même surcouche de tablature que l'improvisation (notes jouées inscrites à la position du curseur). Peut être **tirée dans la 4** si le coût s'avère faible (une prop de `TabView` + le flux de la phase 3). |
| **P4** | **Accordage guidé corde par corde** — les six cordes dans l'ordre, « corde 6 juste → passe à la 5 », rappel « dernier accordage : 3 jours ». **✔ fait en 4b** (`core/input/tuningGuide.ts` : les six cordes dans l'ordre, ±5 cents tenus 400 ms, rappel au-delà de 3 jours). | **4** | Prérequis direct de la validation arpège : une guitare à −20 cents fait échouer des cordes justes. Réutilise l'accordeur de la 3 tel quel ; l'effort est dans l'enchaînement et le rappel, pas dans la mesure. |
| **P5** | **Avance / retard moyen sur la grille** — « tu joues 40 ms avant le clic » pendant l'exercice. | **5** | C'est du **timing** : la phase 5 possède l'onset, la compensation de latence et les transitions. Les instants d'attaque sont déjà mesurés (phase 3), il ne reste qu'à les comparer aux clics et à les afficher. |

Deux conséquences à garder en tête quand ces phases s'ouvriront : **P1 et P4 ne sont pas des gadgets de confort** — ce sont les deux conditions pour que la validation audio du module Accords soit juste (savoir viser une case, partir d'une guitare accordée) ; et **P2 est une correction de contresens**, pas une amélioration : aujourd'hui l'app envoie vers l'accordeur un élève qui doit simplement presser plus près de la frette.

---

### 9.2 Propositions de la phase 5 → phase où elles atterrissent

Les cinq propositions du bilan de la phase 5 sont **placées**, pas notées. Trois d'entre elles étaient déjà au plan (`MUSIC_DESIGN` §16.3, Q1, Q2, Q5) : la phase 5 les a rendues **possibles** sans les livrer, et la colonne « phase » dit maintenant précisément où elles tombent. Deux sont nouvelles (Q6, Q7).

| # | Proposition | Phase | État réel / dépendance |
|---|---|---|---|
| **Q1** | **Diagnostic par corde dans le temps** — « sur Am, c'est la corde de Sol que tu étouffes, 7 fois sur 10 », agrégé depuis `missedStrings` | **fin de la 5** | **Donnée prête** : `missedStrings` est journalisé par l'arpège, la pose à froid et — depuis D69 — par le plaqué écouté. Il ne manque que l'écran (un bloc sur la page Accords). Effort très faible, impact fort |
| **Q2** | **QCM d'oreille** — les mêmes questions, mais **entendues** au lieu d'être lues | **6** | **Moteur prêt** : `scoreHypothesis` compare des accords voisins, `chordToScore` sait jouer la question. Le QCM existant (`quiz.ts`) change de source, pas de logique |
| **Q5** | **Métronome dans l'enchaînement** — mesurer l'attaque **contre le clic**, pas seulement entre deux repères | **fin de la 5** | **Mesure prête** : `onsetMs` existe dans `poly.ts`. Il reste à le rapporter à la grille du métronome et à l'afficher (« tu joues 38 ms avant le clic ») : de l'affichage, plus de l'analyse |
| **Q6** | **La confiance expliquée, pas seulement affichée** — une ligne sous les six barres : « la barre dit *ce que j'entends*, pas *ce que tu vaux* » | **fin de la 5** | **Constat mesuré** : un accord à 5 cordes sur 6 affiche **31 %** de confiance globale, parce qu'elle suit la corde la plus faible. Le chiffre est juste, la phrase qui l'accompagne manque. Texte seul |
| **Q7** | **Le plaqué comme test de sortie de palier** — « appris » exigerait aussi un plaqué écouté à ≥ 80 %, en **remplacement** d'un des trois arpèges | **6**, **après** la validation sur instrument réel | **Bloqué volontairement** : les 91 % de la matrice sont un plafond optimiste (synthèse, échantillons propres). Durcir un seuil d'apprentissage sur ces chiffres bloquerait des élèves sur une mesure qui n'a pas encore vu une vraie guitare |

**Ce que la phase 5 ne déplace pas** : les propositions P1-P5 du §9.1 restent où elles sont (P1 et P2 faites en 4a, P3 en phase 7, P4 faite en 4b, P5 en fin de phase 5 = Q5).

## 12. Prochaine étape : la phase 6 (Défi Accords), puis le reste de la 5 sur instrument réel

**Où on en est** : les phases 0 à 4b sont livrées, la **refonte d'interface** est mergée sur `master` (D54-D66), la **phase 5 est livrée côté analyse** (D67-D69, matrice de confusion publiée, étape « Plaquer » écoutée) et le déploiement Pages est câblé.

**Gammes, lot « mémoire et vitesse » (branche `gammes/memoire-vitesse`)** : à merger sur `master` après ta validation, puis à jouer sur instrument réel — une série à l'aveugle et une séquence à 80 BPM en croches, vrai micro (le masque des clics par hauteur n'est vérifié qu'avec le clic de l'app et des sons de synthèse). Une décision t'attend : le bonus d'XP « à l'aveugle » (D84, proposé).

**Trois choses restent avant de dire la phase 5 terminée**, et aucune ne peut se faire sans matériel :
1. **Jouer un accord sur une vraie guitare** (interface USB d'abord, micro de téléphone ensuite) et comparer les confiances obtenues à celles des fixtures. C'est le seul test qui vaut ; tant qu'il n'est pas fait, les 91 % sont un plafond.
2. **Comparer l'attaque mesurée aux clics du métronome** (`onsetMs` existe, la comparaison non) → P5 de la phase 3, « tu joues 40 ms avant le clic ».
3. **Segmenter et analyser les quatre strums d'une progression** pour rendre l'étape « Intégrer » vérifiable.

**Les propositions du bilan sont placées en §9.2** : deux d'entre elles (Q1, Q5) se font en **fin de la phase 5** parce que la donnée existe déjà, une troisième (Q6) est un texte à écrire, et les deux autres (Q2, Q7) tombent en phase 6.

**La phase 6 maintenant** (demandée après la 7) — défi Accords, strumming, familles d'accords, harmonisation · **Q1, Q2, Q7** : le moteur d'écoute est là, il manque le jeu. Les restes de la phase 5 (instrument réel, timing contre la grille, étape Intégrer) et de la phase 7 (décalage attaque/clic, note blues) se feront quand tu pourras jouer sur une vraie guitare.

**Objectif** : entendre **six cordes ensemble**. C'est la seule chose que le module Accords ne sait pas faire, et c'est celle qui manque pour que « plaqué » et « tempo » cessent d'être des déclarations.

**Livrables**
1. **Analyse « accord attendu »** (`core/input/poly.ts`) : détection d'attaque (flux spectral), fenêtre longue **après** l'attaque (FFT 8 192-16 384, 5,9-2,9 Hz/bin), somme pondérée des harmoniques 1-6 par note attendue avec **soustraction itérative** des harmoniques déjà expliqués par les notes plus graves (idée de Klapuri). Sortie : **confiance 0-1 par note**, jamais un verdict binaire.
2. **Comparaison avec les hypothèses concurrentes** : Em vs E, D/Dsus2/Dsus4, Am vs C, G/B vs G — les paires documentées en `MUSIC_DESIGN` §6. Message ciblé (« Sol♯ détecté au lieu de Sol »).
3. **Tests sur signaux synthétiques d'abord** : générateur de superposition (harmoniques décroissantes, inharmonicité légère, bruit d'attaque, strum 10-40 ms, désaccord ±0/15/30 cents, SNR 30/20/10 dB, corde étouffée simulée), **matrice de confusion** pour les paires proches, **résultats chiffrés publiés tels quels**, y compris les échecs. Cibles hypothétiques (pas des promesses) : ≥ 90 % d'acceptation correcte à SNR 20 dB, ≤ 10 % de faux positifs entre voisins.
4. **Onset et timing** : remplacer les horloges internes par l'attaque mesurée, latence retranchée ; **P5 de la phase 3** (« avance/retard moyen sur la grille ») tombe ici naturellement. Le temps de changement de l'étape Enchaîner passe de **une** note repère à l'accord entier.
5. **Ce qui change dans le module Accords** : l'étape « Plaquer » et l'étape « Intégrer » deviennent **vérifiables** (avec niveau de confiance et bouton de secours), et la progression peut créditer l'axe **tempo** de `MUSIC_DESIGN` §4.7.
6. **Seuils séparés par source** : interface USB d'abord, micro de téléphone ensuite ; le mode arpège **reste** la référence pour apprendre.

**« Terminé » =** un accord plaqué reconnu sur signal synthétique avec des chiffres publiés, puis validé sur une vraie guitare (interface USB), et un temps de changement mesuré sur les six cordes — l'app enregistrant un score de confiance, jamais un « faux » sec.

**Points à surveiller** : les harmoniques des cordes graves recouvrent des notes aiguës (5·E2 = 412 Hz ≈ Sol♯4) ; l'**absence** d'une corde est bien plus difficile à prouver que sa présence ; un accord proche (Am/C, Em/G) restera ambigu en strum — le dire dans l'UI, pas seulement ici. Si les cibles ne sont pas tenues : le strum reste « confiance + validation manuelle », l'arpège porte la validation d'apprentissage.

**Dette technique assumée à reprendre** : vue manche optionnelle (attend un accord explicite), page « Progression » (heatmap), doigtés de position non relus, `#/tab` encore en page de contrôle, La de référence non appliquée à la lecture des échantillons, `InputEngine` sans détection de bend/vibrato, **P8/P10 du curriculum** (doigtés saisis des formes mobiles), **mode sans matériel absent du hub**, **« note morte » non démontrée sur un vrai signal**, et **P3 de la phase 3** (affichage live de la note) qui atterrit en phase 7.
