# Constats du simulateur de progression

Relevés à chaque étape du chantier `dev/simulateur` (personas, horloge, rapport, panneau DEV, captures).
**On ne traite rien pendant le dev** : la liste sert à décider ensuite des améliorations UX.

Modèle de l'élève volontairement simple (précision qui monte avec la pratique, oubli par jour, aléa) :
les ordres de grandeur comptent, pas les valeurs exactes. Rapport complet : `npm run sim:report`
→ `.shots/sim/report.md`.

## Étape D — rapport chronologique (2026-10-29)

1. **L'accueil répète « À réviser » presque tous les jours.** Régulier : 21 jours de pratique d'affilée ;
   corde de Si fragile : 23. L'élève ne voit presque jamais « Reprendre la gamme » ni la prochaine forme
   mise en avant. Sent-il qu'il avance ?
2. **L'élève avancé n'a plus de cap.** 5 formes maîtrisées avec vitesse vérifiée dès J26, puis
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
9. **« 5 formes apprises sur 5 » et 5 révisions dues en même temps.** Le parcours dit « tout est appris »
   pendant que le héros dit « à revoir » : l'état « apprise » ne bouge jamais avec l'oubli, l'élève peut
   ne pas comprendre pourquoi une forme apprise revient sans cesse.
10. **« Forme 1 sur 5 à revoir aujourd'hui »** : bonne indication du volume, mais rien n'annonce la
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
13. **La révision ouverte n'est pas celle annoncée.** L'accueil annonce « Forme 1 sur 5 à revoir »
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

17. **Le constat 13 ne venait pas seulement de l'impro.** Avancé à J30, rien n'est dû, mais
    `#/gammes/revision` lance quand même « Session 1/5 » sur des formes maîtrisées, en N2 à trous,
    motif « vue dans une seule zone du manche », tonique inchangée. Le lot 1 du plan reste nécessaire.
18. **« Prochain cap » est déjà pris** : l'affiche de l'accueil dit « Série : 13 jours d'affilée ·
    prochain cap : 14 jours » (palier de série). Le lot 2 du plan doit nommer autrement l'étape suivante
    du parcours (« Prochaine étape », « Nouveau défi »…), sinon deux sens pour un même mot.
19. **Téléphone, page Révision** : la barre de réponse fixe (« Corde de Mi (grave) · case ? » + pavé)
    recouvre la seconde ligne de tablature. Possible artefact de la capture pleine page (éléments fixes) :
    à vérifier sur un vrai téléphone avant d'en faire un lot.
