# MUSIC_DESIGN.md — choix musicaux et pédagogiques

Statut : **phases 0, 1a, 1b, 1c, 1d, 2, 3, 4a et 4b terminées** (4b = module Accords, partie B : cycle complet en sept étapes, QCM sans matériel, accordage guidé corde par corde, paliers P5-P7). Ce document fixe les conventions et le plan pédagogique ; il est mis à jour à chaque phase. Nouveautés de la phase 4b : **§4.6** (le critère « appris » tient enfin sa promesse : pose à froid comprise), **§4.7** (l'axe *transition* est mesuré), **§5** (trois nouveaux types de nœuds), **§16** (bilan de la 4b, avis de prof et propositions).
Auteur du raisonnement : rôle « dev + prof de guitare » du BRIEF.md. Les avis de prof sont marqués **[AVIS PROF]**, les hypothèses **[HYP]**, les points à trancher par toi **[À TRANCHER]**.

Ce qui a été **vérifié par calcul** en phase 0 (script jetable, hors dépôt) : les 43 formes d'accord de la section 4.3 (notes réellement produites en accordage standard = notes de l'accord, basse correcte, orthographe correcte) et les 10 formes mobiles (barrés Mi/La × 5 qualités) sur 13 positions de fondamentale (cases 0 à 12) : **0 erreur**. Tout le reste est du raisonnement non exécuté.

---

## 1. Conventions théoriques

