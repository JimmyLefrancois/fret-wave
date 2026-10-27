# MUSIC_DESIGN.md — choix musicaux et pédagogiques

Statut : **phase 0 validée ; phase 1a (théorie + voicings) commitée ; phase 1b (positions, écriture de la tablature, rythme, couleurs) terminée, tests verts, non commitée**. Ce document fixe les conventions et le plan pédagogique ; il est mis à jour à chaque phase. Nouveautés de la 1b : §2.1, §3.7, §4.3 (barrés), §10.
Auteur du raisonnement : rôle « dev + prof de guitare » du BRIEF.md. Les avis de prof sont marqués **[AVIS PROF]**, les hypothèses **[HYP]**, les points à trancher par toi **[À TRANCHER]**.

Ce qui a été **vérifié par calcul** en phase 0 (script jetable, hors dépôt) : les 43 formes d'accord de la section 4.3 (notes réellement produites en accordage standard = notes de l'accord, basse correcte, orthographe correcte) et les 10 formes mobiles (barrés Mi/La × 5 qualités) sur 13 positions de fondamentale (cases 0 à 12) : **0 erreur**. Tout le reste est du raisonnement non exécuté.

---

## 1. Conventions théoriques

### 1.1 Hauteurs et octaves
- Le modèle interne manipule des **hauteurs réelles (son)**. MIDI 60 = C4 (convention `tonal`). La = 440 Hz par défaut (réglable ; l'accordeur et la détection doivent lire ce réglage).
- Accordage standard, **son réel** : E2 (82,41 Hz) · A2 (110,00) · D3 (146,83) · G3 (196,00) · B3 (246,94) · E4 (329,63). La guitare s'écrit une octave au-dessus mais la tab n'écrit pas d'octave : le modèle n'utilise jamais la hauteur écrite.
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
- Note caractéristique d'un mode (dorien : 6 ; phrygien : ♭2 ; lydien : ♯4 ; mixolydien : ♭7 ; éolien : ♭6 ; locrien : ♭2 et ♭5 ; blues mineur : ♭5 ; blues majeur : ♭3) : anneau lumineux qui pulse sur 4 images (≈ 5 Hz), fixe en mode « réduire les animations ». Ionien : aucune ; le ♭6 de l'éolien se lit « par contraste avec le dorien » (§1.4).

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
- CAGED n'est calculé que si les 6 cordes aiguës sont en standard (Mi La Ré Sol Si mi) : 7 et 8 cordes standard : oui (la corde grave supplémentaire est incluse dans la fenêtre) ; Drop D, DADGAD, Open G… : **refusé, avec la raison affichable**.
- **`formIndex`** : identité de la forme indépendante du mode — rang de départ dans la gamme **parente** : la position 2 de Ré dorien (départ Mi) a le même `formIndex` et les mêmes cases que la position 3 de Do majeur. C'est la clé des nœuds « forme » de §3.1.
- **Numéro d'une position** = rang du degré de départ : « Position 1 » = la tonique sur la corde grave, quel que soit l'endroit du manche. Un même numéro désigne donc la même *forme* dans toutes les tonalités ; pour savoir *où*, on lit « cases a–b ».

---

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
Les doigtés par corde ne sont **pas** figés ici : ils seront saisis dans la base en phase 4 et relus (plusieurs doigtés conventionnels existent, par ex. G 2-1-3 ou 3-2-4). Aucune erreur de transcription tolérée : chaque ligne ci-dessous a été vérifiée par calcul.

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

### 4.7 Les 3 axes de maîtrise
| Axe | Unité de suivi | Mesure |
|---|---|---|
| **Forme** | accord (voicing) | arpèges vérifiés, diagnostic par corde, rappel à froid |
| **Transition** | paire ordonnée A→B | **changements propres par minute** (exercice classique ; objectifs : 20 = correct, 30-40 = fluide sur les premières paires) ou temps de changement mesuré à l'onset |
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

**Identifiants de nœuds** : `gam:lecture:{système}:{forme}:{mode}`, `gam:forme:{système}:{index}`, `acc:accord:{voicingId}`, `acc:transition:{voicingA}>{voicingB}`. Les gammes symétriques utilisent la clé canonique de la collection.
**États** : verrouillée → disponible → en apprentissage → apprise → maîtrisée (dérivés des axes par le module).
**Planificateur** : [HYP] **Leitner à 6 boîtes** (10 min le même jour, 1 j, 3 j, 7 j, 16 j, 35 j), avec :
- réussite nette → boîte +1 ; réussite lente/avec aide → même boîte ; échec → retour boîte 1 (ou −2) ;
- gigue ±15 % pour éviter l'effet « tout le même jour » ;
- **plafond de dû par session** (≈ 8 éléments) pour qu'une absence ne crée pas de « dette de révision » démotivante.
Derrière une interface `Scheduler` pour pouvoir passer à FSRS (MIT, `ts-fsrs`) si les données le justifient : **SM-2 est un compromis historique** ; pour quelques centaines d'éléments et des gestes moteurs, un Leitner honnête suffit.
**Journal** : chaque tentative est un événement horodaté (jamais seulement des agrégats) ; les agrégats se recalculent → on peut changer d'algorithme sans perdre l'historique.

---

## 6. Validation audio : ce qui est réaliste (vue du prof)

| Mode | Fiabilité attendue | Usage |
|---|---|---|
| **Note isolée / arpège corde par corde** (mono, McLeod) | **Bonne** sur interface USB ; **moyenne** sur micro de téléphone pour les 2 cordes graves (peu d'énergie < 100 Hz → octave fausse possible) | référence pour **apprendre** et valider « appris » |
| **Plaqué (strum)**, accord *attendu* | **Approximative** : bon pour « c'est plausible / manifestement faux » ; **mauvais** pour un verdict par corde | XP et confort, jamais de verrou |
| Reconnaissance d'un accord *inconnu* | **Hors périmètre** | non promise |

Cas qui resteront **ambigus** (à documenter dans l'UI et ici) :
- **Em vs E** : la 5e harmonique de la corde de Mi grave (82,41 × 5 = 412,0 Hz) tombe à **−14 cents du Sol♯4 (415,3 Hz)** et à +86 cents du Sol4 : un Mi grave bien joué « injecte » un faux Sol♯ ; il faut **soustraire les harmoniques de la basse** avant de juger la tierce.
- **D / Dsus2 / Dsus4** : un seul fa♯/mi/sol sur la corde aiguë. La 3e harmonique d'un La grave résiduel (110 × 3 = 330 Hz ≈ Mi4 à +2 cents) fait apparaître un **faux Dsus2** si la corde de La vibre par sympathie.
- **Am vs C**, **Em vs G**, accords ouverts qui laissent sonner des cordes à vide non voulues : on ne peut pas détecter « l'absence » d'une corde étouffée de façon fiable en strum.
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

