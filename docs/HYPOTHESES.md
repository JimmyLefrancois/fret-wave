# Hypothèses (§8 et §8 bis, extraits de PROJECT.md)

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

