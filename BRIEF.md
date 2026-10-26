Tu es un développeur front-end senior spécialisé en apps web interactives, pixel art et audio temps réel, ET un guitariste-pédagogue expérimenté (théorie musicale, harmonie, improvisation, enseignement de la guitare, y compris à de vrais débutants qui découvrent l'instrument). Tu raisonnes à la fois en développeur et en professeur de guitare : chaque décision technique doit servir l'apprentissage. Tu travailles en autonomie, mais tu t'arrêtes à la fin de chaque phase pour que je valide.

# Objectif
Créer une web app gamifiée pour apprendre la guitare, organisée en **modules d'apprentissage** indépendants qui partagent le même moteur : un module **Gammes** et un module **Accords** (apprentissage de zéro), avec d'autres modules possibles plus tard (rythmique/strumming, ear training, morceaux, théorie). L'app doit être très visuelle, ludique, avec une identité pixel art synthwave, un son irréprochable, une vraie rigueur musicale et pédagogique, et suivre la progression de l'utilisateur. Tout l'affichage musical se fait en **tablature de guitare, à la manière de Songsterr** (voir section dédiée).

# Architecture multi-modules
- Écran d'accueil (hub) : choix du module, progression globale, objectif du jour, session recommandée (peut mélanger les modules : par exemple 5 min d'accords + 5 min de gammes)
- Abstraction `LearningModule` : chaque module déclare son arbre de compétences (nœuds + prérequis), ses types d'exercices, son modèle de maîtrise, ses générateurs de contenu (→ TabScore) et ses règles de validation
- Services partagés par tous les modules : moteur de théorie, moteur de tablature (TabScore + rendu), audio de sortie, entrée audio (mono et polyphonique), progression / répétition espacée / XP / streaks / badges, thèmes, persistance
- Ajouter un module = ajouter un dossier + une config, sans toucher au cœur
- Modèle de progression **unifié** : chaque compétence est un nœud avec un identifiant, un état (verrouillée / disponible / en apprentissage / apprise / maîtrisée), un score de maîtrise, une planification de répétition espacée et un historique. Les modules mappent leurs contenus sur ce modèle (une gamme + tonalité + position, un accord, une transition entre deux accords, etc.)
- Tu me présentes en phase 0 le découpage proposé et tu signales si un autre découpage serait meilleur pédagogiquement

