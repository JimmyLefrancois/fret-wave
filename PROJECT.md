# PROJECT.md — Fretwave (nom de travail) : apprendre la guitare, en tablature, en pixel art

**Statut : phase 0 validée (D1-D10 acceptées ; D8 = `Am7` anglo). Phase 1a terminée (moteur de théorie + voicings + tests) ; 1b (TabScore + rendu pixel) en attente de ton feu vert.**
Documents liés : `BRIEF.md` (cahier des charges), `MUSIC_DESIGN.md` (conventions musicales, curriculum, avis de prof).
Légende : **[HYP]** hypothèse prise sans te bloquer · **[À TRANCHER]** décision qui t'appartient · **[RISQUE]** voir section 7.

---

## 0. En une page

| Sujet | Décision proposée |
|---|---|
| Framework | **Vite + TypeScript + React 19.** Le temps réel (audio, canvas) vit dans des classes TS hors React ; React ne gère que l'UI (hub, menus, réglages). |
| Rendu pixel | **Canvas 2D**, **un seul « pixel logique » pour toute l'app** (facteur entier S ≥ 2), canvas de largeur variable ; **pas de PixiJS**. |
| Tablature | **Moteur maison** (modèle `TabScore` + layout pur + rendu canvas). **alphaTab écarté** pour le rendu (justification 3.3). |
| Théorie | `tonal` + couche guitare maison ; **une seule couche d'affichage** anglo↔solfège. |
| Audio sortie | Web Audio + Tone.js ; échantillons de guitare (CC BY 3.0 pour démarrer, **licence à afficher**) + repli par synthèse. |
| Pitch mono | `pitchy` (McLeod) dans un AudioWorklet, fenêtre adaptée à l'accordage. |
| Polyphonique | **Moteur maison « accord attendu »** (peignes d'harmoniques + soustraction), **pas essentia.js (AGPL-3.0)**, pas de chromagramme seul. Verdict = **niveau de confiance**, jamais binaire. |
| Persistance | IndexedDB (journal d'événements) + localStorage (réglages) + export/import JSON ; `navigator.storage.persist()`. |
| Modules | `Gammes` et `Accords` au MVP ; **un module `Fondations` (onboarding, accordeur) en plus** ; `Rythmique` préparé dès le modèle. |
| Écart majeur avec le brief | Gammes débutent par la **pentatonique mineure**, pas la majeure ; Am n'est **pas** un accord à 1-2 doigts ; le **verdict par corde en strum est irréaliste** ; **boîte d'accord à décider** (7.1 de `MUSIC_DESIGN.md`). |

---

## 1. Points du cahier des charges à challenger

Ce qui, tel quel, serait irréaliste, trompeur ou frustrant — avec l'alternative.

1. **Diagnostic par corde en plaqué** (« corde étouffée, grésille, mauvaise note ») : irréaliste. Le diagnostic précis est **réservé au mode arpège** ; en strum, niveau de confiance global + indices (voir 7.2).
2. **Am en « 1 à 2 doigts »** : faux (3 doigts). Voir curriculum révisé, `MUSIC_DESIGN.md` §4.
3. **Gammes : « majeure/mineure d'abord »** : théoriquement propre, mais la pentatonique donne un 1er succès bien plus vite. Je propose de changer l'ordre (§3.2 de `MUSIC_DESIGN.md`).
4. **1 248 nœuds de gamme** si on suit le brief au pied de la lettre : intenable en révision. Modèle « formes + lectures + tonalités échantillonnées » (3.1 de `MUSIC_DESIGN.md`) : ≈ 17 formes, ≈ 104 lectures.
5. **Tab seule pour les accords** : limite réelle pour un débutant (la forme de la main). Je propose une **boîte d'accord limitée aux étapes Découvrir/Construire**, à ta décision.
6. **« Niveau 3 : rejouer toute la gamme de mémoire au pavé numérique »** : 36 saisies = abandon. Découpage en segments.
7. **4-5 ambiances × backing tracks de styles différents** : surtout un travail de contenu musical, pas de code. Proposition : 1 style très soigné par thème, **2 thèmes jouables complets (Synthwave, Lo-fi) en phase 7**, les autres en habillage + SFX seulement d'abord.
8. **Qualité sonore « studio » avec échantillons libres** : plafond réel = celui des échantillons disponibles. Voir 3.5 : il faudra peut-être un compromis ou un pack à acheter/enregistrer.
9. **Accords en accordage alternatif** : seules les formes mobiles ou recalculées par un solveur testé sont proposées.
10. **Ordre du brief « tout dans la phase 1 »** : la phase 1 est énorme (théorie + voicings + moteur de tab + audio + hub + thème + module Gammes N1 + positions). Je propose de la découper en 1a/1b/1c (section 10), sans changer l'ordre global.

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
Vite 8.3.5 · React 19.3.1 · Vitest 5.0.5 · Tone 15.1.22 · tonal 6.5.1 · pitchy 4.1.0 · idb 8.0.4 · vite-plugin-pwa 2.0.0 · Node 24.22.1 présent sur la machine. Les numéros seront figés dans `package.json` en phase 1 ; vérification faite via `npm view`, pas via installation.

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

### 3.5 Audio sortie : Tone.js + échantillons
- Tone.js : Transport (timing précis, pas de `setTimeout`), Sampler, Draw (sync visuelle).
- **Échantillons** : point de départ réaliste = jeu `tonejs-instruments` (guitares acoustique, électrique, nylon ; basse électrique) — code MIT, **échantillons CC BY 3.0 → attribution obligatoire** (page « Crédits » + fichier `LICENSES`), issus de sources du domaine public selon l'auteur, **à vérifier avant d'embarquer**. Limites honnêtes : échantillonnage espacé, une couche de vélocité, pas de distinction par corde.
- **Repli et complément** : une **synthèse de corde pincée (Karplus-Strong)** pour tout ce qui sort de la plage échantillonnée (7 cordes, baryton, accordages bas) et pour les SFX.
- **Qualité standard / haute** : proposer deux jeux (poids vs qualité) si on trouve mieux (soundfont libre de qualité, ou pack acheté/enregistré). Les licences (notamment des SoundFonts « Musyng/FluidR3 ») **n'ont pas été vérifiées en phase 0** : à vérifier avant tout usage.

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
IndexedDB via `idb` (ISC) : stores `attempts` (journal d'événements, source de vérité), `nodes` (agrégats recalculables), `settings`, `meta`. Export/import JSON. `navigator.storage.persist()` demandé après la première session réussie. Raison : sans backend, **perdre l'historique est le pire risque produit** (voir R7).

### 3.9 PWA et tests
`vite-plugin-pwa` (Workbox) ; échantillons en cache à la demande (jeu « haute qualité » téléchargeable). Tests : Vitest (logique pure), tests de propriétés sur la théorie (orthographe, voicings), tests de signaux synthétiques pour l'audio, captures d'écran pour le rendu (phase 1+).

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
      progress/  model · store(idb) · srs/Scheduler · xp · streaks · badges · recommender
      themes/    tokens · registry · scene (parallaxe) · particles
      ui/        composants pixel · pavé numérique · accessibilité
    modules/
      fondations/  gammes/  accords/  rythmique/ (déclaré)
      registry.ts  (import.meta.glob('./*/module.ts'))
    data/        voicings.json · progressions.json · skill-graphs/
  tests/
```
**Ajouter un module = ajouter un dossier avec `module.ts` ; ajouter un thème = ajouter un fichier de config + assets.** Le cœur ne change pas.

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

### 4.4 Modèle `TabScore` (indépendant du rendu ; consommé par rendu **et** audio)
```ts
interface TabScore { id; tuning: Tuning; stringCount: number; capo?: number; ppq: 480;
                     tempo: number; timeSig: [number, number]; measures: Measure[] }
interface Measure  { timeSig?; tempo?; label?: { chord?: ChordRef; roman?: string }; events: TabEvent[] }
interface TabEvent { startTick: number; durTick: number; tuplet?: Tuplet;     // entiers : pas de dérive flottante
                     kind: 'notes'|'rest'; notes: TabNote[];
                     chord?: ChordRef; strum?: { dir: 'D'|'U'; spreadMs?: number } }
interface TabNote  { string: number /*0 = grave*/; fret: number; pitch: Pitch /*MIDI + nom anglo*/;
                     muted?: boolean; technique?: 'h'|'p'|'/'|'\\'|'b'|'~'; finger?: 0|1|2|3|4|'T';
                     fn: IntervalFunction /*1,♭3,3,♯4,♭5…*/; hidden?: boolean /*trous niveau 2*/ }
```
- Les **ticks entiers** (PPQ 480) évitent les erreurs de flottants ; conversion vers le Transport de Tone en un seul endroit.
- Générateurs `theory → TabScore` : gamme, position, arpège, accord (plaqué/arpégé), exercice, progression, backing.
- Tests : durées par mesure = signature ; chaque note a une hauteur cohérente avec l'accordage (`pitch = tuning[string] + fret`) ; l'audio joué = les notes affichées.

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

### 4.7 Pipeline audio de sortie
```
Instruments (guitare réf., basse, batterie, pads, SFX)
   → bus guitare | bus backing | bus SFX  (volumes séparés, mémorisés)
   → envoi réverb légère (réponse impulsionnelle pré-calculée : pas de génération à chaud sur mobile)
   → master : EQ doux → compresseur → limiteur (plafond −1 dBFS)
   → Tone.Destination (latencyHint "interactive", contexte démarré après un geste)
```
- Strum : décalage 8-25 ms entre cordes (descendant grave→aigu, montant inverse), vélocité variée, **notes = celles du TabScore**.
- Backing : séquencé par `Tone.Transport` (pas de `setTimeout`) ; lignes de basse et voicings avec conduite de voix ; **banque de patterns par style** (données, pas de code).
- Chargement des échantillons avec écran pixel art ; page **debug audio** pour tester chaque son.

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
- **Hauteur d'une tab 6 cordes ≈ 144 px logiques** : en-tête (nom d'accord + chiffrage romain) 22 ; corde/pastilles 83 ; rythme 16 ; annotation 10 ; doigtés 10 (+ marge). **7 cordes : +14.**
- **Échelle `S` automatique** : `S = clamp(⌊min(largeur/190, hauteur×0,38/144)⌋, 2, 4)` : téléphone 390×844 → **S=2** (chiffre 14 px CSS de haut, pastille 26×34 CSS, bien lisible) ; bureau 1440×900 → S=2 (S=3 en réglage) ; 4K → S=4. Largeur logique = largeur écran/S (**195 px logiques en portrait**).
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

### 5.3 Typographie
- **Police bitmap maison 5×7** pour tout ce qui est dans la tab (chiffres, notes, degrés, ♯ ♭ 𝄪 𝄫, ↓ ↑, °, ø, Δ) : aucune police existante ne couvre ces glyphes en pixel net.
- UI (DOM) : **Press Start 2P** (titres, courts), **Silkscreen** (étiquettes), **VT323** (texte long, plus lisible). Les trois sont sous licence OFL (**à confirmer à l'intégration**), auto-hébergées pour le hors-ligne.
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
| R4 | **Échantillons** : qualité « studio » inatteignable avec les packs libres ; licences | 2 | 2 | Attribution CC BY ; Karplus-Strong en repli ; deux niveaux de qualité ; pack acheté/enregistré possible |
| R5 | **Pixels inégaux** (DPR non entier, redimensionnement) | 2 | 2 | Échelle entière sur pixel physique ; test de rendu à 5-6 DPR ; captures de non-régression |
| R6 | **Moteur de layout de tab** (rythme : ligatures, triolets, doubles croches, piles) plus long que prévu | 2 | 3 | Périmètre incrémental : noires/croches/doubles d'abord, triolets ensuite ; layout pur testé ; modèle complet dès le départ |
| R7 | **Perte de données** (stockage purgé par iOS pour un site non installé après ~7 jours d'inactivité ; vidage manuel) | 2 | 3 | PWA installée + `persist()` ; **export/import JSON** proposé à chaque palier ; journal d'événements |
| R8 | **Perf mobile** (canvas plein écran + particules + audio) | 2 | 2 | Couches pré-rendues, scène à 30 fps, curseur seul redessiné ; profilage dès la phase 1 |
| R9 | **Contenu** : volume de voicings, progressions, patterns de backing ; erreurs de transcription | 2 | 3 | Tests automatiques sur chaque forme ; données séparées du code ; relecture « prof » des doigtés en phase 4 |
| R10 | **Dérive de périmètre** : le brief est très large | 3 | 3 | Phases séquencées, définition de « terminé » par phase, phase 1 découpée 1a/1b/1c |
| R11 | Contraintes d'**autorisation** (HTTPS requis pour le micro) | 1 | 2 | `localhost` pour le dev ; HTTPS pour le déploiement ; messages d'erreur dédiés (refusée, aucun périphérique) |
| R12 | Taille du bundle (Tone.js ≈ 5,4 Mo dépaquetés) | 1 | 1 | Imports ciblés, découpage par module ; **à mesurer** en phase 1 (pas de chiffre avancé ici) |

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

1. Droitier, accordage standard, La = 440 Hz, notation d'affichage **solfège** par défaut (réglage anglo/jazz). **[HYP]**
2. Français uniquement ; textes dans un catalogue i18n pour une éventuelle traduction. **[HYP]**
3. Pas de backend ; données locales ; aucun compte.
4. Corde grave = index 0 dans le modèle ; « corde 1 » = aiguë côté affichage.
5. PPQ 480 en interne.
6. Leitner à 6 boîtes derrière une interface `Scheduler` (FSRS possible).
7. Symboles d'accords affichés en **notation anglo-saxonne par défaut (`Am7`, `G/B`, `F♯m7♭5`)** — **décision D8 validée** ; les noms de notes (tab, annotations) restent en solfège par défaut ; deux réglages distincts (`noteNotation`, `chordNotation`).
8. Défi : x accords de 2 à 6.
9. Latence : mesurée par calibration, pas estimée.
10. Le dépôt git du projet est vide (aucun commit) ; **je n'ai rien commité**. Les 3 fichiers `BRIEF.md`, `PROJECT.md`, `MUSIC_DESIGN.md` sont non suivis.

---

## 9. Plan des phases (affiné)

| Phase | Contenu | « Terminé » = |
|---|---|---|
| **1a** | Moteur de théorie (gammes, accords, orthographe, enharmoniques, conversion solfège), accordages/nb de cordes, base de voicings + tests | Tous les tests de `MUSIC_DESIGN.md` verts ; couverture des 13+13 tonalités |
| **1b** | `TabScore`, layout, rendu pixel art, curseur, police bitmap, positions (CAGED / 3NPS / boxes + table de compatibilité) | Captures lisibles à S=2 sur 390×844 ; chiffres 2 chiffres nets ; piles d'accords nettes |
| **1c** | Moteur audio + échantillons, hub, thème Synthwave, module Gammes N1 | Écoute montante/descendante + drone, curseur synchronisé, page debug audio |
| 2 | Gammes N2/N3 (saisie), progression unifiée persistante, XP, SRS | Journal + export/import |
| 3 | Entrée mono, calibration, accordeur, affichage live | Test sur guitare réelle |
| 4 | Accords A : curriculum, tab accords, leçon guidée, QCM/auto-éval, validation arpège, recommandation | Parcours P0-P4 jouable |
| 5 | Polyphonique, onset, timing, transitions | Résultats chiffrés publiés |
| 6 | Défi Accords, strumming, familles d'accords, harmonisation | Setlist complète |
| 7 | Improvisation + backing tracks + classification | Synthwave + Lo-fi jouables |
| 8 | Thèmes, ear training, dashboard, badges, PWA, polish | — |
À chaque phase : l'app tourne (`npm run dev`), code typé, tests unitaires ; captures d'écran ; bilan en fin de phase + 3 à 5 propositions pédagogiques.

---

## 10. Décisions attendues (avec ma recommandation)

| # | Décision | Recommandation |
|---|---|---|
| D1 | Boîte d'accord : (A) tab seule · **(B) boîte uniquement aux étapes Découvrir/Construire** · (C) partout | **B**, désactivable |
| D2 | Ordre Gammes : pentatonique mineure d'abord (vs majeure d'abord du brief) | pentatonique d'abord |
| D3 | Curriculum Accords révisé (P1 Em/Em7/Asus2/Am7 ; Am en P2 ; C et G en P4 avec marchepieds) | accepté |
| D4 | Power chords : branche optionnelle dès P2 | accepté |
| D5 | Critères « appris » : 3 arpèges vérifiés sur ≥ 2 jours + rappel à froid | accepté (seuils réglables) |
| D6 | Module `Fondations` + `Rythmique` déclaré | accepté |
| D7 | Échantillons : démarrer avec `tonejs-instruments` (CC BY 3.0, attribution) + Karplus-Strong | accepté, à revoir si qualité insuffisante |
| D8 | Style d'affichage des accords | **`Am7` (anglo) — tranché par toi** ; solfège/jazz en option |
| D9 | Solveur de voicings pour accordages alternatifs : phase 4 ou plus tard | plus tard (après P4) |
| D10 | Phase 1 découpée en 1a/1b/1c | accepté |

---

## 11. Journal d'avancement

- **Phase 0** (terminée) : lecture complète de `BRIEF.md` (40 513 octets) ; versions et licences de paquets vérifiées via `npm view` ; calculs de fenêtres FFT, harmoniques et périodes ; **vérification de 43 voicings et 10 formes mobiles (0 erreur)** ; rédaction de `PROJECT.md` et `MUSIC_DESIGN.md`. Aucun code d'application. **Validée par l'utilisateur** (tout accepté ; D8 changée en `Am7`).
- **Phase 0 validée** : D1-D10 acceptées ; **D8 changée : symboles d'accords en anglo (`Am7`) par défaut** (réglages `noteNotation` = solfège et `chordNotation` = anglo, distincts).
- **Phase 1a (terminée)** : projet Vite 8 + React 19 + TypeScript 7 + Vitest 5 ; `src/core/theory/` : notation (conversion unique anglo↔solfège, glyphes ♯ ♭ 𝄪 𝄫), catalogue de gammes (modes, pentatoniques, blues, harmonique/mélodique jazz et leurs modes, symétriques, bebop), politique des tonalités (13+13), accordages 6-8 cordes, fretboard (fréquence → corde/case, plage et fenêtre de pitch déduites de l'accordage), accords par formule, table de compatibilité gamme ↔ systèmes, voicings (43 formes + 10 formes mobiles) avec validateur. **61 tests verts**, `tsc` propre, `vite build` OK (≈ 82 ko gzip), page de contrôle `npm run dev` vérifiée dans un navigateur (Ré dorien = Ré Mi Fa Sol La Si Do ; 43 voicings affichés).
  - Écarts avec ce qui était écrit en phase 0 : la règle d'orthographe des toniques est « **coût égal → les deux** » (et non « écart ≤ 1 ») : c'est elle qui retrouve exactement la table des tonalités (test) ; `dim` = triade, `dim7` = 1 ♭3 ♭5 𝄫7 ; « Bbb5 » se lit Si𝄫 power chord (une altération après la lettre fait toujours partie de la fondamentale).
  - **Pas encore fait de la phase 1** : génération des positions (3NPS, CAGED, boxes), `TabScore`, rendu, audio, hub, thème, module Gammes N1 → phases 1b et 1c.
