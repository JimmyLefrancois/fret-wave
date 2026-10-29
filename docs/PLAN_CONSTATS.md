# Plan : traiter les constats du simulateur

Source : `docs/SIM_CONSTATS.md` (16 constats, étapes D, C, E). Le 12 est corrigé (D96).
Branche proposée : `ux/constats-sim`, partie de `dev/simulateur` (le simulateur sert à mesurer chaque lot).

## Décisions prises (2026-10-29)

| Sujet | Choix | Constats |
| --- | --- | --- |
| Héros de l'accueil quand des révisions sont dues | **Séance du jour** : révisions dues puis prochaine étape, une seule action, durée estimée | 1, 9, 10 |
| Prochain cap quand une gamme est apprise | **Arbre de compétences MUSIC_DESIGN §3.2** (transposition, blues, pentatonique majeure, majeure…) | 2 |
| Série du joueur irrégulier | **Série de semaines actives** en plus de la série de jours (règle de récompense : demande explicite) | 4 |
| Ton de la carte de révision | **Raison + tendance** (« À rafraîchir · vue il y a 3 j · palier 2 sur 6 », score en tendance), message de retour après absence | 3, 8 |

Sans action (constat documenté, rien à corriger) : **6** (plafond d'XP jamais atteint), **15** (J1 dépend du jour
de lancement), **16** (déjà réglé dans `tools/sim-tour.mjs`).

## Ordre des lots

0 → 1 → 2 → 3 → 4 → 5 → 6. Les lots 1 et 2 forment le cœur (cohérence révision et accueil) ; 3 à 5 sont
indépendants entre eux une fois le 2 posé. Un commit par lot, constats cochés dans `SIM_CONSTATS.md`,
une décision `D97+` dans `docs/DECISIONS.md` pour chaque règle nouvelle.

---

### Lot 0 — Garde-fous mesurables (avant toute correction)

But : chaque constat devient une assertion qui échoue aujourd'hui et passera après son lot.

- `tests/simInvariants.test.ts` : pour chaque persona et chaque jour simulé (`simulate(..., { onDay })`) :
  - **I1** (constat 13) : chaque carte due que l'accueil compte a une cible dans `buildReviewQueue` ;
    le nombre annoncé par l'accueil = le nombre de formes dues de la séance.
  - **I2** (constats 1, 2) : sur 7 jours de pratique d'affilée, l'accueil propose au moins une fois une
    étape de progression (pas seulement « À réviser » / « Reprendre la gamme »).
  - **I3** (constat 9) : une forme « apprise » qui est due est signalée « à rafraîchir » dans le parcours.
  - Marquées `it.fails` au départ, retournées lot par lot.
- `src/dev/report.ts` : nouvelles colonnes « séance du jour » (n révisions + étape), « cap », « semaines ».

### Lot 1 — Une révision qui tient sa promesse (constat 13)

Constat vérifié dans le code (`modules/gammes/review.ts`) : après les cartes dues, la séance est
complétée jusqu'à 5 par des formes « fragiles » **quel que soit leur état** (une forme maîtrisée revient en
N2 à trous, tablature visible), et le motif « vue dans une seule zone du manche » **ne change pas de
tonique** (`target()` reprend `last.tonic`).

1. `buildReviewQueue` :
   - le complément ne prend que des formes **en apprentissage** (`state === 'learning'`), jamais une
     forme apprise ou maîtrisée non due ;
   - le motif « une seule zone » tire une **tonique d'une zone pas encore vue** (MUSIC_DESIGN §3.1 :
     « chaque révision tire une tonique différente ») : nouvelle fonction pure
     `tonicForNewZone(node, scaleId, system, tuning)` → tonique dont la position tombe dans une zone
     absente de `node.zones` (orthographe la plus simple, `tonicSpellings`) ; sinon le motif disparaît.
2. Une seule source pour l'accueil et la séance : l'accueil appelle `buildReviewQueue` (déjà pur) pour
   compter, au lieu de `dueNow` seul. « Forme 1 sur N » = la vraie séance.
3. Durée estimée : `sessionMinutes(queue, journal)` = médiane des `seconds` de l'élève par genre
   (rappel à froid, trous), repli à 90 s par forme + temps de « Regarde la forme » si sous 80 % ; arrondi
   à la minute, affiché « ~6 min ».
4. Tests : `review.test.ts` (forme maîtrisée jamais en complément ; zone nouvelle effective ;
   I1 retourné), `sessionMinutes`.

