# Constats du simulateur de progression

Relevés à chaque étape du chantier `dev/simulateur` (personas, horloge, rapport, panneau DEV, captures).
**On ne traite rien pendant le dev** : la liste sert à décider ensuite des améliorations UX.

Modèle de l'élève volontairement simple (précision qui monte avec la pratique, oubli par jour, aléa) :
les ordres de grandeur comptent, pas les valeurs exactes. Rapport complet : `npm run sim:report`
→ `.shots/sim/report.md`.

## Étape D — rapport chronologique (2026-10-29)

1. ✅ **Corrigé (D98, lot 2)** — **L'accueil répète « À réviser » presque tous les jours.** Régulier : 21 jours de pratique d'affilée ;
   corde de Si fragile : 23. L'élève ne voit presque jamais « Reprendre la gamme » ni la prochaine forme
   mise en avant. Sent-il qu'il avance ?
2. ✅ **Corrigé (D98, lot 2)** — **L'élève avancé n'a plus de cap.** 5 formes maîtrisées avec vitesse vérifiée dès J26, puis
   « Reprendre la gamme » 28 jours de suite : aucune suggestion d'autre gamme, tonique ou système.
3. **La carte de révision peut décourager.** Dès J1 : « Dernier passage : exercice à trous, 50 % ».
   Joueur du week-end : « 88 % » affiché trois semaines d'affilée, comme si rien ne bougeait.
4. **Joueur du week-end** : série cassée 5 fois, révisions bloquées à 5 dues (il ne les fait pas),
   alors qu'il atteint l'objectif du jour chaque samedi.
5. **Rattrapages nombreux** (30 à 50 pour les profils réguliers) : ni XP ni preuve. L'élève comprend-il
   pourquoi ces séries ne comptent pas ?
6. **Plafond d'XP (120) jamais dépassé**, même par l'avancé : il ne gêne personne à 3-4 séries par jour.
7. **Sans micro** : première forme apprise à J7, contre J3 au micro. L'écart s'explique-t-il à l'écran ?

Bruit connu : « corde la plus ratée » n'a de sens que pour la persona Si fragile ; ailleurs, c'est un
effet du simulateur (les segments de 3 cordes graves concentrent les ratés sur les cordes 0-2).

## Étape C — panneau DEV (2026-10-29)

Observés en chargeant « Décrocheur » puis en avançant l'horloge de 7 jours (`__sim.shift(7)`).

8. **Retour après une absence : rien ne le dit.** Une semaine sans jouer, l'accueil affiche « Dernier
   passage : de mémoire, 87 % · 28 oct. » comme si de rien n'était ; la série retombe à 0 sans un mot,
   la jauge dit « 0 / 3 exercices aujourd'hui ». Pas d'accueil du type « content de te revoir, on
   reprend doucement ».
9. ✅ **Corrigé (D98, lot 2)** — **« 5 formes apprises sur 5 » et 5 révisions dues en même temps.** Le parcours dit « tout est appris »
   pendant que le héros dit « à revoir » : l'état « apprise » ne bouge jamais avec l'oubli, l'élève peut
   ne pas comprendre pourquoi une forme apprise revient sans cesse.
10. ✅ **Corrigé (D98, lot 2)** — **« Forme 1 sur 5 à revoir aujourd'hui »** : bonne indication du volume, mais rien n'annonce la
    durée (5 rappels à froid ≈ 8-10 min).
11. **Le simulateur a révélé un piège d'outillage** (pas de l'app) : remplacer un fichier par un nouveau
    (`perl -i`, `sed -i`) peut échapper à l'observateur de Vite, qui sert alors l'ancien module. Après
    une modification de ce genre, recharger ou toucher le fichier en place.

## Étape E — tournée visuelle (2026-10-29)

`node tools/sim-tour.mjs` : 6 personas × jours clés, 4 écrans, planche `.shots/sim-tour/index.html`.

12. ✅ **Corrigé (D96)** — **Les prises d'impro deviennent des révisions dues que rien ne peut vider** (le plus grave relevé).
    `cardsFrom` crée une carte Leitner pour `gam:impro:…` ; un taux de notes d'accord de 40-80 % y vaut
    un « échec », la carte reste en boîte 1. L'accueil (filtre `!acc:`) la compte : avancé à J45,
    « À réviser (5) — Dernier passage : impro, 72 % · 12 oct. », 44 jours de pratique d'affilée en
    « À réviser ». Or la file de révision (`buildReviewQueue`) n'ouvre que les séries de lecture : la
    carte ne sera jamais revue. Le rapport (étape D) le masquait, il filtre maintenant comme l'accueil.
    *Correction* : `cardsFrom` ne crée plus de carte pour une prise d'impro. Simulation refaite :
    l'avancé repasse en « Reprendre la gamme » (constat 2 de nouveau visible, il est réel).
