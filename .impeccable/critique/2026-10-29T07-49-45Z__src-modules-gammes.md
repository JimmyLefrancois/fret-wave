---
target: gammes
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Jiphie\\Desktop\\dev\\fret-wave\\src\\modules\\gammes"
timestamp: 2026-10-29T07-49-45Z
slug: src-modules-gammes
---
# Critique n° 2 : module Gammes (src/modules/gammes/)
Method: dual-agent (A : revue de design · B : détecteur + navigateur)

## Note de santé : 27/40 (Bon) — 22/40 à la critique 1
| # | Heuristique | Note | Problème clé |
|---|---|---|---|
| 1 | Visibilité de l'état | 2 | Fin de série ratée invisible (Résultat vers y≈1180) ; progression et corde en badges pixel 11 px |
| 2 | Monde réel | 3 | N2/N3, BOXES, « Box 2 » à côté de « boîte 1 sur 6 » |
| 3 | Contrôle | 3 | « Nouvelle série » en bouton principal pendant la série (efface le travail) |
| 4 | Cohérence | 2 | 3 réglages de tempo ; plusieurs boutons principaux magenta ; « S'exercer » plein = sélectionné |
| 5 | Prévention | 3 | — |
| 6 | Reconnaissance | 3 | Corde active loin de la tablature, petite |
| 7 | Souplesse | 3 | Aucune touche après un résultat (ScaleTrainingPage.tsx:590) |
| 8 | Sobriété | 2 | formStateLine en double ; panneau « Aucune note caractéristique » ; demi-panneaux vides |
| 9 | Récupération | 3 | « 16 erreurs » pour 8 trous |
| 10 | Aide | 3 | — |

## Détecteur
CLI : 0 sur le module. app.css : hex l.482 #2a0a3d et l.815 #ffb3c9 (réels), 39 tailles hors échelle, 2 rebonds, VT323 absente de DESIGN.md. Navigateur : aucun contraste en échec ; 3 halos par écran sur Entraînement, Révision et Séquences (Ouvrir le micro + Nouvelle série) ; ligne de ~156 caractères sur Jouer (« Le micro valide chaque note… »).

## Problèmes prioritaires
- [P1/P0 sur téléphone] Fin d'une série ratée invisible : le Résultat est sous le pavé mort, ni défilement ni annonce. Fix : le Résultat remplace Réponse au même endroit ; écran de fin calme pour 0 étoile ; annonce et focus. (layout, harden)
- [P1] Téléphone : tablature (750 px) et réponse jamais visibles ensemble. Fix : barre de réponse collée en bas (corde, chiffres, verdict). (adapt)
- [P1] Corde visée, progression et tempo en Silkscreen 11 px (C lu comme O). Fix : en sans-serif 18-20 px dans la consigne du pavé. (typeset)
- [P2] 3 boutons principaux avec halo ; « Nouvelle série » destructrice pendant la série. Fix : un seul bouton principal par état. (polish)
- [P2] Mots en collision : Box/boîte, « Série tenue » à ★★ sans grille (Celebration.tsx:114), « 16 erreurs » pour 8 trous. (clarify)

## Profils d'utilisateur
Alex : ~15 Tab jusqu'à Rejouer après un résultat. Sam : Résultat ni annoncé ni focalisé ; pointillé fin en Aube ; Silkscreen 11 px déformé. Guitariste à 1-2 m : corde, progression, tempo et fin d'échec illisibles.

## Mineures
Le verdict apparaît en poussant le pavé de 74 px (réserver une hauteur pendant la série) ; cadre du trou actif qui reste après la fin ; « Aucune note caractéristique » en N3 ; Instrument/Instrument ; Press Start 2P sur les touches et .back ; liens de bas de page en puces.

## Questions
1. Pourquoi le pavé mort garde-t-il le centre après la série ? 2. Une fin calme pour l'échec ? 3. Sur téléphone, une ligne de tablature + une consigne géante ?
