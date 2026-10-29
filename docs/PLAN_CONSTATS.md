# Plan : traiter les constats du simulateur

Source : `docs/SIM_CONSTATS.md` (19 constats, étapes D, C, E et relance après D96 ; le 12 est corrigé en D96).
Branche proposée : `ux/constats-sim`, partie de `dev/simulateur` (le simulateur sert à mesurer chaque lot).
Plan réécrit le 2026-10-29 sur **mesures fraîches** (rapport, tournée bureau 1440 et téléphone 390, capture
non pleine page au téléphone, mesures ad hoc sur les journaux simulés). Chaque cause est vérifiée dans le code.

## Décisions prises (2026-10-29)

| Sujet | Choix | Constats |
| --- | --- | --- |
| Héros de l'accueil quand des révisions sont dues | **Séance du jour** : révisions dues puis prochaine étape, une seule action, durée estimée | 1, 9, 10 |
| Prochain cap quand une gamme est apprise | **Arbre de compétences MUSIC_DESIGN §3.2** (transposition, blues, pentatonique majeure, majeure…) | 2 |
| Série du joueur irrégulier | **Série de semaines actives** en plus de la série de jours (règle de récompense : demande explicite) | 4 |
| Ton de la carte de révision | **Raison + tendance** (« À rafraîchir · vue il y a 3 j · palier 2 sur 6 », score en tendance), message de retour après absence | 3, 8 |

