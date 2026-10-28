# Architecture et conception (§1 à §7, extraits de PROJECT.md)

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
10. **Ordre du brief « tout dans la phase 1 »** : la phase 1 est énorme (théorie + voicings + moteur de tab + audio + hub + thème + module Gammes N1 + positions). Je propose de la découper en 1a / 1b / 1c / 1d (`PROJECT.md` §9 ; D10 et D18, [`docs/DECISIONS.md`](DECISIONS.md)), sans changer l'ordre global.

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
- **Compte à rebours, backing, SFX** : pas en 1c (voir `PROJECT.md` §12).
- **Prévu pour la suite** (phase 7) : bus **backing** (basse, batterie, pads) et bus **SFX** branchés sur le même `mix` ; séquencement par `Tone.Transport`, lignes de basse et voicings avec conduite de voix, motifs de strumming par style **en données** — la chaîne actuelle les accepte sans modification.

### 4.8 Pipeline audio d'entrée — *tel que construit en 3* (`src/core/input/`)
```
getUserMedia({ deviceId?, echoCancellation:false, noiseSuppression:false, autoGainControl:false })  // pas de channelCount : Firefox + interface stéréo → flux muet ; le worklet mixe en mono
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

