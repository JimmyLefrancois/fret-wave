# PROJECT.md — Fretwave (nom de travail) : apprendre la guitare, en tablature, en pixel art

**Statut : phases 0, 1a, 1b, 1c, 1d, 2, 3, 4a et 4b terminées, **refonte d'interface terminée et mergée sur `master`**, déploiement GitHub Pages câblé, **phase 5 : écoute polyphonique livrée** (accord plaqué écouté, matrice publiée), **phase 7 : improvisation livrée** (accompagnements synthwave et lo-fi, classification harmonique, notes allumées sur la position) · 4b = module Accords, partie B : les **sept étapes** du cycle du brief sont là (Découvrir → Construire → Vérifier → Plaquer → **Fixer** (pose à froid chronométrée) → **Enchaîner** (changement mesuré entre deux notes repères) → **Intégrer** (progression + strum)), plus le **QCM sans matériel**, l'**accordage guidé corde par corde** et les paliers **P5-P7** (couleurs, slash, Fa et Si m) · « appris » exige enfin une pose à froid · **tour complet des pages** (19 écrans, largeurs et alignements mesurés) · D1-D74 tranchées (D13 écartée, D7 remplacée par D14) · aucune décision en attente · **606 tests (605 verts, 1 ignoré)**.**
Documents liés : `BRIEF.md` (cahier des charges), `MUSIC_DESIGN.md` (conventions musicales, curriculum, avis de prof).
**Repères** : *État exact* juste en dessous · **hypothèses** §8 (1-88) et §8 bis (ce qui a changé) · **plan des phases** §9 · **propositions pédagogiques placées** §9.1 (phase 3) et §9.2 (phase 5) · **décisions** §10 (D1-D76) · **prochaine étape** §12. Pages de l'app (hash) : `#/hub`, `#/gammes`, `#/gammes/jouer`, `#/gammes/entrainement`, `#/gammes/revision`, `#/gammes/impro`, `#/accords`, `#/accords/lecon`, `#/accords/qcm`, `#/accordeur`, `#/reglages`, plus les outils de contrôle `#/tab`, `#/audio`, `#/theorie` (la page « Son » a quitté la barre de navigation en phase 3 : elle reste joignable depuis les réglages). `npm run dev` → http://localhost:5173/ (un seul serveur à la fois : deux instances Vite sur le même port servent une version périmée du CSS).
Légende : **[HYP]** hypothèse prise sans te bloquer · **[À TRANCHER]** décision qui t'appartient · **[RISQUE]** voir section 7.

---


## État exact (dernière mise à jour : après la phase 4b)

**Git** : remote `origin` = `git@github.com:JimmyLefrancois/fret-wave.git`. `master` : `183eacc` Phase 0 · `5797333` 1a · `823fbbd` 1b · `971be8c` 1c · `ee0f82e`…`264b7d9` 1d · `d76e78a` + `3a9e049` Phase 2 · `688aff7` lisibilité · phase 3 · `2c447d6` phase 4a · **`8cda4a8` phase 4b** · `2f34d6e` tour des pages. La **refonte d'interface** (`ui/simplification`) est **mergée en fast-forward** : `master` porte désormais tout — `33a172d` accords, `ae5baf8` thème Aube, `8f7aa62` accomplissements, `bce3d90` comètes, `53a42ca` rythme vertical, `532b52f` Pages, `b7cad3b` deux portes, `78b96e2` aération des cartes · **D66**. **À la dernière mesure : 567 tests (566 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK.**

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

## État exact de la refonte d'interface (branche `ui/simplification`, **mergée sur `master`**)

**Statut** : tout ce qui suit est sur `master`. La branche `ui/simplification` est un ancêtre de `master` (peut être supprimée).

**Demande d'origine** : « je trouve que c'est vraiment fouilli, je ne sais même pas où aller pour faire des exercices » — mot d'ordre simplicité, compréhension, navigation facile, sur une branche dédiée, sans nouvelle fonctionnalité de jeu.