Décision **D97** (complément de révision et tonique de zone) — c'est l'application de §3.1, pas une
règle nouvelle, mais elle change ce que l'élève joue : à noter.

### Lot 2 — Séance du jour et prochain cap (constats 1, 2, 9, 10)

**2a. Prochaine étape de progression** — `src/modules/gammes/curriculum.ts` (pur, testé) :

- `nextFormStep(journal, selection)` : dans la gamme et le système courants, la première forme (ordre du
  manche) pas encore apprise, et son étape suivante, déduite du journal et de `learnedGaps` :
  N1 écouter (jamais entendue) → N2 segments → N2 position entière (au micro) → N3 de mémoire.
  Rend `{ selection, level, segment, label, why }` (« Position 3 · à trous · il manque une réussite
  sur la position entière »).
- `nextCap(journal, selection)` quand toutes les formes du système sont apprises, en suivant §3.2,
  données en tableau ordonné `SCALE_PATH` :
  1. G1.2 **blues mineur** (une note de plus sur les mêmes boxes) ;
  2. **G1.4 transposition** : même gamme, tonique dans une zone non couverte (via `tonicForNewZone`),
     tant que < 3 zones prouvées (§3.2 : « jamais avant 2 tonalités maîtrisées », d'où après le blues) ;
  3. G2 pentatonique majeure (+ blues majeur) → G3 majeure (boxes/3NPS selon `defaultSystem`) → G4 éolien
     → G5 mixolydien, dorien, lydien, phrygien, locrien → G6 harmonique, mélodique → G7 symétriques, bebop ;
  4. G8 impro proposé en parallèle dès qu'une gamme a ≥ 3 formes apprises (ligne secondaire, pas le héros).
  Chaque cap porte sa raison en une phrase (« même dessin, autre case : la box 1 en Do m, cases 8-11 »).
- Tests : chaque persona simulée reçoit une étape cohérente ; l'avancé à J45 reçoit un cap (I2).

**2b. Plan de séance** — `src/app/hubPlan.ts` :

- `dailySession(journal, now, selection)` → `{ review: ReviewTarget[]; next: Step | null; cap: Cap | null;
  minutes: number }`. Remplace `hubPlan` pour la partie gammes (les accords gardent leur reprise).
- Héros « **Séance du jour · ~8 min** » : liste courte numérotée
  1. « Rafraîchir 3 formes, de mémoire » (si dues) ;
  2. « Avancer : Position 3, à trous » (ou le cap : « Nouveau : blues mineur, box 1 »).
  Bouton primaire = la première étape non faite ; Espace / Entrée inchangés (`isHeroShortcut`).
- Rien de dû : le héros montre directement l'étape de progression (fini le « Continuer la gamme »
  générique sur la sélection courante).
- **Enchaînement** : le bilan de la séance de révision (`ScaleTrainingPage`, `sessionDone`) affiche
  « Ensuite : Position 3, à trous » et y mène (sélection + niveau + segment). Pas de file mélangée
  révision/progression dans la même page : la progression peut demander N1 (autre écran).
- Parcours (constat 9) : « 5 formes apprises sur 5 · **3 à rafraîchir** » — « apprise » ne change pas de
  sens, on montre seulement l'entretien dû.

Décision **D98** (séance du jour, ordre du prochain cap). Le simulateur est rebranché sur
`nextFormStep` / `nextCap` (lot 6) : l'élève virtuel suit alors **les propositions de l'app**.

### Lot 3 — Carte de révision et retour après absence (constats 3, 8)

- `reviewLine(card, journal, now)` remplace `reviewSummary` dans le héros :
  « À rafraîchir · vue il y a 3 j · palier 2 sur 6 », puis en second plan la **tendance** des 3 dernières
  preuves de la forme (« 50 % → 75 % → 83 % ») ; une seule preuve : « premier passage : 50 % ».
- `absence(journal, now)` : jours depuis le dernier exercice vérifié ; à partir de 3 jours, ligne en tête
  du héros : « Content de te revoir. 4 formes à rafraîchir, ~6 min : on reprend doucement. »
  Si la série de jours est tombée, la phrase le dit sans reproche et rappelle la série de semaines (lot 4).
- Textes dans `hubPlan.ts` (purs, testés) ; pas de nouveau composant.

### Lot 4 — Série de semaines actives (constat 4)

Règle nouvelle, à ta demande (règle de récompense) : **D99**.