13. ✅ **Corrigé (D97, lot 1)** — **La révision ouverte n'est pas celle annoncée.** L'accueil annonce « Forme 1 sur 5 à revoir »
    (les cartes d'impro) ; la page Révision lance « Session 1/5 » sur d'autres formes, choisies comme
    « fragiles » : pour un élève qui a tout maîtrisé, un exercice à trous N2, tablature visible, motif
    « vue dans une seule zone du manche », alors que le panneau dit « Cette forme : maîtrisée ».
14. **Le panneau « Exercice » de la révision est un long paragraphe** : la liste des 5 formes de la
    session, la règle des 35 %, le mode d'emploi du pavé et l'état de la forme dans un seul bloc.
15. **Une persona qui ne pratique pas le jour J1** (sans micro, week-end un jeudi) montre « Commencer »
    avec un journal vide : cohérent, mais rappel que le premier écran dépend du jour de lancement.
16. Outillage : dans Playwright, un `goto` qui ne change que le hash ne recharge pas la page (les modules,
    donc le décalage d'horloge, restent en mémoire) ; la tournée recharge explicitement.

## Relance après D96 (2026-10-29)

Rapport et tournée complète refaits (bureau 1440 et téléphone 390). Chiffres inchangés sauf l'avancé :
plus de cartes d'impro, l'accueil passe en « Reprendre la gamme » dès J30 (constat 2 de nouveau visible).

17. ✅ **Corrigé (D97, lot 1)** — **Le constat 13 ne venait pas seulement de l'impro.** Avancé à J30, rien n'est dû, mais
    `#/gammes/revision` lance quand même « Session 1/5 » sur des formes maîtrisées, en N2 à trous,
    motif « vue dans une seule zone du manche », tonique inchangée. Le lot 1 du plan reste nécessaire.
18. ✅ **Corrigé (D98, lot 2)** — **« Prochain cap » est déjà pris** : l'affiche de l'accueil dit « Série : 13 jours d'affilée ·
    prochain cap : 14 jours » (palier de série). Le lot 2 du plan doit nommer autrement l'étape suivante
    du parcours (« Prochaine étape », « Nouveau défi »…), sinon deux sens pour un même mot.
19. **Téléphone, page Révision** : la barre de réponse fixe (« Corde de Mi (grave) · case ? » + pavé)
    recouvre la seconde ligne de tablature. Possible artefact de la capture pleine page (éléments fixes) :
    à vérifier sur un vrai téléphone avant d'en faire un lot.

## Lot 1 — porte unique et file honnête (`ux/constats-sim`, 2026-10-29)

Traités (D97) : 13, 17, et du plan les constats 20 (le bouton de l'accueil contournait le rappel à froid),
22 (deux plafonds : le texte disait « 8 au plus par séance », la séance en fait 5) et 25 (un échauffement
sur 3 cordes créait la carte : cause du « 50 % » du constat 3 à J1). Invariants (fin fixe 29 oct. 19 h) :
I1 230 fautes → 0 (avancé 186 → 0), I1 bis 249 → 0, I1 ter vert ; I4 131 soirs fautifs → 85 (lot 2).

20. ✅ **Corrigé (D97)** — Le bouton « Réviser maintenant » ouvrait une forme seule en N2.
22. ✅ **Corrigé (D97)** — Deux plafonds : en fait un défaut de texte. Deux séances de 5 couvraient déjà les
    8 dues annoncées (vérifié par I1 ter sur un journal fabriqué) ; l'accueil dit « 8 au plus
    aujourd'hui », le bilan propose « Encore 3 formes dues ».
25. ✅ **Corrigé (D97)** — Le premier échauffement créait une carte.
26. **Page Révision à file vide** (vu pendant la tournée du lot 1) : avancé J30, la page retombait sur un
    exercice N2 de la forme courante, maîtrisée, sans dire pourquoi. Corrigé dans le lot (D97) : « Aucune
    forme à réviser pour l'instant. »
27. **Effet de Q2 sur le simulateur, pas sur l'app** : première forme apprise plus tard chez le régulier
    (J3 → J6) et le décrocheur (J4, mais 3 apprises au lieu de 5 en fin de course). L'élève virtuel ne fait
    de rappel N3 que sur une carte due ; sans carte créée par l'échauffement, il n'en a plus le 2ᵉ jour. À
    revoir quand le simulateur suivra la séance du jour (lot 2c). Les tirages aléatoires se décalent aussi
    (jours pratiqués, série cassée 1 fois chez le régulier) : bruit.
28. **Avancé : plafond d'XP touché un jour** (133 XP bruts, 13 non comptés), jamais avant le lot. Son parcours
    a changé (formes maîtrisées dès J12 au lieu de J16) ; à relire avec le constat 6 après le lot 2c.
29. ✅ **Corrigé (D98, lot 2)** — **« Une autre forme » trompe désormais** : elle fait tourner la forme affichée, mais le bouton ouvre la
    séance dans son ordre à elle. Le lot 2b la retire (prévu au plan).

## Lot 2 — séance du jour et étape suivante (`ux/constats-sim`, 2026-10-29)

Traités (D98) : 1, 2, 9, 10, 18, 29, et du plan le 21 (une forme revue aujourd'hui revenait le soir même).
Le simulateur suit maintenant la séance du jour (révisions, puis « Avancer », puis « Nouveau défi ») ; la
colonne « séance » du rapport est celle que l'accueil propose en arrivant (17 h).
Invariants : I2, I2 bis (chaque jour de pratique a une étape ou un défi), I3, I4 verts (I4 : 131 soirs
fautifs avant le lot 1, 85 après, 0 maintenant). Même séance proposée ≥ 5 jours de pratique d'affilée :
régulier 21 → aucune, décrocheur 12 → aucune, sans micro 22 → aucune, week-end 11 → aucune, avancé 27 →
aucune, Si fragile 21 → **8** (voir 30). L'avancé atteint le blues mineur à J9, le régulier à J22.

21. ✅ **Corrigé (D98)** — Une forme revue aujourd'hui revenait le soir même.
27. ✅ **Résolu par le lot 2c** — Le régulier apprend de nouveau sa première forme à J3 : la séance passe
    au rappel de mémoire (N3) après deux réussites, sans attendre qu'une carte soit due.
30. ✅ **Traité (D98, règle à l'essai)** — **Si fragile : 8 jours de pratique sur « Position 1, trous »**, puis 13 jours sur « Position 2, trous ».
    La position entière ratée en boucle (corde de Si) n'a aucun repli : la séance ne propose jamais
    l'échauffement sur 1-3 cordes ni « Revoir la forme (N1) ». Règle pédagogique à décider (question à l'auteur).
31. **Avancé : la charge de révision grimpe avec chaque gamme** (18 formes dues à J43 sur 5 gammes ; 8 par
    jour au plus) et le **plafond d'XP est atteint 34 jours** (999 XP non comptés). Le constat 6 s'inverse :
    le plafond gêne l'élève qui suit tout le parcours. Aucune règle d'XP changée.
32. **Avancé : plus aucune forme « vitesse vérifiée »** (5 avant le lot). Artefact du simulateur : ses séries
    de vitesse ne portent que sur la gamme en cours, qui change à chaque défi. À revoir au lot 6.
33. ✅ **Traité (D98)** — **Défis « même dessin » validés en un essai** : Mi m et la transposition se valident par une réussite
    forte (N3 ou N2 au micro) sur la position 1 ; l'avancé les passe le soir même où il finit le blues.
    Suffisant pour G1.1 / G1.4 ? (question à l'auteur).
34. La tournée tourne à 23 h 30 : l'accueil montre l'état du soir (« 4 formes rafraîchies », « Avancer »).
    Option `--theme dawn` ajoutée à `tools/sim-tour.mjs` pour les captures en Aube.

### Réponses de l'auteur aux constats 30 et 33 (2026-10-29)

- **30** : « revoir la forme après 3 échecs, pour tester ». Mesure : Si fragile apprend sa première forme à
  J9 (J14 avant) et finit à 3 formes apprises (2 avant) ; la plus longue série identique devient « Position 1,
  revoir » 6 jours (8 avant). Le simulateur ne fait rien gagner à une écoute (sa précision ne monte qu'avec les
  séries jouées) : il mesure le rythme du parcours, pas l'effet pédagogique de « revoir ». À juger sur un vrai
  élève. Effet de bord : le régulier apprend sa première forme à J6 (J3 avant), ses échecs du début
  déclenchent aussi « revoir ».
- **33** : « critère complet ». Mi m puis Ré m prennent chacun deux jours à l'avancé (J13-J14, J15-J16) ; il
  passe à la pentatonique majeure à J16 (J14 avant).