**Ce qui a changé à l'écran**
- **Accueil** : trois blocs au lieu de dix panneaux de prose — « Continuer » (la gamme en cours, ▶ Découvrir / S'exercer au micro / Changer), deux portes (Apprendre · Accorder), la révision **seulement quand une carte est due**, puis les **dix derniers accomplissements** (D59) ; **deux portes** (Apprendre · **Accords**, D61 et D65) et **cinq onglets** dans la barre — l'accordeur s'ouvre par son onglet. Sortis de l'accueil : niveau détaillé, badges, liste des modules, code couleur, points d'entrée, note de journal.
- **Gammes** : un seul écran. Famille (dont la famille **Mineures**, D56), tonique, puis **la liste des positions** avec, sur chaque ligne, « Découvrir » et « S'exercer ». L'accordage et le système de positions passent dans un repli : ce sont des réglages, pas des étapes.
- **Exercice** : la tablature passe **avant** les réglages, le micro devient un bouton primaire en tête, découpage / session mélangée / métronome sont repliés. La **légende du halo** (D57) est écrite sous la portée, et un **panneau de réussite** animé (D58) récapitule XP gagné, XP total, XP du jour et les mesures de la série.
- **Décor** (D55) : l'affiche synthwave (soleil rayé, montagnes, grille en perspective) est présente sur **toutes** les pages et couvre tout l'écran ; le soleil est centré sur l'accueil, décalé à droite ailleurs pour ne pas passer sous les titres.
- **Deux ambiances** (D60) : « Synthwave Neon » (sombre) et « Aube » (clair), sélectionnables dans Réglages → Ambiance ; même décor, même vocabulaire de couleurs, contraste mesuré dans les deux.
- **Détails de mise en page** : tablature à la largeur de son panneau (D52), plancher de lisibilité 11 px (D51), accordeur réordonné (D53), flèches de strum en ▼ ▲ dans le DOM, tempo à droite du transport, commutateur « Drone · fond. + quinte » sur une ligne.
- **Rythme vertical unifié** (D64) : trois jetons (`--gap-block` 12/20, `--gap-inside` 8, `--gap-tight` 4), page en colonne à `gap` constant sur téléphone ; les dix-neuf valeurs mesurées avant tombent à **0, 4, 8, 12, 20 px**. Outil `tools/spacing-check.mjs`.
- **Aération du contenu** (D66) : panneaux à 14 px de rembourrage (16/18 au bureau), petits textes à 1,55 d'interligne, lignes de liste à 11/12 px ; les pastilles d'état vides ne se dessinent plus et l'objectif d'étape des Accords est devenu une **bande pleine** au lieu d'une phrase posée sur le décor.

**Mesures (téléphone 390 × 844, bureau 1 440 × 900)**
- Hauteurs : accueil **4 301 → 844 px** (puis ~1 940 px avec les dix accomplissements, et 1 236 px sans journal), gammes 1 936 → 1 464, exercice 2 039 → 1 837 avec la tablature sur le premier écran, accordeur 6 432 → 2 488.
- **`tools/tour-check.mjs` : 0 problème sur les 19 écrans aux deux tailles, 0 erreur console** (il a servi de juge toute la branche : largeurs, débordement, textes < 11 px, troncatures).
- **584 tests (583 verts, 1 ignoré)**, dont 7 sur les accomplissements, les contrôles de contraste des deux thèmes et les deux tests de comètes ; `tsc --noEmit` propre ; `vite build` OK, `index` **592,2 ko (188,6 ko gzip)**, CSS **49,1 ko (10,3 gzip)** — la phase 5 ajoute 9,5 ko (3,9 gzip).

**Ce qui n'a pas été touché** : aucune règle musicale, aucun barème d'XP, aucun seuil de maîtrise. Les accords ont retrouvé un onglet de barre et une porte sur l'accueil (D61) : ils n'étaient plus joignables que par un lien de pied de page. Les sessions mélangées gardent leur panneau « Session terminée » (pas de panneau de réussite animé).

**Déploiement (GitHub Pages)** — `vite.config.ts` prend `base = '/fret-wave/'` quand `GITHUB_PAGES=1`, posé par `.github/workflows/deploy.yml` (build + `actions/deploy-pages` sur `master`). Tout ce qui construit une URL d'asset passe par `import.meta.env.BASE_URL`, donc les échantillons suivent (`/fret-wave/samples/…`). Le routeur est en `#/…` : aucune réécriture ni `404.html` n'est nécessaire. **Vérifié en servant `dist/` sous un sous-chemin** : l'app démarre, les cinq onglets sont là, deux échantillons se chargent en 200, aucune erreur console ni requête en échec. **Prérequis côté dépôt** : Settings → Pages → Source = « GitHub Actions ». **État au 28/10** : le dépôt est encore en « Deploy from a branch », donc le site `https://jimmylefrancois.github.io/fret-wave/` sert l'`index.html` **source** (qui appelle `/src/main.tsx`, non compilé : écran blanc) et le job `deploy` du workflow échoue — le job `build` (npm ci, 567 tests, build) passe, lui. Après le passage en « GitHub Actions », relancer le workflow : le `dist` complet (base `/fret-wave/`) est publié à la même adresse.

**Ce que la refonte laisse ouvert** (assumé, à trancher plus tard)
- **L'écran de découverte reste le plus dense** : sept réglages d'affichage (annotation, cordes affichées, fondamentales, rythme, drone, métronome, boucle) cohabitent avec le sujet, la position. « Plus d'options » n'en replie qu'une partie. C'est le prochain écran à alléger.
- **Les sessions mélangées** n'ont pas le panneau de réussite : elles gardent leur carte « Session terminée », sans animation ni récap XP.
- **Aucun test sur matériel réel** : ni vraie guitare, ni vrai micro, ni interface USB, ni Safari/iOS. Le micro reste simulé par un fichier (`tools/mic-check.mjs`).
- **La première ouverture** n'est pas accompagnée : journal vide, l'accueil affiche la gamme par défaut sans dire « commence ici ».
- **Le vocabulaire « palier P1 »** subsiste dans les en-têtes d'accords : il est expliqué par le titre de l'étape juste à côté, mais c'est un reste de vocabulaire de spécialiste.

**Commits de la branche** : `2f34d6e` tour des pages · `85841d9` refonte de navigation · `9f2185a` décor plein écran · `1975d83` affiche partout · `be92e8c` famille Mineures · `03b037b` + `26eee4d` légende du halo · `95fa1ff` commutateur inline · `bfee5c4` tempo · `0b203e8` panneau de réussite · `8f7aa62` accomplissements · `940fa79` docs · `1434ee5` thème « Aube » · `b7a96fa` docs · `ae5baf8` docs · `33a172d` accords · `aa10c6f` docs · `a43479a` formulations · `9a94b70` docs · `aa10c6f` docs.


---

## État exact de la phase 4a (rappel)

**Git** (branche `master`) : `183eacc` Phase 0 · `5797333` 1a · `823fbbd` 1b · `971be8c` 1c · `ee0f82e`…`264b7d9` 1d · `d76e78a` + `3a9e049` Phase 2 · `688aff7` lisibilité · phase 3 · **`2c447d6` phase 4a**. **489 tests (488 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK.** Aucun remote.

**Découpage de la phase 4** : **4a = moteur et leçon** (bloc ci-dessous, gardé comme rappel) ; **4b = Fixer / Enchaîner / Intégrer**, QCM sans matériel, accordage guidé corde par corde (P4 de la phase 3), paliers P5-P7 — **livrée**, voir le bloc du haut. Le cycle du brief a 7 étapes et **les sept sont dans l'écran** : la phrase de la 4a (« quatre sont livrées, trois ne le sont pas ») n'est plus vraie.

**Fait et vérifié (4a)**
- **Doigtés saisis** (`src/data/voicings.ts`) pour les 44 formes de la base, et **relus par règle** (`core/theory/chordFingers.ts`) : un doigt = une case (sauf barré), corde à vide ou étouffée sans doigt, case la plus basse tenue par l'index ou le majeur, cordes du barré au doigt du barré, 4 doigts au plus. L'ordre de pose est **déduit** : barré d'abord, puis index → auriculaire, cordes graves d'abord. C'était la dette de la 1d ; l'étape « Construire » n'était pas faisable sans elle.
- **Curriculum** (`modules/accords/curriculum.ts`) : P0 (matériel/posture/une note nette), P1 (Em, Em7, Asus2, Am7), P2 (Am, E, A, E7, A7), **P2b branche rock** (E5, A5, D5, G5, C5), P3 (Dsus2, D, Dsus4, Dm), P4 (Cmaj7, C, G, G variante 4 doigts). Chaque entrée porte **pourquoi** elle est là, ses prérequis et les transitions du palier ; chaque palier porte un **avis de prof**. Tests : prérequis existants et jamais postérieurs, transitions entre accords déjà introduits, palier du curriculum = palier de la base.
- **Boîte d'accord pixel** (`core/tab/chordBox.ts`) : 6 cordes, 5 cases, sillet épais en haut du manche, repère de case pour une forme déplacée (G5 → « 3 »), X et ronds, pastilles aux **couleurs de fonction** de la tablature, numéro de doigt dans la pastille, barré. À l'étape Construire, elle **se remplit doigt par doigt** ; les cordes à vide et étouffées sont visibles dès le début (on voit qu'on joue six cordes, dont quatre à vide).
- **Leçon** (`modules/accords/lesson.ts` + `ChordLessonPage.tsx`) : quatre étapes. **Construire** valide chaque doigt au micro (P1 « joue la case que je montre ») ; **Vérifier** demande les cordes dans l'ordre **grave → aiguë**, juge la hauteur attendue, trois essais puis révélation ; **Plaquer** est **déclaré** (statut non vérifié) en attendant la phase 5.
- **Progression** : tentative `kind: 'arpeggio'` (vérifiée) ou `'strum'` (déclarée, **aucun chiffre de justesse au journal**), `module: 'accords'`, `chordId`. Nœud `acc:accord:{voicingId}` : même journal, même Leitner, même XP. **« Appris » = 3 vérifications propres sur 2 jours** (D5) contre 2 pour une forme de gamme.
- **Recommandation** (`modules/accords/recommend.ts`) : premier accord du parcours dont les prérequis sont atteints, avec la **raison** (« s'appuie sur Em · 2 transitions déjà en place · ouvre le palier P2 »). Un accord déjà travaillé n'est jamais réaffiché comme verrouillé ; aucun accord n'est inaccessible.
- **Hub** : panneau Accords (prochain accord + progression 0/17), compteurs de gammes **filtrés** pour ne pas mélanger les deux modules dans « formes travaillées » et dans la révision.
- **P2 de la phase 3 livré** : une corde **15 à 40 cents basse et faible** → « appuie juste derrière la frette », pas « accorde-toi » ; une corde **à vide** ne reçoit jamais ce conseil (corrigé après capture).

**Mesures de la 4a**
- **Chemin complet au micro simulé** (Chromium, `--use-file-for-fake-audio-capture`, échantillons nylon CC0 enchaînés E2 B2 E3 G3 B3 E4) : **6 / 6 cordes justes**, écarts mesurés **+4 à +19 cents** (les échantillons sont légèrement hauts, c'est physiquement vrai), tentative journalisée `kind: 'arpeggio'`, `correct: 6/6`, `missedStrings: []`, **9 s**. Reproductible : `node tools/chord-mic-check.mjs .shots/mic/em.wav`.
- **Chemin d'erreur** (Fa joué au lieu de Si) : message par corde, **3 essais puis case révélée**, tentative `5/6` avec **`missedStrings: [0]`**.
- **Mise en page** (revue après ton signalement, `tools/accords-check.mjs`, 2 tailles × 5 écrans) : **aucun débordement horizontal** (`scrollWidth == clientWidth` à 390 et 1 440), aucune erreur console, 6 lignes de vérification rendues, 17 cartes d'accord. La **première** version de cette mesure était trompeuse : elle ne regardait que le débordement, alors que sur bureau les panneaux étaient écrasés sur **une seule colonne de la grille de 12** (la classe `.span-12` n'existait pas). Le contrôle vérifie maintenant les deux : débordement **et** largeur réelle des panneaux. Page de la leçon : **1 311 px** de haut sur téléphone (contre 1 970 avant la refonte), l'action principale (« Construire ») **au-dessus** de la barre de navigation.
- **Poids** : `index` **533,4 ko (169,0 ko gzip)** — **+46,2 ko (+13,1 ko gzip)** pour le module Accords (curriculum, boîte, leçon, pages, CSS). CSS **32,9 ko (7,3 gzip)** (la refonte de la vue accord ajoute 1,4 ko).
- **Tests** : 489 (488 verts, 1 ignoré), dont **58 nouveaux** sur les doigtés, la boîte, la leçon, le curriculum, la recommandation et les nœuds d'accord.

**Pas fait (4a)** — à dire tel quel
- **Le plaqué n'est pas écouté** : l'étape 4 est une déclaration. Un élève peut se déclarer propre alors qu'une corde frise ; le journal garde le statut « non vérifié » et l'écran le dit.
- **Pas de rappel à froid chronométré** (Fixer) : le critère « appris » est donc **plus faible** que ce que le §4.6 de `MUSIC_DESIGN.md` annonce (il manque la pose à froid ≤ 8 s un autre jour).
- **Pas de transitions** (Enchaîner) ni de progression (Intégrer) : aucune compétence musicale de changement d'accord n'est entraînée.
- **Pas de QCM** ni de mode sans matériel au-delà de la déclaration corde par corde.
- **Accordage guidé corde par corde (P4)** : ✔ **fait en 4b** (l'accordeur existait, l'enchaînement non).
- **Palier P5-P10** absents du curriculum (septièmes, sus/add, slash, barrés) : la base de voicings les contient, le parcours non.
- Toujours non vérifiés : **vraie guitare**, **vrai micro**, **vrai téléphone**, Safari/iOS, le timbre.
- **« Note morte » non démontrée de bout en bout** : la règle est testée unitairement, mais un signal synthétique atténué et abaissé de 28 cents a été lu **+187 cents** par le détecteur (verdict `outside`, donc aucune erreur comptée — le comportement reste juste, la démonstration non).

**Trouvé en route, corrigé (4a)**
1. **La boîte d'accord recouvrait les boutons** : le canvas utilisait la classe `.pix` de la tablature, qui est en `position: absolute` → l'élève ne pouvait pas cliquer « Doigt posé ». Trouvé par le pilotage Playwright, pas par les tests.
2. **« La corde de E2 devrait donner E »** : les conseils parlaient en notation du modèle (E2, A2) au lieu de la couche d'affichage → « corde de Mi », « La, case 2 ».
3. **Conseil absurde sur une corde à vide** : « appuie juste derrière la frette 0 ». Une corde à vide n'a pas de frette à viser — règle corrigée et testée.
4. **En-tête de page cassé** : `page-head` est une grille à 3 colonnes (retour, titre, tag) ; les deux nouveaux écrans y avaient glissé quatre blocs → titre et sous-titre se superposaient (vu sur capture).
5. **Une déclaration enregistrait un score** : le mode « sans micro » écrivait `kind: 'strum'` avec `correct: 6/6` — une auto-évaluation devenait une preuve. Corrigé : une déclaration n'a jamais de chiffres.
6. **La fenêtre de la boîte démarrait à la 2e case** pour un accord ouvert (Em) : la corde à vide **jouée** ancre la forme au sillet.
7. **Les cordes à vide disparaissaient** à l'étape Construire (elles n'ont pas de doigt à poser) → visibles dès le début, seuls les doigts manquants sont masqués.
8. **Un palier sans accord (P0) s'affichait « franchi 0/0 »** : il est « l'étape où tu commences » tant qu'aucun accord n'est appris.
9. **« Reprendre cette leçon »** sur un accord jamais ouvert → « Apprendre Em » quand rien n'a commencé.
10. **La vue accord était inutilisable sur téléphone** (ton signalement, revue Playwright capturée écran par écran) : l'en-tête se **superposait** au sous-titre et au tag (grille à 3 colonnes, 4 blocs), le sélecteur d'étapes **passait à la ligne** et poussait « Construire » **sous la barre de navigation**, la boîte d'accord était **un écran plus bas** dans un panneau séparé, et la tablature (`plaqué` + `arpégé` dans le même score) faisait **657 px** de haut. Refonte : étapes en **une rangée de 4 boutons** (numéro + libellé), boîte à **S = 2** (chiffres de 14 px, comme la tablature) dans le même panneau que les notes, **une seule** zone d'écoute, tablature **plaquée seule** en retour à la ligne (274 px), en-tête à un seul bloc de texte court.
11. **Sur bureau, les panneaux du module étaient écrasés** : `.span-12` n'existait pas dans la grille de 12 colonnes (seuls 4/5/6/7/8), donc chaque panneau pleine largeur tombait dans **une** colonne de ~100 px — texte à un mot par ligne. Ajout de `.span-12`, de `.step-nav`/`.step-goal` en pleine largeur, et **contrôle de largeur** ajouté à l'outil.
12. **La signature rythmique mordait sur la première pastille** d'un accord : elle était dessinée « 4/4 » horizontalement dans une largeur réservée d'un seul chiffre. Elle est maintenant **empilée** (4 au-dessus de 4), comme sur une portée — un chiffre de large, donc plus aucun chevauchement, et les largeurs de mesure ne changent pas.
13. **La tablature était coupée à droite sur téléphone** en défilement continu (score plus large que l'écran, champ non défilable) → **retour à la ligne** pour un score d'une mesure.
14. **Deux serveurs Vite** tournaient en même temps : celui de `:5173` servait un **CSS périmé** (sans `.span-12`), ce qui a fait croire un moment que le correctif ne s'appliquait pas. Même piège qu'en 1d et en phase 2 ; les deux processus ont été arrêtés et un seul relancé.
15. **« Pose majeur sur la corde de A2 »** et **deux lignes « MI »** dans la vérification : la consigne et les pastilles de corde parlaient en notation du modèle. La consigne dit « La », et la pastille affiche le **numéro de corde** (1 = aiguë) — en police pixel, « Mi » et « mi » sont identiques.

## État exact de la phase 3 (rappel)

**Git** (branche `master`) : `183eacc` Phase 0 · `5797333` 1a · `823fbbd` 1b · `971be8c` 1c · `ee0f82e`…`264b7d9` 1d · `d76e78a` + `3a9e049` Phase 2 · `688aff7` lisibilité · **phase 3 (commit en fin de phase)**. **431 tests (430 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK.** Aucun remote, arbre propre.

**Fait et vérifié (3 — entrée audio monophonique, calibration, accordeur)**
- **Détection** (`src/core/input/pitch.ts`) : `pitchy` 4.1.0 (MPM de McLeod) sur une fenêtre **dérivée de l'accordage** (`pitchWindowSize` : 2048 en standard, 4096 dès une corde sous ~100 Hz). Deux couches maison : `PitchTracker` (mesure + seuils) et **`NoteStabilizer`** — une note n'est « reconnue » qu'après **3 fenêtres consécutives** dans la même demi-teinte, écartées de ≤ 40 cents. C'est ce qui empêche une corde qui s'éteint de remplir des cases au hasard.
- **Piège de `pitchy` documenté et corrigé** : son `minVolumeDecibels` est en **amplitude au carré** (`10^(db/10)` comparé à un RMS), pas en dBFS. Un seuil de −42 dBFS doit lui être passé −21 : sans conversion, le seuil réel était **100 fois trop bas** (trouvé par le test de seuil). La conversion vit dans `dbfsToPitchy`.
- **Capture** (`public/worklets/fretwave-input.js`, JS pur, 100 lignes) : anneau glissant, RMS par bloc, **détection d'attaque** (montée × 2,2 sur le niveau lissé, réfractaire 90 ms) ; un message par `hop` de 1024 échantillons (**21 ms**, 47 fenêtres/s) avec la fenêtre ordonnée en transfert. **L'attaque est mémorisée jusqu'au prochain envoi** : un bloc intermédiaire ne la perd plus (défaut trouvé par le test du worklet).
- **Moteur navigateur** (`src/core/input/engine.ts`) : `getUserMedia` avec **echoCancellation / noiseSuppression / autoGainControl désactivés**, lecture de `track.getSettings()` pour **dire** quand le navigateur les a gardés (R3) ; nœud worklet relié à la sortie **par un gain à zéro** (dans le graphe, jamais audible → pas de larsen) ; une seule source à la fois, `track.stop()` explicite ; erreurs typées (`denied`, `insecure`, `unavailable`, `busy`, `failed`) avec message et marche à suivre.
- **Contexte natif** : Tone 15 renvoie un `AudioContext` de `standardized-audio-context`, qui **refuse** `new AudioWorkletNode(...)` (`parameter 1 is not of type 'BaseAudioContext'`, constaté au navigateur). Le moteur d'entrée reprend donc le contexte natif enveloppé (`nativeContextOf`) : même horloge, même matériel, pas de second contexte à réveiller.
- **Appariement** (`src/core/input/match.ts`, pur) : verdicts `fill` / `tuning` / `octave` / `wrong` / `outside` / `empty`. Règles de prof : une note juste à ±tolerance remplit ; **au-delà de la tolérance mais dans la même demi-teinte, c'est un problème d'accord** (aucune erreur comptée, renvoi vers l'accordeur) ; **une octave d'écart n'est pas une faute** ; au-delà de **2 demi-tons**, ce n'est plus une tentative (une autre note du segment, ou une fausse route).
- **Ce que le micro ne peut pas faire, écrit dans le code et dans l'UI** : il donne une **hauteur**, jamais une **corde**. La3 existe en 4 endroits du manche ; l'app valide donc la **case attendue** et ne prétend jamais faire un diagnostic par corde à partir du son.
- **Niveaux 2-3 au micro** (`ScaleTrainingPage.tsx`) : interrupteur « Micro (jouer pour valider) » ; la case se remplit à la note jouée, **le pavé reste un secours complet**. Une note **visible** du segment (ou déjà trouvée) jouée par erreur **ne compte jamais comme une erreur** — c'est ainsi qu'un élève se repère (défaut trouvé par le micro simulé, voir plus bas). Tentative enregistrée **au même format qu'en phase 2** (`kind`, `correct`, `total`, `missedStrings`, `tempoOk`).
- **Tempo enfin mesuré au jeu** : quand le micro est actif, l'instant retenu est celui de l'**attaque de la dernière note**, **latence mesurée retranchée**, et non plus le clic sur un pavé. Les clics du métronome sont **masqués ± 90 ms** (`nearClick`) : sans cela, le métronome de l'app remplirait des cases tout seul.
- **Calibration** (`src/core/input/calibration.ts`, pur) : plancher de bruit = **médiane** des niveaux RMS au silence (la moyenne se laisse déplacer par une chaise), seuil suggéré = plancher + 12 dB borné, **latence = médiane des écarts entre le clic programmé et son retour**, écart-type implicite par rejet à ±30 ms de la médiane. **Moins de 3 mesures sur 5 retenues → rien n'est mémorisé** et l'écran le dit (le périphérique simulé n'entend pas les clics : exactement ce cas).
- **Accordeur** (`#/accordeur`) : niveau + seuil réglable, périphérique, source **micro / interface USB** (seuils et latences **mémorisés par source**), plancher de bruit mesuré en 2 s, latence en 5 clics, **La de référence** 415-445 Hz lu par la détection, et les cordes de l'accordage courant : corde entendue allumée, écart signé, verdict (juste / trop bas / trop haut / très loin), aiguille. Le numéro de corde est affiché (1 = aiguë) : en police pixel, « mi » et « Mi » se confondent.
- **Réglages** : nouveau panneau « Entrée audio » (seuil, tolérance, La, latence) et lien vers l'accordeur ; le paragraphe de la grille dit maintenant que le tempo est mesuré au jeu **avec** le micro, au pavé sans.
- **Navigation** : 4 onglets (Hub, Gammes, **Accordeur**, Réglages). La page « Son » (outil de contrôle de la 1c) **sort de la barre** : cinq libellés en police pixel ne tiennent pas sur 390 px sans ellipse (« ACCOR… » mesuré) ; elle reste joignable depuis les réglages et par `#/audio`.

**Mesures de la 3**
- **Justesse de la détection** (48 kHz, signaux synthétiques à réponse connue) : **écart ≤ 0,3 cent sur tout le manche** (E2 82,41 Hz → E6 1 318,5 Hz, 49 hauteurs) ; fondamentale **affaiblie** (×0,2) ou **absente** : pas de saut d'octave (Mi2 lu 82,41 Hz) ; désaccord +25 cents lu +25,0 ; bruit seul et silence → **aucune note**.
- **Jusqu'à la tablature, avec de vrais échantillons** : un WAV construit à partir de la banque **nylon CC0** (A2, C3, D3, E3, puis la box entière) est donné à Chromium comme micro (`--use-file-for-fake-audio-capture`). Notes lues : **110,1 / 131,1 / 147,2 / 165,1 / 263,0 / 294,9 / 330,0 / 392,7 Hz** (écart maximal **+9 cents**), cases remplies, message « Mi · 5 (quinte juste) · +21 ¢ — juste », **tentative journalisée** (`correct: 2/2`, ★★★, 15 XP) sur **3 essais sur 3**.
- **Chemin d'erreur** (faire jouer Fa3 quand Mi3 est attendu) : « tu joues Fa · non — réessaie », puis « tu joues Fa · c'était 7 (case révélée) », tentative `correct: 1/2`, `revealed: 1`, **`missedStrings: [1]`**, ★.
- **Chemin « note déjà écrite »** : jouer une note visible du segment ne compte aucune erreur (« Ré est déjà écrite dans ce segment ») — vérifié avant et après correction du défaut.
- **Coût de la détection** : **0,17 ms** par fenêtre de 2048, **0,37 ms** par fenêtre de 4096 (500 mesures, Node) → ≈ 1,7 % d'un cœur à 47 fenêtres/s. Le fil audio ne fait que copier des échantillons et calculer un RMS.
- **Poids** : `index` **487,2 ko (155,9 ko gzip)** — **+40,7 ko (+14,1 ko gzip)** pour `pitchy`, le moteur d'entrée, l'accordeur et l'UI ; chunk Tone inchangé (340,8 / 79,4) ; CSS **29,0 ko (6,6 gzip)**.
- **Lisibilité et mise en page** (mesuré par `tools/layout-check.mjs`, 6 pages × 2 tailles) : **aucun débordement horizontal** à 390 ni à 1 440 ; contraste minimal **5,5:1** sur l'accordeur, 5,2 ailleurs, **aucun texte sous 4,5** ; cibles tactiles ≥ 32 px (curseurs portés à 44 px).
- **Worklet** : testé hors navigateur (`node:vm`) — nom d'enregistrement, une fenêtre par saut, taille, **ordre du plus ancien au plus récent** (une rampe reste croissante), niveau, et **règle d'attaque identique bloc par bloc** à `onsetStep` (les deux copies ne peuvent pas diverger en silence).

**Pas fait (3)** — à dire tel quel
- **Aucune vraie guitare, aucun vrai micro** : tout est vérifié sur signaux synthétiques et sur un **périphérique simulé** qui rejoue des échantillons de guitare. La « définition de terminé » du plan (« jouer quelques notes sur une vraie guitare ») **n'est donc pas atteinte par moi** : elle demande 2 minutes avec l'instrument branché.
- **Latence jamais mesurée en vrai** : le chemin de mesure existe, la valeur reste à obtenir casque et haut-parleurs (le périphérique simulé n'entend pas les clics de l'app → 1 mesure sur 5, non mémorisée, ce qui est le comportement voulu).
- **Chemin `grid: kept` au micro non exercé** : la fixture joue à son propre rythme, donc la grille est manquée (`missed`, ★). La règle reste testée unitairement (`insideGrid`, `nearClick`) ; la démonstration « tempo tenu au jeu » demande un guitariste.
- **Polyphonie absente** (phase 5) : pas de validation d'accord plaqué, pas de diagnostic par corde d'un accord.
- Toujours non vérifiés : le **timbre** (je n'écoute pas), **Safari / iOS** (reprise du contexte, `getUserMedia` sur mobile, `AudioWorklet` dans une PWA), un **vrai téléphone**, le **bruit d'une pièce réelle** (les seuils par défaut sont raisonnés, pas calibrés).
- Pas de réglage de **périphérique par nom** avant autorisation (limitation des navigateurs, dite à l'écran) ; pas de détection de **bend/vibrato** (une note tenue qui glisse sort de la retenue et redéclenche) ; pas de **mode casque** automatique.

**Trouvé en route, corrigé (3)**
1. **L'ouverture du micro s'annulait elle-même** : `start()` prenait son jeton *avant* `stop()`, qui l'incrémente → la garde `token !== this.token` refermait le flux juste après `getUserMedia` (état bloqué à « requesting », puis « idle »). Trouvé par le harnais micro, pas par les tests unitaires.
2. **`AudioWorkletNode` refusé** par le contexte de Tone (`standardized-audio-context`) → passage au contexte natif enveloppé.
3. **Le seuil de `pitchy` était 100 fois trop bas** (dBFS vs dB d'amplitude²) : le détecteur analysait du bruit.
4. **Jouer une note visible comptait comme une erreur** : la garde « déjà écrite » ne couvrait que le verdict `outside`, pas `wrong` (une note du segment à 2 demi-tons d'un trou passait pour une faute) → test sur le score **affiché**, avant tout verdict d'erreur.
5. **Une attaque pouvait être perdue** entre deux envois du worklet (bloc non final) → attaque mémorisée jusqu'au prochain message.
6. **La barre de navigation passait à la ligne** avec 5 onglets, puis tronquait « ACCORDEUR » → onglet « Son » retiré de la barre, grille `auto-flow: column`, libellés à 9,5 px (mesuré : aucun `scrollWidth > clientWidth`).
7. **« corde de Ré3 · 198 cents bas » pour un Do3** : la corde la plus proche était nommée jusqu'à 7 demi-tons. Bornée à 0,6 demi-ton dans l'interface (0,75 dans l'accordeur).
8. **Une latence non concluante était mémorisée** (209 ms sur 1 mesure) → moins de 3 mesures sur 5, rien n'est écrit.
9. **`**par source**` s'affichait littéralement** dans le JSX (et le même défaut existait depuis la phase 2 dans le texte de la grille) → balises `<strong>`.
10. **La rangée de cordes affichait « MI » deux fois** (Silkscreen est en capitales : `mi`/`Mi` s'y confondent) → numéro de corde à gauche.

## État exact de la phase 2 (rappel, après le commit `688aff7`)

**Git** (branche `master`) : `183eacc` Phase 0 · `5797333` Phase 1a · `823fbbd` Phase 1b · `971be8c` Phase 1c · `ee0f82e` + `a7cb1bd` + `354d20a` + 4 commits de mise en page (1d, jusqu'à `264b7d9`) · **`d76e78a` Phase 2** + `3a9e049` seconde passe (grille, session mélangée, pondération) + `688aff7` lisibilité (panneaux, cartes opaques). **371 tests (370 verts, 1 ignoré), `tsc --noEmit` propre, `vite build` OK.** Aucun remote, arbre propre.

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

**Git** (branche `master`) à l'époque : `ee0f82e` Phase 1d, puis `a7cb1bd`, `354d20a` et les commits de mise en page jusqu'à `264b7d9`. **314 tests (313 verts, 1 ignoré) au terme de la 1d**, `tsc --noEmit` propre, `vite build` OK. *(Depuis : `d76e78a` phase 2, `3a9e049` seconde passe, `688aff7` lisibilité, 371 tests — voir le bloc ci-dessus.)*

**Fait et vérifié (1d — hub, thème, module Gammes N1)**
- **Thème par design tokens** (`src/core/themes/`) : `tokens.ts` (contrat : palette, scène, panneau de tab, polices, UI), `synthwave.ts` (un fichier = un thème), `registry.ts` (`applyTheme` pose 22 variables CSS + `data-theme` sur `<html>`, thème par défaut sans attribut), `scene.ts` (dessin pur, testable sans canvas). **Aucun hex n'est recopié dans `app.css`** : la feuille ne contient qu'une palette de secours `:root` pour le premier rendu. Les **couleurs d'intervalle restent hors thème** (`core/tab/colors.ts`).
- **Mise en page grand écran** (≥ 900 px) : **grille de 12 colonnes sur 90 % de la largeur** (max 1 560 px), gouttières de 20 px, **rangées de même hauteur** (`align-items: stretch`) ; les panneaux prennent 4, 5, 6, 7 ou 8 colonnes (`.span-*`), ce qui garantit que les bords supérieurs et inférieurs s'alignent. **Barre de navigation en haut** (56 px, mot-symbole à gauche, onglets à droite) au lieu de la barre du bas. Tablature, bande d'exercice et navigation de positions **centrées sur 1 040 px** (largeur de lecture). Sur téléphone : une colonne de 560 px max, barre en bas — inchangé. Mesuré à 1 440 : colonne **1 296 px**, colonnes de panneaux **528 / 748 px**, hauteurs de rangée identiques.
- **Captures de vérification** : `npm run shots` (Playwright, Chromium) → `.shots/<page>-<largeur>x<hauteur>.png` et `-full.png` ; `--only n1 --width 1440` pour cibler. Outil de développement, jamais exécuté par les tests ; Playwright est une dépendance de dev (~120 Mo de navigateur, hors dépôt).
- **Scène pixel** : ciel en bandes avec tramage, étoiles déterministes (graines fixes) qui scintillent, soleil rayé à trois zones, deux crêtes de montagne, horizon lumineux, **lignes de grille horizontales qui avancent** (14 lignes, perspective en d², 30 img/s). Deux variantes : **`poster`** (hub, horizon à 38 %, soleil 26 % de la largeur borné à 11 % de la hauteur) et **`calm`** (écrans de travail : ciel + étoiles seulement). Parallaxe = décalage vertical borné à 40 px au défilement. Échelle **2 px CSS par pixel logique** (3 au-delà de 1 500 px), `image-rendering: pixelated`.
- **Rayons verticaux de la grille : non dessinés** (D19). Mesuré : à 195 px logiques de large, 17 rayons convergent en une hachure de 3 px autour du point de fuite ; à 9 rayons le fan reste un pâté de 30 px. Les horizontales qui se resserrent portent la perspective.
- **Polices** : Press Start 2P (mot-symbole seulement) et Silkscreen 400/700 (étiquettes, badges, onglets) sont auto-hébergées dans `public/fonts/` (sous-ensemble latin, **OFL 1.1**, `README.md` de provenance) ; VT323 reste embarquée mais n'est plus utilisée par le DOM. **Tout le texte courant, les titres de page et les contrôles sont en sans-serif système** (aucun téléchargement) : voir D24. La tablature n'utilise aucune de ces polices (police bitmap maison 5×7 avec ♯ ♭ 𝄪 𝄫 dessinés).
- **Hub** (`#/hub`) : poster + objectif du jour + « reprendre » + **deux portes d'entrée** (Apprendre · Accords, D65) + état des quatre modules. Les chiffres viennent du **journal de pratique local** (D22), pas d'un compteur décoratif : « 1 / 3 · 1 gamme écoutée · 10 s » après une écoute réelle.
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
| Pitch mono | `pitchy` (McLeod), fenêtre adaptée à l'accordage ; **capture dans un AudioWorklet, analyse sur le fil principal** (D35, 0,17-0,37 ms par fenêtre) ; note stabilisée sur 3 fenêtres ; **latence mesurée**, pas estimée. |
| Polyphonique | **Moteur maison « accord attendu »** (peignes d'harmoniques + soustraction), **pas essentia.js (AGPL-3.0)**, pas de chromagramme seul. Verdict = **niveau de confiance**, jamais binaire. |
| Persistance | localStorage (réglages, journal) + export/import JSON. *(Phase 0 prévoyait IndexedDB : révisé en phase 2, D25 ; `navigator.storage.persist()` pas encore demandé.)* |
| Modules | `Gammes` (N1-N3 livrés) et `Accords` (cycle complet en 7 étapes depuis la 4b, + QCM sans matériel) au MVP ; **l'accordeur est un écran de premier rang** (`#/accordeur`, phase 3) plutôt qu'un module `Fondations` séparé ; `Rythmique` préparé dès le modèle. |
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

**Tel que construit en phase 3 — écart assumé avec le plan (D35)** : `pitchy` tourne sur le **fil principal**, pas dans le worklet. Un module AudioWorklet est chargé par `addModule()` et **n'est pas passé par le bundler** : on ne peut pas y importer un paquet ESM, sinon il faudrait une étape de build séparée dont le résultat peut se périmer en développement (même piège que le CSS servi par un vieux serveur Vite, rencontré deux fois). Répartition retenue : le worklet fait le travail par bloc (**anneau, RMS, attaque**, 128 échantillons ≈ 2,7 ms) et envoie une fenêtre toutes les 1024 échantillons (21 ms) ; le fil principal fait la FFT/NSDF, mesurée à **0,17 ms (2048)** et **0,37 ms (4096)**, soit ≈ 1,7 % d'un cœur à 47 fenêtres/s. Conséquence honnête : la détection dépend du fil principal (une image longue la retarde, aucune n'est perdue pour autant — les fenêtres arrivent dans l'ordre).
Garde-fous effectivement livrés : seuil de volume (corrigé de la convention `pitchy`, D35), **clarté minimale**, **retenue de note sur 3 fenêtres**, et le cas **octave** traité comme « douteux » (aucune erreur comptée) plutôt que deviné.

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

### 4.8 Pipeline audio d'entrée — *tel que construit en 3* (`src/core/input/`)
```
getUserMedia({ deviceId?, echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1 })
  → track.getSettings() relu : si le navigateur a gardé l'AGC ou la réduction de bruit, l'écran l'affiche (R3)
  → AudioContext NATIF (celui que Tone enveloppe) : un AudioWorkletNode n'accepte pas l'enveloppe
  → AudioWorklet « fretwave-input » (JS pur, public/worklets/) : anneau windowSize + RMS par bloc + attaque
        └─ un message par hop de 1024 éch. (21 ms) : fenêtre ordonnée (transfert), rms, peak, t, onset, onsetT
  → fil principal : pitchy (fenêtre 2048/4096 selon l'accordage) → clarté ≥ seuil → NoteStabilizer (3 fenêtres)
  → matchPitch(hauteur, cibles non remplies) : fill / tuning / octave / wrong (≤ 2 demi-tons) / outside
  → calibration : seuil sur le plancher de bruit MÉDIAN · latence = médiane clic programmé → retour entendu (5 clics)
```
Pas de Worker séparé : l'analyse polyphonique (« accord attendu ») est l'objet de la phase 5, et rien n'a été
construit pour elle. Casque recommandé dès qu'un son de l'app est joué (le micro le reprend), et **clics du
métronome masqués ± 90 ms** pour qu'ils ne remplissent pas de cases.

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
- UI (DOM) : **Silkscreen** pour les **étiquettes de décor** (titres de panneau, badges, tags — capitales courtes, jamais plus d'un mot ou deux), et **sans-serif système** dès qu'un libellé **porte du sens ou se lit d'un coup d'œil** : titres, texte, boutons, segments, chips, **libellés des sept étapes de la leçon** et **onglets de la barre de navigation**. Press Start 2P ne sert plus qu'au mot-symbole. Les polices pixel sont sous licence OFL, auto-hébergées pour le hors-ligne.
- **Règle mesurée depuis la 4b** : **aucun texte d'interface sous 11 px** (vérifié par `tools/tour-check.mjs` sur les 19 écrans) ; un libellé qui se lit est en sans-serif **≥ 11,5 px** (13 px pour les étapes, 11,5 px pour les onglets), contraste **≥ 5,5:1**, jamais tronqué par ellipse. Silkscreen en capitales à 9,5-10,5 px perdait les accents (« DECOUVRIR »), faisait lire « 0 2 » au lieu de « 02 », et son avance obligeait à tronquer « ACCORDEUR ».
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
| R2 | **Latence** entrée/sortie sur Android/Bluetooth ; timing Défi injuste | 3 | 2 | **Chemin de mesure livré (3)** : 5 clics joués, retour entendu, médiane + rejet à ±30 ms, mémorisé par source ; moins de 3 mesures retenues → rien n'est écrit. Retranchée du chronomètre de la grille. **Valeur réelle non obtenue** (pas de matériel ici) ; Bluetooth déconseillé |
| R3 | **iOS/Safari** : contexte audio suspendu, interrupteur silencieux qui coupe le Web Audio, contraintes de capture ignorées | 2 | 3 | Démarrage sur geste ; session audio « playback » ou astuce `<audio>` silencieux (**à tester sur appareil**) ; **livré (3)** : avertissement explicite quand `getSettings()` révèle un AGC/NS actif, message dédié si le contexte n'est pas sécurisé. Safari toujours non testé |
| R4 | **Échantillons** : qualité « studio » inatteignable avec les packs libres ; licences | 2 | 2 | **Traité en 1c (D14)** : deux banques CC0 documentées, attribution affichée quand même, repli Karplus-Strong, hauteur et niveau mesurés. Reste : le timbre jugé à l'oreille, pas par moi |
| R5 | **Pixels inégaux** (DPR non entier, redimensionnement) | 2 | 2 | Échelle entière sur pixel physique ; test de rendu à 5-6 DPR ; captures de non-régression |
| R6 | **Moteur de layout de tab** (rythme : ligatures, triolets, doubles croches, piles) plus long que prévu | 2 | 3 | Périmètre incrémental : noires/croches/doubles d'abord, triolets ensuite ; layout pur testé ; modèle complet dès le départ |
| R7 | **Perte de données** (stockage purgé par iOS pour un site non installé après ~7 jours d'inactivité ; vidage manuel) | 2 | 3 | PWA installée + `persist()` ; **export/import JSON** proposé à chaque palier ; journal d'événements |
| R8 | **Perf mobile** (canvas plein écran + particules + audio) | 2 | 2 | Couches pré-rendues, scène à 30 fps, curseur seul redessiné ; profilage dès la phase 1 |
| R9 | **Contenu** : volume de voicings, progressions, patterns de backing ; erreurs de transcription | 2 | 3 | Tests automatiques sur chaque forme ; données séparées du code ; relecture « prof » des doigtés en phase 4 |
| R10 | **Dérive de périmètre** : le brief est très large | 3 | 3 | Phases séquencées, définition de « terminé » par phase, phase 1 découpée 1a / 1b / 1c / 1d |
| R11 | Contraintes d'**autorisation** (HTTPS requis pour le micro) | 1 | 2 | **Traité (3)** : `window.isSecureContext` vérifié avant `getUserMedia`, messages distincts pour refus, contexte non sécurisé, aucun périphérique, périphérique occupé; `localhost` en développement |
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

**Prises en phase 3**
63. **Seuils de détection par source** : −42 dBFS (micro), −36 (interface USB) ; **clarté minimale 0,90** ; **tolérance 35 cents**. Ce sont des valeurs *raisonnées*, pas calibrées sur une pièce réelle (mesuré : un signal à −20 dB de bruit donne une clarté de 0,906, donc 0,90 est la limite basse). Réglables dans l'accordeur.
64. **Une note n'est reconnue qu'après 3 fenêtres** (≈ 65 ms) dans la même demi-teinte, étalement ≤ 40 cents ; la justesse affichée est la **médiane**. Latence totale geste → case remplie ≈ 100 ms (3 fenêtres + demi-fenêtre). À revoir si c'est perceptible à l'usage.
65. **Verdict audio** : juste à ±tolérance ; **accord** (aucune erreur) jusqu'à max(tolérance+10, 60) cents ; **une octave d'écart n'est pas une faute** ; **au-delà de 2 demi-tons, ce n'est plus une tentative** ; une note **déjà écrite** dans le segment n'est jamais une erreur (D36).
66. **Le micro ne dit pas la corde** : l'app valide la **case attendue**, jamais « tu as joué sur la mauvaise corde ». La corde d'une tentative reste celle du trou (`missedStrings`).
67. **Au micro, `seconds`** court de la première note acceptée ; la grille se juge sur l'**attaque de la dernière note**, latence retranchée. Au pavé, rien ne change (chrono de saisie).
68. **Les clics du métronome sont masqués ± 90 ms** : jouer pile sur le clic peut coûter une analyse. Compromis choisi contre la fausse validation.
69. **Le worklet est du JS pur** dans `public/worklets/` (testé hors navigateur par `node:vm`) ; `pitchy` reste sur le fil principal (D35).
70. **La de référence dans les réglages d'entrée** (415-445 Hz), lue par la détection **et** l'accordeur ; elle n'est pas encore appliquée aux échantillons de sortie (`tuningCents` reste vide côté lecture).
71. **La page « Son » quitte la barre de navigation** (4 onglets : Hub, Gammes, Accordeur, Réglages) ; elle reste joignable depuis les réglages et par `#/audio` (D38).
72. **Un seul `InputEngine` par contexte audio** (`app/inputSession.ts`) : deux flux ouverts se disputeraient le périphérique sur Android.
73. **Les doigtés sont saisis, jamais calculés** : une heuristique se trompe dès qu'un accord admet deux doigtés conventionnels (G en 2-1-3 ou 3-2-4). Chaque doigté est relu par une **règle mécanique** (`chordFingers.ts`), pas par une source externe : la relecture humaine reste à faire.
74. **L'ordre de pose est déduit** (barré, puis index → auriculaire, cordes graves d'abord). C'est l'ordre qu'on enseigne à l'oral ; il ne gère ni les démanchés ni les variantes 1-2-4.
75. **Un accord exige 3 vérifications propres sur 2 jours** (D5) alors qu'une forme de gamme en exige 2 : un accord est un geste moteur, pas une lecture. Seuil non calibré sur un vrai débutant.
76. **Le plaqué se déclare, il ne se vérifie pas** : `kind: 'strum'` n'écrit jamais de score de justesse (correct/total à `null`). Une auto-évaluation ne doit pas pouvoir devenir une preuve.
77. **Le mode arpège impose l'ordre grave → aiguë** : c'est ce qui lève l'ambiguïté hauteur/corde en monophonie. Conséquence assumée : un élève qui joue les cordes dans un autre ordre n'est pas validé, même si l'accord est juste.
78. **La boîte d'accord ne vit que dans Découvrir et Construire** (D1 = B) et reste désactivable : la règle « tablature seulement » du brief n'est pas entamée ailleurs.
79. **Les nœuds de gamme et d'accord partagent le même journal et le même Leitner** : le hub filtre (`module`), la révision de gammes ignore `acc:*`. Un seul modèle, deux modules.

**Prises en phase 4b**
80. **Pose à froid** : 8 s (P1-P2) → 5 s (P3-P4) → 3 s (P5+), resserré d'un cran par réussite, **jamais sous 3 s**. Ce sont des seuils de prof, pas une mesure — un débutant met souvent 4 à 6 s sur un Sol les premières semaines. **[HYP fragile]**
81. **La pose à froid mesure la première note** (basse, ou note repère) et non l'accord plaqué : c'est le maximum de ce qu'une détection monophonique autorise. La propreté est jugée ensuite, sans limite de temps.
82. **Un rappel à froid le même jour ne compte qu'à ≥ 10 min** après la première vérification (consolidation motrice) ; à un autre jour, il compte toujours.
83. **Les secondes d'une pose sont arrondies au supérieur** (`Math.ceil`) : le journal ne stocke que des entiers, et 8,1 s ne doit pas s'écrire 8 s.
84. **Enchaînement** : 30 s d'exercice, un changement « propre » ≤ 2 s, « fluide » ≤ 1,5 s, repères de lecture 20/min (correct) et 30-40/min (fluide). Mesure **entre deux notes repères** horodatées par le même détecteur (la latence s'annule), sans métronome.
85. **Un changement compte dès qu'une note repère juste est entendue** : les autres cordes de l'accord ne sont pas jugées (monophonie). L'enchaînement ne rend donc jamais un accord « appris ».
86. **QCM** : 6 questions, les trois types en alternance, **deux confusions réelles** parmi les distracteurs, vivier = accords déjà rencontrés (sinon les six premiers du parcours), tirage déterministe. XP 6 **sans bonus de vitesse** ; nœud `acc:savoir:*` distinct du nœud de la forme.
87. **Progressions** : 8 en données, aucune avec un barré complet (Bm7 et Fmaj7 au lieu de Bm et F), une mesure par accord, déclaration sous `acc:progression:{id}`.
88. **Accordage guidé** : ±5 cents tenus **400 ms** par corde, « ce n'est pas cette corde » au-delà de 90 cents, rappel au-delà de **3 jours** sans accordage. Plus serré que la tolérance d'exercice (35 cents) : on accorde avant de jouer, on ne juge pas en jouant.

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
- **63-64** (seuils, clarté, retenue de note) : réglés par raisonnement et par mesure **sur signaux synthétiques**, jamais dans une vraie pièce avec un vrai micro. C'est le premier réglage à corriger après deux minutes de jeu réel.
- **65** (2 demi-tons pour une tentative, octave non comptée) : choix de prof. Le seuil des 2 demi-tons est le plus discutable — une gamme a des écarts de 1 à 2 demi-tons, donc un élève qui joue *la note voisine* remplit cette case-là, ce qui est le comportement voulu mais peut masquer une erreur de doigté.
- **68** (masque des clics) : 90 ms est large (15 % du temps à 50 BPM). Un guitariste qui joue exactement en place verra parfois sa note ignorée.
- **67** (`seconds` au micro) : mêle temps de jeu et temps de lecture ; acceptable pour un exercice court, faux pour un exercice entrecoupé de pauses.
- **80** (8 / 5 / 3 s de pose à froid) : valeurs de prof, non calibrées sur un vrai débutant ; le passage de 8 à 5 s après **une** réussite est probablement trop rapide.
- **84-85** (2 s « propre », 30 s d'exercice) : le seuil de 2 s est un choix de musique, pas une mesure ; en dessous de 20 changements/min l'exercice peut décourager, au-dessus de 40 il ne teste plus rien.
- **86** (QCM) : le vivier « accords rencontrés » se réduit à trois accords après deux leçons, donc les mêmes questions reviennent ; à revoir avec un historique plus riche.
- **88** (±5 cents, 400 ms) : une guitare fraîchement accordée dérive de quelques cents pendant qu'on joue ; 5 cents peut être vécu comme « impossible » sur une mécanique bon marché. À mesurer sur un vrai instrument.
- **Le mode sans matériel n'est pas dans le hub** : un élève sans guitare doit passer par le module Accords pour le trouver.
- **`changeMs` au journal** ne garde que la médiane : impossible de dire après coup si l'élève s'améliore ou s'il a fait un seul bon changement.

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
| Entrée audio | worklet + Worker séparés, polyphonie dès la 3 | **mono seulement** : `pitchy` sur le fil principal (D35), worklet = capture (3) |
| Module Accords | « phase 4 » en un bloc, QCM + validation plaquée | **4a + 4b livrées** : 7 étapes, arpège vérifié, pose à froid, transition mesurée, progression, QCM ; **le plaqué reste déclaré** (phase 5) |
| Doigtés d'accord | « saisis en phase 4 » (rangée vide depuis la 1b) | **saisis et relus par règle** (D40), ordre de pose déduit |
| Progression | journal réservé aux gammes | **un seul journal, deux modules** : `module: 'accords'`, `chordId`, nœuds `acc:accord:*` (D43) |
| Validation N2/N3 | pavé numérique | **pavé ou micro** : la case se remplit à la note jouée (3) |
| Tempo des exercices | chrono de saisie au pavé | **attaque mesurée**, latence retranchée, quand le micro est actif (3) |
| Navigation | Hub · Gammes · Son · Réglages | **Hub · Gammes · Accordeur · Réglages** (la page Son sort de la barre, D38) |
| Boîte d'accord | à trancher | **D1 = B** (Découvrir/Construire) |
| Cycle d'un accord | 4 étapes sur 7 (4a) | **7 étapes** : Fixer, Enchaîner et Intégrer livrées en 4b |
| Critère « appris » | 3 arpèges sur 2 jours | **3 arpèges + une pose à froid réussie** (D45) |
| Durée d'une leçon | 4 écrans | 7 étapes, deux rangées de boutons, action principale toujours au-dessus de la barre |
| Mode sans matériel | absent | **QCM** à trois types, nœud `acc:savoir:*` (D47) |
| Enchaînement | rien | **mesuré** entre deux notes repères, nœud `acc:transition:*` (D46) |
| Progressions | moteur seul (1b) | **8 progressions** jouables, déclarées (D48) |
| Accordage | accordeur (3) | **guidé corde par corde** + rappel 3 jours (D49) |
| Curriculum | P0-P4 (17 accords) | **P0-P7 (35 accords)**, P8-P10 en phase 6 (D50) |
| Feuille de route | « son final + hub + thème + module » en 1c | 1c = audio seul ; les écrans en 1d |

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
| **Refonte UI** ✔ `532b52f`…`78b96e2` | Navigation simplifiée (accueil à deux portes, Gammes en une liste, tablature en tête d'exercice), thème clair « Aube », panneau de réussite, dix accomplissements, comètes, **rythme vertical unifié** (D64), **aération du contenu** (D66), **déploiement GitHub Pages** | Balayage 0 problème sur 19 écrans aux deux tailles, écarts sur **cinq valeurs** (0/4/8/12/20), thème clair au contraste mesuré, `dist` vérifié servi sous `/fret-wave/` — **atteint** (567 tests) |
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

| D35 | Où tourne la détection de hauteur (3) | **Fil principal**, pas le worklet : un module AudioWorklet n'est pas bundlé, donc `pitchy` (ESM) ne peut pas s'y importer sans build séparé et périssable. Le worklet fait ce qui est par bloc (anneau, RMS, attaque) et envoie une fenêtre toutes les 21 ms ; coût mesuré 0,17-0,37 ms par fenêtre. En prime, la convention de `pitchy` est corrigée : son `minVolumeDecibels` est en amplitude², d'où `dbfsToPitchy` (sinon le seuil réel était 100× trop bas) |
| D36 | Ce qu'un verdict audio a le droit d'affirmer (3) | **La case, jamais la corde** (une hauteur existe à plusieurs endroits) ; `fill` / `tuning` / `octave` / `wrong` / `outside` ; **accord ≠ erreur**, **octave ≠ erreur**, **note déjà écrite ≠ erreur**, erreur seulement à ≤ 2 demi-tons d'un trou |
| D37 | Réglages d'entrée (3) | Seuils **par source** (micro −42 / USB −36 dBFS), clarté 0,90, tolérance 35 cents, La 415-445 Hz, latences par source ; **tout est mémorisé** et lisible dans l'accordeur. Valeurs raisonnées, non calibrées sur une pièce réelle |
| D38 | Place de l'accordeur (3) | **Écran `#/accordeur` dans la barre de navigation** (4 onglets) ; la page « Son » (outil de contrôle 1c) **sort de la barre** et reste joignable depuis les réglages — cinq libellés pixel ne tiennent pas sur 390 px sans ellipse (mesuré) |
| D39 | Découpage de la phase 4 (4a) | **4a = moteur + leçon** (doigtés, boîte, curriculum, arpège, progression, recommandation), **4b = Fixer / Enchaîner / Intégrer**, QCM, accordage guidé, paliers P5-P10. Une phase ne se termine pas sur un écran qui promet plus que ce qu'il fait : l'écran dit quelles étapes restent |
| D40 | Doigtés (4a) | **Saisis, jamais calculés** ; relus par **règle mécanique** (un doigt = une case sauf barré, corde à vide/étouffée sans doigt, case la plus basse tenue par l'index ou le majeur, barré cohérent, 4 doigts au plus). L'ordre de pose est **déduit** (barré, puis index → auriculaire, cordes graves d'abord) |
| D41 | Boîte d'accord (4a) | **D1 = B appliqué** : boîte seulement dans Découvrir et Construire, désactivable (réglage), mêmes couleurs de fonction que la tablature, **se remplit doigt par doigt** ; les cordes à vide et étouffées sont visibles dès le premier geste |
| D42 | Validation d'un accord (4a) | **Mode arpège uniquement, ordre grave → aiguë** (seule façon de lever l'ambiguïté hauteur/corde en monophonie) ; 3 essais puis révélation ; **le plaqué est déclaré** (`kind: 'strum'`, `correct`/`total` à `null`) et ne peut jamais devenir une preuve |
| D43 | Nœuds de progression d'accord (4a) | `acc:accord:{voicingId}` dans **le même journal** ; « appris » = **3 vérifications propres sur 2 jours** (contre 2 pour une forme) ; même Leitner, même XP, hub filtré par module |
| D44 | Recommandation du prochain accord (4a) | Premier accord du parcours dont les prérequis sont **appris**, avec la **raison affichée** (prérequis + transitions déjà en place + ouverture de palier) ; **aucun accord inaccessible**, un accord commencé n'est jamais dit « verrouillé » |
| D45 | Pose à froid (4b) | **Exigée pour « appris »** : une pose réussie dans la limite (8/5/3 s selon le palier, resserrée par les réussites), **en plus** des 3 arpèges sur 2 jours. Le chrono s'arrête à la **première corde juste** ; la propreté se juge ensuite, sans limite. Verdict = temps **et** ≥ 80 % des cordes. Tentative `kind: 'cold'` avec `limitSec`, secondes arrondies au supérieur |
| D46 | Mesure d'une transition (4b) | **Entre deux notes repères** horodatées par le même détecteur : la basse quand elle change, sinon la **première corde qui diffère** (Em→Em7, F 4 cordes→F barré). La latence s'annule dans la différence. Exercice de 30 s, « propre » ≤ 2 s, « fluide » ≤ 1,5 s ; nœud `acc:transition:{a}>{b}` avec `changeMs` médian |
| D47 | QCM sans matériel (4b) | **Nœud de savoir distinct** (`acc:savoir:*`) : trois types (tab anonyme, notes, case masquée), distracteurs = **confusions réelles** (2 garanties), tirage déterministe, vivier = accords rencontrés. **Ne rend jamais un accord « appris »** ; XP 6 sans bonus de vitesse |
| D48 | Progressions (4b) | **8 progressions en données**, filtrées par les accords appris, **aucune avec un barré complet** ; une mesure par accord, motif de strum et métronome. La déclaration s'écrit `kind: 'strum'` + `progressionId`, `correct: null`, nœud `acc:progression:{id}` |
| D49 | Accordage guidé (4b) | Six cordes de la grave à l'aiguë, **±5 cents tenus 400 ms**, « ce n'est pas cette corde » au-delà de 90 cents ; enregistrement du dernier accordage (`fretwave.tuning.v1`) et **rappel au-delà de 3 jours** dans la leçon |
| D50 | Paliers P5-P10 (4b) | **P5 (couleurs), P6 (slash) et P7 (Fa, Si m) livrés** avec justifications, prérequis et transitions ; **P8 (barrés mobiles) et P10 (drop 2/3, extensions) en phase 6** : ils demandent des doigtés **saisis** pour les formes déplacées (D40), pas calculés |
| D51 | Typographie des libellés d'interface (4b) | **Ce qui se lit est en sans-serif ≥ 11,5 px**, contrasté et sans ellipse : les **sept étapes** de la leçon (numéro + libellé, 13 px / 600) et les **quatre onglets** de navigation (11,5 px / 600) quittent Silkscreen. Silkscreen reste pour les étiquettes de décor. Mesuré à 390 et 1 440 px : aucun débordement, aucune troncature, contraste ≥ 5,5:1 ; la barre de navigation devient **opaque** (le texte de la page passait à 6 % derrière les onglets) |
| D52 | Largeur de la tablature (4b, tour des pages) | **La tablature occupe la largeur de son contenant** : le plafond de 1 040 px centré la laissait à 1 040 dans un panneau de 1 256 (première chose qu'on voit). Le **layout étire aussi la dernière ligne** quand c'est la seule (un accord = une ligne) : sans cela le dessin s'arrêtait aux trois quarts du cadre. Sur téléphone, le panneau qui porte une tablature lui laisse **le padding entier** (marges négatives de 12 px) : à S = 2 une mesure de quatre accords demande 179 px logiques, et les 12 px de padding faisaient déborder le dessin de 24 px (fin de mesure coupée) |
| D53 | Ordre des panneaux de l'accordeur (4b, tour des pages) | L'**accordeur passe juste après l'entrée**, et les réglages fins (source, périphérique, seuil, tolérance, clarté, La) sont **repliés** dans un « Réglages d'entrée ». La page s'appelle « Accordeur » et la liste des cordes arrivait après 4 000 px de réglages : elle est maintenant sur le premier écran. Page : **6 432 → 2 488 px** sur téléphone |
| D54 | Refonte de navigation (branche `ui/simplification`) | **Un écran = un geste.** L'accueil passe de 10 panneaux de prose à 3 blocs : « Continuer » (la gamme en cours, ▶ Découvrir / S'exercer au micro), deux portes (Apprendre · Accorder), la révision **seulement quand elle est due**. Retirés de l'accueil : niveau détaillé, badges, liste des modules, code couleur, points d'entrée, note de journal — ils restent dans le journal et les réglages. **Gammes** devient un seul écran : famille, tonique, puis **la liste des positions**, chaque ligne portant ses deux gestes (Découvrir / S'exercer) ; l'accordage et le système de positions passent dans un repli. **Exercice** : la tablature à jouer passe **avant** les réglages, le micro devient un bouton primaire en tête, découpage / mélange / métronome sont repliés. Le mot « Exercice » désignait un QCM sans instrument : il s'appelle « Sans instrument ». Mesuré (téléphone) : accueil **4 301 → 844 px** (un écran), gammes 1 936 → 1 464, exercice 2 039 → 1 837 avec la tablature sur le premier écran |
| D55 | Décor plein écran, affiche partout (branche `ui/simplification`) | Le décor couvre **tout l'écran** sur toutes les pages : le voile ne l'éteint plus aux deux tiers de la hauteur (il ne sert qu'à la lisibilité du texte) et la **grille en perspective défile jusqu'en bas**. L'**affiche** (soleil rayé, montagnes) est présente **partout** : sur l'accueil le soleil est **centré** derrière le titre pixel dans une bande de 258 px (téléphone) / 300 px (bureau) ; sur les écrans de travail il est **décalé à droite** (`sunX = 0,82`) pour ne pas passer sous le titre, qui est aligné à gauche — mesuré : centré, le sous-titre devenait illisible sur le disque. Une ombre portée derrière les en-têtes garantit la lisibilité. Le **halo** du soleil est un disque tracé ligne par ligne : les deux `fillRect` d'origine faisaient un carré aux bords nets, visible dès que le soleil est remonté dans l'affiche |
| D56 | Famille « Mineures » dans le sélecteur de gammes (branche `ui/simplification`) | Le catalogue rangeait ses 31 gammes en cinq familles où **aucune ne s'appelait « mineure »** : la mineure naturelle (éolien) n'existait que dans « Majeure & modes », sous un nom de mode. Une famille **« Mineures »** est ajoutée, en deuxième position, avec les cinq gammes qu'on cherche quand on cherche « mineur » : éolien (mineure naturelle), pentatonique mineure, blues mineur, mineure harmonique, mineure mélodique. **Une gamme peut apparaître dans deux familles** : ici le regroupement sert à entrer par ce qu'on entend, pas à classer la théorie — c'est la première famille qui gagne pour l'affichage du sélecteur |
| D57 | La légende du halo est écrite sous la tablature (branche `ui/simplification`) | Le halo pulsé marque les **notes caractéristiques** (♭6 en mineure naturelle, ♭5 en blues mineur, ♯4 en lydien, ♭2 + ♭5 en locrien, aucune en ionien). L'explication n'existait qu'en bas de la page Découvrir et **pas du tout** sur l'écran d'exercice : la question « c'est quoi les cases qui brillent ? » est un défaut d'écran. Composant `TabLegend` **sous la tablature** des deux écrans. Mise en page revue (2e passe) : une simple phrase de prose ne se lisait pas — posée à même le décor, et au bureau tombée dans une seule colonne de la grille de page (89 px de large, 362 px de haut). C'est maintenant une **bande** sur fond de panneau, avec à gauche la **pastille réelle** (couleur de fonction identique à la portée) entourée d'un anneau qui pulse comme dans la tablature, puis un titre et une ligne : on montre le repère au lieu de le décrire. Variante sans note caractéristique : bande sans pastille, « Rien ne clignote sur cette gamme ». L'animation suit « réduire les animations » (anneau fixe) |
| D58 | Panneau de réussite animé (branche `ui/simplification`) | À la fin d'une série vérifiée, un panneau plein écran façon affiche synthwave (soleil rayé qui monte, grille en perspective qui défile, étoiles qui éclosent) récapitule : **XP gagné** en compteur, **XP total**, **XP du jour / plafond** avec sa barre, étoiles, précision, temps, cases révélées, erreurs, et un **sceau « sans faute »** quand la série est parfaite. Tous les chiffres sont **recalculés depuis le journal** (`xpSummary`, `streak`, `summarizeDay`) — le panneau n'incrémente rien. Il ne s'ouvre **qu'à partir de ★** (80 %) : en dessous, le panneau de résultat ordinaire dit la vérité sans fête. La série d'affilée n'est annoncée qu'à partir de deux jours (« 1 jour d'affilée » ne dit rien). Animation en **CSS pur** (aucun canvas de plus), figée par « réduire les animations » et par `prefers-reduced-motion` ; fermeture par le bouton, Échap ou clic sur le fond. Décoration `Celebration.tsx` |
| D59 | Bloc « Derniers accomplissements » sur l'accueil (branche `ui/simplification`) | Dix franchissements relus depuis le journal, du plus récent au plus ancien : `perfect` (série à 100 %), `pass` (≥ 80 %, le seuil de `PASS`), `learned` (2 réussites sur 2 jours), `mastered` (révision tenue à 16 jours), `chord` (3 vérifications propres sur 2 jours, D45), `streak` (3/7/14/30 jours). Chaque ligne donne le genre, ce sur quoi il porte (« La mineure pentatonique · Box 1 · cases 5–8 »), la mesure (« 94 % au premier essai · Rappel (N3) · grille tenue · +14 XP »), la date relative et un bouton **▶ Rejouer** qui rouvre la forme. Rien n'est stocké en double : les franchissements de maîtrise sont retrouvés par **rejeu** du journal (on avance tentative par tentative et on compare l'état du nœud avant/après) ; la tentative qui provoque un palier **ne compte pas deux fois** (c'est le palier qui est la nouvelle). Un avis à 79 % ne produit rien, une écoute non plus |
| D60 | Thème clair « Aube » (branche `ui/simplification`) | Deuxième ambiance sélectionnable, **même monde** que Synthwave Neon : ciel d'aube (rose pâle → orange), soleil rayé, montagnes en silhouettes claires, grille en perspective — mais sur papier. Trois règles : l'encre d'abord (`text` 16:1, `muted` 9,8:1, `dim` 7,2:1 sur le fond), les accents **assombris** et non délavés (magenta `#C2185B`, cyan `#0B6E7A` — tous ≥ 4,5:1 comme encre), la pastille d'intervalle **inchangée** (elle porte l'apprentissage : seul le panneau de tablature s'éclaircit, avec une encre sombre). Jetons nouveaux : `onAccent` (encre posée sur un aplat d'accent — sans lui, un bouton écrit `#12021f` devient illisible au deuxième thème), `--veil-rgb` (teinte du voile du décor dérivée du fond), `--shadow-ink` (ombre portée teintée), `scheme` (polarité : vérifiée par les tests, et déclarée en `color-scheme` pour les contrôles natifs). **Canvas** : la tablature et la boîte d'accord reçoivent désormais les jetons du thème actif — ils étaient figés en dur sur `THEME_SYNTHWAVE` et restaient sombres en thème clair. Les scanlines sont **interdites** par le thème clair (le jeton existait, il sert enfin) |
| D61 | Les accords retrouvent une place de premier rang (branche `ui/simplification`) | La refonte les avait réduits à un lien de pied d'accueil : invisible, alors que le cycle des sept étapes est complet depuis la 4b. Ils gagnent un **onglet** dans la barre (5 onglets : 68 px sur téléphone à 390, 62 à 360, aucun libellé tronqué) et une **porte** sur l'accueil qui dit l'état réel du parcours et le prochain accord (« 0 / 35 appris · Prochain : Em (palier P1) »). La simplification est conservée : l'accueil garde sa hiérarchie (Continuer → trois portes → révision → accomplissements), les accords n'ajoutent qu'une porte, aucun panneau de prose. **La porte « Accorder » sera retirée en D65 : trois portes à ce moment-là, deux depuis.** Défaut corrigé au passage : la barre du bureau avait `repeat(4, 148px)` en dur, la cinquième colonne implicite avalait 688 px — colonne auto de largeur fixe désormais, quel que soit le nombre d'onglets |
| D62 | Relecture des formulations affichées (branche `ui/simplification`) | Le texte de l'app est jugé **à l'écran**, pas dans le code : les neuf écrans ont été relus depuis leur `innerText` réel. Six règles en sortent. (1) **Aucun vocabulaire interne** : pas de « phase 5 », « 1d », « voicing », « nœud », « journal », « hub » ; une échéance future se dit « l'app ne l'écoute pas encore », jamais « la phase 5 le fera ». (2) **Une position s'appelle une position** : « Box 1 » n'apparaît plus à l'écran (helper `positionLabelPlain`), le nom du système reste dans l'étiquette du panneau, où il est expliqué. (3) **On nomme le contrôle qu'on demande d'utiliser** : « active « Fondamentales » **dans « Plus d'options »** », « ouvre le micro » (le commutateur est devenu un bouton). (4) **Un seul verbe par geste** : « s'exercer » (plus « se tester »), « entrer » (plus « ouvrir »), « clignoter » (plus « pulser »). (5) **Une clause de contexte, pas trois** : « Pourquoi maintenant » ne répète plus « cette étape » et « le palier P1 » dans la même phrase. (6) **Pas de doublon d'étiquette** : un panneau « Sans instrument » n'affiche plus un badge « sans matériel ». Aucun test de comportement touché : seules trois assertions de libellé ont suivi la nouvelle formulation |
| D63 | Comètes dans le ciel du thème sombre (branche `ui/simplification`) | Une **petite comète** traverse le ciel de temps en temps : une toutes les **7 s** environ (`COMET_SLOT_S`), traversée de **1,15 s** sur ~60 % de la largeur, traînée de 10 à 24 px dont l'alpha décroît vers la queue, tête de 2 px. Dessinée dans la **couche animée** (`drawComets`, appelée par `drawSceneMotion`) : elle hérite donc de l'arrêt des animations (`reduceMotion`) et du 30 img/s existant. **Fonction pure** : tout vient de `time` et d'un tirage `mulberry32` par créneau, donc deux rendus du même instant sont identiques et rien ne traîne entre les images ; deux créneaux au plus sont évalués (une comète peut finir pendant le suivant), jamais deux à la fois. **Le ciel décide** : jeton `comet` dans `SceneTokens`, présent sur Synthwave Neon, **absent** sur Aube (une traînée lumineuse sur du papier se lit comme une rayure). Deux tests : une comète existe et sa tête avance ; sans jeton, rien n'est dessiné, et un rendu privé du jeton à l'instant d'une comète ne laisse aucune trace |
| D64 | Un seul rythme vertical sur toutes les pages (branche `ui/simplification`) | L'audit (`tools/spacing-check.mjs`, 10 pages × 2 tailles, écarts entre blocs de page et entre enfants de panneau) mesurait **dix-neuf valeurs** différentes : 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 38, 44, 67 px. Cause : chaque composant portait sa marge et, sur téléphone, les marges de blocs adjacents s'additionnaient ou se contractaient selon `overflow`. Désormais **trois jetons** — `--gap-block` 12 px entre deux blocs de page (20 px au bureau, où c'est la grille qui le pose), `--gap-inside` 8 px entre deux sous-blocs d'un panneau, `--gap-tight` 4 px pour une étiquette collée à ce qu'elle annonce — et sur téléphone `.shell` est une **colonne à `gap` constant** : les blocs ne portent plus de marge verticale. Mesure après : **0, 4, 8, 12, 20 px, aucune valeur hors échelle**. Une marge en ligne (`style={{ marginTop: 14 }}` dans l'accordeur) passait au-dessus de tout : supprimée |
| D65 | Deux portes d'accueil, pas trois (branche `ui/simplification`) | « Accorder » occupait une porte entière alors que l'accordeur a **son onglet** dans la barre depuis la phase 3 : une porte qui double un onglet coûte une décision pour rien. La porte disparaît, **Accords prend sa place** (demi-largeur, à côté d'Apprendre) et son sous-titre se resserre (« 0 / 35 appris · doigt par doigt, puis corde par corde au micro. Prochain : Em. »). L'accueil tient donc en **Continuer · Apprendre · Accords · accomplissements**, et l'accordeur reste à un clic dans la barre — c'est écrit dans son onglet, pas répété en porte |
| D66 | Ce qui respire : un rembourrage de panneau, un interligne, des lignes de liste (branche `master`) | Le contenu des cartes de droite des Accords (« Ordre de pose », « Ce que le micro ne peut pas dire »…) était tassé. Trois causes, trois corrections : `.panel` passe de 12 à **14 px** de rembourrage (16/18 au bureau), `.t-small` de 1,45 à **1,55** d'interligne (comme `.t-body`), et les lignes de liste (`.finger-step`, `.check-row`) de 9/11 px à **11/12 px** de rembourrage avec **8 px** d'écart. Deux détails corrigés en chemin : une pastille d'état **vide** se dessinait comme une petite boîte (désormais non rendue quand il n'y a rien à dire) et sur téléphone le numéro « ① » partait seul au-dessus du texte (`.finger-body { flex: 1 1 180px }`, en sélecteur à deux classes — sinon la règle générale plus bas dans le fichier gagne). Le rembourrage n'est pas un écart : l'échelle 0/4/8/12/20 de D64 ne bouge pas |
| D67 | Entendre six cordes ensemble — l'écoute polyphonique (phase 5) | `core/input/poly.ts` : attaque par flux spectral, FFT 16 384 sur la fenêtre **après** l'attaque (2,9 Hz/bin), somme harmonique 1-6 par note attendue, **des graves vers les aiguës**, avec retrait de la **part modélisée** de chaque corde — pas du pic entier. Ce détail décide de tout : dans un Em, la fondamentale du Si aigu (247 Hz) tombe **exactement** sur le 3ᵉ harmonique du Mi grave et le 2ᵉ du Si médium ; retirer le pic effaçait la note cherchée (mesuré : confiance 0,16 au lieu de 1,00 à 30 dB avant correction). Le plancher de bruit est **relatif** (0,4 % du pic le plus fort), sinon les fuites d'une corde grave passaient pour une preuve et tout saturait à 1,00. Confiance par corde en échelle logarithmique du rapport signal/plancher (3× = 0, 40× = 1) ; **jamais un verdict binaire**. Score d'une hypothèse = confiance **moins la pénalité d'inexpliqué** (fondamentales fortes que l'accord ne prédit pas, pondérées 0,45) : c'est elle qui distingue « Do » de « La mineur 7 » — sans elle, un accord inclus dans un autre gagnait toujours. **Matrice de confusion publiée** (`tests/poly-matrix.test.ts`, 11 accords × 7 conditions) : **91 % d'accords justes dans les 7 conditions**, **224/224 cordes entendues** sur les quatre conditions réalistes, marge médiane +0,51 sur le second. **Seule confusion : G/B pris pour G** — G/B double la corde de Si, deux cordes à l'unisson font un seul pic : ce n'est pas réglable, et le test le fige pour que personne ne « répare » le score |
| D68 | La capture et la gestuelle d'écoute (phase 5) | Un **tampon circulaire** de 1,5 s (`core/input/capture.ts`) garde la queue de chaque bloc du Worklet (seule partie neuve : les fenêtres se recouvrent) ; l'analyse ne tourne **qu'au moment où l'élève demande**, jamais en continu. Gestuelle : on **arme**, l'app attend la **vraie attaque** détectée par l'entrée (pas un compte à rebours), laisse **380 ms** de régime stable, puis analyse les **520 ms** les plus récentes. Délai de secours de 4 s (si l'élève ne joue pas, l'analyse dit « rien entendu », ce qui est une réponse honnête) et refus sous **150 ms** de son : mieux vaut refuser que rendre un spectre faux. Écran : verdict en une phrase, **six lignes de 19 px** (corde, barre de confiance, pourcentage), corde manquante en orange avec le mot « absente », et **message ciblé** — « Sol♯ à la place de Sol (corde de Sol) » — jamais « faux ». Le bouton de secours « Je le déclare, sans micro » reste, en statut non vérifié |
| D69 | Un plaqué écouté est une vérification (phase 5) | Nouveau genre de tentative `pluck`, avec un champ **`confidence`** borné à 0-1 par `normalizeAttempt` (une valeur hors bornes est préférée absente à fausse). Il **compte comme une vérification** de l'accord (nœud `acc:accord:{voicingId}`, `correct` = cordes entendues) : c'est plus strict qu'un arpège, puisque six cordes sonnent ensemble. En revanche il **ne remplace pas** l'arpège dans « appris » : l'arpège reste la référence d'apprentissage parce que c'est lui qui dit *quelle* corde manque. La déclaration sans micro reste `strum`, jamais vérifiée |
| D70 | Passe mobile à l'œil : ce que les mesures ne voyaient pas (branche `master`) | Tour Playwright **en capture** sur les 12 écrans à 390 × 844 (pas seulement les mesures) : huit défauts trouvés, tous corrigés. (1) La phrase d'intro de la page Accords était **posée sur le décor**, sous le soleil et les étoiles → bande `.lead-band` (fond de panneau), même traitement que l'objectif d'étape de D66. (2) Les **noms de cordes de la tablature touchaient la bordure** du panneau : la portée déborde volontairement (marges négatives = rembourrage), donc la colonne des noms commençait à 1 px logique de la bordure → option `padLeft` (4 px logiques) dans la mise en page, **déduite du budget de largeur** pour ne rien faire déborder. (3) La **signature rythmique « 4/4 »** s'affichait en mode débutant, empilée au début de la portée, et se lisait comme un doigté → masquée quand les hampes le sont. (4) « **Box 1 · cases 5–8** » restait dessiné dans la tablature alors que D62 bannit ce mot de l'écran → `positionLabelPlain`. (5) Cinq boutons de largeurs différentes empilés à l'étape Plaquer (156, 250, 218, 272, 172 px) → sur téléphone ils s'apparient deux par deux à largeur égale, et un bouton seul prend la ligne. (6) Deux boutons côte à côte n'avaient pas la même hauteur (« S'EXERCER AU MICRO » sur deux lignes) → `.row { align-items: stretch }`. (7) Le libellé « Réglages d'entrée · source, seuil, tolérance, La » se coupait avec une **virgule en tête de ligne** → « Réglages d'entrée ». (8) Des **fragments de phrase en minuscule** traînaient seuls en bas d'un panneau (« mêmes notes que Do majeur », « le premier accord : … ») → `whySentence` / `asSentence` les capitalisent, et la parenté remonte en tête du panneau Lecture au lieu de rester une ligne orpheline. Au passage, l'outil de balayage apprend à lire les marges négatives portées par un **conteneur intermédiaire** (`.quiz-tab`) : il déclarait la tablature du QCM trop large alors qu'elle prenait la largeur de son panneau |
| D71 | Accompagnements **synthétisés** et **en données** (phase 7) | La musique d'accompagnement est une **fonction pure** : `backingPattern(backing, tonique)` rend la liste des événements (voix, temps, hauteurs, durée, gain), et `BackingPlayer` ne fait que les **programmer** sur le contexte audio avec 250 ms d'avance. Quatre accompagnements en données, décrits **par degré** (0 = i, 8 = ♭VI…) et non par nom : la même boucle se transpose sur n'importe quelle tonique, et l'élève improvise dans la gamme qu'il travaille. Le style n'est pas un habillage : le synthwave a une caisse claire sur 2 et 4, le lo-fi **sur 3 seulement** (half-time) avec des accords de septième. Synthèse plutôt qu'échantillons : 12 Mo de guitare suffisent déjà, et un accompagnement synthétique ne vole pas la vedette. Nouveau bus **`backing`** (volume séparé, trim −3 dB, **pas de réverb** : une nappe réverbérée noie la guitare) |
| D72 | Cinq rôles harmoniques, un score, **un** conseil (phase 7) | Chaque note jouée est classée **dans son contexte** : `chord` (1/3/5/7), `color` (tension consonante : 9, ♯11, 13), `passing` (dans la gamme, étrangère à l'accord), `avoid` (la **quarte sur majeur et dominante** — le demi-ton qui frotte la tierce), `out` (hors gamme). Deux choix assumés par rapport au principe de `MUSIC_DESIGN` §8 : la note à éviter est la quarte, **pas** « tout demi-ton au-dessus d'une note d'accord » (la ♭9 est une tension de dominante, pas une faute), et **le temps ne change pas le rôle, il change le score** — la pastille reste stable, la place est jugée. Score 0-100 : **45 %** notes d'accord + **20 %** dans la gamme + **35 %** d'accords **sur les temps forts** (c'est là que ça s'entend). Le bilan donne **une seule** phrase : rester dans la gamme, puis visiter l'accord, puis le placer au temps, et seulement ensuite proposer une tension |
| D73 | P3 de la phase 3 : **la note entendue s'allume sur la position** (phase 7) | `TabView` reçoit un `flash` (corde + case) et dessine l'anneau du curseur sur la pastille correspondante ; la couche animée continue de tourner tant qu'un flash existe. Deux écrans l'utilisent : **l'improvisation** (la note jouée s'inscrit à sa place pendant que la grille tourne) et **la page Découvrir** (bande « M'écouter » sous la tablature), ce qui livre enfin P3 de la phase 3. Le placement se fait contre les **notes de la position affichée** (`core/impro/locate.ts`), jamais ailleurs sur le manche : à défaut d'octave exacte on prend **l'octave la plus proche**, puis la plus proche de la note précédente — une ligne mélodique se joue dans un voisinage |
| D74 | Improviser n'est pas jouer une forme (phase 7) | Nouveau genre `impro`, **niveau 4**, sur un nœud **distinct** `gam:impro:{gamme}:{système}:{forme}` : sans cela, une prise bavarde et fausse aurait fait baisser la maîtrise d'une position qu'on joue proprement note à note, et une prise juste l'aurait gonflée sans qu'on ait rien répété. `correct`/`total` y valent les notes d'accord sur le total joué — un **taux**, pas un exercice réussi ou raté. XP 12 × le taux (plafond journalier inchangé) : la quantité de notes ne doit pas payer |
| D75 | **Rien de transparent sur le décor** (branche `master`) | Ta règle : « aucun bouton transparent, aucun texte sans fond derrière ». La scène (soleil, grille, étoiles) est un canvas **derrière** l'application : tout ce qui n'a pas de fond propre se lit dessus avec un contraste imprévisible. Nouvel audit `tools/contrast-audit.mjs` : 11 routes, il remonte les éléments **interactifs** et les blocs de **texte** dont aucun ancêtre n'a de fond opaque. **52 éléments** trouvés au premier passage, **0** après. Corrigés : `.btn-quiet` (les boutons « ‹ Position », « Position › », « ← Changer de gamme », « Accueil » étaient littéralement transparents), `.chip` (toutes les pastilles : familles, toniques, niveaux, motifs), `.linkish`, les boutons du pied d'accueil, l'**en-tête de toutes les pages** (devenu une **bande** pleine — titre, sous-titre et étiquette ne reposent plus sur un dégradé), `.pos-nav`, `.next-step`, `.foot-note`, les paragraphes d'intro des Accords et du QCM (en `.lead-band`) et l'affiche d'accueil (dégradé qui laisse le **soleil franc** en haut et pose le titre sur une plaque opaque en bas — un voile uniforme à 0,52 le rendait olive, mesuré sur capture). Deux textes faux trouvés en chemin : « le niveau 4 n'est pas encore ouvert » (il l'est depuis la phase 7) et « l'accord plaqué n'est pas encore écouté » (depuis la phase 5). **Retour suivant** : la bande « M'écouter » de la page Découvrir était une **boîte dans une boîte** (le commutateur gardait son propre fond et sa bordure dans la bande), avec une case de 20 px et une phrase en 12,5 px : un seul cadre désormais, case de 26 px, libellé 15 px, phrase en 13 px à **9,9:1** de contraste. Et la bande tombait dans **une** colonne de la grille au bureau (90 px de large, phrase sur 158 px de haut) : `grid-column: 1 / -1` |
| D76 | Les cartes remplissent leur rangée (branche `master`) | Ta remarque : « les cartes ne font pas toutes la largeur, exemple sur la page gammes ». Nouvel audit `tools/card-audit.mjs` : pour chaque route et chaque taille, il compare chaque panneau à la largeur utile de la page (téléphone : pleine largeur obligatoire) et, au bureau, vérifie que **la somme des cartes d'une rangée + les gouttières = la largeur de la page** (une carte sans `span-N` laisse un trou visible). **8 trous** trouvés, tous au bureau : `Instrument` seul (5/12), « Ce que cet exercice mesure » seul (7/12), `Entrée` seul (7/12), `Accordeur`+`Latence` à 6+5, et trois sur Réglages (`Exercices`+`Mouvement` à 6+5, `Son` seul, `Données locales` seul). Corrigés en passant les cartes secondaires en **pleine largeur** (la règle : une rangée est soit une carte pleine, soit une paire qui la remplit). Au passage, le **mixeur** affichait des curseurs de 140 px au milieu d'une carte de 1 256 px : `label.inline` (0,1,1) l'emportait sur `.mix-row` (0,1,0), donc la rangée restait un flex — sélecteurs passés à deux classes, curseurs de 340 px, tous alignés. Et le canal **Accompagnement** manquait dans les Réglages (il n'existait qu'au mixeur de la page Audio) |

**D1-D70 tranchées** (D13 écartée ; D7 remplacée par D14 ; D18 tranchée ; **D24 = la typographie de la 1d**, ajoutée au journal). **Aucune décision en attente** : la suite (phase 5) est décrite au §12.

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
- **Correction de lisibilité** (commit `688aff7` ; ta remarque : « les cartes n'ont pas de fond, le contraste est vraiment faible ») : les quatre sections du hub (**Par où commencer, Badges, Modules, Le code couleur**) étaient posées **à même le décor**, sans panneau ; plusieurs cartes étaient **translucides** (`rgba(…, 0.5-0.72)`) ou de la **même couleur que leur panneau** (touches du pavé, cartes de module, lignes de liste), donc invisibles en tant que cartes ; le texte secondaire (`--dim`) tombait à **4,6:1** sur une carte. Corrigé (D34) : panneaux partout, cartes en `surface-hi` opaque, creux en `bg`, `muted`/`dim` éclaircis, seuils relevés dans `theme.test.ts`, titre de module en `text` + filet d'accent, colonne de gauche tendue à la hauteur de sa rangée. Vérifié au navigateur : contraste minimum **5,2:1** (207 textes sur quatre écrans), aucun sous 4,5, rangées alignées. **Trouvé en route** : le serveur Vite de la session servait un **CSS périmé** (le fichier sur disque était bon, la feuille servie gardait `--accent` sur les titres de module) → serveur redémarré ; `curl http://127.0.0.1:5173/src/app/app.css` le montre en une commande (même piège qu'en 1d).
- **Phase 3** (terminée, commit en fin de phase) : entrée audio monophonique de bout en bout — `pitchy` + retenue de note, worklet de capture, appariement hauteur → case, seuils par source, plancher de bruit et **latence mesurés**, accordeur, « Micro » dans les niveaux 2-3 avec **tempo mesuré au jeu**. **431 tests** (430 verts, 1 ignoré), `tsc` propre, build OK. Vérifié : justesse ≤ 0,3 cent sur 49 hauteurs, silence et bruit refusés, et surtout **le chemin complet avec un micro simulé rejouant de vrais échantillons nylon** (notes lues à ≤ 9 cents, cases remplies, ★★★, tentative journalisée ; chemin d'erreur avec révélation et `missedStrings`). **Trouvé en route, corrigé** : (1) `start()` prenait son jeton avant `stop()` → l'ouverture du micro s'annulait elle-même ; (2) `new AudioWorkletNode` refusé par le contexte enveloppé de Tone → contexte natif ; (3) seuil `pitchy` 100× trop bas (dBFS vs amplitude²) ; (4) jouer une note visible du segment comptait comme une erreur ; (5) une attaque pouvait être perdue entre deux messages du worklet ; (6) la barre de navigation passait à la ligne puis tronquait « ACCORDEUR » ; (7) « corde de Ré3 » annoncée pour un Do3 ; (8) une latence tirée d'une seule mesure était mémorisée ; (9) `**…**` affiché littéralement dans le JSX ; (10) « MI » deux fois dans l'accordeur (police en capitales). **Non vérifié** : vraie guitare, vrai micro, latence réelle, Safari/iOS, chemin `grid: kept` au micro.
- **Phase 4a** (terminée, commit `2c447d6`) : module Accords, partie A — curriculum P0-P4 + branche rock avec justifications et prérequis, **44 doigtés saisis** et relus par règle, boîte d'accord pixel (D1 = B), leçon Découvrir / Construire (doigt validé au micro) / Vérifier (arpège corde par corde) / Plaquer (déclaré), nœuds `acc:accord:*` dans le journal existant, recommandation justifiée, panneau hub. **489 tests** (488 verts, 1 ignoré), `tsc` propre, build OK. Vérifié au navigateur : micro simulé jouant les six cordes de Mi mineur (échantillons nylon) → **6/6 cordes, +4 à +19 cents, tentative `arpeggio` journalisée en 9 s** ; chemin d'erreur → révélation et `missedStrings: [0]` sur une tentative 5/6 ; aucun débordement à 390 et 1 440 sur les cinq écrans du module ; aucune erreur console. **Trouvé en route, corrigé** : (1) le canvas de la boîte héritait de `.pix` (`position: absolute`) et **recouvrait les boutons** — l'élève ne pouvait pas cliquer « Doigt posé » ; (2) les conseils parlaient en notation du modèle (« corde de E2 ») au lieu de la couche d'affichage ; (3) conseil « appuie derrière la frette 0 » sur une corde à vide ; (4) en-tête à quatre blocs dans une grille à trois colonnes → titre superposé au sous-titre ; (5) une déclaration sans micro enregistrait `correct: 6/6` (une auto-évaluation devenait une preuve) ; (6) fenêtre de la boîte démarrant à la case 2 sur un accord ouvert ; (7) cordes à vide masquées à l'étape Construire ; (8) P0 affiché « franchi 0/0 » ; (9) « Reprendre cette leçon » sur un accord jamais ouvert. **Non démontré** : la règle « note morte » sur un vrai signal (un échantillon atténué et abaissé de 28 cents est lu **+187 cents** par le détecteur — verdict `outside`, donc aucune erreur comptée, mais la démonstration manque) ; vraie guitare, vrai micro, vrai téléphone, Safari/iOS. **Revue de la vue accord (ton signalement)** : en-tête superposé, quatre étapes sur deux lignes qui poussaient « Construire » **sous la barre de navigation**, boîte d'accord un écran plus bas, panneaux **écrasés sur une colonne** au bureau (`.span-12` n'existait pas), signature rythmique mordant la première pastille, tablature coupée à droite : tout corrigé et revérifié écran par écran (page **1 970 → 1 311 px** sur téléphone, action principale visible, 0 erreur console).
- **Aération des cartes d'Accords, et la phrase posée sur le décor (tes retours : « les cartes de droite… trop serré » et « la phrase *Corde par corde…* est écrite directement sans rien derrière »)** : deux défauts distincts. (1) Les cartes étaient tassées — rembourrage des panneaux 12 → 14 px (16/18 au bureau), interligne des petits textes 1,45 → 1,55, lignes de doigts et de vérification 9/11 → 11/12 px avec 8 px d'écart. (2) L'objectif de l'étape était un `<p>` **sans fond**, écrit à même le ciel étoilé sur les sept étapes, avec la case « boîte d'accord » collée dans la même phrase (« … au micro ou à l'oreille. boîte d'accord »). Il devient une **bande pleine** (fond de panneau, bordure) : la phrase d'un côté, le réglage de l'autre, à droite au bureau et sous le texte sur téléphone. Deux pastilles vides supprimées, un numéro orphelin corrigé. Décision **D66**.
- **Deux portes au lieu de trois (ta demande : « mets Accords à la place de Accorder, vire le bloc Accorder, il est dans le menu »)** : l'accordeur garde son onglet dans la barre, sa porte d'accueil faisait doublon et coûtait une décision. Accords remonte en deuxième position, en demi-largeur à côté d'Apprendre, sous-titre resserré (« Prochain : Em. » au lieu de « (palier P1) »). Mesuré : deux cartes de 362 × 128 px sur téléphone, 638 × 128 au bureau, journal des écarts toujours sur l'échelle 0/4/8/12/20, balayage à 0 problème. Décision **D65**.
- **Rythme vertical unifié (ta demande : « vérifie toutes les marges entre tous les blocs sur toutes les pages »)** : nouvel outil `tools/spacing-check.mjs` (10 pages × 2 tailles, écarts mesurés entre blocs de page et entre enfants de panneau, histogramme). Avant : **dix-neuf valeurs** de 0 à 67 px, dont 2, 6, 10, 14, 18 qui ne correspondent à rien. Après : trois jetons (`--gap-block` 12/20, `--gap-inside` 8, `--gap-tight` 4), `.shell` en colonne à `gap` constant sur téléphone, plus aucune marge locale sur les blocs et les composants qui en portaient une. Mesure : **0, 4, 8, 12, 20 px — aucune valeur hors échelle**. Deux défauts trouvés en chemin : une marge écrite en style en ligne dans l'accordeur (14 px, au-dessus de la feuille de style) et l'ombre des en-têtes trop faible, qui laissait le soleil de l'affiche sous le sous-titre de la page Gammes. Décision **D64**.
- **Comètes sur le ciel sombre (ta demande : « des petites comètes qui traversent le ciel étoilé »)** : une toutes les 7 s environ, traversée de 1,15 s, traînée de 10 à 24 px avec une tête de 2 px — dessinée dans la couche animée, donc arrêtée avec « réduire les animations ». Fonction **pure** (aucun état entre les images, même instant = même image) et **pilotée par un jeton de thème** : le ciel clair n'en reçoit pas. Vérifié par deux tests et par un rendu ×3 de la couche (traînée diagonale, tête plus brillante). Décision **D63**.
- **Relecture des formulations (ta demande : « refais un tour sur toutes les formulations »)** : le texte des neuf écrans a été relu **depuis l'écran** (`innerText` des pages, pas le code), et une vingtaine de corrections sont sorties — le jargon interne fuyait partout (« Box 1 » en en-tête alors que la liste dit « Position 1 », « phases 2 et 7 », « analyse polyphonique en phase 5 », « Nœuds de savoir suivis », bouton « Hub »), plus des ambiguïtés (« elle se remplit », « tape la case au pavé », « fausse note d'accordage fausse tout ») et des promesses internes (« la phase 5 l'écoutera » → « l'app ne l'écoute pas encore »). Règles consignées en **D62**. Les tests de libellé ont suivi (3 assertions), aucun test de comportement n'a bougé.
- **Les accords remis en place (ta demande : « remet les accords en place tout en gardant la simplification »)** : ils n'étaient plus joignables que par un lien de pied d'accueil. Cinquième **onglet** dans la barre (mesuré : 68 px par onglet à 390 px, 62 à 360, aucun libellé tronqué) et **porte** sur l'accueil avec l'état réel du parcours et le prochain accord. Le lien de pied disparaît (doublon). La hiérarchie de l'accueil ne bouge pas : Continuer → trois portes → révision → accomplissements (D65 en retirera une). Défaut trouvé en chemin : `repeat(4, 148px)` en dur sur la barre du bureau, la 5e colonne implicite avalait 688 px — passée en colonne auto. Décision **D61**.
- **Deuxième ambiance « Aube » (ta demande : « un nouveau thème sélectionnable, dans le même genre mais en thème plus clair »)** : le sélecteur de Réglages existait mais ses lignes étaient **décoratives** (aucun clic) — elles sont devenues des boutons, avec l'ambiance active marquée. La palette claire est construite sur trois règles : encre d'abord (16,2:1 / 9,8:1 / 7,2:1), accents assombris et non délavés (magenta `#C2185B`, cyan `#0B6E7A`, tous ≥ 4,5:1 comme encre), couleurs d'intervalle **inchangées** (seul le panneau de tablature s'éclaircit). Quatre jetons nouveaux : `onAccent`, `--veil-rgb`, `--shadow-ink`, `scheme`. Défaut trouvé en route : la tablature et la boîte d'accord importaient `THEME_SYNTHWAVE` **en dur** et restaient sombres en thème clair — elles passent par `useThemeTokens()`. Les scanlines sont interdites en clair. Vérifié : bascule aller-retour, persistance au rechargement, 13 routes balayées en clair aux deux tailles (0 débordement, 0 texte sous 11 px, 0 erreur console), contrastes mesurés au navigateur. Décision **D60**.
- **Accomplissements sur l'accueil (ta demande : les 10 derniers, avec les détails)** : nouveau module pur `modules/gammes/accomplishments.ts` (7 tests) qui relit le journal et rend dix franchissements datés — série réussie, sans-faute, forme apprise, forme maîtrisée, accord appris, palier de jours. Chaque ligne porte le sujet, la mesure et une date relative, plus **▶ Rejouer**. Les passages de maîtrise sont trouvés par **rejeu** (état du nœud avant/après chaque tentative), et la série qui déclenche un palier n'apparaît pas deux fois. Vérifié avec un journal de synthèse de 6 tentatives sur 3 jours : 7 entrées, tri du plus récent au plus ancien, aucun doublon, 0 erreur console. Décision **D59**.
- **Panneau de réussite animé (ta demande : une animation synthwave avec le récap des points)** : à la fin d'une série, une affiche plein écran — soleil rayé qui monte, grille en perspective qui défile, étoiles en éclosion — et le récap : **+15 XP** en compteur, **15 XP au total · 15 / 120 aujourd'hui** avec sa barre, étoiles, précision, temps, révélés, erreurs, sceau « sans faute ». Tous les chiffres sont recalculés depuis le journal, et le panneau ne s'ouvre **qu'à partir de ★** : en dessous, le panneau de résultat ordinaire suffit. Vérifié au navigateur en terminant réellement une série (3 trous justes via les crochets de développement) : panneau affiché sur téléphone et au bureau, fermeture par bouton/Échap/fond, variante `prefers-reduced-motion` figée ; 0 erreur console. Décision **D58**.
- **Légende du halo sous la tablature (ta question : « c'est quoi les cases qui brillent ? »)** : ce sont les **notes caractéristiques** de la gamme (♭6 en mineure naturelle, ♭5 en blues mineur, ♯4 en lydien, ♭2 et ♭5 en locrien, rien en ionien) — le repère pédagogique central de l'écran, expliqué seulement en bas de la page Découvrir et jamais sur l'écran d'exercice. Composant `TabLegend` ajouté sous la tablature des deux écrans, pastille du degré dans sa couleur, phrase accordée au nombre de notes (singulier / pluriel / aucune). Mesuré : « Note caractéristique · ♭6 » sur l'éolien, « ♭5 » sur le blues mineur, « Aucune note caractéristique » sur la pentatonique mineure. Deuxième passe sur la mise en page (phrase de prose → bande avec la pastille et son anneau) : au bureau la légende était tombée dans une seule colonne de 89 px. Décision **D57**.
- **Famille « Mineures » (ta remarque : « il manque les gammes mineures non ? »)** : exact, et c'était un défaut d'architecture d'information, pas de catalogue — les cinq gammes mineures existaient, mais rangées sous « Pentatoniques » ou sous « Majeure & modes » (l'éolien s'appelait « mineure naturelle » entre parenthèses). Une famille **Mineures** les réunit au deuxième rang du sélecteur : éolien, pentatonique mineure, blues mineur, mineure harmonique, mineure mélodique. Elles restent dans leur famille d'origine (une gamme peut apparaître deux fois : ici on entre par ce qu'on entend). Mesuré : 6 pastilles de famille, 5 lignes, aucun texte tronqué, 0 problème au balayage. Décision **D56**.
- **Décor plein écran et retour de l'affiche (ta demande : « l'image de fond en fullscreen, j'aimais bien le soleil en haut »)** : le décor occupait tout l'écran mais le voile le coupait à 64 % de la hauteur (le bas de page était un aplat) — le voile ne fait plus que garantir la lisibilité. L'accueil retrouve une **affiche** de 258 px (téléphone) / 300 px (bureau) où le soleil passe derrière le titre pixel. Corrigé en route : le halo du soleil était deux **carrés** aux bords nets (`fillRect`), visibles dès que le soleil est remonté — il est maintenant tracé comme un disque, ligne par ligne. Puis, à ta demande (« fais sur toutes les pages »), l'affiche est passée **partout** avec le soleil **décalé à droite** sur les écrans de travail (`sunX = 0,82`) : centré, il tombait sous le sous-titre et le rendait illisible. Décision **D55**.
- **Refonte de navigation — branche `ui/simplification` (ta demande : « je ne sais même pas où aller pour faire des exercices », le mot d'ordre étant simplicité et navigation facile)** : l'accueil est ramené à **trois blocs** (Continuer · Apprendre · Accorder) et la révision n'apparaît que si une carte est due ; les compteurs de prose (niveau, badges, modules, code couleur, points d'entrée) sortent de l'écran. La page **Gammes** fusionne les quatre étapes numérotées en **une liste de positions** où chaque ligne porte « Découvrir » et « S'exercer » — plus besoin de comprendre « système de positions » pour jouer une note ; l'accordage et les systèmes passent dans un repli. Côté **exercice** : la tablature passe avant les réglages, le micro devient un bouton primaire (« ▶ Ouvrir le micro ») et les réglages de série sont repliés ; l'ancien panneau « Exercice » de l'écran de découverte (un QCM sans instrument) est renommé « Sans instrument » pour ne plus voler le mot. Mesuré par `tools/tour-check.mjs` : 0 problème sur les 19 écrans aux deux tailles, 0 erreur console ; **accueil 4 301 → 844 px** sur téléphone (un seul écran), gammes 1 936 → 1 464, exercice 2 039 → 1 837. Décision **D54**.
- **Tour complet des pages (après la 4b, ta demande : « la tablature ne fait pas la même largeur que le reste »)** : nouvel outil `tools/tour-check.mjs` (19 écrans × 2 tailles : 12 routes + les 7 étapes de la leçon) qui mesure largeurs, bords gauches, débordements, textes tronqués, textes sous 11 px et erreurs console. Corrigé : (1) **plafond de 1 040 px** retiré de `.tabview`, `.pos-nav` et `.quiz-strip` — ils étaient plus étroits que leurs panneaux de 216 à 256 px ; (2) le layout **étire la dernière ligne** d'une tablature en mode wrap (un accord = une ligne s'arrêtait aux trois quarts du cadre) ; (3) **fin de mesure coupée de 24 px** sur téléphone : le panneau qui porte une tablature lui laisse le padding (marges négatives) ; (4) **sous-titre de l'en-tête sur deux lignes** quand l'étiquette prenait la place (l'étiquette passe sous le titre sous 520 px) ; (5) **plancher de lisibilité à 11 px** (étiquettes 9,5-10,5 px, degrés de gamme, noms de systèmes) ; (6) **tableaux de la page Audio** qui débordaient à 390 px (`table-layout: fixed`) ; (7) **flèches de strum** dans le DOM : « ↓ ↑ » se réduisaient à deux traits (« ıı (croches) ») → triangles ▼ ▲ dans un seul module `app/strumLabel.ts` ; (8) page Théorie sans `main.wide` (contenu collé au bord) ; (9) **accordeur réordonné** (D53). Mesuré après correction : **0 problème sur les 19 écrans aux deux tailles**, 0 erreur console. Décisions **D52** et **D53**.
- **Lisibilité des libellés (après la 4b, ton signalement « les typos 01 Découvrir, 02 Construire ne sont pas assez lisibles »)** : les **sept étapes** passent de Silkscreen capitales 9,5 px à sans-serif 13 px / 600 (numéros 10,5 px, chiffres tabulaires), et la **barre de navigation** de Silkscreen 9,5 px à sans-serif 11,5 px — « ACCORDEUR » était tronqué par ellipse et les accents disparaissaient en capitales. La barre devient **opaque** (le contenu de la page se lisait à travers). Mesuré à 390 et 1 440 px : aucune troncature, aucun débordement, contraste 9,08:1 (étapes inactives) / 16,55:1 (active) et 7,96:1 / 5,59:1 (onglets). **Trouvé en route** : le serveur Vite servait encore l'ancienne feuille après l'édition (`curl` sur le CSS servi : « 12.5px » alors que le fichier disait « 13px ») — serveur relancé, puis mesuré à nouveau. Décision **D51**.
- **Mise à jour de ce document (après la 3)** : « État exact » (bloc 3 + rappel 2), §3.6 (écart worklet → fil principal), §4.8 (pipeline réel), R2/R3/R11, hypothèses 63-72 et fragiles, §8 bis (entrée audio, tempo, navigation), plan (3 ✔), **§9.1 (les cinq propositions de la phase 3 placées en phases 4, 5 et 7)**, décisions **D35-D38**, journal, §12 réécrite pour la phase 4 (avec P1, P2, P4 dans ses livrables).
- **Mise à jour de ce document (après la 2)** : « État exact » (bloc 2 + rappel 1d), hypothèses 50-62 et fragiles, §8 bis (progression, persistance, rythme, session), §3.8 (persistance révisée), §4.1 (arborescence `progress/`), §4.3 (stores), plan (2 ✔ + seconde passe), décisions **D24-D33** (D25 écarte IndexedDB), journal (défauts trouvés), §12 « Prochaine étape » réécrite pour la phase 3.
- **Mise à jour de ce document (après 1c)** : « État exact » (bloc 1c, mesures, pas fait, écarts), §3.1 (outils de build), §3.5 (échantillons et échantillonneur maison), §4.1 (arborescence), §4.7 (pipeline tel que construit), R4 et R12 (traités / mesurés), hypothèses 31-41, plan (1c fait, 1d proposée), décisions **D14-D18** (D7 remplacée), journal, §12 « Prochaine étape ».

- **Phase 4b** (terminée, commit `8cda4a8`) : cycle complet — **Fixer** (pose à froid chronométrée 8/5/3 s, chrono arrêté à la première corde juste, temps **et** propreté), **Enchaîner** (changements mesurés entre deux **notes repères**, 6 changements / 1 749 ms de médiane au micro simulé), **Intégrer** (8 progressions en données, strum et métronome, déclarées), **QCM sans matériel** (3 types, confusions réelles, nœud `acc:savoir:*`), **accordage guidé corde par corde** (±5 cents tenus 400 ms, 6/6 au micro simulé, enregistrement), **paliers P5-P7** (35 accords). « Appris » exige désormais une pose à froid (D45). **558 tests** (557 verts, 1 ignoré), `tsc` propre, build OK : `index` 580,9 ko (183,9 gzip), CSS 34,5 ko (7,5 gzip). Vérifié au navigateur : sept étapes en deux rangées, aucun débordement à 390 et 1 440, action principale au-dessus de la barre sur les sept écrans, aucune erreur console ; au micro simulé : enchaînement Em→Am, pose à froid jugée « trop lente » (chemin d'échec) et accordage complet. **Trouvé en route, corrigé** : (1) Em→Em7 partage la basse, donc l'alternance de basses ne mesurait rien → notes repères ; (2) une pose à 8,1 s s'écrivait 8 s et passait pour réussie → arrondi supérieur ; (3) `guideSteps` demandait le mi aigu en premier ; (4) les distracteurs du QCM étaient tirés au hasard → deux confusions réelles garanties ; (5) le QCM interrogeait des accords jamais ouverts → vivier limité ; (6) quatre cases masquées au lieu d'une dans le trou du QCM ; (7) actions d'Intégrer et d'Enchaîner sous le pli → réorganisées ; (8) sept boutons d'étape sans `row-gap` ; (9) « b3 » dans les paragraphes → `fmtDegree` au cœur ; (10) fixture d'accordage transposée de deux demi-tons (`asetrate` au taux du fichier) ; (11) identifiants P6 faux, arrêtés par le test du curriculum. **Non vérifié** : vraie guitare, vrai micro, vrai téléphone, Safari/iOS, le timbre.
---

- **Phase 5 — entendre six cordes ensemble (ta demande : « passe à la phase 5 »)** : nouvel analyseur `core/input/poly.ts` (attaque par flux spectral, FFT 16 384, somme harmonique des graves vers les aiguës, **soustraction de la part modélisée** de chaque corde, plancher relatif, confiance logarithmique par corde, pénalité d'inexpliqué pour départager les accords voisins) et `core/input/capture.ts` (tampon de 1,5 s alimenté par la queue de chaque bloc du Worklet). L'étape **Plaquer** n'est plus une déclaration : on arme, l'app attend la vraie attaque, analyse 520 ms et affiche **six lignes de confiance** avec un **message ciblé** (« Sol♯ à la place de Sol (corde de Sol) ») ; la déclaration reste possible et reste non vérifiée. Journal : genre `pluck` avec `confidence`. **Mesures** : matrice de confusion **11 accords × 7 conditions = 91 %** de reconnaissance dans chaque condition, marge médiane **+0,51**, **224/224 cordes** entendues ; **une seule confusion, G/B contre G** (corde doublée à l'unisson = un seul pic : impossible, et figé par un test). Au navigateur avec les **vrais échantillons** de la banque en faux micro : Em juste 6/6 à 80 %, Mi majeur → « Sol♯ à la place de Sol », corde étouffée → « la corde de mi n'a pas sonné ». **584 tests (583 verts, 1 ignoré)**, `tsc` propre, build `index` 592,2 ko (188,6 gzip), CSS 49,1 ko (10,3 gzip), balayage 0 problème sur 19 écrans aux deux tailles. **Non vérifié** : vraie guitare, vraie interface, vrai micro, iOS ; timing contre la grille et étape Intégrer restent à faire. Décisions **D67-D69**.

- **Passe mobile à l'œil (ta demande : « fais un tour avec Playwright sur la version mobile, il y a pas mal de soucis de marges, de textes collés »)** : le balayage automatique disait 0 problème — il mesure les largeurs, pas ce qui se lit. Un tour **en captures** sur les 12 écrans à 390 × 844 a trouvé **huit défauts** : phrase d'intro des Accords posée sur le décor ; noms de cordes de la tablature sur la bordure du panneau ; signature « 4/4 » parasite en mode débutant ; « Box 1 » encore dessiné malgré D62 ; cinq boutons d'inégal largeur empilés ; deux boutons de hauteurs différentes dans une rangée ; libellé de repli coupé avec une virgule en tête de ligne ; fragments de phrase en minuscule isolés en bas de panneau. Tous corrigés (D70), documents et outil de balayage mis à jour. **584 tests (583 verts, 1 ignoré)**, `tsc` propre, build 592,1 ko (188,5 gzip), CSS 49,4 ko (10,4 gzip), échelle d'écarts toujours 0/4/8/12/20, balayage 0 problème sur les 19 écrans aux deux tailles.

- **Phase 7 — improviser sur un accompagnement (ta demande : « passe à la phase 7, on fera la 6 après, j'ai envie d'avancer sur l'impro »)** : quatre accompagnements **en données** (synthwave mineur/majeur, lo-fi mineur et ii–V–I), synthétisés (basse filtrée, pads, batterie de bruit) et programmés 250 ms en avance sur le contexte audio ; nouveau bus `backing`. Analyse **harmonique** des notes jouées : cinq rôles (note d'accord, couleur, passage, à éviter, hors gamme), score 45/20/35 et **un seul** conseil. La note jouée **s'allume sur la position** (`TabView.flash`) — c'est aussi P3 de la phase 3, livrée sur l'écran d'impro **et** sur la page Découvrir. Journal : genre `impro`, niveau 4, nœud séparé. **Mesures** : 606 tests (605 verts, 1 ignoré) dont 22 nouveaux ; build 612,0 ko (194,5 gzip), CSS 51,2 ko (10,7 gzip) ; balayage **0 problème sur 20 écrans** aux deux tailles ; au navigateur avec micro simulé, la boucle tourne, **8 notes classées**, trois taux (50 % d'accord · 100 % dans la gamme · 100 % sur les temps forts), bilan **78/100** et tentative `impro` au journal (4/8, niveau 4, 12 s). **Non vérifié** : le son lui-même (aucun test audio), le décalage attaque/clic, la note blues et les approches chromatiques. Décisions **D71-D74**.

- **Rien de transparent sur le décor (ta demande : « aucun bouton transparent ou de texte sans fond derrière, exemple les boutons pour changer de position »)** : nouvel audit `tools/contrast-audit.mjs` (11 routes, éléments interactifs + blocs de texte sans fond opaque). **52 éléments** au premier passage, **0** après. Ce qui n'allait pas : les boutons `quiet` étaient *littéralement* transparents (« ‹ Position », « Position › », « ← Changer de gamme », « Accueil »), les pastilles aussi (`.chip`), et **l'en-tête de chaque page** posait titre, sous-titre et étiquette sur un dégradé qui s'éteignait en bas — il est devenu une bande pleine. Corrigés aussi : le pied d'accueil, la barre de positions, le bloc « étape suivante », les notes de pied de page, les intros des Accords et du QCM, et l'affiche d'accueil (dégradé : soleil franc en haut, plaque opaque sous le titre — un voile uniforme le rendait olive). Balayage et échelle d'écarts inchangés (0 problème, 0/4/8/12/20). Décision **D75**.

- **Tailles de cartes (ta demande : « fais le tour de toutes les pages, vérifie la taille des cartes, il y a des incohérences »)** : nouvel audit `tools/card-audit.mjs`, 14 routes × 2 tailles. Téléphone : **tout est plein largeur** (aucun défaut). Bureau : **8 rangées incomplètes**, toutes corrigées — une carte de 5 ou 7 colonnes seule laissait un trou de 5 à 7 colonnes. Règle appliquée : une rangée est **soit une carte pleine, soit une paire qui la remplit**. Trouvés au passage : le **mixeur** rendait des curseurs de 140 px dans une carte de 1 256 px (`label.inline` battait `.mix-row` : la rangée restait un flex), et le canal **Accompagnement** n'était pas réglable dans les Réglages. Décision **D76**.

## 12. Prochaine étape : la phase 6 (Défi Accords), puis le reste de la 5 sur instrument réel

**Où on en est** : les phases 0 à 4b sont livrées, la **refonte d'interface** est mergée sur `master` (D54-D66), la **phase 5 est livrée côté analyse** (D67-D69, matrice de confusion publiée, étape « Plaquer » écoutée) et le déploiement Pages est câblé.

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