- `weekStreak(attempts, now)` dans `core/progress/rewards.ts` : semaines consécutives (lundi-dimanche,
  calendrier local) avec **au moins 2 jours** ayant un exercice vérifié (même filtre que `streak` : ni
  écoute, ni déclaration). La semaine en cours ne casse rien tant qu'elle n'est pas finie ; elle compte dès
  qu'elle a ses 2 jours.
- Affichage : sous la jauge de l'affiche, « Série : 3 jours · 5 semaines » (la série de jours ne change pas).
- « Comment ça compte ? » : une phrase pour la série de semaines.
- Paliers d'accomplissement (4, 8, 12 semaines) dans `accomplishments.ts` ? **À trancher au début du
  lot** (je propose oui, même mécanisme que `STREAK_MILESTONES`).
- Tests : week-end simulé = série de semaines intacte ; semaine à un seul jour = cassée ; changement d'heure.
- Seuil de 2 jours : choix par défaut (le joueur du week-end joue samedi et dimanche) ; à confirmer en D99.

### Lot 5 — Ce qui compte, dit au bon moment (constats 5, 7, 14)

- **5** (rattrapages) : déjà expliqué à l'écran de résultat (`ScaleTrainingPage`, « Essai de rattrapage :
  enregistré, sans effet… »). Ajout : le bilan de séance compte « 2 rattrapages : comptés pour la journée,
  pas pour la mémoire ». Vérifier à la tournée que la phrase est visible sans défiler.
- **7** (sans micro) : quand une série N2 sur la position entière réussit **au pavé**, le résultat dit
  « Réussie au pavé : pour qu'elle compte comme réussite forte, rejoue-la de mémoire (N3) ou au micro. »
  (s'appuie sur `learnedGaps` → `strong`, déjà utilisé page Entraînement).
- **14** (panneau « Exercice » en un paragraphe) : quatre lignes courtes et étiquetées — *Séance* (« 3 / 5 ·
  Position 3 », liste repliable), *Trous* (« 8 sur 23 »), *État* (« maîtrisée »), *Pavé* (aide repliée
  dans un `<details>`). Styles par les tokens, vérifiés dans les deux thèmes (Synthwave, Aube).

### Lot 6 — Outillage et simulateur (constat 11, boucle de mesure)

- **11** : mémoire de travail (pas une règle du projet) : pendant que `npm run dev` tourne, éditer avec
  l'outil d'édition, jamais `perl -i` / `sed -i` (nouvel inode, Vite sert l'ancien module).
- Simulateur : l'élève virtuel suit `dailySession` (révisions, puis l'étape ou le cap proposé) au lieu
  de son parcours maison → le rapport mesure enfin **la boucle de l'app**. Personas inchangées.
- Rapport : invariants I1-I3 en constats automatiques ; colonne « semaines ».
- Bruit connu (« corde la plus ratée » hors persona Si fragile) : ne l'afficher que si une corde dépasse
  nettement les autres (≥ 2 × la suivante).

---

## Vérification, à chaque lot

1. Tests ciblés du lot + `npx tsc --noEmit`.
2. `npm run sim:report` : relire les constats du lot (ils doivent disparaître ou changer de nature) ;
   consigner les nouveaux dans `SIM_CONSTATS.md` (étape « Lot n »).
3. `node tools/sim-tour.mjs --pages hub,revision` (et `--width 390 --height 844` pour le téléphone) :
   relecture des captures, thèmes Synthwave et Aube pour les lots 2, 3, 5.
4. Fin du chantier : `npm test`, `npm run build`, tournée complète.

## Ce que ce plan ne change pas

Intervalles Leitner, seuils PASS (80 %) / EXCELLENT, critères « apprise » / « maîtrisée », barème et
plafond d'XP, objectif du jour (3), série de jours. Les seules règles nouvelles sont D97 (complément de
révision, tonique de zone), D98 (séance du jour, ordre des caps) et D99 (série de semaines).

## Questions encore ouvertes (à trancher en début de lot)

- Lot 1 : une révision « autre zone » transpose la forme : faut-il le dire avant (« même dessin, en Do m ») ?
  Je propose oui, dans la ligne de raison.
- Lot 2 : ordre retenu par défaut blues mineur puis transposition (lecture de §3.2) ; à confirmer.
- Lot 4 : paliers d'accomplissement en semaines (oui / non) et seuil de 2 jours.