### 1.1 Hauteurs et octaves
- Le modèle interne manipule des **hauteurs réelles (son)**. MIDI 60 = C4 (convention `tonal`). La = 440 Hz par défaut (réglable ; l'accordeur et la détection doivent lire ce réglage).
- Accordage standard, **son réel** : E2 (82,41 Hz) · A2 (110,00) · D3 (146,83) · G3 (196,00) · B3 (246,94) · E4 (329,63). La guitare s'écrit une octave au-dessus mais la tab n'écrit pas d'octave : le modèle n'utilise jamais la hauteur écrite.
- **Le La de référence est un réglage de premier rang depuis la phase 3** (415-445 Hz, défaut 440) : il est lu par la **détection** (fréquence → demi-tons) et par l'**accordeur**. Il ne s'applique pas encore aux échantillons de sortie : jouer à 442 Hz avec des échantillons à 440 reste un écart de 7,9 cents à l'oreille, à corriger en phase 4-5.
- Corde grave = index 0 dans le modèle ; à l'affichage la corde aiguë est en haut. Dans la parole française, « corde 1 » = la plus aiguë : conversion unique dans la couche d'affichage.
- Tests : `fretToPitch(E2, 12) = E3 = 164,81 Hz` ; `freqToCandidates(82,41)` = [(corde grave, case 0)] en standard et [(corde grave, case 2)] en Drop D ; plage dérivée de l'accordage (Drop D → 73,42 Hz ; 7 cordes avec Si1 → 61,74 Hz ; haut de plage = corde aiguë case 24 = E6 ≈ 1 318,5 Hz).

### 1.2 Notation : modèle anglo-saxon, affichage solfège
- **Modèle de données = notation anglo-saxonne uniquement** (`C`, `Bb`, `F#`, `C##`), car c'est celle de `tonal`. **Affichage = couche unique `fmt`** (solfège ou anglo au choix, réglage global). Aucun composant n'écrit « Do » ou « C » en dur ; aucun module n'affiche une note sans passer par `fmt`.
- Correspondance : C=Do, D=Ré, E=Mi, F=Fa, G=Sol, A=La, B=Si. **Piège connu : « B » anglo = « Si », pas « Sib »** ; Bb = Si♭.
- Altérations : ♯ ♭ ♮ **et doubles altérations 𝄪 𝄫** (nécessaires : Fa𝄪 dans Sol♯ mineur harmonique). Ces glyphes n'existent pas dans les polices pixel (Press Start 2P…) : **police bitmap maison pour la tab** avec ces glyphes dessinés à la main.
- Accords : le symbole affiché suit la même couche, **réglage distinct de celui des notes**. **Décision D8 (validée) : `Am7`, `G/B`, `F♯m7♭5` (anglo) par défaut** ; options `Lam7` (solfège + suffixe) et jazz `A-7`. Les noms de notes (tab, annotations, gammes) restent en solfège par défaut. Piège de l'option solfège : « Dom » se lit mal (« dominante ? ») → `Do m`.
- Tests obligatoires : aller-retour `en→fr→en` sur les 35 noms de notes (7 lettres × {𝄫,♭,♮,♯,𝄪}) ; `Bb → Si♭` ; `B → Si` ; accords slash ; rejet des entrées ambiguës.

### 1.3 Orthographe, enharmoniques, armures
Règle générale : **une note par lettre** dans toute gamme heptatonique ; l'orthographe se déduit de la tonique + formule d'intervalles, jamais de l'armure.

Tonalités proposées (armure ≤ 6 altérations ; sauf indication, on n'en propose qu'une par hauteur) :

| Majeures | Mineures (relatives) |
|---|---|
| Do (0) · Sol (1♯) · Ré (2♯) · La (3♯) · Mi (4♯) · Si (5♯) | La m (0) · Mi m (1♯) · Si m (2♯) · Fa♯ m (3♯) · Do♯ m (4♯) · Sol♯ m (5♯) |
| Fa (1♭) · Si♭ (2♭) · Mi♭ (3♭) · La♭ (4♭) · Ré♭ (5♭) | Ré m (1♭) · Sol m (2♭) · Do m (3♭) · Fa m (4♭) · Si♭ m (5♭) |
| **Fa♯ (6♯) ET Sol♭ (6♭) : les deux proposés** | **Ré♯ m (6♯) ET Mi♭ m (6♭) : les deux proposés** |
| refusés : Do♯ (7♯) → Ré♭ ; Do♭ (7♭) → Si | refusés : La♯ m (7♯) → Si♭ m ; La♭ m (7♭) → Sol♯ m |

Ça donne 13 majeures et 13 mineures affichables pour 12 hauteurs (Fa♯/Sol♭ et Ré♯m/Mi♭m en double). Les deux variantes d'une même hauteur **partagent le même nœud de progression** (même son, même forme sur le manche) : on ne fait pas réviser deux fois ; seule l'orthographe affichée change.

Cas à tester (non exhaustif) : Fa♯ maj = Fa♯ Sol♯ La♯ Si Do♯ Ré♯ **Mi♯** ; Sol♭ maj = Sol♭ La♭ Si♭ **Do♭** Ré♭ Mi♭ Fa ; Si maj = 5♯ ; Ré♭ maj = 5♭.

**Toniques de modes et de gammes dérivées** (12 hauteurs × orthographes possibles) : on choisit l'orthographe de la tonique par **coût** = somme des |altérations| des 7 notes (+ pénalité forte par double altération, + pénalité pour altération « de troisième » comme Fa♭/Si♯). **Coût égal → on propose les deux** (comme Fa♯/Sol♭ : 6 altérations chacun). Vérifié par test : pour la majeure et la mineure naturelle, cette règle retrouve exactement la table de tonalités ci-dessus (26 noms, 12 hauteurs). Exemples attendus : La♭ lydien (parent Mi♭ majeur, 3♭) et non Sol♯ lydien ; Do♯ dorien (parent Si majeur, 5♯) et non Ré♭ dorien (parent Do♭ majeur, 7♭). **Pour les gammes mineures** (naturelle, harmonique, mélodique), la tonique suit le tableau ci-dessus (Sol♯ m, pas La♭ m) ; c'est la formule qui produit les altérations, y compris une double : Sol♯ harmonique = Sol♯ La♯ Si Do♯ Ré♯ Mi **Fa𝄪**. **Doubles altérations admises seulement quand la formule les impose.** L'UI explique alors (« Fa𝄪 : la sensible est un demi-ton sous la tonique Sol♯ ; Fa𝄪 sonne comme Sol ») — texte pédagogique, pas une erreur.

### 1.4 Gamme, mode, tonalité, accord : vocabulaire de l'app
- **Tonalité** = centre + armure/hiérarchie (Do majeur). **Gamme** = collection ordonnée avec une formule d'intervalles. **Mode** = rotation d'une gamme-parent, avec une **tonique** (jamais « la tonalité de Ré dorien » : « Ré dorien — tonique Ré, mode parent : Do majeur »). **Accord** = superposition à un instant.
- L'app montre **deux lectures** de chaque mode, côte à côte :
  1. *Mode parent* : Ré dorien = Do majeur joué de Ré à Ré (2e mode) → mêmes touches que Do majeur ;
  2. *Formule* : Ré dorien = 1 2 ♭3 4 5 6 ♭7 = mineure naturelle avec 6te majeure (ou majeure avec 3ce et 7e mineures).
- Ionien = majeure, éolien = mineure naturelle (mêmes nœuds, deux étiquettes).

| Mode | Formule | Note caractéristique | Parent de la tonique X |
|---|---|---|---|
| Ionien | 1 2 3 4 5 6 7 | — | X majeur |
| Dorien | 1 2 ♭3 4 5 **6** ♭7 | 6te majeure | majeure une 2de majeure plus bas |
| Phrygien | 1 **♭2** ♭3 4 5 ♭6 ♭7 | ♭2 | 3ce majeure plus bas |
| Lydien | 1 2 3 **♯4** 5 6 7 | ♯4 | 4te juste plus bas |
| Mixolydien | 1 2 3 4 5 6 **♭7** | ♭7 | 5te juste plus bas |
| Éolien | 1 2 ♭3 4 5 ♭6 ♭7 | ♭6 (vs dorien) | 6te majeure plus bas |
| Locrien | 1 **♭2** ♭3 4 **♭5** ♭6 ♭7 | ♭5 (et ♭2) | 7e majeure plus bas |

Les notes caractéristiques sont mises en valeur (glow/pulsation) dans la tab. **[AVIS PROF]** Le locrien a *deux* notes qui le distinguent (♭2 et ♭5) ; le dorien se définit surtout *contre* l'éolien (6te) et le phrygien *contre* l'éolien (♭2) : l'app souligne le contraste avec le mode voisin, pas seulement la note.

### 1.5 Gammes particulières
- **Pentatoniques** : mineure 1 ♭3 4 5 ♭7 ; majeure 1 2 3 5 6 ; 5 boxes ; la majeure et la mineure d'une même armure partagent les mêmes 5 formes (relatives : La m pent = Do maj pent). **Blues mineur** 1 ♭3 4 ♭5 5 ♭7 (« blue note » = ♭5) ; **blues majeur** 1 2 ♭3 3 5 6 (♭3 = note de passage).
- **Mineure harmonique** 1 2 ♭3 4 5 ♭6 7 ; **mineure mélodique : convention jazz par défaut** 1 2 ♭3 4 5 6 7 en montée *et* en descente (ses modes servent à improviser) ; **option « classique »** : descente = mineure naturelle. Le choix est un réglage global, documenté ici, affiché sur l'écran de gamme.
- Modes à prévoir dans le modèle (livrés tard) : de l'harmonique (phrygien dominant = mixolydien ♭9 ♭13 ; etc.), de la mélodique (lydien dominant, altéré, locrien ♮2…), bebop (dominant et majeur, 8 notes), tons entiers, diminuée (ton-demi-ton et demi-ton-ton), augmentée.
- **Gammes symétriques : identité de révision = ensemble de hauteurs, pas tonique.** Tons entiers : **2** collections distinctes. Diminuée : **3** collections (Do TD ≡ Mi♭ TD ≡ Fa♯ TD ≡ La TD ; Do DT ≡ Ré♭ TD…) ; les deux « formes » TD/DT sont la même collection lue depuis deux types de notes → **2 modes distincts**. Augmentée : **4** collections. La clé canonique du nœud = forme normale de l'ensemble de hauteurs (rotation minimale) ; la heatmap compte ces classes, pas 12 cases.

### 1.6 Accords
Formules (à partir de la fondamentale, orthographe par lettres) : maj 1 3 5 · m 1 ♭3 5 · 7 1 3 5 ♭7 · maj7 1 3 5 7 · m7 1 ♭3 5 ♭7 · sus2 1 2 5 · sus4 1 4 5 · add9 1 3 5 9 · m7♭5 1 ♭3 ♭5 ♭7 · dim (triade) 1 ♭3 ♭5 · dim7 1 ♭3 ♭5 𝄫7 · 5 (power) 1 5 (8).
Nomenclature d'affichage unique (modèle `tonal` en interne : `Cmaj7`, `Cm7b5`, `Cdim`) : `maj7`/`Δ`, `m7`, `7`, `sus4`, `add9`, `m7♭5`/`ø`, `°`, slash `X/Y` (Y = basse). Ex. `Cmaj7` = C E G B (jamais Dob/Si♯ « au hasard »).
Chiffrage romain : casse = qualité (I ii iii IV V vi vii° ; i ii° III iv v VI VII), `ii7–V7–Imaj7`.

---

## 2. Conventions de tablature (musique)

- 6 lignes par défaut, N selon l'accordage ; **corde aiguë en haut** ; étiquettes d'accordage à gauche selon l'accordage ET la notation choisie. En solfège les deux Mi se distinguent par la casse (`Mi` grave, `mi` aigu), comme `E`/`e` en anglo. **[HYP]**
- Nombre = case (0 = vide, jusqu'à 24, 2 chiffres lisibles). `x` = corde étouffée/non jouée.
- **Lecture audio (1c)** : le son est produit depuis la même forme que celle affichée ; tenue des notes, strum, accents et couches de vélocité : §11.5.
- **Accord = pile verticale** (même colonne = même instant), nom au-dessus, flèches ↓↑ dessous. Deux écritures liées : **plaqué** et **arpégé** (grave→aigu). Le son joué est généré **depuis la même forme** que celle affichée (source unique : le TabScore).
- **Répétition « simile »** : en lecture/jeu sur téléphone, la pile n'est dessinée qu'aux changements d'accord ; les frappes suivantes sont portées par la ligne de flèches. Mode « détaillé » (pile à chaque frappe) en option. **[HYP]** (sinon une mesure de croches fait 8 piles de 17 px logiques et sature l'écran portrait).
- **Couleur = fonction d'intervalle**, identique dans tous les thèmes. Proposition : **la teinte porte le degré (1 2 3 4 5 6 7), l'altération porte la luminosité + une encoche sur la pastille** → ♭3 et 3 sont de la même famille mais distinguables ; ♯4 (famille 4) ≠ ♭5 (famille 5) même sur la même touche ; ♭3 ≠ ♯2. Un marqueur de forme (encoche/coin) double la couleur : indispensable pour les daltoniens (≈ 8 % des hommes). À valider par simulation daltonisme en phase 1.
- Doigtés : 1 index, 2 majeur, 3 annulaire, 4 auriculaire, T pouce. Barré : trait vertical + case + cordes couvertes + doigt.
- Techniques (h, p, /, \, b, ~) dans le modèle dès la phase 1 ; affichage quand un exercice les utilise.
- **Limites assumées** (sans diagramme de manche) : la tab montre mal la *forme de la main* et la *géométrie d'une position*. Compensations prévues : alignement vertical des colonnes, repère de case en marge, couleurs d'intervalle, doigtés, aperçu « position complète corde par corde », construction progressive (un doigt à la fois). **Ce qui reste insuffisant** : voir la forme d'un accord d'un coup d'œil, voir comment deux positions voisines se chevauchent, voir qu'une pentatonique « tient dans un rectangle ». Cf. propositions de vues complémentaires en 7.1 (non implémentées, **[À TRANCHER]**).

### 2.1 Conventions implémentées en 1b (toutes testées)

**Pastille et couleurs**
- Pastille 11×13 px logiques (1 chiffre) ou 17×13 (2 chiffres, jusqu'à la case 24) ; glyphes 5×7 ; pas de 14 px entre cordes, donc 1 px d'air entre deux pastilles d'une pile.
- Couleur = **fonction** d'intervalle : famille 1 jaune · 2 / 9 orange · 3 magenta · 4 / 11 vert · 5 cyan · 6 / 13 violet · 7 corail ; ♭ = −22 % de luminosité + encoche en bas à droite ; ♯ = +30 % de blanc + encoche en haut à droite ; **fondamentale = coins coupés** (le seul marqueur de forme). ♯4 et ♭5 sur la même touche ont deux couleurs (ΔE 69), comme ♭3 et ♯2 (ΔE 73).
- Chiffre sombre ou blanc, selon le meilleur contraste (WCAG) : ≥ 4,5 sur les 23 fonctions testées (un chiffre sombre sur ♭3, ♭6, ♭7 donnait 3,6-4,0).
- **Daltonisme (simulation Machado, ΔE76 minimal entre familles)** : protanopie 12,9 · deutéranopie 17,7 · tritanopie 12,0. **Limite constatée sur capture** : orange / magenta / vert se rapprochent en protanopie et deutéranopie. La couleur n'est donc **jamais la seule information** : forme de la fondamentale, encoche d'altération, rangée de degrés (réglable) — **décision : pas de réglage « aide daltonisme »** (D13 écartée) ; limite assumée.
- Note caractéristique d'un mode (dorien : 6 ; phrygien : ♭2 ; lydien : ♯4 ; mixolydien : ♭7 ; éolien : ♭6 ; locrien : ♭2 et ♭5 ; blues mineur : ♭5 ; blues majeur : ♭3) : anneau lumineux qui pulse sur 4 images (≈ 5 Hz), fixe en mode « réduire les animations ». Ionien : aucune ; le ♭6 de l'éolien se lit « par contraste avec le dorien » (§1.4). **La légende est écrite sous la tablature**, sur l'écran de découverte comme sur l'écran d'exercice (bande « Note caractéristique », la pastille ♭6 dessinée dans sa couleur de fonction et entourée du même anneau pulsé que la portée), avec la pastille dans sa couleur de fonction : le halo est un repère, il doit s'expliquer là où il apparaît (composant `modules/gammes/TabLegend.tsx`).

**Pile d'accord**
- Pile verticale, corde aiguë en haut ; `X` (rouge) sur chaque corde non jouée, écrit sur un fond qui coupe la ligne de corde ; barré = repère vertical à gauche de la pile couvrant les cordes concernées + `B1` (case du barré) dans la rangée du libellé.
- **Simile** : la pile est redessinée au début de chaque mesure et quand la forme change ; les frappes suivantes ne portent que la flèche (↓ cyan, ↑ rose) et le rythme. Réglage « une pile par frappe » disponible.
- Annotation d'une pile (note, degré, intervalle, doigté) : à droite de chaque pastille, sur fond de panneau. Pour une note seule : une rangée sous la tab.

**Rythme (sous la tab, hampes vers le bas)**
- Noire : hampe. Croches / doubles croches : **ligatures par temps** (par noire en 2/4, 3/4, 4/4 ; par noire pointée en 6/8, 9/8, 12/8) ; une croche isolée porte un fanion ; une double croche entre deux croches : ligature partielle. Blanche : hampe + anneau ; ronde : anneau seul. Points (simple et double). Triolet de croches : ligature + « 3 ». Silences : ronde (suspendu), blanche (posé), noire, croche, double croche.
- Motifs de strum : ↓ ↓ ↓ ↓ ; ↓↑ en croches ; « motif universel » ↓ · ↓ ↑ · ↑ ↓ ↑, écrit en durées jusqu'à la frappe suivante (la main continue de battre, la tab n'écrit que les frappes : 2-1-2-1-1-1 croches).
- Un arpège de 6 notes en croches remplit 6 des 8 croches de la mesure ; les 2 dernières sont des silences alignés sur les temps (jamais une pause « au hasard »).

**Notation affichée**
- Étiquettes de cordes : `mi` aigu / `Mi` grave en solfège, `e` / `E` en anglo ; Drop D : `Ré` grave. Noms de notes d'annotation : réglage solfège / anglo ; accords : `Am7` · `Lam7` · `A-7`.
- Degrés écrits avec les vrais glyphes (♭3, ♯4, 𝄫7) ; intervalles : `P1 m3 M3 A4 d5 m7`.
- Niveau 2 (mémorisation) : une note `hidden` s'affiche en emplacement pointillé, **sans chiffre, sans couleur, sans annotation** (rien ne fuit).

---

## 3. Module Gammes — plan pédagogique

### 3.1 Principe : apprendre des *formes*, pas 1 248 gammes
Calcul naïf pour le seul MVP : 12 toniques × 7 modes × (7 positions 3NPS + 5 CAGED) = 1 008 nœuds ; + 2 pentatoniques × 12 × 5 = 120 ; + 2 blues × 12 × 5 = 120 → **1 248 nœuds**. Irréaliste à réviser, et musicalement faux : le doigt ne « sait » pas qu'on est en Fa♯.

Réalité physique : **17 motifs de manche** (7 de 3NPS + 5 de CAGED pour tout ensemble heptatonique diatonique, + 5 boxes pentatoniques) ; chacun se lit comme 7 modes (diatonique) ou 2 couleurs (pent. maj/min) ou + note de blues. D'où trois couches :

1. **Nœud « forme »** (≈ 17) : le motif et son doigté, indépendant de la tonalité.
2. **Nœud « lecture »** (≈ 104) : forme × mode (où sont la tonique, les notes caractéristiques, quel son). C'est l'**unité de répétition espacée**.
3. **Évidence « tonalité »** : chaque révision tire une tonique différente (zones du manche variées) ; la heatmap des tonalités se remplit avec ces preuves. Tonique *inférée* après X réussites dans ≥ 3 zones distinctes (cases 0-4, 5-9, 10-14…), puis échantillonnée de temps en temps.

[AVIS PROF] C'est la bonne granularité : un guitariste qui connaît la box 1 en La mineur la rejoue en Si♭ mineur en la glissant d'une case, à condition de **savoir nommer sa tonique**. On entraîne donc deux choses séparées : le motif (moteur) et le repérage des notes/tonique sur le manche (mémoire). La tab sans diagramme rend ça plus dur ; d'où l'importance du repère de case en marge et de la fondamentale en couleur.

### 3.2 Arbre de compétences (ordre recommandé ; tout est déverrouillable)

```
G0 Fondations
 ├ G0.1 noms des cordes (Mi La Ré Sol Si mi) et lecture de la tab
 └ G0.2 notes sur les cases 0-5 de la corde de Mi grave et de La
G1 Pentatonique mineure
 ├ G1.1 box 1 en Mi m (cases 0-3, quasi à vide) puis La m (cases 5-8)
 ├ G1.2 blue note ♭5 → blues mineur (box 1)
 ├ G1.3 boxes 2 à 5 (règle de chaînage : la box n+1 commence sur la 2de note de la box n sur la corde de Mi grave ; en La m : cases 5-8 → 7-10 → 9-13 → 12-15 → 14-17 ; la même box 4 s'écrit cases 0-3 en position ouverte, la box 5 cases 2-5 ; **calculé et testé en 1b**, voir §3.7)
 └ G1.4 transposition : même box, autre case (jamais avant 2 tonalités maîtrisées)
G2 Pentatonique majeure = même motifs, autre racine (relative) ; blues majeur
G3 Majeure (ionien)
 ├ G3.1 Do majeur 1re position (cases 0-3) — pas de pré-requis de forme
 ├ G3.2 3NPS : position 1 puis 2…7 (par ordre de proximité, pas 1→7 d'un bloc)
 ├ G3.3 CAGED : formes de Do, La, Sol, Mi, Ré (lien explicite avec les accords ouverts)
 └ G3.4 tonalités faciles : Sol, Ré, La, Mi, puis le reste
G4 Mineure naturelle (éolien) + relation relative ; lien avec G1 (la pent. est un sous-ensemble)
G5 Modes, dans l'ordre : Mixolydien → Dorien → Lydien → Phrygien → Locrien
G6 Harmonique, mélodique (jazz) et leurs modes
G7 Symétriques, bebop, avancées
G8 Improvisation (niveau 4 transversal à G1-G6, déverrouillé par un nombre minimum de formes lues)
```
Ordre des modes **[AVIS PROF]** : mixolydien d'abord (♭7 : une *seule* note change par rapport à la majeure, et sonne partout en rock/blues/funk) ; dorien ensuite (♮6 contre éolien, très utile sur ii–V et grooves mineurs) ; lydien (♯4, couleur « film ») ; phrygien (♭2, flamenco/métal) ; locrien en dernier (peu jouable sur tonique, à enseigner comme *contexte* m7♭5).

Pourquoi la pentatonique mineure d'abord alors que le brief commence par « majeure / mineure naturelle » : elle est jouable avec 2 notes par corde, **elle sonne bien tout de suite** (sur une seule box, sur presque tout backing en mineur), et Mi m cases 0-3 n'exige presque aucun étirement. La gamme majeure à 7 notes en 3NPS demande des doigtés à 1-2-4 / 1-3-4 qui frustrent un débutant. L'ordre du brief n'est pas faux (théoriquement plus propre), mais pédagogiquement la pentatonique est un meilleur premier succès.

### 3.3 Table de compatibilité gamme ↔ systèmes de positions

| Gamme | Systèmes proposés | Notes / limites |
|---|---|---|
| Majeure, éolien/mineure nat. et les 5 autres modes | **3NPS (7)**, **CAGED (5)**, diagonal/linéaire (option) | CAGED des modes = formes de la gamme parente, tonique déplacée |
| Pentatonique mineure/majeure | **Boxes (5)**, CAGED-pent (option, lien accords) | pas de 3NPS (5 notes) |
| Blues mineur / majeur | **Boxes + note de blues/de passage** | la ♭5 (ou ♭3) est un ornement de la box, pas une « 6e note à mémoriser » |
| Mineure harmonique | **3NPS** (avec étirements 1-2-4 / 1-3-4 documentés autour de ♭6→7, 3 demi-tons) | CAGED « pur » : **non proposé en MVP** (la 2de augmentée casse les formes) ; positions adaptées à documenter plus tard |
| Mineure mélodique (jazz) et ses modes | **3NPS** | idem, pas de CAGED |
| Tons entiers (6) | **motifs symétriques** (le motif se répète toutes les 2 cases) | 2 collections |
| Diminuée (8) | **motifs symétriques** (répétition toutes les 3 cases) | 3 collections, 2 lectures TD/DT |
| Augmentée (6) | motifs symétriques (toutes les 4 cases) | 4 collections |
| Bebop (8) | **position + note de passage chromatique** | pas de 3NPS (8 notes) ; la note de passage est marquée comme telle |

Le moteur expose `systemsFor(scale): PositionSystem[]` ; l'UI n'affiche que cette liste, avec la raison d'un refus au survol (ex. « 3 notes par corde : indisponible, 5 notes »).

### 3.4 Niveaux (par lecture) et critères
1. **Découverte** : écoute + tab colorée (montée, descente, drone, arpège superposé). Validé quand l'utilisateur a joué/lu l'ensemble une fois (auto-déclaré) — pas d'XP « vérifié ».
2. **Mémorisation** : trous dans la tab (saisie ou jeu). Seuil proposé : ≥ 80 % de trous corrects au premier essai, sur 2 sessions.
3. **Rappel** : tab vide, tout de mémoire, chrono. [AVIS PROF] **Ne jamais exiger les 36 notes d'une position complète d'un bloc au pavé numérique** : 36 saisies = abandon. Découpage « 1 corde → 2 cordes → montée → montée+descente » ; bonus de vitesse **uniquement si précision ≥ 95 %**.
4. **Improvisation** : voir 8. Prérequis : niveaux 1-3 d'au moins une forme *et* connaître l'accord de la 1re mesure de la progression (pas pour jouer — pour l'entendre).
**Étoiles** : ★ précision, ★★ précision + tempo cible, ★★★ + sans aide (annotation masquée).

**Tel que construit en phase 2** (`modules/gammes/exercise.ts`, `ScaleTrainingPage.tsx`) — écarts assumés :
- **Le niveau 2 masque une part réglable des notes (20 / 35 / 50 %, défaut 35), avec un minimum de 2 et jamais toute la position.** Calcul : une box à 2 notes par corde = 4 notes, 35 % → 1,4 → un trou ; un exercice à un trou ne prouve rien et se devine. Cinq découpages : **1 corde / 2 cordes / 3 cordes / position entière / aller-retour** — c'est le chunking demandé, appliqué aux **cordes** (l'unité de lecture d'une position), pas aux mesures.
- **Le niveau 3 masque toutes les notes du segment** ; la tablature garde les cordes, les mesures et le rythme (rythme masqué par défaut, cohérent avec le §3.9). L'élève écrit des **cases**, pas des couples corde+case : le nombre de notes est donc donné par les emplacements. **[HYP]** C'est plus facile qu'un rappel total ; c'est le compromis qui rend l'exercice faisable sur un téléphone au pavé.
- **Validation par case, une note à la fois** ; une case trouvée du deuxième coup compte comme **fausse** (« reconnue, pas sue »), et **la 2ᵉ erreur révèle la case** (elle reprend sa couleur de fonction). Aucune punition bloquante : la série se termine toujours et la tentative est enregistrée.
- **Grille rythmique (métronome)** : un **temps par trou**, en mesures entières, 30-120 BPM (50 par défaut). **Avec le micro (phase 3), la mesure devient honnête** : l'instant retenu est celui de l'**attaque** de la dernière note, latence de la chaîne retranchée ; au pavé, elle reste une mesure de saisie. Les clics du métronome sont masqués ± 90 ms côté micro (sinon ils rempliraient des cases tout seuls). Le score de la grille ne contient **que des silences** : le métronome de la 1c clique, aucune note ne sonne, donc l'app ne donne pas les réponses. Étoiles : ★ ≥ 80 % ; **★★ exige la grille tenue** (série finie dans le temps) et ≥ 95 % ; ★★★ sans une erreur ni une révélation **et** dans la grille ; **grille manquée = ★ au mieux** (on ne descend pas à 0 si la précision est bonne : on ne certifie pas, on ne punit pas). Tentative : `tempoOk`. **Limite assumée** : le temps mesure la rapidité à **écrire** une case, pas à la jouer ; la phase 3 (micro) rendra la mesure réelle. Le chrono repart du lancement de la grille, sinon une grille abandonnée compterait dans la tentative.
- **L'annotation est celle du réglage** (notes, degrés, intervalles, doigtés), sauf sur les trous où **rien ne fuit** (ni chiffre, ni couleur, ni annotation, ni nom de fonction dans le libellé du pavé — la fonction est aussi une partie de la réponse).

**Ce que la tentative enregistre** : gamme, tonique, accordage, système, position, `formIndex`, niveau, nombre de cordes du segment, **trous justes au premier essai / total**, durée, première case (zone du manche) et **cordes fautives** — pas chaque réponse. Le détail des erreurs note par note n'a pas de valeur supplémentaire pour un débutant et coûte 20 fois plus d'octets.

### 3.5 Exercices de technique (tous en tab, générés par `TabScore`)
Séquences (par 3, par 4, tierces, quartes), motifs, alternate picking, legato (h/p dans le modèle), « tempo ladder » : montée de 4-5 BPM quand précision ≥ 95 % sur 2 passes. Ces exercices sont des *générateurs* de TabScore, pas des écrans spécifiques.

### 3.6 Ear training (mini-jeux) — par ordre d'utilité/effort
1. Majeur vs mineur (accord puis gamme) ; 2. quelle est la note caractéristique ? (dorien vs éolien, lydien vs ionien) ; 3. intervalles ascendants (2de→8ve) ; 4. mode sur drone ; 5. « joue la note que tu entends » (nécessite le micro). Les 1 et 2 sont à très haut impact pour un coût faible : audio seul.

### 3.7 Positions : définitions implémentées en 1b (testées sur 12 toniques × tous les accordages)

Une position = des couples (corde, case) lus **corde grave → aiguë, cases croissantes** ; la descente est l'ordre inverse exact. Toutes les notes appartiennent à la gamme, l'orthographe est celle de la gamme.

| Système | Règle | Vérifié |
|---|---|---|
| **3 notes par corde** (gammes à 7 notes) | 3 notes **consécutives** de la gamme par corde, enchaînées d'une corde à l'autre ; la position *k* part du degré *k* sur la corde grave, à l'instance la plus basse du manche | 7 positions pour les 21 gammes à 7 notes × 12 toniques × 9 accordages (6 à 8 cordes) ; étendue maximale **mesurée : 6 cases d'écart** (7 cases occupées), y compris harmonique et mélodique ; position *k* et *k+1* : 12 notes sur 18 en commun |
| **Boxes** (pentatoniques) | 2 notes consécutives par corde, même enchaînement | La m : **5-8 → 7-10 → 9-13 → 0-3 (= 12-15) → 2-5 (= 14-17)** ; Mi m box 1 : 0-3 ; La m pent et Do maj pent : mêmes 5 formes |
| **Blues** | box de la pentatonique + la note de blues qui tombe dans la fenêtre | La blues, box 1 : ♭5 (Mi♭) corde de La case 6 et corde de Sol case 8 — les cases de la forme classique ; blues majeur : ♭3 |
| **Bebop** | 3NPS de la gamme de base (bebop dominant → mixolydien ; bebop majeur → ionien) + la note de passage chromatique | 7 notes + la 7M (dominante) ou la ♯5 (majeur), marquées `passing` |
| **CAGED** | fenêtre de **5 cases** autour de la forme d'accord de la majeure parente : forme de Mi / La / Ré = accord ± 1 case ; Do / Sol = 3 cases sous la fondamentale à 1 au-dessus | **[définition maison, à relire]** 5 formes pour la majeure, ses 6 autres modes et les 2 pentatoniques ; 2-3 notes par corde ; fondamentale, tierce et quinte toujours présentes ; fenêtres consécutives qui se recouvrent, sur 13 tonalités |
| **Symétriques** | période du motif (2 tons entiers, 3 diminuée, 4 augmentée) ; un motif par case de la période ; fenêtre de 5 cases | 2 / 3 / 4 positions |

- Exemples de fenêtres CAGED (cases) : **Do majeur** C 0-4 · A 2-6 · G 5-9 · E 7-10 · D 9-13 ; **Sol majeur** G 0-4 · E 2-5 · D 4-8 · C 7-11 · A 9-13.
- **Relecture de prof (condition D12, faite en 1d)** sur Do, Sol et La majeur, forme par forme : la fenêtre contient **la triade complète**, **≤ 3 notes par corde**, et la fondamentale tombe sur la corde de la forme. **La** : A 0-3 · G 2-6 · E 4-7 · D 6-10 · C 9-13. Les 15 fenêtres sont cohérentes avec les formes barrées correspondantes (ex. Do, forme de G : 8-7-5-5-5-8, donc fenêtre 5-9 avec la tonique en 6/8, 3/5 et 1/8). **Aucune correction demandée** ; la seule réserve pédagogique est celle du nom : « forme de Mi » désigne la forme d'accord qui **ancre** la fenêtre, pas l'endroit de la tonique, qui change de corde d'une forme à l'autre. À dire à l'élève, sinon il cherche la tonique au mauvais endroit.
- CAGED n'est calculé que si les 6 cordes aiguës sont en standard (Mi La Ré Sol Si mi) : 7 et 8 cordes standard : oui (la corde grave supplémentaire est incluse dans la fenêtre) ; Drop D, DADGAD, Open G… : **refusé, avec la raison affichable**.
- **`formIndex`** : identité de la forme indépendante du mode — rang de départ dans la gamme **parente** : la position 2 de Ré dorien (départ Mi) a le même `formIndex` et les mêmes cases que la position 3 de Do majeur. C'est la clé des nœuds « forme » de §3.1.
- **Numéro d'une position** = rang du degré de départ : « Position 1 » = la tonique sur la corde grave, quel que soit l'endroit du manche. Un même numéro désigne donc la même *forme* dans toutes les tonalités ; pour savoir *où*, on lit « cases a–b ».

---

### 3.8 Doigtés de position (implémentés en 1d)

Règle appliquée, **corde par corde** (`core/theory/fingerings.ts`, testé sur toutes les positions du catalogue) :

| Cas sur une corde | Doigtés |
|---|---|
| 1 note | 1 |
| 2 notes, écart 1 / 2 / ≥ 3 cases | 1-2 / 1-3 / 1-4 |
| 3 notes, cluster (≤ 2 cases au total) | 1-2-3 |
| 3 notes, 2e note collée à l'index (`1+1`) | 1-2-4 |
| 3 notes, 2e note collée à l'auriculaire (`2+1`) | 1-3-4 |
| 3 notes, écart symétrique | 1-3-4 |
| 4 notes | 1-2-3-4 |
| **5 notes et plus** | **aucun doigté** (démanché nécessaire) |

**[AVIS PROF]** J'ai choisi une règle **par corde** et non « une case = un doigt sur toute la position ». La seconde est séduisante mais fausse dès qu'une fenêtre fait 5 cases (CAGED) : elle réclame un cinquième doigt ou décale tout. La règle par corde reproduit exactement les doigtés qu'on enseigne : box 1 de La mineur pentatonique = 1-4 sur les cordes 1 et 2, 1-3 ailleurs ; 3NPS 5-7-8 = 1-3-4 ; 5-6-8 = 1-2-4. Elle ne prétend pas remplacer un prof : elle ne gère **ni les démanchés, ni les variantes 1-2-4 sur les grands écarts, ni les doigtés d'accords** (phase 4). C'est une aide à la lecture, pas une vérité — d'où l'annotation **optionnelle** et l'absence de doigté plutôt qu'un doigté inventé.

### 3.9 Niveau 1 « Découverte » : ce que l'écran montre, et pourquoi

| Choix | Raison pédagogique |
|---|---|
| **Annotation par défaut = degrés** (`1 ♭3 4 5 ♭7`) | À ce stade, le nom de la note ne sert à rien : c'est la **fonction** qu'on apprend. « Notes » et « intervalles » restent à un tap. |
| **Couleur = fonction**, identique partout | ♭3 et 3 ne partagent pas la couleur ; ♯4 et ♭5 non plus. L'élève apprend une **carte de fonctions**, pas un nuancier. |
| **Légende nommée en français** (« tierce mineure ») | Relier la couleur au **mot** qu'utilisera le prof, et au son entendu avec le drone. |
| **Drone par défaut, jamais de tierce** | On entend la couleur du mode contre une tonique stable ; une tierce dans le drone déciderait majeur/mineur à la place de la gamme. |
| **Note caractéristique en glow** | Elle désigne ce qui **définit** le mode (6te du dorien, ♭2 du phrygien, ♯4 du lydien, ♭5 du locrien…). |
| **Calque « notes de l'accord »** (estompe les étrangères) | Montre où habitent 1-3-5-7 **dans la forme** : c'est le pont entre la gamme et l'accord. Sur La m pent + Am7, seule la 4te s'éteint — visuellement, la gamme « contient » l'accord. |
| **Position précédente / suivante** (Box 1 → 5) | Le chaînage des boxes est la compétence suivante (§3.2, G1.3). Le compteur « 1 / 5 » rend la progression visible. |
| **Pas de score, pas de « validé »** | Le brief prévoit une validation auto-déclarée au niveau 1. L'app **journalise l'écoute** (durée réelle) et ne prétend rien de plus. Un niveau 1 « validé » sans preuve serait un mensonge. |
| **Mode « fondamentales »** (1 et 5 seulement) | Ancrer la tonique **dans** la forme avant les autres notes : l'erreur n°1 est de connaître la forme sans savoir où elle habite. Option, un tap. |
| **Découpage par cordes** (2 → 3 → 4 → toutes) | Chunking : 4 notes à lire au lieu de 12. Prépare le niveau 3 sans nouveau code de théorie. Les cordes **graves** d'abord (début de la montée). |
| **Exercice « montre-moi la … »** | L'app demande une fonction, l'élève **touche la pastille**. La couleur devient une réponse, pas un décor ; en cas d'erreur, **toutes** les pastilles de la fonction visée s'allument (anneau blanc) pendant 1,8 s. Les cibles se limitent à ce qui est affiché : avec « fondamentales » actif, il n'y a que 1 et 5. |
| **Comparaison de deux modes voisins** | Dorien vs éolien (6 / ♭6), ionien vs lydien (4 / ♯4), mixolydien vs ionien (7 / ♭7), phrygien vs éolien (♭2 / 2), locrien vs phrygien (♭5 / 5), pentatonique vs blues (ajout de la ♭5). **Même tonique, même système, même forme**, seule la note qui change pulse des deux côtés. |
| **Rythme masqué par défaut** | Le niveau 1 ne garde que les pastilles et l'annotation ; un interrupteur rend hampes et ligatures. Un débutant n'a rien à faire de croches le premier jour. |

**Traité en 1d** : le rythme est **masqué par défaut** en N1 (switch « Rythme ») et les options secondaires (cordes, accord, fondamentales) sont repliées : l'écran tient en deux panneaux avant la tablature. **Reste faible** : la forme de la main (vue manche optionnelle, non implémentée) et les niveaux 2-4.

## 4. Module Accords — plan pédagogique

### 4.1 Avis sur le curriculum du brief
Le brief propose Em, Am (« 1 à 2 doigts »), puis E, A, D, puis Dm, C, G. Trois remarques de prof :
- **Am n'est pas un accord à 1-2 doigts** : x02210 = 3 doigts. Em (2 doigts) l'est ; Em7 (1 doigt) aussi.
- **C et G sont les deux « murs » de l'accord ouvert** (écartement, saut de cordes, étouffement de la 6e pour C). Les mettre dans le même lot que Dm est une marche trop haute.
- Ce qui marche mieux que « on ajoute un accord » : **la famille par pivots** — chaque nouvel accord = un accord connu + 1 doigt ou le même doigté décalé d'une corde. Cmaj7 (x32000, 2 doigts) → C (+ index sur Si case 1). Asus2 → Am (+ index). Em → Em7 (lever 1 doigt).

### 4.2 Curriculum final proposé (paliers)

**P0 — Fondations** (≈ 1 séance) : accordeur, noms des cordes, lire une pile en tab, posture (pouce, doigts arrondis), **un seul doigt, une note nette** (validation mono par le micro). On valide ici tout le matériel audio.

**P1 — « Un ou deux doigts, rien à étouffer côté aigu »** : `Em` · `Em7` (1 doigt) · `Asus2` · `Am7`. Transitions : Em↔Em7 (lever 1 doigt), Em↔Asus2 (même paire de doigts, décalée d'une corde). Pourquoi pas Am d'emblée : 3 doigts + 5 cordes à jouer (6e exclue).

**P2 — « Famille Mi / La, 3 doigts »** : `Am` · `E` · `A` · `E7` · `A7`. Transitions : Asus2→Am (+1 doigt), Em↔Am, Am↔E (même forme, une corde plus grave), E↔A, A↔Am, E↔Em. **Branche P2b « Rock » (parallèle, optionnelle)** : power chords E5 A5 D5 (puis G5 C5 mobiles).

**P3 — « Famille Ré »** : `Dsus2` · `D` · `Dsus4` · `Dm`. Transitions : D↔Dsus2/Dsus4 (un seul doigt bouge), D↔Dm, **A↔D**. D est un triangle serré sur 3 cordes (fatiguant au début) ; les sus d'abord donnent le geste avec 2 doigts.

**P4 — « Les deux murs »** : `Cmaj7` (marchepied) → `C` ; `G` (3 doigts) puis la variante 4 doigts. Transitions : **D↔G, G↔C, C↔Am, Em↔C, G↔Em**. C’est le palier où la moitié des débutants décroche : le plan prévoit plusieurs entrées (voir 7.3).

**P5 — « Septièmes et couleurs ouvertes »** : D7 · G7 · C7 · B7 · Dmaj7 · Gmaj7 · Cadd9 · Asus4 · Esus4 · variante Em7 022030. B7 est un accord dur (4 doigts) : placé en fin de palier, jamais bloquant.

**P6 — « Premiers accords slash »** : G/B, D/F♯, C/G, **toujours présentés dans leur contexte** (G → G/B → C : ligne de basse). Un slash enseigné hors contexte est un simple « accord bizarre ».

**P7 — « Fa et Si mineur »** : Fa : `Fmaj7` (xx3210, sans barré) → `F` 4 cordes (xx3211 = mini-barré sur 2 cordes) → `F` barré complet (133211). Si m : `Bm7` (x20202, 2 doigts, substitut) → `Bm` (x24432). **Aucun de ces accords n'est un verrou** pour la suite.

**P8 — Barrés mobiles** : forme de Mi (maj, m, 7, m7, maj7) puis forme de La. Lien explicite avec P2-P3 : « la forme de Mi barrée = le Mi ouvert déplacé, l'index remplaçant le sillet ». C'est ici que se fait le pont avec CAGED du module Gammes.

**P9 — Triades sur 3 cordes adjacentes** (cordes 3-2-1, 4-3-2…, renversements) : base pour le jeu « funk/jazz » et pour entendre les accords comme des mélodies courtes.

**P10 — Voicings avancés** : drop 2, drop 3, extensions 9/11/13.

**Transversaux** (placés dans les paliers, pas en fin de parcours) :
- *Strumming* : tout ↓ en noires dès P1 (60 BPM) ; ↓↑ en croches dès P3 ; motif ↓ ↓↑ ·↑↓↑ (« motif universel ») dès P4-P5.
- *Transitions* : chaque palier ajoute les transitions de ses accords (4.5).
- *Harmonisation d'une tonalité* : dès que Sol, Do ou Ré maj. sont possibles (P4) ; tonalités faciles Sol/Do/Ré/La/Mi ; accords pivots ; chiffrage romain.
- *Capo / transposition* : P5+, une fois 8-10 accords connus (c'est une leçon de lecture, pas de doigts).

### 4.3 Base de voicings : formes vérifiées (accordage standard)
Notes en notation anglo (modèle) ; l'UI les affiche en solfège. « x » = corde non jouée. Cases listées de la corde grave (gauche) à l'aiguë (droite).
Les doigtés par corde sont **saisis dans la base depuis la 4a** (`src/data/voicings.ts`, champ `fingers`) et **relus par une règle mécanique** (`core/theory/chordFingers.ts`) : un doigt = une case sauf barré, corde à vide ou étouffée sans doigt, case la plus basse tenue par l'index ou le majeur, cordes du barré au doigt du barré, quatre doigts au plus. Ils ne sont **pas calculés** : plusieurs doigtés conventionnels coexistent (G en 2-1-3 ou 3-2-4) et une heuristique choisirait au hasard. L'ordre de pose est déduit — barré d'abord, puis index → auriculaire, cordes graves d'abord. Détail et limites : §15.

| Palier | Accord | Frettes 6→1 | Notes (grave→aigu) | Remarque |
|---|---|---|---|---|
| P1 | Em | 022000 | E-B-E-G-B-E |  |
| P1 | Em7 | 020000 | E-B-D-G-B-E | 1 doigt |
| P1 | Am7 | x02010 | A-E-G-C-E | 2 doigts; ne pas jouer la 6e corde |
| P1 | Asus2 | x02200 | A-E-A-B-E | même paire de doigts que Em, décalée d'une corde |
| P2 | E7 | 020100 | E-B-D-G#-B-E |  |
| P2 | E | 022100 | E-B-E-G#-B-E |  |
| P2 | Am | x02210 | A-E-A-C-E |  |
| P2 | A | x02220 | A-E-A-C#-E |  |
| P2 | A7 | x02020 | A-E-G-C#-E |  |
| P2b | E5 | 022xxx | E-B-E | 1-5-8 |
| P2b | A5 | x022xx | A-E-A | 1-5-8 |
| P2b | D5 | xx023x | D-A-D | 1-5-8 |
| P2b | G5 | 355xxx | G-D-G | 1-5-8 |
| P2b | C5 | x355xx | C-G-C | 1-5-8 |
| P3 | D | xx0232 | D-A-D-F# |  |
| P3 | Dm | xx0231 | D-A-D-F |  |
| P3 | Dsus2 | xx0230 | D-A-D-E |  |
| P3 | Dsus4 | xx0233 | D-A-D-G |  |
| P4 | C | x32010 | C-E-G-C-E |  |
| P4 | Cmaj7 | x32000 | C-E-G-B-E | 2 doigts · marchepied vers C |
| P4 | G | 320003 | G-B-D-G-B-G |  |
| P4 | G | 320033 | G-B-D-G-D-G | variante 4 doigts |
| P5 | Em7 | 022030 | E-B-E-G-D-E | variante |
| P5 | Asus4 | x02230 | A-E-A-D-E |  |
| P5 | Esus4 | 002200 | E-A-E-A-B-E |  |
| P5 | D7 | xx0212 | D-A-C-F# |  |
| P5 | Dmaj7 | xx0222 | D-A-C#-F# |  |
| P5 | Cadd9 | x32030 | C-E-G-D-E |  |
| P5 | C7 | x32310 | C-E-Bb-C-E | 5te omise (déclarée) |
| P5 | G7 | 320001 | G-B-D-G-B-F |  |
| P5 | Gmaj7 | 320002 | G-B-D-G-B-F# |  |
| P5 | B7 | x21202 | B-D#-A-B-F# |  |
| P6 | G/B | x20003 | B-D-G-B-G | basse ≠ fondamentale |
| P6 | D/F# | 200232 | F#-A-D-A-D-F# | basse ≠ fondamentale |
| P6 | C/G | 332010 | G-C-E-G-C-E | basse ≠ fondamentale |
| P7 | Bm7 | x20202 | B-D-A-B-F# | substitut simple de Bm |
| P7 | Fmaj7 | xx3210 | F-A-C-E | sans barré |
| P7 | F | xx3211 | F-A-C-F | mini-barré (index sur Si+mi) |
| P7 | F | 133211 | F-C-F-A-C-F | barré complet (forme de Mi) |
| P7 | Bm | x24432 | B-F#-B-D-F# |  |
| P10 | C | xxx553 | C-E-G | 3 cordes aiguës · position fondamentale |
| P10 | C | xxx988 | E-G-C | 3 cordes aiguës · 1er renversement |
| P10 | C | xxx010 | G-C-E | 3 cordes aiguës · 2e renversement |

Formes mobiles (fondamentale sur la case r de la corde indiquée ; offsets relatifs à r ; `x` = non joué), toutes vérifiées sur les 13 fondamentales r=0…12 :

| Forme | Fondamentale | Offsets 6→1 |
|---|---|---|
| Mi maj | corde 6 | 0 2 2 1 0 0 |
| Mi m | corde 6 | 0 2 2 0 0 0 |
| Mi 7 | corde 6 | 0 2 0 1 0 0 |
| Mi m7 | corde 6 | 0 2 0 0 0 0 |
| Mi maj7 | corde 6 | 0 x 1 1 0 x |
| La maj | corde 5 | x 0 2 2 2 0 |
| La m | corde 5 | x 0 2 2 1 0 |
| La 7 | corde 5 | x 0 2 0 2 0 |
| La m7 | corde 5 | x 0 2 0 1 0 |
| La maj7 | corde 5 | x 0 2 1 2 0 |

Précisions honnêtes :
- **Barrés (1b)** : `F-133211` (case 1, cordes 6→1), `F-xx3211` (case 1, cordes 2→1), `Bm-x24432` (case 2, cordes 5→1) portent un champ `barre` ; les formes mobiles (Mi / La) en reçoivent un dès qu'elles quittent le sillet (l'index remplace le sillet), sur les cordes à l'offset 0 de la forme (Mi maj7 en Sol : cordes 6→2, car la corde 1 n'est pas jouée). Test : toutes les cordes du barré sont à la case du barré ou au-dessus et au moins deux y sont posées.
- Une forme « 4 cordes » comme **xx0003 est en réalité G/D** (basse = Ré). On l'étiquette ainsi ; on ne la présente pas comme « un Sol ».
- **Accordages alternatifs** : seules les formes mobiles (barrés, power chords, triades) et les formes recalculées par un **solveur de voicings** (recherche exhaustive d'un accord dans l'accordage donné, étendue ≤ 4 cases, notes requises présentes, basse contrainte, classement par ergonomie) sont proposées ; chaque résultat passe le même test automatique que les formes curées. Les formes ouvertes fixes ne s'appliquent qu'au standard. **[À TRANCHER]** : solveur en phase 4 ou plus tard.
- Tests d'une forme : (a) classes de hauteurs jouées = formule de l'accord moins omissions *déclarées* ; (b) basse = fondamentale ou basse déclarée ; (c) orthographe égale à celle de la formule ; (d) étendue ≤ 4 cases (hors barré) ; (e) nombre de doigts ≤ 4 (un barré compte pour 1) ; (f) formes mobiles testées sur 13 fondamentales.

### 4.4 Cycle d'apprentissage d'un accord (7 étapes du brief) — avis
Découvrir → Construire → Vérifier → Plaquer → Fixer → Enchaîner → Intégrer : **je garde l'ordre**. Deux ajustements :
- **« Vérifier » (arpège) est l'étape qui valide « appris »**, pas « Plaquer ». La validation plaquée est approximative (6) : elle apporte de l'XP et du confort, jamais un verrou.
- Après « Vérifier », insérer un **micro-rappel à froid** le jour même (≥ 10 min plus tard) : la consolidation motrice passe par la répétition espacée dès les premières heures.

### 4.5 Transitions : classement proposé
Classées par (utilité dans les progressions courantes) × (facilité), **doigts communs vérifiés d'après les cases** (position identique corde+case) :

| # | Transition | Palier | Doigts communs | Remarque |
|---|---|---|---|---|
| 1 | Em ↔ Em7 | P1 | 1 (corde de La, case 2) | lever le doigt de la corde de Ré |
| 2 | Em ↔ Asus2 | P1 | 1 (corde de Ré, case 2) | même paire de doigts, décalée d'une corde |
| 3 | Asus2 → Am | P2 | 2 | ajouter l'index (Si 1) |
| 4 | **Em ↔ Am** | P2 | 1 (corde de Ré, case 2) | la plus classique |
| 5 | **Am ↔ E** | P2 | 1 (corde de Ré, case 2) | même forme, une corde plus grave |
| 6 | **E ↔ A** | P2 | 1 (corde de Ré, case 2) | |
| 7 | A ↔ Am · E ↔ Em | P2 | 2 | un doigt change de case/de corde |
| 8 | **A ↔ D** | P3 | 1 (corde de Sol, case 2) | la plus utile du blues/rock |
| 9 | D ↔ Dsus2 / Dsus4 / Dm | P3 | 2 | un seul doigt bouge |
| 10 | Cmaj7 ↔ C | P4 | 2 | ajouter l'index |
| 11 | **C ↔ Am** | P4 | 2 | seul le doigt de la corde de La (case 3) passe sur la corde de Sol (case 2) |
| 12 | **D ↔ G** | P4 | 0 | **la plus coûteuse de la liste** ; à travailler avec le tempo ladder |
| 13 | **G ↔ C** | P4 | 0 | idem (2 « murs » enchaînés) |
| 14 | Em ↔ C · G ↔ Em | P4 | 1 | |
| 15 | Am ↔ F (xx3211) | P7 | 2 | |

Un calcul heuristique rapide (fréquence dans 7 progressions types × 5 tonalités faciles ÷ coût de pose) classe A–E, A–D, D–G, C–G en tête ; Em–Am n'y figure pas seulement parce que mon échantillon de progressions ne contient pas vi–iii. **Ce classement est une proposition de départ**, recalculé en phase 4 sur une bibliothèque de progressions plus large (test unitaire de la fonction `transitionCost`).

### 4.6 Critères « accord appris » — proposition
Un accord passe **en cours d'apprentissage → appris** quand, **à la fois** :
- **Forme** : ≥ 3 arpèges *vérifiés* (toutes les cordes attendues OK, confiance ≥ 0,7) répartis sur **≥ 2 jours différents** (pas juste 2 sessions la même soirée : la consolidation nocturne compte) ;
- **Rappel à froid** : 1 pose de l'accord sans aide en ≤ 8 s (puis 5 s, puis 3 s selon le palier) un jour différent de la 1re vérification ;
- **Plaqué** : non requis (validation approximative).
**Appris (non vérifié)** : même chose mais par auto-évaluation → statut distinct, moins d'XP, jamais « maîtrisé ».
**Maîtrisé** : appris + intervalle de révision ≥ 14 jours réussi + transition vers ≥ 2 accords connus sous le seuil de tempo.
Seuils configurables (N, jours, secondes). **[AVIS PROF]** : 3 arpèges propres sur 2 jours est exigeant mais honnête ; moins, c'est valider un hasard. Au micro de téléphone dans une pièce bruyante, passer N à 2 et le dire.

**Tel que construit depuis la 4b** — le paragraphe ci-dessus est tenu, à une nuance près :
- **forme** : 3 vérifications propres (≥ 80 %) sur ≥ 2 jours différents, dans le même journal que les gammes (`acc:accord:{voicingId}`, `minSuccesses = 3`) ;
- **rappel à froid** : **exigé** (étape Fixer). Une pose réussie **dans la limite** — 8 s aux paliers P1-P2, 5 s à P3-P4, 3 s ensuite, resserrée d'un cran par réussite réussie — et **propre** (≥ 80 % des cordes). Le chrono s'arrête à la **première corde juste** : c'est le moment où la main arrive, pas la durée du geste complet. Un rappel le **même jour** ne compte qu'à **≥ 10 minutes** de la première vérification (consolidation motrice) ;
- **plaqué** : **écouté depuis la phase 5** (`core/input/poly.ts`) et journalisé en `pluck` avec sa confiance ; il **compte comme une vérification** (c'est plus strict qu'un arpège : six cordes ensemble). Il **n'est pas exigé** pour « appris » — l'arpège reste la référence d'apprentissage, parce que c'est lui qui dit *quelle* corde manque.

**Ce que le critère ne dit pas** (à dire à l'élève, et c'est dit à l'écran) : la pose à froid valide l'**arrivée** de la main sur une note attendue, pas la propreté des six cordes simultanées ; et le temps est arrondi **au supérieur** au journal, pour qu'une pose à 8,1 s ne passe jamais pour 8 s.

### 4.7 Les 3 axes de maîtrise
| Axe | Unité de suivi | Mesure |
|---|---|---|
| **Forme** | accord (voicing) | arpèges vérifiés, diagnostic par corde, rappel à froid |
| **Transition** | paire ordonnée A→B | **changements propres par minute** (exercice classique ; objectifs : 20 = correct, 30-40 = fluide sur les premières paires). **Livré en 4b** : exercice de 30 s, une **note repère** par accord (la basse, ou la première corde qui diffère quand les deux formes partagent la même — Em→Em7), écart médian en ms, « propre » ≤ 2 s, « fluide » ≤ 1,5 s |
| **Tempo** | chaque accord, sur backing | BPM maximal tenu proprement dans des progressions/strums contenant l'accord, crédité à chaque accord de la progression |

### 4.8 Système adaptatif
- **Difficulté estimée par accord** (heuristique, à calibrer par les données réelles) : `d = doigts + 1,5·[étirement ≥ 3 cases] + 2·[mini-barré] + 3·[barré complet] + 0,5·(cordes étouffées) + 0,5·(doigts sur cordes non adjacentes) − bonus de proximité (doigts déjà posés dans les accords connus)`.
- **Coût de transition** `A→B` : nombre de positions (corde, case) de B absentes de A + pénalité par saut de corde + bonus pour doigts communs et pour doigt « à pivot ».
- **Prochain accord recommandé** : score = prérequis atteints (physique + théorie) × proximité de difficulté (ni trop facile ni trop dur) × transitions débloquées avec les accords connus × progressions/morceaux-types débloqués × correction d'une faiblesse détectée. L'UI affiche **pourquoi** (« Asus2 : s'enchaîne avec Em et prépare Am »).
- **Échecs répétés** : échelle d'aide, jamais de blocage. (1) conseil ciblé selon la corde fautive ; (2) exercice préparatoire (un doigt, puis deux, validés en mono) ; (3) version simplifiée (`simplifiedOf`) ; (4) reporter l'accord de X jours, sans pénalité de série.
- **Points faibles** : par accord, par corde (« tu rates souvent la corde de Si »), par transition, avec conseil.
- **Diagnostic initial** optionnel : 6-8 accords au choix, validation rapide ; départ de zéro par défaut ; tout est déverrouillable à la main.
- **Séances** : 10-15 min pour un débutant, échauffement rappelé, **pause/douleur** (bouts des doigts sensibles les premières semaines : normal, mais s'arrêter si c'est dans la main ou le poignet).

### 4.9 Mode Défi « Setlist »
- Pool = accords **appris** uniquement (≥ 2). Tirage de x accords (2 à n) **pondéré** : `poids = 1 + a·faiblesse(accord) + b·faiblesse(transition) + c·dû(SRS)`, sans répétition immédiate, en équilibrant faciles/difficiles.
- Niveaux : (1) ordre simple, 2-3 accords, 50-60 BPM, tout ↓ ; (2) aléatoire ; (3) tempo ladder (+4 BPM quand ≥ 90 % de précision) ; (4) nom seul sans tab ; (5) accord « surprise » ; (6) survie ; (7) progression type dans une tonalité (I–IV–V, I–V–vi–IV, vi–IV–I–V…) ; (8) mini-chanson.
- Chaque accord : score de **justesse** (confiance) et de **timing** (onset − temps fort − latence calibrée) ; tolérance réglable ; **jamais un verdict binaire** (3 bandes + « ambigu »). Résultats : étoiles, XP, détail par accord/transition, conseil.
- Sans matériel : reconnaissance tab ↔ nom, QCM, auto-évaluation (statut « non vérifié »).

---

## 5. Répétition espacée et modèle de maîtrise

**Identifiants de nœuds** : `gam:lecture:{système}:{forme}:{mode}`, `gam:forme:{système}:{index}`, `acc:accord:{voicingId}`, `acc:transition:{voicingA}>{voicingB}`, **`acc:savoir:{voicingId}`** (QCM : ce qu'on sait *lire*, jamais un geste) et **`acc:progression:{id}`** (activité déclarée sur une progression). Les deux derniers ne rendent jamais un accord « appris ». Les gammes symétriques utilisent la clé canonique de la collection.
**États** : verrouillée → disponible → en apprentissage → apprise → maîtrisée (dérivés des axes par le module).
**Planificateur** : [HYP] **Leitner à 6 boîtes** (10 min le même jour, 1 j, 3 j, 7 j, 16 j, 35 j), avec :
- réussite nette → boîte +1 ; réussite lente/avec aide → même boîte ; échec → retour boîte 1 (ou −2) ;
- gigue ±15 % pour éviter l'effet « tout le même jour » ;
- **plafond de dû par session** (≈ 8 éléments) pour qu'une absence ne crée pas de « dette de révision » démotivante.
Derrière une interface `Scheduler` pour pouvoir passer à FSRS (MIT, `ts-fsrs`) si les données le justifient : **SM-2 est un compromis historique** ; pour quelques centaines d'éléments et des gestes moteurs, un Leitner honnête suffit.
**Journal** : chaque tentative est un événement horodaté (jamais seulement des agrégats) ; les agrégats se recalculent → on peut changer d'algorithme sans perdre l'historique.

**Tel que construit en phase 2** (`core/progress/scheduler.ts`) : le journal est la seule source ; **les cartes ne sont pas stockées, elles se recalculent** en rejouant les tentatives vérifiées dans l'ordre chronologique (`cardsFrom`). Trois conséquences vérifiées par test : même journal → mêmes échéances ; un import de journal restaure exactement les échéances ; changer d'algorithme (`Scheduler`) ne perd rien. La gigue ±15 % est **déterministe** (hachage du nœud et du rang de révision) : sans cela, deux calculs successifs donneraient deux dates et aucun test ne pourrait rien affirmer. Échec = −2 boîtes (pas de retour brutal à zéro), réussite lente = sur place, **plafond 8 cartes dues par session**. Le diagnostic par corde (`Attempt.missedStrings`) alimente le hub (« La — 1 case manquée sur 1 tentative »).

**Rappel à froid (lot « mémoire et vitesse »)** (`modules/gammes/review.ts`, `coldReview.ts`) — principe : **un essai fait juste après avoir vu la réponse ne prouve rien**. Constat de départ (vérifié dans le code) : la session mélangée choisissait N3 à partir de la boîte 3, sinon N2, et gardait le découpage par défaut (2 cordes) — une carte due se « révisait » donc en comblant deux trous qu'on retrouve en comptant les cases depuis une note voisine.
- Une carte **due** sur une forme déjà travaillée s'ouvre en **N3, position entière, en montée**, tablature vide, **sans annotation ni légende**, sans « Écouter d'abord » ni « Nouvelle série » (elle effacerait les cases révélées). **Seul cet essai à froid** compte pour Leitner, la maîtrise et l'XP, barème inchangé.
- Sous 80 % : « **Regarde la forme** » (10 / 20 / 30 s, défaut 20, réglage `lookSeconds`), la forme se masque d'elle-même (ou « J'ai vu, masquer »), puis **nouvel essai N3**. Ce rattrapage est journalisé `afterReveal: true` : il compte pour la série et l'objectif du jour (pratique vérifiée) mais **pas** pour Leitner, la maîtrise, l'XP ni les accomplissements (`isProof` = vérifié et non `afterReveal`). Pas d'étoiles ni de fête sur un rattrapage. **[HYP]** « Refaire celle-ci » en révision est traité de même : la forme vient d'être corrigée sous les yeux.
- « **Passer** » est présent à chaque étape. Une forme jamais pratiquée n'a pas de carte : elle garde le parcours N1 → N2 → N3. Les formes **fragiles non dues** gardent l'exercice ordinaire (N2, 2 cordes).
- Réglage « **Rappel à froid en révision** » (`coldReview`, activé par défaut) ; désactivé, la révision retrouve le choix de la phase 2. Intervalles Leitner et plafond de 8 cartes **inchangés**.

---

## 6. Validation audio : ce qui est réaliste (vue du prof)

| Mode | Fiabilité attendue | Usage |
|---|---|---|
| **Note isolée / arpège corde par corde** (mono, McLeod) | **Bonne** sur interface USB ; **moyenne** sur micro de téléphone pour les 2 cordes graves (peu d'énergie < 100 Hz → octave fausse possible) | référence pour **apprendre** et valider « appris » |
| **Plaqué (strum)**, accord *attendu* | **Mesurée en phase 5** (`poly.ts`, matrice de confusion publiée §6.1) : 91 % d'accords justes sur signaux de synthèse de 7 conditions, 100 % des cordes d'un accord juste entendues ; **une corde étouffée est vue** (confiance 0,00) ; l'inversion doublée (G/B) n'est pas distinguable | vérification du geste complet, avec confiance par corde ; **jamais** de « faux » sec |
| Reconnaissance d'un accord *inconnu* | **Hors périmètre** | non promise |

### 6.1 Ce que l'écoute polyphonique sait faire — mesuré, pas espéré

**Comment ça marche** (détail dans `core/input/poly.ts`) : attaque par flux spectral, puis FFT 16 384 sur la fenêtre **après** l'attaque (2,9 Hz par bin), puis somme harmonique 1-6 par note attendue, **des graves vers les aiguës**, avec retrait de la part que chaque corde explique (et non du pic entier : la fondamentale du Si aigu d'un Em tombe exactement sur le 3ᵉ harmonique du Mi grave — retirer le pic effaçait la note cherchée). La confiance de chaque corde est une échelle logarithmique du rapport signal/plancher, le plancher étant **relatif** (0,4 % du pic le plus fort) pour que les fuites d'une corde grave ne passent pas pour une preuve.

**Matrice de confusion** (`tests/poly-matrix.test.ts`, 11 accords × 7 conditions, publiée dans `.shots/poly/matrix.json`) :

| Condition | Accords reconnus parmi 11 | Marge médiane sur le 2ᵉ |
|---|---|---|
| signal propre | **10/11 (91 %)** | +0,51 |
| bruit 30 dB | 10/11 (91 %) | +0,51 |
| bruit 20 dB | 10/11 (91 %) | +0,51 |
| bruit 10 dB | 10/11 (91 %) | +0,48 |
| 20 dB · guitare à +15 cents | 10/11 (91 %) | +0,47 |
| 20 dB · guitare à +30 cents | 10/11 (91 %) | +0,49 |
| 30 dB · guitare à +30 cents | 10/11 (91 %) | +0,49 |

**Cordes entendues** sur les quatre conditions réalistes : **224/224 (100 %)**. Les paires documentées plus bas (Am/C, Em/E, D/Dsus2, D/Dsus4, C/Cmaj7, Am/Am7, G/G/B) sont **toutes** tranchées dans le bon sens, sauf une.

**La seule confusion qui reste, dans toutes les conditions : G/B pris pour G.** Ce n'est pas un réglage à corriger, c'est une impossibilité : G/B **double la corde de Si**, et deux cordes à l'unisson produisent **un seul** pic dans le spectre. Aucun analyseur ne peut les séparer ; le test le fige pour que personne ne « répare » le score en cassant autre chose.

**Sur les vrais échantillons de la banque** (pas des sinus : `tools/make-chord-fixtures.sh` superpose six cordes nylon avec 18 ms d'étalement, rejouées par un faux micro Chromium) :

| Ce qui est joué | Ce que l'app dit |
|---|---|
| Em juste | « Entendu : 6 cordes sur 6, confiance 80 % » — cordes entre 73 et 100 % |
| Mi **majeur** au lieu de Em | « Une corde manque : **Sol♯ à la place de Sol** (corde de Sol) », confiance 31 % |
| Em, corde de mi aiguë étouffée | « la corde de mi n'a pas sonné. Vérifie qu'aucun doigt voisin ne l'étouffe » |

**Ce que ça ne prouve pas** : une vraie guitare, un vrai micro, une vraie pièce, une vraie caisse de résonance. Les chiffres ci-dessus sont un **plafond optimiste** — la matrice est synthétique, et les fixtures sont des échantillons propres sans bruit de pièce. La validation sur instrument réel reste à faire, et c'est écrit dans `PROJECT.md` §12.

Cas qui resteront **ambigus** (à documenter dans l'UI et ici) :
- **Em vs E** : la 5e harmonique de la corde de Mi grave (82,41 × 5 = 412,0 Hz) tombe à **−14 cents du Sol♯4 (415,3 Hz)** et à +86 cents du Sol4 : un Mi grave bien joué « injecte » un faux Sol♯ ; il faut **soustraire les harmoniques de la basse** avant de juger la tierce.
- **D / Dsus2 / Dsus4** : un seul fa♯/mi/sol sur la corde aiguë. La 3e harmonique d'un La grave résiduel (110 × 3 = 330 Hz ≈ Mi4 à +2 cents) fait apparaître un **faux Dsus2** si la corde de La vibre par sympathie.
- **Am vs C**, **Em vs G**, accords ouverts qui laissent sonner des cordes à vide non voulues : mesurés, ces cas sont **tranchés** par la pénalité d'inexpliqué (§6.1) ; ce qui reste impossible, c'est une corde **doublée à l'unisson** (G/B contre G) et une corde étouffée **dans un accord très dense** (le seuil par corde est à 0,45 de confiance, et un accord à six cordes laisse peu d'énergie propre à chacune).
- **Accordage** : une guitare à −20 cents fait passer des notes correctes pour fausses → **accordeur obligatoire avant tout exercice audio** (et lecture du La de référence dans les réglages).
Principe d'interface : **niveau de confiance + 3 bandes (OK / probable / douteux) + message** ; **bouton de secours « je l'ai bien joué »** (statut « non vérifié », moins d'XP). Jamais « faux » sec sur un plaqué.

---

## 7. Avis de prof sur les points délicats

### 7.1 Tab seule pour les accords : suffisant ?
**Pour lire** : oui (pile verticale + doigtés + couleurs). **Pour voir la forme de la main** : non, pas pour un vrai débutant. Une pile de chiffres est une liste de nombres ; la boîte d'accord (cordes verticales, cases horizontales) montre la **géométrie** (écart entre doigts, doigts sur cordes adjacentes, barré), qui est exactement ce que le cerveau compare à la main sur le manche. Songsterr lui-même l'affiche en vue accords.
Options **[À TRANCHER]** (rien n'est implémenté) :
- **(A) Tab seule partout** (brief par défaut) : cohérent, mais la leçon d'accord est la plus faible.
- **(B) Tab + boîte d'accord uniquement dans les étapes Découvrir/Construire du module Accords** (réglage activable, off possible) — **ma recommandation** : une aide ponctuelle, pas un deuxième format à lire.
- **(C) Boîte d'accord partout** : contraire à l'esprit du brief, déconseillé.
Même question, plus modérée, pour les positions de gamme : une vue « manche » optionnelle dans le module Gammes aiderait CAGED et les boxes. Je ne la propose **pas** par défaut ; je la signale comme limite réelle.

### 7.2 Place des power chords
Je les place **en branche optionnelle parallèle à partir de P2** (après Em/E/A) : ils sont **faciles pour la main gauche** (2-3 doigts, peu d'exigence de netteté sur 6 cordes), très motivants pour qui veut du rock, **mais** ils masquent la notion majeur/mineur (pas de tierce) et peuvent retarder les vrais accords. Opt-in au départ (« je veux jouer du rock ») : la branche s'ouvre dès Em+E ou A connus, et est présentée comme « accord *sans* tierce », donc ni majeur ni mineur.

### 7.3 Le mur du palier P4 (C, G) et le barré (F, Bm)
- Un barré demande de la force **et du temps** (semaines, pas jours). **Aucun verrou** : Fmaj7 (xx3210), F 4 cordes (xx3211) et Bm7 (x20202) permettent de jouer des progressions réelles sans le barré complet.
- Pour C : Cmaj7 → C. Pour G : version 3 doigts puis 4 doigts ; en attendant G/B et G/D comme soutien.
- Plusieurs « entrées » par accord : le message « bloqué sur C » ne doit jamais apparaître ; l'app propose un autre chemin.

### 7.4 Critères de maîtrise
Voir 4.6. Seuils plus bas pour micro de téléphone ; XP plafonnée par jour (la quantité ne doit pas payer plus que la qualité) ; bonus de vitesse seulement à précision ≥ 95 %.

### 7.5 Réalisme de la validation audio
Voir section 6. Le brief demande « validation du strum via micro ou interface USB » comme élément central du Défi : **c'est réalisable à un niveau « plausibilité + confiance »**, pas à un niveau « diagnostic par corde » ; la promesse produit doit être : « l'app entend ton accord, te dit à quel point elle est sûre, et t'aide » — pas « l'app corrige ta main ». Le mode arpège porte la rigueur.

### 7.6 Doigtés simplifiés
Statut de nœud à part (`simplifiedOf: voicingId`), jamais présenté comme « le vrai accord » : étiquette « version simplifiée », chemin de montée vers la forme complète, XP identique mais l'accord complet reste dans l'arbre. Exemples : Cmaj7 (x32000) → C ; F 4 cordes → F barré ; Bm7 x20202 → Bm ; G/D xx0003 → G.

### 7.7 Quelques exigences du brief à challenger
- « Niveau 3 : rejouer la gamme de mémoire avec timer » → voir 3.4 (découper).
- « Jouer 12 tonalités × tous modes » → 3.1 (formes + transposition échantillonnée).
- « 4 ambiances × backing tracks de styles différents » → énorme travail de contenu musical ; proposer 1 style très soigné par thème, 2 thèmes jouables en phase 7 (Synthwave + Lo-fi).
- Strum validé par corde → section 6.

### 7.8 Rythme
Le brief place le strumming en transversal. **[AVIS PROF]** : le rythme est la cause n°1 d'abandon après les accords. Je le garde transversal dans le MVP mais je le modélise comme **module à part entière** (`rythmique`) dès la phase 0 (mêmes services), pour pouvoir l'extraire sans rien toucher.

---

## 8. Improvisation : classification harmonique des notes (phase 7)

Pour chaque note jouée (hauteur, temps, accord en cours, gamme/mode de contexte) :
1. **Note d'accord** : classe de hauteur ∈ {1, 3, 5, 7} de l'accord.
2. **Tension/couleur disponible** : note de la gamme de contexte qui n'est pas d'accord et n'est pas « à éviter » (9, 13, 11 selon le contexte).
3. **Note à éviter** : note de la gamme située **un demi-ton au-dessus d'une note d'accord** (règle calculable) → sur C maj7/ionien : Fa (4te) ; sur G7/mixolydien : Do (4te) ; sur Em7/phrygien : Fa (♭9) ; sur Am7/éolien : Fa (♭13) ; sur Bm7♭5/locrien : Do (♭9) ; dorien et lydien : aucune. Nuance enseignée : **« à éviter » ≠ « interdit »** : en passage ou sur temps faible c'est correct ; tenue, elle frotte.
4. **Note de passage** : hors accord, de la gamme, sur un temps faible et approchée/quittée par mouvement conjoint.
5. **Hors gamme** : le reste ; exceptions : blue note ♭5 sur blues, approches chromatiques (note d'approche à ½ ton d'une note d'accord, résolvant) → **non pénalisées**.
Nuance enseignée : un V7 qui résout vers un accord **mineur** appelle plutôt le mixolydien ♭9 ♭13 (5e mode de l'harmonique) ou l'altéré. La classification doit lire le **contexte** (accord suivant) et non seulement l'accord courant.
Feedback explicatif : toujours une cause + une action (« Do tenu sur G7 frotte avec Si : résous sur Si »).

### 8.1 Tel que construit (phase 7) — et où c'est plus simple que ci-dessus

`core/impro/classify.ts` classe chaque note **à la volée** (une fonction pure, testée sur des tables) et
rend un rôle parmi cinq : `chord`, `color`, `passing`, `avoid`, `out`. Trois différences assumées avec le
paragraphe de principe :

1. **La note à éviter est la quarte sur majeur et dominante** (5 demi-tons au-dessus de la fondamentale),
   pas « tout demi-ton au-dessus d'une note d'accord ». La règle du demi-ton aurait marqué la ♭9 comme
   « à éviter » alors que c'est une **tension** de dominante très utilisée ; la quarte, elle, frotte la
   tierce majeure d'un demi-ton dans tous les cas et c'est le cas d'école.
2. **Le temps ne change pas le rôle, il change le score.** Une note de passage reste un passage ; c'est
   le score qui regarde si elle tombe sur un temps fort. Séparer les deux permet d'afficher un rôle
   stable (la pastille ne clignote pas) et de pénaliser la **place**, pas la note.
3. **La note blues (♭5) n'est pas encore neutralisée** : elle sort aujourd'hui en `out` sur une gamme
   majeure ou mineure naturelle. Le contexte « blues » demanderait de savoir qu'on improvise sur un
   blues — ce n'est pas implémenté, et c'est dit à l'écran (« hors gamme » veut dire hors de la gamme
   choisie, pas « fausse »).

**Les tensions consonantes par qualité** (ce que la table accepte comme `color`) :

| Qualité | 9 | ♯11 | 13 | 11 (quarte) | autres |
|---|---|---|---|---|---|
| maj / maj7 | couleur | couleur | couleur | **à éviter** | — |
| min / min7 | couleur | passage | couleur | couleur | ♭6 = passage |
| dom7 | couleur | couleur | couleur | **à éviter** | — |
| sus4 | couleur | passage | couleur | *note d'accord* | tierce majeure = couleur |

**Le score** (0-100) : `45 %` de notes d'accord + `20 %` de notes dans la gamme + `35 %` de notes
d'accord **sur les temps forts**. Les poids disent la pédagogie : jouer juste ne suffit pas, il faut
**dire l'harmonie**, et c'est sur les temps forts que ça s'entend. Un solo qui ne visite que la gamme
plafonne autour de 45 ; un solo qui dit l'accord sans jamais le placer au bon moment plafonne autour de
65. Le score est affiché **avec ses trois taux**, et l'écran dit qu'il mesure la tenue de la grille, pas
le goût de la phrase : une ligne lente et juste vaut mieux qu'une avalanche de notes, et l'app ne sait
pas mesurer ça.

**Le conseil** est **une** phrase, la plus utile : d'abord rester dans la gamme (`inScaleRate < 85 %`),
ensuite visiter l'accord (`chordRate < 45 %`), ensuite le placer sur les temps forts
(`strongChordRate < 50 %`), et seulement si tout cela tient, proposer une tension. Un écran qui liste
cinq défauts à la fois n'en corrige aucun.

**Ce que l'analyse ne fait pas** : ni phrase, ni rythme, ni dynamique, ni résolution des dissonances
(une note à éviter qui **descend d'un demi-ton sur une note d'accord** est du meilleur jazz — l'app la
compte comme à éviter). C'est la limite du classement note à note, et elle est écrite ici pour ne pas
être découverte plus tard.

---

## 9. Idées en attente et références

**Idées en attente** (non planifiées) : mode « débutant » de la tab (hampes masquées, flèches seules) ; vue « fondamentales seulement » d'une position ; positions en sous-ensembles (2 cordes, puis 3…) pour le chunking ; comparaison côte à côte de deux modes voisins ; superposition de la forme d'accord dans une position CAGED ;  mode gaucher (miroir de la vue boîte) ; solveur de voicings pour accordages alternatifs ; bibliothèque de morceaux **domaine public / traditionnels uniquement** (les morceaux sous droits ne peuvent pas être embarqués) ; journal de pratique exportable ; mode « métronome seul » ; entraînement du chant/note cible ; export Guitar Pro (via alphaTab, hors chemin critique).

**Références de travail** (citées de mémoire, **non relues** pendant la phase 0 ; à vérifier avant d'être affichées dans l'app) : Mark Levine, *The Jazz Theory Book* (notes à éviter, modes sur accords) ; cours débutant de JustinGuitar (ordre des accords, exercice « one-minute changes ») ; McLeod & Wyvill, « A Smarter Way to Find Pitch » (2005) ; A. Klapuri, estimation multi-F0 par annulation itérative (ISMIR 2006) ; Wozniak, SM-2 ; FSRS (Ye et al.).

---

## 10. Bilan de la phase 1b — avis de prof et propositions

### 10.1 Avis de prof sur ce qui est construit
- **Ce qui marche vraiment** : la tab montre maintenant la *fonction* des notes, pas seulement leur place. La fondamentale jaune aux coins coupés, la couleur du ♭3 qui diffère de celle de la 3ce, le glow sur la note qui fait le mode (la 6te du dorien, le ♭5 du blues) : c'est ce qui transforme « 12 chiffres à retenir » en « une forme avec un centre ». La box 1 de La mineur sort exactement comme la forme qu'on enseigne (5-8 / 5-7 / 5-7 / 5-7 / 5-8 / 5-8) et la blue note tombe aux bonnes cases (corde de La case 6, corde de Sol case 8) — vérifié par test, pas à l'œil.
- **Ce que la tab ne sait pas faire (limite confirmée sur les captures)** : une box à 2 notes par corde se lit comme une forme ; une position 3NPS (18 notes sur 6 lignes) se lit comme une **liste de chiffres**. Je ne promets pas qu'un débutant « voie » le rectangle à partir de la tab seule. Les repères actuels (cases a–b, fondamentale jaune, couleurs) aident, ils ne remplacent pas un diagramme. Ma recommandation de la phase 0 (une vue manche **optionnelle** dans le module Gammes) reste d'actualité ; je ne l'ai pas implémentée.
- **Les accords** : la pile + X + barré + « simile » est lisible et honnête, mais l'étape « Construire un doigt à la fois » est **bloquée par les données** : aucun doigté n'est saisi (phase 4, relecture prof). Sans eux, la rangée « doigté » reste vide. Et la forme de la main reste mal visible dans une pile (D1 : boîte d'accord aux étapes Découvrir / Construire, toujours recommandée).
- **Rythme** : correct (ligatures par temps, points, triolets, silences), mais trois couches — pile, flèches, hampes — c'est beaucoup pour quelqu'un qui joue ses deux premiers accords. À ce stade, seules les flèches comptent : un mode « débutant » qui masque les hampes est plus important que n'importe quel raffinement de notation.
- **CAGED** : ma définition (fenêtre de 5 cases autour de la forme d'accord) est cohérente et testée, mais **ce n'est pas encore une position que j'enseignerais sans que tu la relises** (D12). Les fenêtres de Do majeur (C 0-4 · A 2-6 · G 5-9 · E 7-10 · D 9-13) sont plausibles ; je n'ai pas de source sous les yeux pour comparer.
- **Couleur et daltonisme** : les chiffres de contraste sont bons, mais l'œil voit orange, magenta et vert se confondre en protanopie / deutéranopie. Sans réglage dédié (D13 écartée), seule la rangée de degrés optionnelle compense : ce n'est pas pleinement accessible à ≈ 8 % des garçons et hommes. Limite assumée.
- **Le curseur** : ancré à 30 % de la largeur, notes passées estompées, anneau blanc sur la note en cours — ça se suit sans lâcher la main des yeux. Mesuré exact au pixel par rapport au tick du Transport (écart max à une droite parfaite : 3,9 ticks ≈ 6 ms) ; l'alignement avec le son **entendu** repose sur la latence de sortie annoncée par le navigateur (retranchée), **non mesurée au micro**. **Le son, lui, est provisoire et je ne l'ai pas écouté** : le timbre d'un PluckSynth n'est pas celui d'une guitare ; ne juge pas la pédagogie sur lui.

### 10.2 Propositions pédagogiques (impact ÷ effort décroissant)
1. **« Fondamentales d'abord »** *(impact fort, effort faible)* : avant de jouer une position, n'allumer que les fondamentales (et les quintes) ; l'élève les nomme à voix haute. Ça ancre la tonique **dans** la forme avant les 10 autres notes — l'erreur n°1 est de connaître la forme sans savoir où elle « habite ». Réutilise `fn` : un simple réglage d'affichage.
2. **Positions par morceaux** *(fort, moyen)* : le même générateur émet une position en sous-ensembles — 2 cordes, puis 3, puis la box entière. Réduit la charge de 12 notes à 4 et prépare le niveau 3 « Rappel » (§3.4) sans nouveau code de théorie.
3. **« Quelle est la ♭3 ? »** *(fort, moyen)* : jouer la box avec drone, demander de toucher la pastille d'une fonction donnée (la magenta, la ♭5…). Apprend à lire la couleur comme un **son** (la couleur du mode), pas comme un décor ; c'est de l'ear training sur la tab elle-même.
4. **Deux modes côte à côte** *(moyen, faible)* : dorien et éolien sur la même position, seule la note qui change en glow (la 6te contre la ♭6). Le brief demande les deux façons de penser les modes ; le modèle porte déjà `characteristic`.
5. **Le pont accord ↔ gamme dans CAGED** *(moyen, moyen)* : dans une position CAGED, superposer la pile de la forme d'accord correspondante (« ton Mi barré est ici, la gamme l'entoure »). Les données existent (fenêtres CAGED + formes mobiles) ; c'est le lien explicite que demande le brief entre les deux modules.

---

## 11. Phase 1c — le son : échantillons, hauteur, niveaux, jeu

La 1c ne construit que le **moteur audio de sortie** (le hub, le thème et le module Gammes N1 passent en 1d). Tout ce qui suit est vérifié par test ou par mesure, sauf ce qui est explicitement marqué « non vérifié ».

### 11.1 Sources d'échantillons : retenues et écartées

| Banque | Source | Licence | Contenu utile | Poids |
|---|---|---|---|---|
| **nylon** (défaut) | FreePats, « Spanish Classical Guitar », version 2019-06-18, roberto@zenvoid.org | **CC0 1.0** | 48 FLAC mono 44,1 kHz, un échantillon par demi-ton (ou presque) de G1 à C6 | 5,3 Mo |
| **electric** | Karoryfer Samples, « Emilyguitar » (D. Smolken), commit `b4920dc` | **CC0 1.0** | 90 FLAC mono 44,1 kHz, Ré♭2 → Ré6, une note sur trois environ (écarts de 2-3 demi-tons) ; couches p, mf (3 répétitions), f | 6,8 Mo |

| Source écartée | Licence annoncée | Raison exacte |
|---|---|---|
| `tonejs-instruments` (guitares) | code MIT, échantillons **CC BY 3.0** | Chaîne d'attribution **invérifiable** : `sample-source-info.txt` cite « guitar ac — Iowa » (le jeu de l'université de l'Iowa ne contient pas de guitare) et « guitar ny — Freesound 11573 », page qui renvoie **404**. Une CC BY qu'on ne peut pas attribuer correctement n'est pas utilisable |
| FluidR3_GM (`gleitz/midi-js-soundfonts`) | CC BY 3.0 annoncée par le dépôt | Aucun fichier de licence par instrument, provenance non documentée |
| Musyng Kite, FatBoy | **CC BY-SA 3.0** | Partage à l'identique : contaminerait les ajouts ultérieurs |
| FreePats « FSS Steel-String Acoustic » | **GPL v3** | Copyleft fort sur les échantillons |

**Attribution** : inutile en CC0, affichée quand même (page Audio, « Crédits et licences ») — c'est la moindre des choses et ça garde la traçabilité pour la suite.

Pour ajouter une banque : un dossier `public/samples/<id>/` avec les fichiers, `LICENSE.txt`, le lisez-moi de la source et un `manifest.json` (provenance, licence, modifications, et par fichier : taille, SHA-256, durée, **écart de hauteur mesuré**, gain de nivellement). `tools/build-samples.mjs` produit ce manifeste (mesures comprises) ; un test vérifie licence, empreintes, en-têtes FLAC, étiquetage des notes et couverture du manche sur 9 accordages.

### 11.2 Le timbre : ce que je peux dire honnêtement
Je n'ai **pas écouté** les banques (pas d'oreille ici). Ce que je sais par la documentation des sources : le nylon est une classique espagnole enregistrée au micro (attaque douce, médiums chauds) ; l'électrique est une caisse demi-caisse enregistrée en direct avec des cordes filets plats (son net, mordant, sans ampli). Conséquence probable, à confirmer par toi : le nylon convient mieux à l'écoute d'une gamme ou d'une couleur de mode ; l'électrique rend mieux le **rythme** d'un strum. D'où un choix d'instrument **en option**, pas une constante.

### 11.3 La hauteur juste ne se suppose pas : elle se mesure
Les enregistrements ne sont pas exactement au demi-ton : écarts mesurés par autocorrélation (±2 cents) de **−12,5 à +17,3 cents** selon le fichier, y compris entre variantes d'une même note (une attaque plus forte tend la corde, donc monte — c'est physiquement vrai). La lecture applique la correction de chaque échantillon (vitesse = 2^(cents/1200)).

Pourquoi c'est non négociable : la phase 3 jugera la guitare de l'élève à quelques cents près. Une application qui joue elle-même 15 cents faux lui apprend à accorder faux. Le test vérifie que la vitesse de lecture reste dans [0,79 ; 1,27] sur toute la guitare standard, et le manifeste refuse un écart mesuré au-delà de ±25 cents (l'étiquette ou la mesure serait alors suspecte).

### 11.4 Niveaux : mesurés, pas au jugé
Rendu hors ligne dans le navigateur (même chaîne master, même échantillonneur, 48 kHz), réglages par défaut :

| Essai | crête | RMS | RMS actif |
|---|---|---|---|
| nylon, progression ↓·↓↑·↑↓↑ | −4,0 | −16,6 | −16,1 |
| nylon, pentatonique montée + descente | −4,5 | −18,6 | −18,1 |
| nylon, accord arpégé | −6,2 | −20,7 | −18,9 |
| électrique, progression | −3,8 | −18,4 | −17,9 |
| électrique, gamme | −4,5 | −21,0 | −20,5 |
| drone (La : fond + quinte + octave) | −15,3 | −26,9 | −26,8 |
| métronome (par clic) | −11,3 | — | −27,7 |
| cas extrême : tout à 1, accord de Fa barré à 170 BPM, humanisation max | **−1,2** | −15,4 | −10,8 |

Lecture : 4-5 dB de marge sous le plafond en usage normal ; le drone est **10 dB sous la guitare** (on l'entend, il ne masque pas la gamme) ; le métronome reste 7 dB sous la crête de la guitare (audible, jamais plus fort que la musique) ; le cas extrême est borné.

**Le limiteur seul ne suffisait pas** : `Tone.Limiter` (compresseur 20:1, attaque 3 ms) laisse passer les crêtes plus rapides que son attaque — mesuré à **+2,2 dBFS**. D'où le plafond dur qui suit (identité sous −3,1 dBFS, asymptote −1 dBFS, dérivée continue, suréchantillonnage 2×).

### 11.5 Règles de jeu : ce que le son imite de la main
- **Une voix par corde** : rejouer une corde coupe la précédente (25 ms). C'est le comportement de l'instrument, et ça évite d'empiler un accord sur lui-même.
- **Strum** : écart moyen 14 ms par corde (4-40 réglable) qui **s'accélère en fin de geste** ; vélocité qui décroît du côté **d'où part la main** ; montant 12 % plus doux ; accent sur le début de mesure, puis le temps, puis le contretemps ; le balayage occupe au plus **35 %** de la durée de l'événement (à 200 BPM en croches il se resserre de lui-même).
- **Humanisation déterministe** : gigue de ±20 % de l'écart et ±7 % de vélocité, graine = tick. Rejouer deux fois une mesure donne **exactement** le même son — indispensable pour comparer deux prises, et pour tester.
- **Tenue** : accord et progression → les cordes sonnent **jusqu'à la fin de la mesure** (main gauche qui laisse sonner) ; arpège → deux fois la durée écrite (legato) ; gamme et position → étouffées à la fin de chaque note. Choix pédagogique : à l'arpège on doit entendre **la corde qui continue** ; à la gamme, **chaque hauteur séparément**.
- **Couche de vélocité par événement** : toutes les cordes d'un même strum prennent la même couche — un strum ne mélange pas deux timbres. Le gain, lui, reste par note.
- **Répétitions** : trois variantes mf sur l'électrique ; sinon désaccord de ±3 cents par note, pour qu'une note répétée ne soit pas un clone sonore.
- **Drone** : fondamentale (Mi2-Ré♯3) + quinte + octave, **jamais la tierce** — le drone ne doit pas annoncer « majeur » ou « mineur » à la place de la gamme.
- **Métronome** : un clic par temps, accent sur le premier temps ; un clic par **groupe de trois croches** en 6/8, 9/8, 12/8 (un clic par croche serait un marteau-pilon).

Non modélisé à ce stade : techniques (h/p, slide, bend, vibrato), palm mute, différence de timbre médiator / doigts, résonance sympathique des cordes à vide, mise en valeur de la basse d'un accord slash.

### 11.6 Ce qui n'est pas vérifié
Le **timbre** (je n'écoute pas) ; **Safari et iOS** (décodage FLAC, interrupteur silencieux qui coupe le Web Audio, reprise du contexte après geste) ; **un vrai téléphone** ; la **latence acoustique** (compensation par la latence annoncée par le navigateur, 11 ms ici) ; l'absence de clic sur les vrais échantillons (mesurée sur un sinus de contrôle ; les fichiers ont par ailleurs un fondu de fin et commencent à −1,3 dB sous leur crête).

### 11.7 Avis de prof sur cette phase, et propositions
Le vrai gain de la 1c n'est pas « on a du son » : c'est que **ce qu'on entend est vérifié identique à ce qu'on voit** (le lecteur tient un journal des notes déclenchées, la page Audio compare corde par corde). Un élève apprend en faisant correspondre trois choses : la tab, le geste, le son. Si le son joue une autre note que la tab — voicing approximatif, corde décalée, échantillon mal transposé — tout l'apprentissage part de travers sans que personne ne le voie.

1. **Compte à rebours d'une mesure** *(fort, faible)* : une mesure de clics avant la gamme. Démarrer en retard sur un temps est la première cause de décrochage rythmique.
2. **Écouter la fondamentale seule d'abord** *(fort, faible)* : jouer la gamme avec seulement tonique et quinte audibles (le reste très atténué), puis tout. Réutilise `fn`.
3. **Boucle sur un segment** *(fort, moyen)* : une corde, une mesure, tempo réduit ; prépare le chunking des niveaux 2-3.
4. **Deux modes sur le même drone** *(moyen, faible)* : dorien puis éolien en alternance automatique, seule la note qui change est mise en évidence.
5. **Mode « strum seul »** *(moyen, faible)* : flèches et son, sans pile ni hampes, pour ceux qui jouent leurs deux premiers accords (§10.1).

---

## 12. Bilan de la phase 1d — avis de prof et propositions

### 12.1 Ce qui marche
- **L'app ne peut plus mentir sur la gamme choisie** : les orthographes alternatives apparaissent quand le coût est égal, les systèmes incompatibles sont grisés **avec leur raison**, le mode parent est nommé (« mode parent : Do majeur (2e degré) ») et jamais présenté comme une tonalité. C'est exactement là que les apps de gammes se cassent, et c'est invisible quand c'est bien fait.
- **Le calque d'accord est la meilleure idée de la phase** : il transforme « voici 12 notes » en « voici la gamme, et voilà où est l'accord dedans ». Sur une pentatonique mineure, une seule note s'éteint — et cette note est justement la 4te, celle qui « frotte ». On peut l'enseigner en 10 secondes avec cet écran.
- **Les doigtés remplissent une rangée qui était vide depuis la 1b**, avec des valeurs qui sont celles qu'on enseigne vraiment (1-3 / 1-4 / 1-2-4 / 1-3-4), et **rien** quand la position demanderait un démanché.
- **Les chiffres du hub sont vrais.** « 1 gamme écoutée · 10 s » vient d'une lecture réelle mesurée, pas d'un décor. C'est la base de confiance dont la phase 2 aura besoin.
- **Le poster fait son travail** : identité immédiate, typographie lisible, et le décor s'efface dès qu'on entre dans un écran de travail (variante `calm`).
- **Typographie : le pixel tient le chrome, pas le texte.** Trois essais successifs en 1d — Press Start 2P sur les titres, puis une police pixel à trait d'un pixel (Pixelify Sans), puis Silkscreen sur les contrôles — ont tous buté sur la même limite : à 10-23 px, une police pixel perd ses accents, sa hauteur d'x et sa lisibilité sur téléphone. Répartition retenue : **Silkscreen** (capitales épaisses) pour les étiquettes de panneau, badges, tags et onglets — 1 à 4 mots, jamais une phrase ; **sans-serif système** pour les titres, le texte, les boutons, les segments et les chips. L'identité visuelle passe par le décor, les bordures, les néons, la tablature bitmap et le mot-symbole — pas par la police du paragraphe.

### 12.2 Ce qui reste faible
- **La tablature seule ne montre toujours pas la forme.** Une box à 2 notes par corde se lit ; une position 3NPS se lit comme une liste. La vue manche optionnelle reste la vraie réponse, et elle n'existe pas. Le compteur de positions et la légende de couleurs compensent en partie, pas complètement.
- **Le niveau 1 est une écoute, pas un apprentissage vérifié.** Rien n'est encore évalué : c'est conforme au brief, mais il ne faut pas appeler ça « appris ».
- **Le rythme dans la tablature est du bruit en N1** (voir §3.9).
- **Le timbre n'a pas été écouté** (comme en 1c) et rien n'a été testé sur un vrai téléphone : la lisibilité a été jugée sur captures 390×844, pas dans la main.
- **Doigtés heuristiques** : justes sur les formes usuelles, non relus position par position.

### 12.3 Propositions — état après la seconde passe de 1d
Les cinq propositions ont été **implémentées dans la même phase** (testées : `tests/learning.test.ts`). Détail de ce qu'elles font réellement dans le §3.9. Ce qui reste ouvert : la **vue manche optionnelle** (contraire au brief tel qu'il est écrit, elle attend ton accord) et la **relève des doigtés** position par position.

1. **« Fondamentales d'abord »** *(fort, faible)* — fait — un mode qui n'allume que 1 et 5 dans la position, l'élève nomme la tonique à voix haute. Corrige l'erreur n°1 : connaître la forme sans savoir où elle habite.
2. **« Montre-moi la ♭3 »** *(fort, moyen)* — fait (toucher la pastille, correction par anneau blanc) — lecture avec drone, l'élève touche la pastille d'une fonction demandée. Transforme la couleur en son au lieu d'un décor ; c'est de l'ear training **sur la tablature elle-même**.
3. **Positions par morceaux** *(fort, moyen)* — fait (2 / 3 / 4 cordes) — la même position en 2 cordes, puis 3, puis entière. Réduit 12 notes à 4, prépare le niveau 3 sans nouveau code de théorie.
4. **Mode « débutant » de la tablature** *(moyen, faible)* — fait (rythme masqué par défaut) — masquer hampes, ligatures et silences, ne garder que les pastilles et l'annotation. Réglage global, une ligne de layout.
5. **Deux modes côte à côte** *(moyen, faible)* — fait (5 paires, même forme, note qui change en glow) — dorien et éolien sur la même position, seule la note qui change pulse. Le modèle porte déjà `characteristic` et le brief demande les deux lectures des modes.

---

## 13. Bilan de la phase 2 — avis de prof et propositions

### 13.1 Ce qui marche vraiment
- **La chaîne complète est honnête de bout en bout** : l'élève touche une case, l'app enregistre **un fait** (trous justes au premier essai, durée, corde fautive), et tout le reste — maîtrise, boîte de révision, XP, badges, série — est **recalculé** à chaque ouverture. On peut changer la formule de maîtrise demain sans perdre un seul essai, et un import de fichier restaure exactement les mêmes échéances. C'est la propriété que la plupart des apps de pratique n'ont pas : elles incrémentent un compteur et ne savent plus remonter au geste.
- **« Apprise » veut enfin dire quelque chose** : deux réussites à 80 % sur deux jours différents, pas un sans-faute un soir de chance. La consolidation nocturne est dans le modèle, pas seulement dans le discours. Et la revoyure à 10 minutes (boîte 1) est exactement ce qu'on fait en cours : on reprend l'accord avant de ranger la guitare.
- **Le trou comme unité d'exercice** est le bon geste pédagogique : il garde le contexte (la forme entière reste lisible en N2) tout en forçant la récupération active. C'est la différence entre relire une tablature et la savoir.
- **La révélation après deux erreurs** évite les deux écueils opposés : l'acharnement (l'élève bloque sur une case et abandonne) et le mensonge (valider faux pour avancer). La case révélée reprend sa **couleur de fonction** : l'erreur devient une leçon de lecture.
- **Le découpage par cordes** est ce que je fais à l'oral : « juste les deux cordes graves, on ajoute après ». 4 notes au lieu de 12 change tout sur un écran de téléphone.
- **La transposition suggérée** (« cette forme n'a été jouée qu'en Ré — même forme en Do ») est la première fonction de l'app qui enseigne quelque chose que l'élève ne savait pas qu'il devait apprendre : le motif se transpose, la tonique se repère. C'est le cœur du module Gammes.
- **Le diagnostic par corde** donne une phrase de prof que l'app peut dire sans micro : « tu rates la corde de La ».

### 13.2 Ce qui reste faible (à dire franchement)
- **Le tempo est mesuré, pas encore musical.** La grille existe (un temps par trou, ★★ conditionné), mais elle chronomètre une **saisie**. Un élève peut la tenir à la souris et être incapable de jouer la même position en mesure. C'est un premier pas honnête — l'app l'écrit dans l'UI — et pas la fin du sujet.
- **Un exercice écrit peut se tricher.** En N2, les notes visibles autour d'un trou permettent de **compter les cases** (une note voisine à la case 7 donne le trou à 8) sans savoir la forme. En N3 le problème disparaît — c'est pourquoi le N3 est le vrai test. **Corrigé** : le N3 pèse 1,5 contre 1 pour le N2 dans la moyenne récente de maîtrise (à scores égaux, le poids ne change rien). Reste que la pondération est un choix, pas une mesure.
- **Le taux de 35 % est un choix, pas une mesure.** Sur une position 3NPS de 18 notes, 35 % fait 6 trous : c'est beaucoup pour un débutant et peu pour un élève avancé. Le réglage (20 / 35 / 50 %) serait plus juste que la constante.
- **La maîtrise ne mesure ni la vitesse ni la musicalité** : uniquement la justesse au premier essai. Un élève lent et juste vaut mieux qu'un élève rapide et faux, mais l'inverse existe aussi (celui qui « sait » mais ne sait plus sous les doigts, en temps réel).
- **Le diagnostic par corde reste grossier** : il ne dit pas *quelle case* de la corde est ratée (le haut de la forme ? la note qui demande un écart de 3 cases ?). `missedStrings` perd cette information pour économiser 20 fois moins d'octets — le compromis est bon pour le MVP, insuffisant pour un vrai bilan.
- **Les accordages sont mélangés** dans ce compteur (index de corde seul) : en Drop D, « corde 1 » n'est plus la même note.
- **Rien n'est vérifié à l'oreille** : ni le timbre (inchangé depuis la 1c), ni la lecture sur un vrai téléphone, ni Safari/iOS. La lisibilité du pavé et de la tablature a été mesurée en CSS (48 px, pas de débordement), pas jugée dans la main.

### 13.3 Propositions — état après la phase 2 (seconde passe)
Les sept propositions sont **implémentées dans la phase** (testées, visibles au hub ou dans l'exercice) :

1. **Diagnostic par corde** *(fort, faible)* — fait — `missedStrings` + agrégation : « La — 1 case manquée sur 1 tentative ». C'est la première phrase de prof que l'app dit d'elle-même.
2. **Prochaine échéance affichée** *(fort, faible)* — fait — « dans 6 min (boîte 1 sur 6) ». La revoyure rapprochée cesse d'être une théorie : l'élève voit quand revenir.
3. **Transposition suggérée** *(fort, faible)* — fait — la même forme dans une tonique jamais vue, orthographe décidée par le moteur. Corrige l'erreur n°2 du débutant : connaître une forme sans savoir la déplacer.
4. **Exercice au métronome, ★★ au tempo cible** *(fort, moyen)* — fait — grille d'un temps par trou jouée par le métronome sur un score de silences ; grille tenue + ≥ 95 % = ★★, parfaite + dans la grille = ★★★, grille manquée = ★. Le tempo est réglable (30-120 BPM) et mémorisé. **Reste** : la vraie mesure du rythme attend le micro (phase 3).
5. **Révision mélangée (interleaving)** *(fort, moyen)* — fait — session de 3 à 5 formes **différentes** (route `#/gammes/revision`, bouton au hub) : dues d'abord, puis fragiles, alternance gamme × système, enchaînement sans repasser par le hub, bilan (formes, précision moyenne, XP). **Reste** : la longueur est en dur (5) et l'ordre est déterministe (testable).
6. **Peser le N3 plus que le N2 dans la maîtrise** *(moyen, faible)* — fait — poids 1,5 contre 1 dans la moyenne récente ; testé : à scores égaux, rien ne change.
7. **Réglage du taux de trous (20 / 35 / 50 %)** *(moyen, faible)* — fait — dans Réglages, avec la règle « au moins 2, jamais toutes » qui reste vraie quel que soit le taux.

Ce qui n'est **pas** fait, et que je continue de recommander, hors phase 2 : la **vue manche optionnelle** (la vraie réponse à « je ne vois pas la forme », toujours contraire au brief tel qu'il est écrit), la **relève des doigtés** position par position, et un **ear training** sur la note caractéristique (reconnaître le ♭3 du dorien à l'oreille, pas seulement le toucher).


---

## 14. Bilan de la phase 3 — avis de prof et propositions

### 14.1 Ce qui marche vraiment
- **La boucle est fermée : geste → son → preuve.** Jusqu'ici l'app vérifiait qu'un élève savait *lire* une tablature (taper une case). Elle vérifie maintenant qu'il sait *jouer* la note. C'est la différence entre un quiz et un cours, et c'est exactement l'objet de la phase.
- **Le refus de la fausse précision est la meilleure décision de la phase.** Trois choses étaient tentantes et fausses : dire sur quelle corde l'élève a joué, compter une octave fausse comme une faute, compter une note désaccordée comme une erreur de mémoire. Chacune aurait appris du faux à un débutant qui n'a aucun moyen de le détecter. L'app dit « je ne sais pas » là où elle ne sait pas — c'est ce qui rend crédibles les endroits où elle affirme.
- **La retenue de note (3 fenêtres)** : une corde qui s'éteint produit des sauts d'une demi-teinte. Sans elle, l'app remplirait des cases au hasard — et un élève perdrait confiance en une séance. Ce n'est pas un détail d'implémentation, c'est la condition de la confiance.
- **Les cents affichés** (« Mi · 5 · +21 ¢ — juste ») sont la première information que le pavé ne pouvait pas donner : *où est la main*. +21 cents sur une case 7 dit « ton doigt est loin de la frette », pas « tu ne sais pas ta gamme ».
- **L'accordeur au même niveau que l'exercice** : la validation audio est inutilisable sur une guitare à −20 cents. Mettre l'accordeur dans la barre, avec le plancher de bruit et la latence, transforme un gadget en **préalable**.
- **Le tempo devient réel** : quand le micro est actif, la grille mesure l'attaque de la note jouée, latence retranchée. La dette de la phase 2 (« la grille mesure la rapidité à écrire ») est payée.

### 14.2 Ce qui reste faible (à dire franchement)
- **Une note à la fois.** Un guitariste joue six cordes ; le moteur mono n'entend qu'une hauteur. Rien du module Accords ne pourra être validé autrement qu'en **arpège** avant la phase 5 : il faut le dire dans l'UI, pas seulement dans les documents.
- **Pas de bend, pas de vibrato, pas de note morte.** Une corde mal frettée sonne souvent **15 à 40 cents bas** : l'app la classe aujourd'hui en « problème d'accord » et envoie vers l'accordeur — alors que le remède est de **presser plus près de la frette**. C'est le contresens le plus coûteux de cette phase.
- **Les deux cordes graves sur un micro de téléphone.** L'octave peut basculer ; l'app le reconnaît mais ne le corrige pas : un élève au téléphone sera bloqué plus souvent sur E2/A2 qu'un élève sur interface USB. Le message est honnête, l'expérience reste inégale.
- **100 ms entre le geste et la case** (3 fenêtres + demi-fenêtre). À 120 BPM, un temps dure 500 ms : 20 % du temps du temps. Pour l'instant les exercices restent lents, mais c'est une limite de l'approche « fenêtre glissante ».
- **Le masque de 90 ms autour des clics** protège d'une fausse validation… et peut **ignorer une note jouée pile en place**. Un élève parfaitement rythmé sera parfois puni par le détecteur.
- **Rien n'est calibré sur une vraie pièce** : seuils par défaut, clarté 0,90, tolérance 35 cents sont raisonnés et mesurés sur signaux synthétiques. Deux minutes de guitare réelle diront plus que tout ce paragraphe.
- **La référence 440 Hz n'entre pas encore dans la lecture** : jouer à 442 avec des échantillons à 440 crée un écart de 7,9 cents entre ce qu'on entend et ce qu'on joue.
- **Toujours pas d'oreille** : je n'ai pas écouté le son, et je n'ai pas entendu une vraie guitare à travers ce détecteur.

### 14.3 Propositions (impact ÷ effort décroissant) — **placées dans la feuille de route** (`PROJECT.md` §9.1)
1. **« Joue la case que je montre »** *(fort, faible)* — **phase 4** — l'inverse du trou : la tablature affiche une case (pastille allumée), l'élève la joue, l'app valide. C'est le pont manquant entre *lire un chiffre* et *poser un doigt* : le trou suppose déjà que la main sait où aller. Réutilise `matchPitch` avec une seule cible ; un mode de plus dans l'écran d'entraînement.
2. **Diagnostic de note morte** *(fort, moyen)* — **phase 4** — quand une note est **15 à 40 cents bas** *et* de niveau faible, dire « la corde ne sonne pas : appuie juste derrière la frette », au lieu de « accorde-toi ». Le niveau (`rmsDb`) est déjà là ; la règle est simple ; c'est la correction n°1 du débutant.
3. **Affichage live sur la position (niveau 1)** *(fort, moyen)* — **phase 7** (tirable dans la 4 si le coût est faible) — en Découverte, la note détectée allume la pastille correspondante **de la position affichée** : l'élève joue la gamme en suivant la tablature et voit ce qu'il a réellement sonné. C'est le « retour de l'entrée audio sur la tab » du brief, dans sa forme la plus utile (et le seul moyen d'apprendre une position à l'oreille et à l'œil en même temps).
4. **Accordage guidé corde par corde** *(moyen, faible)* — **phase 4** — l'accordeur propose les six cordes dans l'ordre, valide chacune, et affiche « corde 6 juste → passe à la 5 ». Un rituel de 60 s avant chaque séance ; l'app peut alors rappeler « dernière mesure d'accordage : 3 jours » avant un exercice au micro.
5. **Indicateur d'avance/retard sur la grille** *(moyen, faible)* — **phase 5** — on connaît l'instant de chaque attaque : afficher « tu joues 40 ms avant le clic, en moyenne » pendant l'exercice. C'est la différence entre *jouer avec* un métronome et *jouer à côté* — la leçon rythmique la plus utile qu'on puisse tirer du micro avant la phase 5.

**Pourquoi ces phases-là** : P1 et P4 sont les deux conditions de justesse de la validation audio du module Accords (viser une case, partir d'une guitare accordée), P2 corrige un contresens (une note morte n'est pas un problème d'accord), P3 partage la surcouche de tablature de l'improvisation, P5 appartient au timing. Le détail du rattachement est dans `PROJECT.md` §9.1.

**Reste en attente des phases précédentes** : vue manche optionnelle (contraire au brief tel qu'écrit, toujours pas d'accord explicite), relecture des doigtés position par position, ear training sur la note caractéristique, page « Progression ».


---

## 15. Bilan de la phase 4a — avis de prof et propositions

### 15.1 Ce qui marche vraiment
- **Les doigtés existent enfin — et ils sont relus.** C'était la dette la plus gênante du projet : la rangée « doigté » était vide depuis la 1b, donc « un doigt à la fois » n'était qu'une intention. Quarante-quatre formes sont saisies, et une règle mécanique attrape les fautes qu'un œil pressé laisse passer : un doigt sur deux cases, un doigt sur une corde à vide, un barré dont une corde échappe à l'index, une forme commencée par l'annulaire. Le test ne prouve pas que le doigté est **le meilleur** — il prouve qu'il est **possible et cohérent**. C'est exactement ce qu'un test peut affirmer.
- **La boîte d'accord gagne sa place.** Je la recommandais (D1 = B) avec la crainte d'ajouter un second langage à lire. Elle n'en ajoute pas : mêmes couleurs de fonction, mêmes noms de cordes, même vocabulaire. Elle apporte ce que la tab ne sait pas dire — la **géométrie** : deux doigts voisins, un écart, un index à plat. Et le fait qu'elle se remplisse doigt par doigt en fait un support de construction, pas une illustration.
- **L'arpège dans l'ordre grave → aiguë est la bonne décision technique et pédagogique.** Elle règle d'un coup le problème posé en phase 3 (« le micro donne une hauteur, jamais une corde ») : la hauteur attendue est connue à chaque instant, donc valider la note *est* valider la corde. C'est aussi l'ordre dans lequel on vérifie un accord à l'oreille.
- **Trois vérifications sur deux jours, dans le même journal que les gammes.** Aucun code de progression parallèle : mêmes tentatives, même Leitner, mêmes cartes. La seule différence est un seuil (3 au lieu de 2) — et c'est justifié : un accord est un geste, une gamme est une lecture.
- **Le plaqué ne triche pas.** Le mode « sans micro » écrit `correct: null` : une auto-évaluation ne peut pas devenir une preuve, même par accident. C'est le genre de trou qui rend une app malhonnête sans que personne ne s'en aperçoive ; il a été trouvé et fermé.
- **La recommandation dit pourquoi**, et **rien n'est verrouillé** : le plus mauvais message d'une app d'apprentissage, c'est « tu n'as pas le droit ». Ici un accord commencé n'est jamais réaffiché comme verrouillé, et un prérequis manquant est nommé.

### 15.2 Ce qui reste faible (à dire franchement)
- **Le cycle est incomplet, et c'est le cœur du module.** Découvrir, Construire, Vérifier : un élève peut former un accord, mais **pas l'enchaîner**. Or la musique commence au changement d'accord. En l'état, le module apprend une **forme**, pas encore une **chanson**.
- **Le plaqué n'est pas écouté.** Six cordes ensemble, c'est précisément ce qu'un guitariste appelle « jouer l'accord ». L'étape 4 est donc une déclaration — honnête, mais ce n'est pas de la validation.
- **« Appris » est plus faible que ce que j'avais annoncé** (§4.6) : il manque la pose à froid chronométrée. Un élève peut valider trois arpèges lents et ne pas savoir placer l'accord en trois secondes.
- **Le mode arpège est une marche haute pour un vrai débutant** : il faut une guitare accordée, six cordes qu'on ne touche pas par erreur, et pincer proprement la corde grave. L'app diagnostique bien (corde étouffée, doigt trop loin de la frette, guitare désaccordée), mais elle demande beaucoup avant de donner un premier « c'est bon ». C'est le prix de la rigueur ; il faudra une porte de sortie (déclaration) **toujours visible**, ce qui est le cas.
- **Une corde étouffée ne se distingue pas d'une corde non pincée** : l'app dit « rien n'a sonné », ce qui est vrai et utile, sans trancher la cause.
- **Le détecteur reste fragile sur les signaux faibles** : un échantillon atténué et abaissé de 28 cents a été lu **+187 cents**. Le verdict devient alors `outside`, qui n'est pas compté comme une erreur — le comportement est sauf, mais je ne peux pas prétendre que la règle « note morte » a été démontrée sur un vrai signal. C'est le premier point à revoir avec une guitare dans les mains.
- **Rien d'écouté, rien de joué** : pas de vraie guitare, pas de vrai micro, pas de vrai téléphone. Les 6/6 au micro simulé prouvent la chaîne, pas l'expérience.

### 15.2 bis Revue de la vue accord (après ton signalement)
La première version était **inutilisable sur téléphone**, et ce n'était pas un détail esthétique :
- **l'en-tête se superposait** au sous-titre et au tag (quatre blocs dans une grille à trois colonnes) — le nom de l'accord se lisait mal ;
- le **sélecteur d'étapes passait à la ligne** et repoussait « Construire » **sous la barre de navigation** : l'action principale était invisible et non cliquable au premier écran ;
- la **boîte d'accord** vivait un écran plus bas, dans un panneau séparé, alors qu'elle est la raison d'être de l'étape « Découvrir » ;
- la tablature affichait **plaqué + arpégé** dans un même score de **657 px** de haut, coupé à droite sur téléphone.

Ce qui a changé : étapes en **une rangée de quatre boutons** (numéro + libellé, 46 px de haut), boîte **dans le même panneau** que les notes et à **S = 2** (chiffres de 14 px CSS — la même taille que dans la tablature : grossir la boîte n'ajoutait pas d'information, seulement des pixels), une seule zone d'écoute (plaqué / arpégé / construire), tablature **plaquée seule** en retour à la ligne. La page passe de **1 970 px à 1 311 px** sur téléphone, et l'action principale est **au-dessus** de la barre.

**[AVIS PROF]** — la leçon sur laquelle on tombe décide si l'élève reste. Un écran où le bouton « continuer » est sous la barre de navigation, c'est un abandon au premier contact ; et une boîte d'accord reléguée un écran plus bas, c'est la meilleure idée de la phase rendue invisible. Le contenu était bon, la mise en page le annulait : c'est exactement le genre de défaut qu'aucun test unitaire ne voit, et que seule une capture à la taille réelle révèle.

### 15.3 Propositions pédagogiques (impact ÷ effort décroissant)
1. **Le rappel à froid chronométré (Fixer)** — *fort, moyen* — **4b**. L'accord est demandé sans aide, 8 s → 5 s → 3 s, un autre jour. Sans lui, « appris » reste une demi-promesse. C'est la proposition qui a le meilleur rapport valeur/effort du module, et elle ne demande aucune technique nouvelle : un chrono et l'écran déjà écrit.
2. **Enchaîner deux accords, chronomètre en main** — *fort, moyen* — **4b** (mesure fiable en 5). « Em → Am, quatre temps chacun, à 60 BPM » : c'est la compétence musicale réelle, et c'est ce que les débutants ratent (pas la forme, le changement). Le modèle de nœuds `acc:transition:{a}>{b}` est déjà prévu ; `progressionToScore` existe depuis la 1b.
3. **Voir les cordes à vide et étouffées dès le premier geste** — *moyen, très faible* — **fait dans la 4a** (corrigé après capture) : à l'étape Construire, seuls les doigts manquants sont masqués. Un débutant qui ne voit pas le X de la 6e corde gratte les six et croit que « ça sonne ». C'est un détail d'affichage qui change une leçon.
4. **Dire quelle corde est la plus souvent étouffée, par accord** — *moyen, faible* — **reporté en phase 5** (proposition **Q1** du §16.3) : les `missedStrings` sont déjà journalisés par tentative d'arpège, mais l'affichage utile (« sur Am, c'est souvent la corde de Sol ») prend sa vraie valeur avec le diagnostic polyphonique, qui sait *pourquoi* la corde ne sonne pas. Non livré en 4b, et dit tel quel.
5. **QCM « quel accord est-ce ? » et « quelles notes le composent ? »** — *moyen, faible* — **✔ fait en 4b** (`#/accords/qcm`) : trois types (tablature anonyme, notes, case masquée), distracteurs pris dans les confusions réelles (Am vs C, Em vs E, D vs Dsus2), nœud `acc:savoir:*` distinct du nœud de la forme. L'extension « à l'oreille » reste à faire (proposition **Q2**, §16.3).

**Ce que je ne recommande pas** : ajouter les paliers P5-P10 avant que le cycle des sept étapes soit complet. *(Depuis la 4b, le cycle est complet : P5-P7 sont livrés, P8-P10 attendent des doigtés saisis — la réserve porte désormais sur la **validation**, pas sur la largeur : voir §16.3.)* Empiler des accords qu'on ne sait ni enchaîner ni placer à froid donnerait l'illusion d'un curriculum large ; c'est la profondeur qui manque, pas la largeur.

---

## 16. Bilan de la phase 4b — avis de prof et propositions

### 16.1 Ce qui marche vraiment
- **Le cycle est complet, et il se voit.** Sept étapes sur l'écran, pas seulement dans un document. La 4a s'arrêtait sur « Plaquer » en laissant croire que le cycle était fini ; ici, l'élève peut **poser à froid**, **enchaîner** et **jouer une progression** le même soir.
- **« Appris » veut enfin dire quelque chose.** Trois arpèges lents ne suffisent plus : il faut une pose chronométrée, propre, un autre jour (ou dix minutes plus tard). C'est la correction la plus importante de la phase — elle rend le mot honnête, et elle coûte un chrono et l'écran déjà écrit.
- **Le temps de changement est mesuré, pas estimé.** L'idée qui débloque tout : horodater une **note repère** par accord avec la **même horloge**, donc la latence s'annule dans la différence. Au micro simulé, la médiane mesurée (1 749 ms) est exactement l'espacement du fichier — la mesure est juste, pas seulement plausible.
- **Le cas « même basse » a été trouvé en jouant, pas en réfléchissant.** Em → Em7 ne bouge pas la corde grave : une mesure naïve aurait compté des notes tenues comme des changements. Le repère est devenu « la première corde qui diffère ». C'est le genre de défaut qu'aucun test unitaire n'aurait signalé, parce qu'il fallait **jouer** l'exercice.
- **Les libellés se lisent enfin.** Les sept étapes et les quatre onglets étaient en Silkscreen capitales à 9,5 px : accents perdus, « ACCORDEUR » tronqué, et « 02 » qui se lisait « 0 2 ». Passés en sans-serif (13 px pour les étapes, 11,5 px pour les onglets), contraste mesuré ≥ 5,5:1, aucune troncature. La police pixel garde son rôle — le décor, la tablature, le mot-symbole —, pas celui de porter un mot qu'il faut comprendre.
- **Le QCM est honnête sur ce qu'il est.** Un nœud de **savoir**, distinct du nœud de la forme : on peut savoir lire un accord sans savoir le jouer, et l'app ne mélange plus les deux. Les distracteurs sont les confusions réelles (Em/E, Am/C, D/Dsus2) — une question se joue sur une tierce, pas sur un nom au hasard.
- **L'accordage guidé ferme la boucle ouverte en phase 3.** Une guitare à −20 cents faisait échouer des notes justes ; l'accordeur existait, l'enchaînement non. Six cordes dans l'ordre, ±5 cents, et un rappel quand le dernier accordage date.

### 16.2 Ce qui reste faible (à dire franchement)
- **Le plaqué n'est toujours pas écouté.** C'est la limite qui structure tout le module : l'étape 4 et l'étape 7 sont des **déclarations**. Un élève peut jouer faux et l'app le croit. Le journal garde le statut « non vérifié », mais la promesse du brief (« validation du strum ») attend la phase 5.
- **L'enchaînement ne juge qu'une note.** On mesure l'arrivée de la main, pas la propreté des six cordes : une corde étouffée passe inaperçue. C'est pour cela que la transition ne rend jamais un accord « appris » — la règle est juste, mais elle laisse un trou pédagogique réel.
- **Les seuils sont des seuils de prof.** 8/5/3 s, 2 s « propre », 20 changements/minute, ±5 cents : rien n'est calibré sur un vrai débutant. Le plus discutable est le passage de 8 à 5 s après **une seule** réussite.
- **Le QCM n'entend rien et ne teste pas la main.** Il travaille la lecture ; un élève peut le réussir à 100 % sans savoir poser un accord. C'est complémentaire, pas équivalent — et l'écran ne le prétend pas.
- **Le mode sans matériel est enterré.** Il vit dans le module Accords (`#/accords/qcm`), pas dans le hub : l'élève qui n'a pas sa guitare aujourd'hui ne le trouvera pas tout seul.
- **Rien d'écouté, rien de joué** : pas de vraie guitare, pas de vrai micro, pas de vrai téléphone. Le micro simulé prouve la chaîne, pas l'expérience.

### 16.3 Propositions pédagogiques (impact ÷ effort décroissant) — placées
| # | Proposition | Impact/effort | Phase | Pourquoi |
|---|---|---|---|---|
| **Q1** | **Diagnostic « quelle corde ne sonne pas » par accord** — « sur Am, c'est souvent la corde de Sol », agrégé depuis les `missedStrings` déjà journalisés | fort / **très faible** | **fin de la 5** (donnée prête, écran à faire) | C'est la phrase qu'un prof dit au bout de trois cours. Depuis la phase 5 la donnée est **complète** : `missedStrings` est journalisé par l'arpège **et** par le plaqué écouté (`pluck`). Rien ne bloque plus, il ne manque que l'écran. |
| **Q2** | **QCM d'oreille** — les trois mêmes types, mais **entendus** (plaqué ou arpégé) au lieu d'être lus | fort / moyen | **6** (le moteur est prêt) | Le pont manquant entre *lire* et *entendre*. La phase 5 a fourni les deux briques : `scoreHypothesis` pour comparer des accords voisins, et le rendu `chordToScore` pour **jouer** la question. Le QCM existant (`quiz.ts`) n'a qu'à changer de source : entendue au lieu de lue. |
| **Q3** | **Pose à froid en aveugle partiel** — une fois sur trois, l'accord est **nommé** sans tablature ni boîte | moyen / **très faible** | 6 | Aujourd'hui la forme reste affichée : on mesure la vitesse de pose, pas le rappel de la forme. Un tirage déterministe suffit. |
| **Q4** | **Carnet de transitions** — « ton meilleur enchaînement : Em→Am en 1,4 s », et la paire suivante proposée par **progression mesurée** | moyen / faible | 6 (avec le Défi) | Le `changeMs` est journalisé mais personne ne le lit : le rendre visible transforme une mesure en objectif. |
| **Q5** | **Métronome dans l'enchaînement** — mesurer le changement **contre le clic** et non seulement entre deux repères | fort / moyen | **fin de la 5** | C'est le vrai critère musical (« ton changement tombe-t-il sur le temps ? »). L'onset est mesuré depuis la phase 5 (`onsetMs` dans `poly.ts`), il reste à le rapporter à la grille du métronome — donc de l'affichage, plus de l'analyse. |

| **Q6** | **La confiance expliquée, pas seulement affichée** — une ligne sous les six barres : « la barre dit *ce que j'entends*, pas *ce que tu vaux* » | moyen / **très faible** | **fin de la 5** | Mesuré : un accord à 5 cordes sur 6 affiche **31 %** de confiance globale, parce qu'elle suit la corde la plus faible — c'est juste pour juger un accord, mais un élève lit « 31 % » comme « j'ai tout raté ». Le chiffre est bon, la phrase qui l'accompagne manque. |
| **Q7** | **Le plaqué comme test de sortie de palier** — « appris » exigerait aussi **un plaqué écouté à ≥ 80 %** ; il remplacerait un des trois arpèges, sans rallonger le parcours | fort / moyen | **6**, et **après** la validation sur instrument réel | Ferme la boucle « je sais le poser *et* le faire sonner en entier ». À ne pas livrer avant d'avoir mesuré les confiances sur une vraie guitare : durcir un seuil sur des chiffres de synthèse, c'est bloquer des élèves sur un plafond optimiste. |

**Ce que je ne recommande toujours pas** : élargir encore le curriculum (P8-P10) avant que le plaqué soit écouté. Trente-cinq accords qu'on ne sait ni enchaîner proprement ni vérifier en plaqué, c'est de la largeur ; ce qui manque désormais, c'est la **profondeur de la validation**.

---

## 17. Ce que la récompense a le droit d'afficher (branche `ui/simplification`)

Trois surfaces de récompense existent désormais : le **panneau de réussite** en fin de série (§16, D58), le bloc des **dix derniers accomplissements** sur l'accueil (D59) et les **paliers de jours** (3 / 7 / 14 / 30). Elles répondent toutes aux mêmes règles, qui sont pédagogiques avant d'être techniques.

### 17.1 On ne félicite que ce qui est vérifié
- Une **écoute** ne produit jamais d'accomplissement, ne rapporte pas d'XP et ne compte ni pour l'objectif du jour ni pour la série : elle n'est pas vérifiée (§7.4, D22, D81).
- Une **déclaration** (« je l'ai plaqué ») ne compte ni comme accomplissement, ni pour l'objectif du jour, ni pour la série (D81).
- Un **QCM** produit un savoir (`acc:savoir:*`), pas un geste : il n'apparaît pas comme « forme apprise ».
- Le seuil de la fête est celui de la maîtrise : **80 %** de trous justes au premier essai. En dessous, l'écran de résultat dit la vérité sans animation — féliciter un 60 % apprendrait à viser le bouton « terminer » plutôt que la justesse.

### 17.2 Le chiffre affiché est recalculé, jamais incrémenté
Le panneau et le bloc lisent `fretwave.attempts.v1` et recalculent **XP total**, **XP du jour** (plafonné à 120), **série** et **état de maîtrise** avec les mêmes fonctions que le hub. Aucun compteur parallèle, donc aucun risque qu'un chiffre affiché contredise le journal — et un import de journal fait réapparaître les accomplissements correspondants sans les dupliquer.

### 17.3 Un franchissement s'annonce une fois
La tentative qui fait passer une forme à « apprise » ou « maîtrisée » ne produit **pas** en plus une ligne « passage réussi » (D80 : « série » est réservé aux jours d'affilée) : le palier est la nouvelle, la série est ce qui l'a causée. De même, « 1 jour d'affilée » ne s'affiche pas (la série commence à deux) et les paliers de jours ne se répètent pas.

### 17.4 Ce que la récompense ne mesure pas
Elle ne dit rien du **timing** (le micro valide une hauteur, pas un placement), rien du **doigté**, rien de la **qualité du son** (un accord sale peut passer une série de trous). Le panneau le rappelle d'une ligne : « la tentative déplace la forme dans la file de révision, elle ne la certifie pas ». C'est la limite assumée de la phase 3-4, et elle s'écrit là où l'élève lit ses étoiles.

### 17.5 Une ambiance ne change pas ce qui s'apprend
Le thème clair (« Aube », D60) change le décor et l'encre, **jamais les couleurs d'intervalle** : la tonique reste jaune, la tierce mineure rose, la quinte verte, la ♭5 assombrie avec son encoche. C'est une règle d'apprentissage, pas d'esthétique : un élève qui change d'ambiance le soir doit retrouver le même code le lendemain, sinon la couleur cesse d'être un repère et redevient une décoration. Le seul élément qui suit l'ambiance dans la tablature est le **panneau** (papier ou nuit) et l'encre qui s'y pose ; le chiffre dans la pastille garde son contraste calculé (`digitColorFor`).

---

## 18. Bilan de la refonte de navigation — avis de prof et propositions

Branche `ui/simplification`, décisions D52 à D62. Aucune règle musicale n'a changé : ce bilan porte sur **ce que l'élève voit et comprend**, pas sur ce qu'il apprend.

### 18.1 Ce qui marche vraiment
- **Le chemin vers l'exercice existe enfin.** « Découvrir » puis « S'exercer » sur la même ligne, à côté de la position concernée : plus besoin de traverser quatre panneaux pour jouer une note. C'était la plainte d'origine (« je ne sais même pas où aller »), et elle était juste.
- **La reconnaissance du repère visuel.** Le halo des notes caractéristiques existait depuis la phase 2 ; personne ne savait ce qu'il voulait dire. Une bande sous la portée, avec la pastille réelle et son anneau, a transformé un mystère en information — sans document, sans tutoriel.
- **« Apprise » et « maîtrisée » ne sont plus des mots en l'air.** Les accomplissements les datent, les expliquent (« 2 réussites sur 2 jours ») et les rendent relisibles ; le panneau de réussite ne s'ouvre qu'au seuil de 80 %. La récompense est devenue une conséquence vérifiable, pas un décor.
- **L'ambiance claire n'a rien changé à ce qui s'apprend.** Les couleurs d'intervalle sont identiques dans les deux thèmes ; seul le papier change. C'est ce qui permet de changer d'ambiance le soir sans perdre ses repères le lendemain.
- **Le texte a été relu depuis l'écran, pas depuis le code.** Une vingtaine de formulations corrigées : plus de « Box », plus de « phase 5 », plus de « hub » — un débutant n'a plus à traduire le vocabulaire du développeur.

### 18.2 Ce qui reste fragile
- **Les deux modules ne se parlent pas.** Un élève qui apprend La mineur pentatonique en gammes et Mi mineur en accords travaille deux choses qui ne se rencontrent jamais à l'écran : aucune passerelle « joue cet accord comme note de la gamme ».
- **L'écran de découverte reste le plus dense de l'app** : sept réglages d'affichage cohabitent avec le sujet (la position). Les plus utiles (annotation, nombre de cordes) devraient être les seuls visibles.
- **La réussite mesure la lecture, pas le jeu.** Une série de trous validée au micro prouve que les hauteurs sont justes, jamais que le rythme ou le doigté le sont. Les ★ ne doivent pas être lus comme « je sais jouer cette position ».
- **Rien n'a été vérifié sur une vraie guitare.** Tout ce bilan repose sur un micro simulé et un journal de synthèse.

### 18.3 Propositions (par ordre de valeur)
| # | Proposition | Impact / coût | Phase | Pourquoi |
|---|---|---|---|---|
| **R1** | **Une seule position « en cours »** — l'accueil et la liste mettent en avant la prochaine, les autres en lignes compactes | fort / faible | avant 5 | Le journal sait déjà quelles formes sont travaillées : afficher cinq positions de même poids laisse l'élève choisir au hasard. |
| **R2** | **Écouter avant de jouer** — bouton « modèle » qui joue la position lentement, puis lance l'exercice (call & response) | fort / moyen | avant 5 | Aujourd'hui l'élève comble des trous sans référence sonore : il déduit, il n'entend pas. |
| **R3** | **Verdict par note, pas par série** — « juste / trop haut / corde voisine » à l'instant, au lieu d'un score à la fin | fort / moyen | 5 | Le micro sait déjà quelle note a sonné ; c'est ce qui apprend l'oreille, pas le total. |
| **R4** | **Fluidité chronométrée sur une position** — comme la pose à froid des accords (8 s → 5 s → 3 s) | moyen / faible | avant 5 | Le barème existe pour les accords (D45) ; rien d'équivalent pour une gamme tenue d'affilée. |
| **R5** | **Transposer pour prouver** — même forme deux cases plus haut, une fois la position tenue | moyen / faible | avant 5 | C'est le test qui distingue « j'ai mémorisé un dessin » de « je connais la gamme ». Le journal conserve déjà les toniques travaillées par forme (`NodeStats.tonics`) : la cible se calcule. |

« avant 5 » = travail d'interface à faire entre la 4b et la phase 5 (§9) — **fait** : la refonte d'interface est terminée et mergée sur `master` (D54-D66 de `PROJECT.md`), il ne reste rien d'interface en attente avant la phase 5.

**Ce que je ne recommande pas** : ajouter un troisième module (oreille, rythme) avant que gammes et accords se rejoignent. La refonte a montré que le problème n'était pas le nombre d'écrans mais le nombre de décisions à prendre par écran — un module de plus, même bien fait, le recréerait.