Aucune ne contredit le code. Deux points à savoir avant de les appliquer (tranchés le jour même, voir « Réponses de l'auteur ») :

- **« Séance du jour » ne suffit pas seule contre le constat 1** : la plupart des révisions dues le soir sont des
  formes **déjà revues le jour même** (palier 1 = 10 min). Sans règle de fin de séance, la séance du jour se
  rouvrirait sitôt finie (Q1 : la forme sort de la séance jusqu'à demain).
- **« Selon l'arbre §3.2 »** : l'ancien plan justifiait « blues puis transposition » par « jamais avant 2
  tonalités maîtrisées » ; le blues n'ajoute aucune tonalité. Les « 2 tonalités » de §3.2 sont celles de G1.1
  (Mi m puis La m), que l'app n'enseigne pas. Ordre corrigé au lot 2a. Et §3.1 (« chaque révision tire une
  tonique différente ») contredit G1.4 (« jamais avant 2 tonalités maîtrisées ») si on l'applique à un débutant
  (Q3 : transposer seulement après 2 toniques travaillées).

---

## Mesures fraîches (2026-10-29)

Rapport `SIM_REPORT=1 … tests/simReport.test.ts`, tournée `tools/sim-tour.mjs` (bureau + téléphone), et mesures
sur les journaux simulés (à 17 h le lendemain, l'heure où la persona revient) :

| Persona | jours pratiqués | lendemain « À réviser » | soirs où **toutes** les dues ont été jouées le jour même | dues au palier 1-2 | rappels N3 net / lent / raté |
| --- | --- | --- | --- | --- | --- |
| régulier | 26 | 24 | 18 | 89 / 90 | 22 / 51 / 30 |
| décrocheur | 16 | 15 | 15 | 103 / 103 | 1 / 19 / 32 |
| Si fragile | 25 | 24 | 24 | 69 / 69 | 0 / 6 / 47 |
| sans micro | 23 | 23 | 20 | 83 / 83 | 17 / 42 / 32 |
| week-end | 12 | 11 | 1 | 116 / 132 | 0 / 1 / 9 |
| avancé | 44 | 16 | 14 | 22 / 23 | 64 / 44 / 8 |

- File de révision de l'avancé (`buildReviewQueue`, J14-J45) : **190 formes de complément, 186 apprises ou
  maîtrisées, 190 « vue dans une seule zone du manche », 190 dans la tonique d'origine.**
- Nombre annoncé par l'accueil = nombre de rappels à froid de la file, tous les jours, pour les 6 personas
  (depuis D96). Mais seulement parce qu'aucune persona n'a plus de 5 formes (voir constat 22).
- Téléphone 390 × 844, page Révision, vue réelle (pas pleine page) : à la case 18 sur 23, la case active est sur la
  3ᵉ ligne de tablature, **entièrement sous la barre de réponse** (`.answer-bar`, haut à 640 px, toile jusqu'à
  861 px), défilement 0. Le constat 19 n'est pas un artefact.
- XP brute max par jour : 120 (régulier, un jour), 116, 108, 95, 60, 55. Plafond 120 jamais dépassé.

---

## Diagnostic, constat par constat

| # | Statut | Cause vérifiée | Lot |
| --- | --- | --- | --- |
| 1 | **Mal diagnostiqué en partie** | Le rapport échantillonne l'accueil à 23 h 59 (`report.ts:64`), après la pratique du jour. Une réussite lente (80-94 %) **ne change pas de palier** (`scheduler.ts:49-53`, `:69`) et un échec ramène au palier 1 (`:71`) ; or le palier 1 revient **10 min** plus tard (`scheduler.ts:18`). Résultat : 18 soirs sur 26 (régulier), toutes les « dues » ont déjà été jouées le jour même. La répétition quotidienne est en partie normale (5 formes apprises en 30 j, paliers 1-2) ; ce qui ne l'est pas, c'est que l'accueil n'ait **ni fin de séance ni étape suivante**. | 2 |
| 2 | Confirmé | `hubPlan` n'a que trois issues : révision, reprise, « Commencer » (`hubPlan.ts:25-43`) ; la reprise de gamme ouvre la **sélection courante** (`HubPage.tsx:237-239`), pas la forme suivante ni une autre gamme. | 2a |
| 3 | **Partiellement mal diagnostiqué** | (a) « 50 % » à J1 = **1 trou juste sur 2** : un échauffement sur 3 cordes (2 trous, `HOLES_RATIO`) crée la carte et la met au palier 1 (`scheduler.ts:91-105` prend toute série qui prouve, segment compris). (b) `Card.lastLevel` / `lastScore` sont documentés « dernier exercice réussi » (`scheduler.ts:37`) et `reviewSummary` « dernier passage réussi » (`hubPlan.ts:59`) : c'est en fait la **dernière tentative**, ratée comprise. (c) Week-end, « 88 % » cinq semaines : c'est vrai, la forme n'a pas été rejouée depuis le 20 sept. (persona `reviews: false`, `simulate.ts:84`) ; l'accueil affiche la date (« · 4 oct. »), le rapport non. Il manque l'âge et la raison, pas un autre chiffre. | 1, 3 |
| 4 | Confirmé, chiffre à jour | Série cassée **6 fois** sur 42 j (pas 5). `streak` exige des jours consécutifs (`rewards.ts:96-110`). « Révisions bloquées à 5 » vient de la persona (`reviews: false`) : c'est voulu, pas un défaut de l'app. | 4 |
| 5 | **Déjà traité à l'écran** | Résultat : « Essai de rattrapage : enregistré, sans effet sur la révision, la maîtrise ni l'XP. » (`ScaleTrainingPage.tsx:994`) ; panneau Exercice : « Essai de rattrapage : … tu viens de voir la forme. » (`:1152`). Reste un trou : le **bilan de séance** (`:964-977`) n'en dit rien. Les 30-50 rattrapages viennent du taux d'échec à froid du simulateur (Si fragile : 47 rappels ratés sur 53). | 5 (une ligne) |
| 6 | Sans action | Max mesuré : 120 XP un seul jour (régulier J29). | — |
| 7 | **Déjà traité, écart surévalué** | Écart réel : 5 jours de pratique contre 3 (sans micro commence à J3), pas « J7 contre J3 ». L'écran le dit déjà : `formStateLine` (« Pour « apprise », il manque une réussite sur la position entière, de mémoire (N3) ou au micro », `ScaleTrainingPage.tsx:74-90`), et D94 pousse vers « Passer au rappel (N3) » après un N2 réussi. Rien à coder. | — |
| 8 | Confirmé | Aucun calcul d'absence dans `hubPlan.ts` ; la série tombe à 0 et la ligne disparaît. | 3 |
| 9 | Confirmé | `learnedScaleForms` compte apprises + maîtrisées (`hubPlan.ts:132-137`), affiché « apprises » (`HubPage.tsx:404-405`) ; rien sur l'entretien dû. Par ailleurs l'avancé lit « 5 formes apprises sur 5 » alors qu'elles sont **maîtrisées** avec vitesse. | 2b |
| 10 | Confirmé | Aucune durée calculée (`HubPage.tsx:263-267`). | 2b |
| 11 | Sans action (outillage) | Déjà noté en mémoire de travail. | — |
| 13 / 17 | **Confirmé, et plus grave que décrit** | (a) Le bouton « Réviser maintenant » de l'accueil **n'ouvre pas la séance** : il ouvre l'écran d'entraînement sur une seule forme (`HubPage.tsx:51-64`, `:202`), au **niveau 2 par défaut** (`ScaleTrainingPage.tsx:104`), sans rappel à froid (posé seulement par `applyTarget`, `:733`). Le rappel à froid de D87 n'existe donc que sur `#/gammes/revision`, qu'aucun lien n'ouvre (interrupteur « Session mélangée » replié dans les réglages, `:1213`). Le simulateur, lui, révise à froid (`simulate.ts:266-276`) : **il mesure un chemin que l'accueil ne prend pas.** (b) Complément de séance : formes triées par maîtrise, quel que soit leur état (`review.ts:130-144`) ; la raison « vue dans une seule zone » vaut pour toute forme jouée dans une seule tonique (`zones` dérive de `fretMin`, `mastery.ts:301`), et `target()` garde `last.tonic` (`review.ts:58`) : la raison n'est jamais tenue. | 1 |
| 14 | Confirmé | Un seul `<p>` : liste des formes + raison (`ScaleTrainingPage.tsx:1138-1142`), puis rappel à froid, consigne, état, aide du pavé. | 5 |
| 15 | Sans action | Dépend du jour de lancement. | — |
| 16 | Sans action | Réglé dans `tools/sim-tour.mjs:69-70`. | — |
| 18 | Confirmé, et un 3ᵉ sens | « prochain cap : 14 jours » (série, `HubPage.tsx:388`) **et** « prochain : Em » (Parcours, accords, `:420`). « Prochain… » est pris deux fois. | 2b |
| 19 | **Confirmé (pas un artefact)** | Mesure en vue réelle (ci-dessus). Aucun défilement ne suit la case active. | 5 |
| Bruit « corde la plus ratée » | Cause précise | `stringWeakness` compte les ratés sans les rapporter aux cordes **jouées** (`mastery.ts:388-405`) : un segment de 3 cordes graves ne peut rater que les cordes 0-2. Vrai aussi chez un élève réel qui s'échauffe. Non affiché dans l'app (rapport seulement). | 6 |

### Constats nouveaux (relevés pendant la vérification)

20. **Le bouton « Réviser maintenant » contourne le rappel à froid** (13 a) : traité au lot 1.
21. **Une forme revue aujourd'hui revient le soir même** (palier 1 = 10 min, voir 1) : Q1, lot 2.
22. **Deux plafonds** : l'accueil compte jusqu'à `DUE_CAP` = 8 (« 8 au plus par séance », `HubPage.tsx:267`,
    `:461`), la séance s'arrête à `REVIEW_MAX` = 5 (`review.ts:37`). Invisible avec une seule gamme (5 formes) ;
    faux dès 6 formes dues. Lot 1.
23. **Deux compteurs « 1 / 5 » sur l'écran de révision** : « Session 1 / 4 » en tête, « 1 / 5 » du sélecteur de
    position en pied (`ScaleTrainingPage.tsx:1334`) ; changer de position au pied sort de la file. Lot 5.
24. **`unseenTonic` existe déjà** (`modules/gammes/transpose.ts:12`, testée dans `exercise.test.ts`) mais n'est
    appelée nulle part : la « nouvelle » `tonicForNewZone` de l'ancien plan doit l'étendre, pas la doubler.
25. **Le premier échauffement crée une carte** (3 a) : Q2, lot 1.

---

## Critique du plan précédent

- **Ordre** : le lot 1 corrigeait la file de `#/gammes/revision` sans voir que l'accueil n'y mène pas ; il faut
  d'abord **une seule porte** (accueil → séance), sinon I1 passe en test et reste faux à l'écran.
- **Lot 6 trop tard** : tant que l'élève virtuel suit son parcours maison, le rapport ne mesure pas ce que la
  séance du jour fait progresser (I2 passerait par simple affichage). Le branchement du simulateur sur la séance
  passe **dans le lot 2** (2c).
- **Lot 4 avant le lot 3** : le message de retour cite la série de semaines.
- **Lot 1, contradiction interne** : le complément n'aurait pris que des formes en apprentissage, et le motif
  « autre zone » les aurait transposées, ce que G1.4 interdit avant 2 tonalités. Q3 a tranché.
- **Lot 1, durée** : la durée appartient à la séance du jour (lot 2) ; on la calcule une fois, dans le module pur
  de la séance.
- **Lot 3** : « tendance » sur des séries de 2 trous (0, 50, 100 %) ne dit rien ; on affiche le **compte** quand
  la série a moins de 5 trous.
- **Lot 5** : les constats 5 et 7 sont déjà expliqués à l'écran ; il reste une ligne au bilan (5), rien pour 7.
  Le constat 19 devient un vrai correctif, avec un contrôle Playwright.
- **Superflu** : `tonicForNewZone` (doublon de `unseenTonic`) ; une colonne « cap » distincte dans le rapport (la
  colonne « séance » la contient) ; la règle « ≥ 2 × la suivante » pour la corde la plus ratée (on corrige la
  cause : l'exposition).
- **Manquait** : la porte unique (20), le double plafond (22), le pied de page en séance (23), la fin de séance
  (21), la ligne « maîtrisées » du Parcours (9), et le fait que `GAP_TEXT` (ce qui manque pour « apprise ») vit
  dans un composant React (`ScaleTrainingPage.tsx:74`) : l'étape suivante en a besoin, il passe dans un module pur.

---

## Ordre des lots

**0 → 1 → 2 (a, b, c) → 4 → 3 → 5 → 6.** Le 1 et le 2 sont le cœur ; le 5 ne dépend que du 1 (raisons de la file)
et peut passer avant le 2 si tu préfères un gain visible tôt. Un commit par lot, constats cochés dans
`SIM_CONSTATS.md`, une décision dans `docs/DECISIONS.md` pour chaque règle nouvelle (D97, D98, D99).

Règles tenues à chaque lot : aucun intervalle Leitner, seuil PASS / EXCELLENT, critère « apprise » / « maîtrisée »,
barème ou plafond d'XP changé hors des réponses Q1-Q4 ; styles par les tokens de `src/core/themes/`,
vérifiés en Synthwave et Aube ; aucun hex dans `app.css` ; un test par changement de logique ; aucune dépendance.

---

### Lot 0 — Garde-fous mesurables

But : chaque constat devient une assertion qui échoue aujourd'hui (`it.fails`) et se retourne au lot qui le traite.
Les tests sont typés (`tsconfig` inclut `tests/`) : un invariant ne peut appeler qu'une fonction qui existe déjà.
Ceux du lot 2 (I2, I3, I5) s'écrivent au lot 2, avec la fonction.

- `tests/simInvariants.test.ts` (nouveau), une boucle `simulate(p, { end: FIXED_END, onDay })` par persona, mesure
  à **17 h le lendemain** (`dayEnd + 1 + 17 h`, l'heure de retour de la persona) :
  - `it.fails('I1 la séance ne propose jamais une forme apprise non due')` : toute cible `mode: 'practice'` de
    `buildReviewQueue` a `state === 'learning'`. Aujourd'hui : 186 cibles fautives (avancé).
  - `it.fails('I1 bis la raison « une seule zone » est tenue')` : toute cible dont la raison commence par
    « vue dans une seule zone » a une tonique dont la position tombe dans une zone absente de `node.zones`.
  - `it('I1 ter le compte annoncé = les rappels à froid de la journée')` : `min(dues, DUE_CAP)` = nombre de cibles
    `cold` de `buildReviewQueue(…, DUE_CAP)`. Passe aujourd'hui ; garde-fou pour le lot 1 (journal fabriqué à
    8 formes dues sur 2 gammes : échoue aujourd'hui avec `REVIEW_MAX`).
  - `it.fails('I4 une séance finie ne se rouvre pas le soir même')` (Q1) : à 23 h, aucune
    cible de la séance n'a de tentative à froid aujourd'hui. Aujourd'hui : 18 soirs fautifs sur 26 (régulier).
- `src/dev/report.ts` : colonne « dues déjà jouées aujourd'hui » (`dayKey(card.lastTs) === key`) ; constat
  automatique « n soirs où toutes les dues ont déjà été jouées le jour même ». Échantillon de l'accueil : garder
  23 h 59 (ce que voit l'élève après sa séance), le dire dans l'en-tête de colonne (« accueil, le soir »).
- `FIXED_END` : `new Date(2026, 9, 29, 19, 0).getTime()`, pour un rapport stable d'un jour à l'autre.

Critère d'acceptation : `npx vitest run tests/simInvariants.test.ts` vert (les `it.fails` échouent comme prévu).

### Lot 1 — Une seule porte vers la révision, une file honnête (constats 13, 17, 20, 22, 25)

1. **Porte unique** (`HubPage.tsx`) : « Réviser maintenant » → `navigate('review')` (la séance, à froid, D87),
   plus `openAttempt` (`:202`). `openAttempt` reste pour « Dernière réussite ». Ce n'est pas une règle nouvelle :
   c'est D87 appliqué au bouton principal. Conséquence visible : depuis l'accueil, une carte due se révise
   **de mémoire, position entière**, et non plus en exercice à trous.
2. **Un seul plafond** : `buildReviewQueue(attempts, now, max = REVIEW_MAX, opts)` garde la séance à 5 (D32) ;
   l'accueil compte avec `reviewCount(attempts, now) = Math.min(dueLecture, DUE_CAP)` (pure, `review.ts`) ; le
   bilan de séance propose la suite s'il reste des dues : bouton « Encore 3 formes dues ».
   Texte de l'accueil (`HubPage.tsx:267`) : « (8 au plus aujourd'hui) » au lieu de « (8 au plus par séance) ».
3. **Complément** (`review.ts:129-144`) : seulement des formes `state === 'learning'` jamais vues à froid
   aujourd'hui ; raison « en apprentissage · il manque … » (texte de `learnedGaps`). Plus aucune forme apprise ou
   maîtrisée non due.
4. **Tonique de révision** (Q3) : nouvelle fonction pure dans `transpose.ts`
   `unseenZoneTonic(scaleId: string, system: PositionSystem, formIndex: number, tuningId: string, zones: readonly number[], seen: readonly string[]): NoteName | null`
   (étend `unseenTonic` : même ordre de toniques simples, filtre « la position de cette forme tombe dans une zone
   absente de `zones` »). Utilisée **seulement** pour le rappel à froid d'une forme due **apprise ou maîtrisée**
   dont la gamme a déjà ≥ 2 toniques travaillées (G1.4 débloqué), une fois sur deux (rang de révision pair,
   déterministe : `card.reps % 2 === 0`). Raison affichée : « même dessin, autre case : en Do m, cases 8-11 ».
   La raison « vue dans une seule zone » disparaît de la file.
5. **Échauffements** (Q2) : `cardsFrom` (`scheduler.ts:91-105`) ignore les séries `holes` hors position entière
   (`!isFullPosition(a)`), comme `sequence` et `impro`. Commentaires corrigés : `Card.lastLevel` / `lastScore`
   = « dernière tentative qui prouve » (`scheduler.ts:37`), idem `reviewSummary` (`hubPlan.ts:59`).

Tests (`tests/review.test.ts`) :
- « le bouton de l'accueil ouvre la séance » : test de la fonction pure `heroAction(plan)` →
  `{ route: 'review' }` quand `plan.review` (extraite de `HubPage.tsx:231-239`, testée dans `hubPlan.test.ts`) ;
- « une forme maîtrisée non due n'entre jamais en complément » ; « le complément ne prend que des formes en
  apprentissage, raison tirée de learnedGaps » ;
- « reviewCount plafonne à DUE_CAP, la séance à REVIEW_MAX » (journal à 8 dues sur 2 gammes) ;
- `unseenZoneTonic` (`tests/exercise.test.ts`, à côté de `unseenTonic`) : La m box 1 (zone 1) → tonique dont la
  box 1 tombe en zone 0 ou 2 ; zones déjà toutes vues → `null` ; orthographe admise par `tonicSpellings` ;
- « une forme due dans une seule tonique n'est jamais transposée » ; « avec 2 toniques travaillées, un rappel sur
  deux change de zone » ;
- `progress.test.ts` « un échauffement sur 3 cordes ne crée ni ne déplace de carte ».

Acceptation : I1, I1 bis, I1 ter verts ; tournée `--pages hub,revision` : avancé J30 → « aucune forme à
réviser » sur la page Révision, plus de N2 sur forme maîtrisée. Décision **D97** (porte unique, complément,
tonique de révision, échauffements hors révision).

### Lot 2 — Séance du jour et étape suivante (constats 1, 2, 9, 10, 18, 21)

**2a. Étape suivante** — `src/modules/gammes/curriculum.ts` (nouveau, pur). `GAP_TEXT` y déménage depuis
`ScaleTrainingPage.tsx:74` (une seule source, importée par l'écran d'entraînement).

```ts
export interface FormStep {
  selection: ScaleSelection; level: 1 | 2 | 3; segment: Segment;
  /** « Position 3 · exercice à trous » */ label: string;
  /** « il manque une réussite sur la position entière » */ why: string;
}
export function nextFormStep(journal: readonly Attempt[], scaleId: string, tonic: NoteName, system: PositionSystem, tuningId: string): FormStep | null;

export interface Cap { scaleId: string; tonic: NoteName; system: PositionSystem; title: string; why: string }
export const SCALE_PATH: readonly { scaleId: string; tonic?: NoteName; kind: 'scale' | 'tonic' | 'transpose' }[];
export function nextCap(journal: readonly Attempt[], from: { scaleId: string; tonic: NoteName; system: PositionSystem }): Cap | null;
```

- `nextFormStep` : première forme du système (ordre du manche) pas encore apprise ; étape déduite du journal et
  de `learnedGaps` : jamais écoutée → N1 « écouter » ; pas 2 réussites → N2 position entière (D91) ; pas de
  réussite forte → N3 (sans micro) ou N2 au micro ; manque un 2ᵉ jour → « reviens demain » (`null` aujourd'hui,
  la séance passe au cap ou s'arrête). Toutes apprises → `null`.
- `nextCap` (ordre de l'arbre §3.2, en partant de La m boxes ; chaque entrée déjà « apprise » est sautée) :
  1. **G1.2 blues mineur**, même tonique, position 1 — « Une note de plus (la ♭5) sur le dessin que tu connais. »
  2. **G1.1, 2ᵉ tonique** : position 1 en **Mi m** (cases 0-3) — « Même dessin, presque à vide : Mi mineur. »
     C'est elle qui ouvre G1.4 (« jamais avant 2 tonalités »).
  3. **G1.4 transposition** : la position 1 dans une zone non couverte (`unseenZoneTonic`), tant que < 3 zones —
     « Même dessin, autre case : Do m, cases 8-11. »
  4. **G2** pentatonique majeure (relative : Do pour La m) puis blues majeur ; **G3** majeure (`ionian`,
     `defaultSystem`) ; **G4** `aeolian` ; **G5** `mixolydian`, `dorian`, `lydian`, `phrygian`, `locrian` ;
     **G6** `harmonic-minor`, `melodic-minor` ; **G7** symétriques, bebop.
  5. G8 impro : jamais en héros ; une ligne secondaire « Improviser sur ce que tu sais » dès 3 formes apprises.
- Tests `tests/curriculum.test.ts` : journal vide → N1 position 1 ; deux N2 réussis sans réussite forte, sans
  micro → N3 ; 5 formes apprises → `nextFormStep` null et `nextCap` = blues mineur ; blues appris → Mi m ;
  Mi m appris → transposition ; 3 zones → pentatonique majeure ; chaque persona simulée reçoit une étape ou un
  cap à chaque jour de pratique.

**2b. Séance du jour** — `src/app/hubPlan.ts` (pur) :

```ts
export interface DailySession {
  review: ReviewTarget[];        // cartes dues pas encore tentées à froid aujourd'hui (Q1)
  reviewedToday: number;         // formes déjà rafraîchies aujourd'hui
  next: FormStep | null;
  cap: Cap | null;               // seulement si next === null
  minutes: number;               // arrondi à la minute, 0 si rien
}
export function dailySession(journal: readonly Attempt[], now: number, sel: { scaleId: string; tonic: NoteName; system: PositionSystem; tuningId: string }, opts?: ReviewOptions): DailySession;
export function sessionMinutes(review: readonly ReviewTarget[], next: FormStep | null, journal: readonly Attempt[], lookSeconds: number): number;
export function heroAction(plan: HubPlan, session: DailySession): { route: RouteName; label: string };
```

- `sessionMinutes` : par forme due, médiane des `seconds` des rappels N3 position entière de l'élève (repli
  90 s), plus `taux d'échec à froid × (lookSeconds + médiane)` ; étape suivante : médiane des séries de ce niveau
  (repli 90 s, écoute 60 s). Arrondi à la minute supérieure.
- `hubPlan` garde la reprise d'accord ; pour les gammes, le héros devient la séance. « Une autre forme »
  disparaît (la séance a son ordre).

Textes exacts du héros (`HubPage.tsx`, panneau `accent="magenta"`, étiquette « Séance du jour ») :
- Ligne de durée : « Environ 8 min » (« Moins d'une minute » si 0 < minutes < 1).
- Étapes (`<ol className="home-steps">`, mêmes styles que le premier pas) :
  1. « Rafraîchir 3 formes, de mémoire » (« Rafraîchir 1 forme, de mémoire ») ; faite : « 3 formes rafraîchies ».
  2. « Avancer : Position 3, exercice à trous » ; sous-ligne `why` ; ou le cap : « Nouveau défi : blues mineur,
     position 1 » ; sous-ligne `cap.why`.
- Bouton primaire = l'étape en cours : « ▶ Réviser (3 formes) », « ▶ Avancer », « ▶ Écouter la position 3 »,
  « ▶ Découvrir le blues mineur ». Espace / Entrée inchangés (`isHeroShortcut`).
- Tout fait (révisions faites, étape « reviens demain ») : « Séance faite. La suite demain : un second jour
  compte pour « apprise ». » ; bouton secondaire « Continuer quand même ».
- **Bilan de séance** (`ScaleTrainingPage.tsx:964-977`) : « Ensuite : Position 3, exercice à trous » (bouton
  primaire, ouvre `selection` + niveau + segment) ; « Encore 3 formes dues » si la file n'est pas vide.
- **Parcours** (`HubPage.tsx:404-405`) : « 5 formes apprises sur 5 · 3 à rafraîchir » ; si des maîtrisées :
  « 5 formes apprises sur 5, dont 2 maîtrisées ». Pure : `pathCountText(learned, mastered, due, total)`.
- **Nommage (constat 18)** : « prochain » est déjà pris deux fois (« prochain cap : 14 jours », « prochain : Em ») ;
  la séance dit « Avancer » et « Nouveau défi », jamais « prochain ».

Tests (`tests/hubPlan.test.ts`) : `dailySession` (rien de dû → `next` seul ; dû + étape → les deux, ordre ;
forme tentée à froid aujourd'hui → sortie de `review`, comptée dans `reviewedToday` ; toutes les formes apprises
→ `cap`) ; `sessionMinutes` (replis, médiane, échec) ; `heroAction` ; `pathCountText`. Invariants :
- **I2** : sur toute fenêtre de 7 jours de pratique, `dailySession` a au moins une fois `next` ou `cap` non nul.
- **I3** : quand une forme apprise est due, `pathCountText` contient « à rafraîchir ».
- **I4** retourné.

**2c. Simulateur branché sur la séance** (`src/dev/simulate.ts`) : chaque jour pratiqué, l'élève fait
`dailySession(...).review` (à froid, rattrapage si < 80 %), puis l'étape `next`, puis le `cap` (il change de
gamme ou de tonique) ; le parcours maison (`nextStep`, `simulate.ts:135`) ne sert plus qu'aux séries de vitesse
de l'avancé. Personas inchangées. Rapport : colonne « séance » (« 3 révisions + Position 3, trous » ou
« blues mineur ») qui remplace « accueil ».

Acceptation : I2, I3, I4 verts ; rapport : plus aucune série de ≥ 5 jours de pratique sur le même héros ;
l'avancé atteint au moins le blues mineur avant J45 ; tournée hub en Synthwave et Aube, 1440 et 390.
Décision **D98** (séance du jour, fin de séance, ordre des défis).

### Lot 4 — Série de semaines actives (constat 4)

Règle de récompense nouvelle, à ta demande : **D99** (Q4 : 2 jours, paliers 4 / 8 / 12).

- `weekStreak(attempts: readonly Attempt[], now: Date, minDays = 2): { weeks: number; thisWeek: number }` dans
  `core/progress/rewards.ts` : semaines consécutives (lundi-dimanche, calendrier local, `dayKey`) ayant au moins
  `minDays` jours avec un exercice vérifié (même filtre que `streak` : `isVerified`). La semaine en cours ne casse
  rien avant d'être finie ; elle compte dès qu'elle a ses jours.
- Affiche (`HubPage.tsx:386-388`) : « Série : 3 jours · 5 semaines » ; jours à 0 : « Série : 5 semaines ».
- « Comment ça compte ? » (`HubPage.tsx:458-460`) : « Une semaine compte quand tu joues au moins 2 jours entre
  lundi et dimanche ; la semaine en cours ne casse rien avant dimanche soir. »
- Paliers : `WEEK_MILESTONES = [4, 8, 12]` dans `accomplishments.ts`, même mécanisme que
  `STREAK_MILESTONES` (`:57`) : « 4 semaines d'affilée ».
- Tests (`tests/progress.test.ts`) : week-end simulé (42 j) → aucune semaine cassée ; semaine à un seul jour →
  cassée ; semaine en cours à 1 jour → ne casse pas ; passage à l'heure d'hiver (25 oct. 2026) ; journal vide → 0.
- Invariant **I6** : week-end, `weekStreak` ne retombe jamais à 0 après la 1re semaine pleine ; `streak` inchangé.

### Lot 3 — Carte de révision et retour après absence (constats 3, 8)

- `reviewLine(card: Card, attempts: readonly Attempt[], now: number): { reason: string; trend: string }` dans
  `hubPlan.ts`, remplace `reviewSummary` :
  - `reason` : « À rafraîchir · vue il y a 3 j · palier 2 sur 6 » (âge par `whenLabel`, déplacée de
    `HubPage.tsx:34` vers `hubPlan.ts`, pure : « il y a 5 sem. » au-delà de 14 j au lieu d'une date).
  - `trend` : 3 dernières preuves de la forme, « 50 % → 75 % → 83 % » ; une seule : « premier passage : 83 % » ;
    série de moins de 5 trous : le compte, « 1 trou juste sur 2 ».
- Dans la séance du jour, sous l'étape 1 : la première forme due avec `reason`, `trend` en `t-dim` ; les autres
  dans un `<details>` « et 2 autres ».
- `absenceDays(attempts: readonly Attempt[], now: Date): number` (jours calendaires depuis le dernier exercice
  vérifié). À partir de 3 jours, première ligne du héros :
  « Content de te revoir. 4 formes à rafraîchir, environ 6 min : on reprend doucement. »
  Puis, si la série de jours est tombée et que la série de semaines tient : « Ta série de semaines tient : 5
  semaines. » ; si les deux sont tombées : « Une nouvelle série commence aujourd'hui. » Jamais de reproche.
  Plus de 8 dues : « 8 aujourd'hui, les autres reviendront. »
- Tests : `reviewLine` (1, 2, 3+ preuves ; série de 2 trous ; âge > 14 j) ; `absenceDays` (0, 2, 3, 12 ; écoute
  seule ignorée) ; texte de retour selon séries. Invariant **I5** : décrocheur J23, la première ligne est le
  message de retour ; régulier, jamais.

### Lot 5 — Écran de révision lisible (constats 5, 14, 19, 23)

- **14** (`ScaleTrainingPage.tsx:1137-1153`) : le paragraphe devient une liste de définitions (`<dl
  className="ex-facts">`, styles par tokens, deux thèmes) :
  - « Séance » : « 2 sur 5 · Position 3 · à rafraîchir » + `<details>` « Les 5 formes » (liste) ;
  - « Consigne » : « De mémoire, sans revoir la forme. Seul ce premier essai compte. » (rattrapage : « Rattrapage :
    tu viens de voir la forme, il ne compte pas. ») ;
  - « État » : `formStateLine` ;
  - aide du pavé dans un `<details>` « Clavier » replié.
- **23** : en séance, le pied « ‹ Position · 1 / 5 · Position › » est masqué (changer de position sortait de la file).
- **5** : bilan de séance : « 2 rattrapages après « Regarde la forme » : comptés pour la journée, pas pour la
  mémoire. » (si > 0).
- **19** : fonction pure `scrollToKeepVisible(holeTop: number, holeBottom: number, viewportH: number, coverTop: number, margin = 16): number`
  (`modules/gammes/exercise.ts`) → décalage de défilement pour que la case active reste au-dessus de la barre
  fixe ; appelée à chaque changement de case active (position de la case : `layout` pur de `core/tab`, sans
  toucher au rendu). Test : case sous la barre → décalage positif ; case visible → 0.
  Contrôle `tools/answer-bar-check.mjs` (Playwright, 390 × 844, régulier J14, page Révision) : pour chacune
  des 23 cases, le bas de la case active est au-dessus du haut de `.answer-bar`. Aujourd'hui : échec dès la case 18.

### Lot 6 — Outillage et bruit du rapport

- `stringWeakness` (`mastery.ts:388`) : ajouter `exposure` (séries vérifiées où la corde était jouée : segment de
  la tentative) et trier par `misses / exposure`. Test : segment de 3 cordes graves → les cordes aiguës ne sont ni
  exposées ni « ratées ». Le rapport n'affiche « corde la plus ratée » qu'avec au moins 5 expositions.
- Constat 11 : rien dans le dépôt (déjà en mémoire de travail).
- Rapport : invariants I1-I6 en constats automatiques en tête de chaque persona.

---

## Invariants mesurés par le simulateur

| Id | Énoncé | Aujourd'hui | Lot |
| --- | --- | --- | --- |
| I1 | La séance ne propose jamais une forme apprise ou maîtrisée non due | 186 fautes (avancé) | 1 |
| I1 bis | Toute raison « autre zone » est tenue (tonique dans une zone non vue) | 190 fautes | 1 |
| I1 ter | Compte de l'accueil = rappels à froid de la journée, plafonds cohérents | vert (faux à 8 dues) | 1 |
| I2 | 7 jours de pratique d'affilée → au moins une étape ou un défi proposé | régulier 21 j, avancé 28 j sans | 2 |
| I3 | Forme apprise due → « à rafraîchir » dans le Parcours | jamais dit | 2 |
| I4 | Une séance finie ne se rouvre pas le soir même | 18 soirs sur 26 (régulier) | 2 |
| I5 | ≥ 3 jours d'absence → message de retour en tête ; jamais sinon | absent | 3 |
| I6 | Week-end : série de semaines jamais cassée ; série de jours inchangée | cassée 6 fois (jours) | 4 |
| I7 | Téléphone : la case active n'est jamais sous la barre de réponse (Playwright) | case 18 cachée | 5 |

## Vérification, à chaque lot

1. Tests ciblés du lot + `npx tsc --noEmit`.
2. `npm run sim:report` : relire les constats du lot ; consigner les nouveaux dans `SIM_CONSTATS.md`.
3. `node tools/sim-tour.mjs --pages hub,revision` (et `--width 390 --height 844`) : captures relues, Synthwave et
   Aube pour les lots 2, 3, 4, 5.
4. Fin du chantier : `npm test`, `npm run build`, tournée complète.

## Ce que ce plan ne change pas

Intervalles Leitner, seuils PASS (80 %) / EXCELLENT (95 %), issue « lente = même palier », critères « apprise » /
« maîtrisée », barème et plafond d'XP, objectif du jour (3), série de jours, plafond de 8 dues, séance de 5 formes.
Règles nouvelles : D97 (porte unique, complément, tonique de révision, échauffements hors révision), D98 (séance du jour,
fin de séance, ordre des défis), D99 (série de semaines).

## Réponses aux questions de l'ancien plan

- **Dire la transposition avant ?** Oui, dans la raison de la séance (« même dessin, autre case : en Do m, cases
  8-11 ») et en tête de l'écran (le titre affiche déjà la gamme et la tonique). Sans cela, l'élève croit à une
  erreur de l'app.
- **Ordre blues puis transposition** : blues d'abord, oui, mais pas pour la raison donnée. Ordre recommandé :
  blues mineur (G1.2, le plus petit pas, même dessin) → **position 1 en Mi m** (G1.1, la 2ᵉ tonalité que l'app n'a
  jamais proposée) → transposition libre (G1.4, débloquée par ces 2 tonalités) → G2…
- **Nom de l'étape suivante** : ni « prochain cap » ni « prochaine étape » (« prochain » sert déjà deux fois) :
  « Avancer » pour la forme suivante, « Nouveau défi » pour un changement de gamme ou de tonique.
- **Seuil de 2 jours et paliers en semaines** : 2 jours (le week-end entier compte, un seul jour ne fait pas une
  habitude), paliers 4 / 8 / 12 semaines (même mécanisme que la série de jours). Confirmé (Q4).
- **Constat 17** : confirmé, et aggravé par le constat 20. **Constat 19** : confirmé en vue réelle, lot 5.

## Réponses de l'auteur (2026-10-29)

| Question | Réponse | Où |
| --- | --- | --- |
| **Q1** Fin de séance | Une forme tentée à froid aujourd'hui **sort de la séance du jour jusqu'à demain** ; affichage seul, Leitner inchangé | Lot 2b, I4, D98 |
| **Q2** Échauffements | **Seules les séries sur la position entière (ou de mémoire) touchent la carte** ; un segment de 1-3 cordes ne crée ni ne déplace de carte | Lot 1 §5, D97 |
| **Q3** Tonique en révision | **Après 2 toniques travaillées**, pour une forme apprise ou maîtrisée, un rappel sur deux, dans une zone non vue, raison affichée ; avant, la tonique apprise | Lot 1 §4, D97 |
| **Q4** Série de semaines | **2 jours par semaine, paliers 4 / 8 / 12 semaines** | Lot 4, D99 |