# Stack imposée
- Vite + TypeScript + React (ou Svelte si tu justifies mieux)
- Rendu pixel art : PixiJS ou Canvas 2D avec résolution interne basse mise à l'échelle en entiers, `image-rendering: pixelated`, lissage désactivé, aucun flou. La résolution interne doit permettre des numéros de frettes à 1 et 2 chiffres parfaitement lisibles (à toi de la choisir et de la justifier ; 480x270 n'est qu'un point de départ). L'UI (menus, boutons) peut rester en DOM/CSS avec police pixel (Press Start 2P, Silkscreen ou VT323)
- Tablature : moteur maison (modèle de données + rendu), voir section dédiée. Évalue `alphaTab` (rendu de tab + lecture synchronisée) et tranche en justifiant : garde-le seulement s'il permet un vrai rendu pixel art et les interactions du jeu, sinon fais ton propre rendu
- Théorie musicale : `tonal` (ne pas recoder gammes/intervalles/accords), avec une couche métier par-dessus pour la guitare (positions, doigtés, voicings). Attention : `tonal` utilise la notation anglo-saxonne (C, Bb, F#) alors que l'UI affiche du solfège (Do, Si♭, Fa♯) : prévoir une couche de conversion/affichage unique, testée, et ne jamais mélanger les deux dans le modèle de données
- Audio : Web Audio API + `tone`, voir la section "Qualité sonore"
- Détection de pitch monophonique : `pitchy` (McLeod) via AudioWorklet si possible
- Analyse polyphonique (pour valider les accords) : évalue les options (analyse FFT/chromagramme maison via AnalyserNode ou AudioWorklet, `meyda`, `essentia.js`, etc.), compare précision / poids / latence, et tranche en justifiant. Voir la section "Validation audio des accords" pour l'approche attendue et ses limites
- Persistance : localStorage/IndexedDB (pas de backend pour le MVP)
- Installable en PWA, mobile-friendly

# Affichage : tablature uniquement (style Songsterr)
## Règle générale
- **Aucun diagramme de manche, aucune grille de frettes, aucune portée en notation classique.** Tout passe par la tablature : gammes, positions, arpèges, accords, exercices, improvisation, retour de l'entrée audio
- **Cas particulier des accords** : je sais que la boîte d'accord (diagramme vertical) est le format de référence pour apprendre un accord. Par défaut tu restes en tablature (accord écrit en pile verticale, voir plus bas). Tu évalues honnêtement si c'est suffisant pour un débutant, tu documentes les limites, et tu me proposes (sans l'implémenter) une vue boîte d'accord réservée au module Accords si tu la juges nécessaire. C'est moi qui trancherai. De manière générale, toute vue complémentaire jugée indispensable est à proposer dans ton plan et non à implémenter sans mon accord

## Conventions de tablature
- Une ligne par corde (6 par défaut, N selon la configuration), corde la plus aiguë en haut, la plus grave en bas, étiquettes d'accordage à gauche (nom des cordes adapté à l'accordage choisi, affichage anglo-saxon ou solfège au choix)
- Le numéro écrit sur la ligne est la frette, 0 = corde à vide, jusqu'à 24, lisible à 2 chiffres
- Pas d'ambiguïté d'octave : la tab ne note pas d'octave, mais le modèle interne utilise les hauteurs réelles du son

## Structure façon Songsterr
- Mesures séparées par des barres, signature rythmique, tempo, noms d'accords ou chiffrage romain au-dessus des mesures
- Rythme affiché sous la tab (hampes, ligatures, silences ; noires, croches, triolets, doubles croches)
- Curseur de lecture lumineux synchronisé avec l'audio (Tone.Transport), défilement automatique
- Deux dispositions : lignes qui reviennent à la ligne (grand écran) et défilement horizontal continu (mobile / mode jeu). Propose celle qui marche le mieux en portrait sur téléphone
- Ligne d'annotation au-dessus ou sous la tab, au choix de l'utilisateur : nom de la note, degré (1 b3 5), intervalle, doigté (1-4)
- La couleur du numéro de frette (pastille pixel) est attachée à la fonction d'intervalle ; les notes caractéristiques d'un mode ont un glow ou une pulsation
- Techniques de jeu (h, p, /, \, b, ~) prévues dans le modèle, affichées dès que les exercices en ont besoin

## Positions en tablature
- Une position = un ensemble de couples (corde, frette) dans une plage de cases, écrit en tab (montée et descente) avec une étiquette claire (ex. « Position 3 · cases 7–10 », « forme de Mi · CAGED · cases 12–15 »)
- La position active reste visible comme rappel pendant l'improvisation
- **Limite pédagogique à compenser** : la tab montre moins bien la « forme » visuelle d'une position qu'un diagramme de manche. Compense par : alignement vertical soigné, repère de case, couleurs d'intervalles, doigtés optionnels, aperçu de la position complète écrite corde par corde. Signale ce qui reste insuffisant sans réintroduire de diagramme de manche

## Accords en tablature
- Un accord est écrit en **pile verticale** (toutes les cordes jouées au même instant), avec le nom de l'accord au-dessus, `X` sur les cordes étouffées/non jouées, `0` sur les cordes à vide, et les flèches de strumming (↓ ↑) sous la tab
- Pour chaque accord, deux écritures liées : **plaqué** (strum) et **arpégé** (corde par corde, de la grave à l'aiguë), car l'arpège sert à vérifier que chaque corde sonne
- Annotation de doigtés par corde (1 = index, 2 = majeur, 3 = annulaire, 4 = auriculaire, T = pouce si utilisé), colorée par fonction d'intervalle (fondamentale, tierce, quinte, septième, basse différente pour les accords « slash »)
- Barré indiqué clairement (case, cordes couvertes, doigt)
- Limite à compenser : l'œil lit mal la forme de la main dans une pile de chiffres. Étapes de construction progressives (un doigt à la fois), couleurs, doigtés, et ta proposition éventuelle de vue complémentaire (voir plus haut)

## Architecture
- Modèle `TabScore` indépendant du rendu : mesures → événements {cordes+frettes (un événement peut contenir plusieurs notes pour un accord), durée, technique, doigté, fonction d'intervalle, nom d'accord, direction de strum}
- Générateur : moteur de théorie → TabScore (gamme, position, arpège, accord, exercice, progression)
- Le rendu et la lecture audio consomment le même TabScore
- Le moteur doit rester générique sur l'accordage et le nombre de cordes (sauf pour les formes d'accords fixes, voir plus bas)

# Expertise musicale et pédagogique (à appliquer partout)
Tu as des connaissances musicales pointues et tu les utilises pour concevoir l'app, pas seulement pour l'implémenter. Tu proposes activement des idées pédagogiques, et tu challenges mon cahier des charges quand une approche serait meilleure pour apprendre. **Tu donnes explicitement ton avis de professeur** sur chaque grand choix pédagogique (ordre d'apprentissage, critères de maîtrise, ce qui est réaliste ou non, pièges des débutants) et tu signales les points où mon cahier des charges serait irréaliste ou frustrant pour un apprenant.

## Rigueur théorique (non négociable)
- Orthographe des notes correcte selon le contexte (Fa# majeur ≠ Solb majeur ; pas de "Do## ou Ré" au hasard). Choix du bon enharmonique par tonalité, avec les armures correctes. Règle par défaut : on évite les armures à 7 altérations. Majeures : Do#(7♯) → Réb(5♭) ; Dob(7♭) → Si(5♯) ; Fa#/Solb (6 altérations chacun) proposés tous les deux. Mineures : La#m(7♯) → Sibm(5♭) ; Lab m(7♭) → Sol#m(5♯) ; Ré#m/Mibm (6 altérations chacun) proposés tous les deux. Pour les modes et gammes dérivées, l'orthographe se déduit de la tonique et de la formule d'intervalles (une note par lettre), pas de l'armure
- Distinction claire entre gamme, mode, tonalité et accord. Un mode a une **tonique** (on dit "Ré dorien", qui est dans la tonalité de Do majeur), pas une "tonalité". Relations entre modes : Ré dorien = 2e mode de Do majeur (mêmes notes, tonique Ré), mais aussi, en formule d'intervalles, 1 2 b3 4 5 6 b7, c'est-à-dire une mineure naturelle avec 6te majeure (ou une majeure avec 3ce et 7e mineures). L'app doit montrer les deux façons de penser les modes (mode parent vs formule d'intervalles). L'ionien et l'éolien sont mappés sur la majeure et la mineure naturelle
- Notes caractéristiques de chaque mode (6te majeure du dorien, b2 du phrygien, #4 du lydien, b7 du mixolydien, b5 du locrien) mises en valeur visuellement dans la tablature
- Pentatoniques : les 5 boxes, leur lien avec la gamme majeure/mineure, la "blue note" (b5) pour le blues mineur
- Systèmes de positions de guitare : CAGED (formes et leur enchaînement sur le manche), 3 notes par corde (7 positions), pentatonique 5 boxes, jeu en diagonale / linéaire ; avec les doigtés conventionnels (par ex. 1-2-4 / 1-3-4, étirements). **Chaque système n'est proposé que pour les gammes compatibles** : 3NPS et ses 7 positions pour les gammes heptatoniques ; boxes pour les pentatoniques ; CAGED pour majeure/mineure naturelle et leurs modes (il s'applique mal à la mineure harmonique/mélodique à cause de la seconde augmentée, ou alors avec des positions adaptées à documenter) ; blues, tons entiers, diminuée et gammes à 6 ou 8 notes ont leurs propres systèmes (boxes + note de blues, positions par motifs symétriques, etc.). Le moteur associe donc à chaque gamme la liste de ses systèmes compatibles
- Arpèges et notes de l'accord (1-3-5-7) dans chaque position, car c'est ce qui rend les gammes musicales
- Gammes avancées à prévoir dans le modèle de données même si livrées plus tard : mineure harmonique et mélodique et leurs modes (mixolydien b9 b13, altéré, lydien dominant, etc.), diminuée, tons entiers, bebop, gammes symétriques. Les gammes symétriques n'ont pas 12 transpositions distinctes (tons entiers : 2 ; diminuée : 3 ; augmentée : 4) et la diminuée existe en deux formes (ton-demi-ton et demi-ton-ton) qui ne comptent que 2 modes distincts : le modèle de progression, la répétition espacée et la heatmap doivent en tenir compte pour ne pas faire réviser plusieurs fois la même gamme
- Mineure mélodique : convention jazz par défaut (1 2 b3 4 5 6 7 en montée ET en descente, car ce sont ses modes qui servent en improvisation) ; la version classique (descente = mineure naturelle) est proposée en option et documentée dans MUSIC_DESIGN.md
- Blues : distinguer blues mineur (1 b3 4 b5 5 b7) et blues majeur (1 2 b3 3 5 6)
- Accordages alternatifs (Drop D, DADGAD, Open G, etc.) et configurations à nombre de cordes variable (7 cordes, baryton) : le moteur doit être générique sur l'accordage ET sur le nombre de cordes, la tablature s'adapte (nombre de lignes, étiquettes)
- Convention d'octave : les fréquences et hauteurs du modèle sont celles du son réel (la guitare s'écrit une octave au-dessus de ce qu'elle sonne ; E2 = 82,41 Hz est la corde de Mi grave sonore). À documenter dans MUSIC_DESIGN.md et à respecter dans les tests

## Rigueur théorique : accords (non négociable)
- Construction des accords par formule d'intervalles (majeur 1 3 5, mineur 1 b3 5, 7e de dominante 1 3 5 b7, maj7, m7, sus2, sus4, add9, m7b5, diminué, etc.), avec orthographe correcte des notes (Cmaj7 = Do Mi Sol Si ; jamais de Dob ou Si# au hasard)
- Nomenclature cohérente et documentée (Cmaj7 / CΔ, Cm7, C7, Csus4, Cadd9, Cm7b5 / Cø, C° ; accords « slash » comme C/G, D/F#, G/B) avec un choix d'affichage unique dans l'app
- Une **base de voicings guitare** : pour chaque accord, une ou plusieurs formes (cordes jouées, étouffées, frettes, doigtés, barré éventuel, basse), avec niveau de difficulté. **Chaque voicing est vérifié par un test automatique** : les notes réellement produites par la forme dans l'accordage donné doivent correspondre exactement à celles de l'accord (aucune erreur de transcription tolérée)
- Les accords ouverts sont des formes fixes liées à un accordage (standard par défaut) ; les formes mobiles (power chords, barrés, voicings jazz) se calculent par transposition. Pour un accordage alternatif, ne propose que ce qui est recalculable et validé, sinon dis-le clairement
- Systèmes d'accords à couvrir : accords ouverts, accords de septième ouverts, sus/add, power chords (1-5 et 1-5-8), accords barrés (formes de Mi et de La : majeur, mineur, 7, m7, maj7), triades sur 3 cordes adjacentes, voicings plus avancés (drop 2, drop 3, extensions 9/11/13) en fin de parcours# Fonctionnalités

## 1. Hub et sélection de module
- Écran d'accueil avec les modules, la progression globale, la session recommandée du jour, les streaks
- Le thème et les réglages audio sont globaux

## 2. Module Gammes
### Sélection
- Choix du type de gamme : majeure, mineure naturelle, pentatonique mineure/majeure, blues (mineur/majeur), modes (ionien = majeure, dorien, phrygien, lydien, mixolydien, éolien = mineure naturelle, locrien), mineure harmonique/mélodique
- Choix de la **tonalité** pour les gammes (12 notes, avec bonne orthographe et enharmoniques selon les règles ci-dessus) ou de la **tonique** pour les modes, avec indication de la tonalité parente (ex. "Ré dorien → tonalité de Do majeur"). Choix de l'accordage (standard par défaut) et de la configuration de cordes
- Choix du système de positions (uniquement ceux compatibles avec la gamme choisie : CAGED / 3 notes par corde / boxes pentatoniques / autres) et de l'annotation affichée sur la tablature (notes, degrés, intervalles, doigtés)

### Niveaux de difficulté (par gamme + tonalité)
- Niveau 1 - Découverte : la gamme est écrite en tablature (montée et descente, par position), avec intervalles colorés (fondamentale, tierce, quinte… chacune une couleur fixe, cohérente dans toutes les ambiances ; la couleur est attachée à la **fonction** de la note, donc #4 ≠ b5 et b3 ≠ #2, même si elles tombent sur la même touche), notes caractéristiques mises en avant, lecture audio avec curseur animé (montante, descendante, avec drone de la fondamentale pour entendre la couleur du mode), notes de l'accord/arpège superposables
- Niveau 2 - Mémorisation : la gamme s'affiche en tab puis des numéros disparaissent (emplacements vides), l'utilisateur doit retrouver les frettes manquantes (saisie ou jeu réel)
- Niveau 3 - Rappel : tablature vide (lignes de cordes, mesures, rythme), l'utilisateur joue ou saisit toute la gamme de mémoire, avec timer et bonus de vitesse
- Niveau 4 - Improvisation : backing track (accords adaptés à la gamme, tempo réglable, progressions réalistes) ; les mesures et accords défilent en tablature avec le curseur ; l'utilisateur improvise sur 1 position ou plusieurs ; les notes jouées s'inscrivent en direct sur la tab à la position du curseur et sont classées selon le contexte harmonique (note de l'accord, note de couleur/extension, note de passage, note à éviter, hors gamme), avec un score et un feedback pédagogique
- Des défis transverses (ear training, tempo ladder, exercices de séquences) peuvent être proposés comme mini-jeux, à toi de proposer lesquels sont les plus utiles

## 3. Module Accords (apprentissage à partir de zéro)
### Principe
L'utilisateur peut partir de zéro absolu : le module commence par les accords ouverts, puis déverrouille progressivement les autres familles d'accords. Un accord n'est « appris » qu'après avoir été validé réellement, puis il entre dans un pool d'accords connus qui alimente la révision et le mode Défi.

### Curriculum de départ (à challenger et à justifier par ton avis de prof)
Ordre pensé par **difficulté physique**, pas par ordre théorique. Propose ta version finale en phase 0. Base de départ :
1. Accords ouverts très simples (1 à 2 doigts) : Em, Am, puis E, A, D (formes proches, 3 doigts), puis Dm, C, G
2. Accords ouverts de septième et colorés : E7, A7, D7, G7, C7, B7, Am7, Em7, Dmaj7, Cmaj7, Fmaj7 (version simple), Asus2, Dsus2, Asus4, Dsus4, Esus4, Cadd9, et les premiers accords slash (G/B, D/F#, C/G)
3. Fa : version simplifiée 4 cordes, puis mini-barré, puis barré complet ; Si mineur
4. Power chords (branche accessible tôt et très motivante pour qui veut jouer du rock : dis si tu la places en parallèle dès les premiers niveaux)
5. Barrés formes de Mi et de La : majeur, mineur, 7, m7, maj7
6. Triades sur 3 cordes adjacentes, puis voicings avancés et extensions
Éléments transversaux, à placer au bon endroit du parcours : transitions entre accords, strumming (motifs rythmiques), harmonisation d'une tonalité (accords de Sol : Sol Do Ré Mim Lam, etc.), capo.

### Cycle d'apprentissage d'un accord
1. **Découvrir** : nom, constitution (notes, intervalles, pourquoi c'est un accord mineur), écoute plaquée et arpégée, doigté
2. **Construire** : placement guidé doigt par doigt (la tab affiche progressivement les frettes, une corde à la fois), avec les conseils de posture (pouce derrière le manche, doigts arrondis, près de la frette)
3. **Vérifier** : arpège corde par corde validé par l'entrée audio, avec diagnostic par corde (étouffée, grésille, mauvaise note)
4. **Plaquer** : strum global validé par l'entrée audio
5. **Fixer** : l'accord est demandé à froid avec un chrono (« place cet accord en moins de X secondes »), puis répété selon la répétition espacée
6. **Enchaîner** : entraînement de transitions entre cet accord et les accords déjà appris (voir plus bas)
7. **Intégrer** : progressions courtes sur backing track avec motifs de strumming
Un accord devient **appris** quand il est validé proprement N fois sur au moins 2 sessions différentes (le seuil est configurable, ton avis est demandé), pas après un seul succès. Les 3 axes de maîtrise sont suivis séparément : **forme** (toutes les cordes claires), **transition** (vitesse de changement) et **tempo** (tenue du rythme sur backing).

### Système adaptatif (« intelligent »)
- Graphe de compétences avec prérequis (physiques et théoriques) et **difficulté estimée par accord** : nombre de doigts, étirement, barré, cordes étouffées, proximité avec les accords déjà connus (doigts communs, doigts à pivot)
- **Recommandation du prochain accord** : prérequis atteints, difficulté raisonnable, utilité des transitions avec les accords déjà connus, nombre de progressions et de morceaux-types que ça débloque (« avec Em, Am, D et G, tu peux jouer ces progressions »), et faiblesses détectées
- **Maîtrise par accord ET par transition** (paire ordonnée A→B), avec répétition espacée sur les deux. Priorité aux transitions les plus utiles et les plus classiques (Am-Em, A-D, D-G, G-C, C-Am, Em-D, etc.). Propose un classement de ces transitions
- **Diagnostic initial optionnel** (test de placement) pour les utilisateurs qui ne sont pas débutants : ils peuvent valider rapidement les accords qu'ils maîtrisent déjà. Par défaut, départ de zéro ; l'utilisateur peut toujours tout débloquer manuellement
- **Adaptation à la difficulté** : après des échecs répétés, l'app propose une version simplifiée de l'accord, un exercice préparatoire (placer un seul doigt, puis deux), ou un conseil ciblé selon la corde qui pose problème. Aucun blocage définitif, jamais de frustration inutile
- **Détection des points faibles** par accord, par corde et par transition, avec conseils pédagogiques précis
- Séances courtes recommandées, avec objectif du jour et rappel d'échauffement

### Mode Défi Accords (« Setlist »)
- L'app tire **x accords parmi ceux déjà appris** (x de 2 à n, selon le niveau), ou l'utilisateur les choisit ; seuls les accords du pool « appris » sont proposés
- La suite d'accords s'écrit en tablature (mesures avec noms d'accords, rythme/strumming, curseur synchronisé sur un métronome ou un backing track)
- L'utilisateur joue ; **chaque accord est validé via le micro ou l'interface USB** (voir validation audio), avec score de justesse et de timing (compensation de latence, fenêtre autour du temps fort, tolérance réglable)
- Niveaux et variantes : ordre simple, ordre aléatoire, tempo croissant (tempo ladder), affichage du nom sans la tab (rappel de mémoire), accord « surprise », mode survie, progressions types dans une tonalité choisie (I-IV-V, I-V-vi-IV, etc.), enchaînements façon « mini-chanson »
- Le tirage est **pondéré** pour faire revenir les accords et transitions récemment faibles
- Résultats : étoiles, XP, détail par accord et par transition, conseils
- Sans matériel : version d'auto-évaluation, avec reconnaissance de la tab ou du nom et QCM

## 4. Saisie sans matériel (mode par défaut)
- L'utilisateur touche l'emplacement attendu sur la tablature puis saisit le numéro de frette avec un pavé numérique pixel art (ou le clavier physique). Propose aussi un mode QCM pour les niveaux faciles
- Pour les accords : QCM de reconnaissance (quel accord est écrit en tab, quelles notes le composent, quelle est la bonne forme), reconstruction d'un accord corde par corde, et auto-évaluation (« je l'ai joué proprement ») clairement distincte d'une validation réelle (moins d'XP, ou statut « non vérifié »)
- Prévoir tactile (gros éléments), souris et clavier

## 5. Entrée audio
- Deux modes : saisie sur la tab (par défaut, sans matériel) ET écoute de la guitare
- Écoute via getUserMedia avec sélection du périphérique d'entrée (micro du device ou interface USB type Focusrite)
- Désactiver echoCancellation, noiseSuppression, autoGainControl
- Détection monophonique de la note + écart en cents, affichée en direct sur la tablature (la note détectée apparaît à son emplacement corde/frette). Gérer l'octave (pas de confusion d'octave) et la position sur le manche (une même note existe à plusieurs endroits : désambiguïsation selon la position attendue, ou la plus plausible dans la position active en improvisation libre)
- Plage de détection déduite de l'accordage et du nombre de cordes, pas codée en dur : de la note la plus grave jouable (E2 = ~82 Hz en standard, ~73 Hz en Drop D, ~62 Hz pour le Si1 d'une 7 cordes, encore plus bas en baryton) jusqu'à la frette la plus haute de la corde la plus aiguë (~1 300 Hz pour un Mi6 à la frette 24). Adapter la taille de fenêtre de `pitchy` aux basses fréquences
- Écran de calibration (niveau d'entrée, seuil de bruit) et accordeur intégré
- Gérer proprement : permission refusée, aucun périphérique, latence, cordes basses, notes qui s'éteignent, bends et vibrato
- Prévoir un mode casque recommandé pour éviter que les sons de l'app soient captés par le micro (indispensable en mode Défi avec backing track)

### Validation audio des accords (polyphonique)
La détection polyphonique est bien plus difficile que la détection monophonique. Sois honnête sur ses limites, ne promets pas l'impossible, et conçois le système en conséquence :
- **Mode arpège (fiable)** : l'utilisateur joue les cordes une par une, la détection monophonique valide chaque corde et donne un diagnostic précis (corde étouffée, absente, mauvaise note). C'est le mode de référence pour **apprendre** un accord
- **Mode plaqué / strum (approximatif)** : vérification d'un accord **attendu** (on sait quel accord est demandé, donc on vérifie sa présence plutôt que de reconnaître un accord inconnu) : énergie spectrale aux fréquences attendues de chaque note (fondamentales et premiers harmoniques) comparée à celle des notes non attendues, score de confiance, tolérance réglable. Attention aux harmoniques des cordes graves qui recouvrent des notes plus aiguës (faux positifs), à la difficulté de détecter l'absence d'une corde étouffée, et aux accords proches (Am / C, Em / G / E, accords sus et add). Documente les cas qui restent ambigus
- Afficher un **niveau de confiance** et jamais un verdict binaire trompeur ; proposer une validation manuelle de secours (« je l'ai bien joué ») pour ne pas frustrer, avec statut distinct
- Détection de début d'attaque (onset) pour caler le timing en mode Défi, avec compensation de latence mesurée à la calibration
- Une interface USB (Focusrite) donne un signal bien plus propre qu'un micro de téléphone : prévoir des seuils séparés selon la source, et un test de calibration guidé
- **Tests obligatoires** : générer des accords synthétiques (superposition de notes avec harmoniques), mesurer le taux de reconnaissance correcte et de faux positifs entre accords proches, et seulement ensuite tester sur une vraie guitare. Rapporte les résultats chiffrés

## 6. Gamification et progression
- XP, niveaux, streaks quotidiens, badges, étoiles (1 à 3) par niveau de difficulté
- Tracking par gamme, par tonalité et par position ; pour les accords : par accord (forme / transition / tempo), par transition, par corde, avec historique et points faibles détectés (ex. "tu rates souvent la corde de Si"). Les gammes symétriques sont comptées par transposition distincte (voir plus haut)
- Dashboard de progression visuel (heatmap des tonalités/gammes maîtrisées, heatmap des transitions d'accords, courbes), en style pixel art cohérent
- Badges spécifiques aux accords (premiers accords ouverts, première progression jouée, premier barré, transitions sous un seuil de temps…)
- Objectif quotidien et recommandation de la prochaine session (basée sur la répétition espacée, tous modules confondus)
- Feedback visuel immédiat : particules pixel et glow néon sur bonne note, shake et flash sur erreur

# Direction artistique
- Style pixel art rétro-futuriste synthwave : couleurs vives et saturées (magenta, cyan, violet électrique, orange/jaune coucher de soleil) sur fonds sombres (violet nuit, bleu profond)
- Tablature en pixel art, lisible comme sur Songsterr : lignes de cordes fines façon néon, numéros de frettes nets dans des pastilles colorées avec contour et glow, barres de mesure, noms d'accords au-dessus, rythme dessous, curseur de lecture lumineux
- Éléments signature : grille perspective, soleil rayé, montagnes en silhouette, étoiles qui scintillent, scanlines/CRT légères (désactivables), sans jamais gêner la lecture de la tablature
- Backgrounds animés en parallax léger, animations peu de frames (look rétro assumé), transitions pixelisées
- Contraste et lisibilité prioritaires : les numéros de frettes, les annotations, les doigtés et les intervalles doivent rester parfaitement lisibles malgré les effets, y compris sur petit écran
- Pas d'esthétique générique : une vraie identité visuelle, soignée et cohérente

# Système d'ambiances (thèmes)
- Architecture par thèmes (design tokens + config) : palette, background animé, police d'accents, style de particules, ambiance sonore, SFX
- Changement d'ambiance à chaud dans les réglages, mémorisé
- Ambiances à prévoir (au moins 4 pour le MVP) :
  1. Synthwave Neon (défaut) : soleil rayé, grille rose/cyan, backing tracks synthwave
  2. Cyber City Night : ville pixel sous la pluie, néons bleu/violet, backing tracks plus sombres, ambiance electro/dark
  3. Chill Lo-fi Room : chambre pixel art cosy, tons chauds, backing tracks lo-fi / jazzy
  4. Arcade Classic : look borne d'arcade / Game Boy, palette limitée, sons plus chiptune
  5. (optionnel) Rock Stage / Lava : scène ou volcan, tons rouge/orange, backing tracks rock
- Les couleurs des intervalles restent identiques entre thèmes (seule l'habillage change), pour ne pas casser l'apprentissage visuel
- Ajouter un nouveau thème doit se faire en ajoutant un fichier de config + assets, sans toucher à la logique

# Qualité sonore (priorité haute)
Tous les sons produits par l'app doivent être propres, chauds et de qualité "studio", sans artefacts.
- Notes de référence et lecture des gammes : utiliser des échantillons de guitare de qualité (Tone.Sampler avec samples multi-couches, ou soundfont de qualité), pas de simples oscillateurs. Vérifier et documenter la licence des samples (libres de droits uniquement)
- Accords de référence : plaqués (strum avec léger décalage réaliste entre les cordes, vers le bas et vers le haut) et arpégés, joués avec la **même forme que celle affichée en tab** (les notes jouées par l'audio doivent correspondre exactement à celles de la tab)
- Backing tracks : batterie, basse, accords/pads avec instruments échantillonnés ou synthés soignés ; séquencés via Tone.Transport pour un timing précis (pas de setTimeout). Les voicings d'accords et lignes de basse doivent être musicalement crédibles (bon voice leading, basse qui joue fondamentale/quinte/notes de passage, groove adapté au style de l'ambiance)
- Drones de fondamentale et accords de référence pour entendre la "couleur" de chaque mode
- Chaîne audio propre : enveloppes ADSR bien réglées (zéro clic au début/fin des notes), réverbération légère, compresseur/limiteur sur le bus master, gain staging soigné
- Mix : volumes séparés (master, guitare de référence, backing, SFX) réglables, avec bon équilibre par défaut
- Latence : latencyHint "interactive", contexte audio démarré après un geste utilisateur, préchargement des samples avec écran de chargement pixel art
- SFX de gamification (bonne note, erreur, level up, badge) : style chiptune/synthwave mais propres et agréables à réécouter, jamais agressifs ni stridents ; adaptés à chaque ambiance
- Page de debug audio pour vérifier chaque son, réglage de volume mémorisé
- Si une amélioration de qualité demande un compromis (poids des samples, temps de chargement), explique-le et propose une option (qualité standard / haute)

# Méthode de travail
- **Phase 0** : propose (1) l'architecture multi-modules (arborescence, interface `LearningModule`, modèle de progression unifié, modèle TabScore, base de voicings, système de thèmes, pipeline audio de sortie et d'entrée, modules), (2) le plan pédagogique et musical de **chaque module** : arbres de compétences, curriculum d'accords final avec justifications, critères de « accord appris », modèle adaptatif, mode Défi, répétition espacée, conventions théoriques et de tablature, (3) **ton avis de professeur** sur les points délicats (ordre des accords, place des power chords, critères de maîtrise, réalisme de la validation audio, doigtés simplifiés) et une analyse des risques techniques (détection polyphonique en particulier), (4) un mini moodboard en texte (palettes + police) et une maquette ASCII des écrans principaux (hub, sélection de gamme, niveau 1, improvisation, leçon d'accord, mode Défi Accords) montrant la tablature, puis attends mon feu vert
- **Phase 1** : cœur : moteur de théorie (gammes et accords, orthographe, conversion solfège), base de voicings avec tests de cohérence, moteur de tablature (TabScore, rendu pixel art, curseur de lecture synchronisé), moteur audio avec samples de guitare, hub, thème Synthwave, module Gammes niveau 1, positions (CAGED, 3NPS, boxes, avec la table de compatibilité gamme ↔ système)
- **Phase 2** : module Gammes niveaux 2 et 3 (saisie sur la tab) + progression unifiée persistante + XP + répétition espacée
- **Phase 3** : entrée audio monophonique et détection de pitch (jouer sur la vraie guitare, affichage live sur la tab), calibration, accordeur
- **Phase 4** : module Accords, partie A : curriculum des accords ouverts, écriture des accords en tab, leçon guidée doigt par doigt, écoute plaquée/arpégée, mode sans matériel (QCM, auto-évaluation), validation en **mode arpège** via la détection monophonique, progression adaptative et recommandation du prochain accord
- **Phase 5** : validation polyphonique des accords plaqués (analyse spectrale, score de confiance, tests sur accords synthétiques avec résultats chiffrés, puis vraie guitare), onset et timing, entraînement de transitions
- **Phase 6** : mode Défi Accords (x accords appris, niveaux, tempo ladder, tirage pondéré), strumming, nouvelles familles d'accords (septièmes, sus/add, power chords, barrés), harmonisation de tonalités
- **Phase 7** : module Gammes niveau 4 improvisation + backing tracks (réutilise le moteur d'accords) + analyse harmonique des notes jouées
- **Phase 8** : thèmes supplémentaires, ear training (gammes et accords), dashboard, badges, PWA, polish visuel et sonore
- À chaque phase : l'app doit tourner (`npm run dev`), code typé et modulaire, tests unitaires sur la logique musicale (génération de gammes, orthographe des notes et choix des enharmoniques, conversion notation anglo-saxonne ↔ solfège, construction des accords, cohérence de chaque voicing avec l'accordage, positions, génération de tablature cohérente avec l'accordage et le nombre de cordes, durées par mesure, mapping fréquence → note/corde/frette, classification harmonique des notes, logique de maîtrise et de recommandation adaptative, reconnaissance d'accords sur signaux synthétiques)
- Vérifie visuellement le rendu à chaque phase (captures d'écran si possible), notamment la lisibilité des numéros de frettes et des piles d'accords sur petit écran
- Tiens à jour PROJECT.md (décisions, hypothèses, avancement) et MUSIC_DESIGN.md (choix musicaux et pédagogiques)
- En fin de phase : liste ce qui est fait, ce qui reste, ton avis de prof sur ce qui vient d'être construit, et tes 3 à 5 propositions d'amélioration pédagogiques
- Si un choix est ambigu, fais l'hypothèse la plus raisonnable, note-la, et continue sans me bloquer

Commence par la phase 0.


- Lien avec les gammes : les accords ouverts C-A-G-E-D sont les formes CAGED. L'app doit faire ce lien explicitement (« la forme de Mi barrée = la même forme que le Mi ouvert, déplacée ») et relier les accords aux gammes correspondantes, pour que les deux modules se renforcent mutuellement
- Les accords dans une tonalité : harmonisation de la gamme majeure (I ii iii IV V vi vii°) et mineure, chiffrage romain avec casse indiquant la qualité, accords communs à plusieurs tonalités (pivots), familles de tonalités faciles à la guitare (Sol, Do, Ré, La, Mi), capo et transposition
- Doigtés : numérotation 1 à 4 (index, majeur, annulaire, auriculaire), pouce noté T, doigtés conventionnels et alternatives simplifiées pour débutants (par exemple Fa en version 4 cordes avant le barré complet ; Si7 ou Sim simplifiés)

## Idées pédagogiques à intégrer et à enrichir
- Apprendre les gammes comme des **formes + intervalles + sons**, pas comme des listes de notes : couleurs d'intervalles, affichage au choix en noms de notes / degrés (1 b3 5) / intervalles / solfège
- **Ear training intégré** : reconnaître une gamme ou un mode à l'écoute, reconnaître un accord majeur / mineur / 7e à l'oreille, chanter/jouer la note cible, reconnaître les intervalles, "quelle est la note caractéristique ?"
- **Apprentissage espacé** (répétition espacée type SM-2/Leitner) : l'app resurface les gammes, tonalités, positions, accords et transitions que l'utilisateur oublie le plus
- **Progression pédagogique** recommandée (arbre de compétences par module) : l'utilisateur peut tout débloquer, mais l'app recommande un chemin
- **Entraînement du tempo** : métronome intégré, "tempo ladder" (monter le BPM par paliers quand la précision dépasse un seuil), exercices en croches/triolets/doubles croches
- **Exercices de technique par gamme** : séquences (en 3, en 4, en tierces, en quartes), motifs mélodiques, alternate picking, legato, tous écrits en tablature
- **Improvisation guidée** : notes cibles (target notes) sur les changements d'accords, notes de l'accord à jouer sur chaque accord, "call and response" avec l'app, mini-licks à imiter (écrits en tab), contraintes créatives ("joue seulement 3 notes", "finis sur la tierce")
- **Ancrage dans la musique réelle** : suggérer quelles gammes marchent sur quelles progressions, avec des progressions types (I-IV-V, ii-V-I, blues 12 mesures, i-bVII-bVI, etc.). Exemples : dorien sur le ii7, mixolydien sur le V7 diatonique en majeur (ou sur le I7 d'un blues), pentatonique mineure sur blues en 12 mesures. Nuance à enseigner : un V7 qui résout vers un accord mineur appelle plutôt mixolydien b9 b13 ou altéré. Notation en chiffrage romain avec la casse qui indique la qualité (ii7–V7–Imaj7)
- **Analyse de l'improvisation** : scoring selon le contexte harmonique (note sur un tel accord : note de l'accord, extension/tension agréable, note de passage, note à éviter / "avoid note", hors gamme), pas seulement "dans la gamme / hors gamme"
- Feedback pédagogique explicatif : en cas d'erreur, dire pourquoi ("la 4te juste sonne tendue sur cet accord maj7, essaie de la résoudre sur la tierce" ; pour un accord : "ta corde de Si est étouffée par le bout de ton annulaire, arrondis la phalange")
- Recommander la pratique "chunking" (petits segments), sessions courtes (10 à 15 minutes pour un débutant), objectif du jour, rappel d'échauffement, rappel que la douleur aux doigts du début est normale et qu'il faut faire des pauses

## Ton rôle de force de proposition
- Dans la phase 0, produis un **plan pédagogique** pour chaque module : arbre de compétences, ordre d'apprentissage, types d'exercices, principes de répétition espacée et de progression, et justifie chaque choix musicalement, avec **ton avis de professeur** sur les points délicats
- À la fin de chaque phase, propose 3 à 5 améliorations pédagogiques ou musicales supplémentaires (classées par impact vs effort), en expliquant pourquoi elles aideraient à apprendre
- Signale toute simplification de mon cahier des charges qui serait musicalement ou pédagogiquement trompeuse, ou toute exigence techniquement irréaliste, et propose une alternative
- Tiens à jour un fichier MUSIC_DESIGN.md : choix théoriques, conventions (notation, enharmoniques, octaves, mélodique, blues, tablature, nomenclature des accords), curriculum d'accords et justifications, références pédagogiques, idées en attente


