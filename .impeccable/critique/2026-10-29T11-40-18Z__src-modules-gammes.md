---
target: gammes
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Jiphie\\Desktop\\dev\\fret-wave\\src\\modules\\gammes"
timestamp: 2026-10-29T11-40-18Z
slug: src-modules-gammes
---
# Critique n° 3 : module Gammes (src/modules/gammes/)
Method: dual-agent (A : revue de design · B : détecteur + navigateur)

## Note : 28/40 (Bon) — 22 → 27 → 28
| # | Heuristique | Note | Problème clé |
|---|---|---|---|
| 1 | Visibilité | 3 | Chrono ~9 px ; sur téléphone, une erreur = petit ✕ |
| 2 | Monde réel | 3 | palier, rappel à froid, Boxes, N2/N3 |
| 3 | Contrôle | 3 | — |
| 4 | Cohérence | 2 | Bouton principal différent entre l'écran de fin et le panneau ; puces sélectionnées magenta ; degrés/doigts sous la tablature |
| 5 | Prévention | 3 | — |
| 6 | Reconnaissance | 3 | Légende de Jouer ~1 400 px sous la tablature |
| 7 | Souplesse | 3 | Pas de raccourci N2/N3 ni « Passer au rappel » |
| 8 | Sobriété | 2 | Jouer 2 032 px ; prose de maîtrise partout ; halos multiples |
| 9 | Récupération | 3 | — |
| 10 | Aide | 3 | Trop d'aide affichée |

## Détecteur
CLI : 0 sur le module. app.css : 44 tailles hors échelle, 2 rebonds, rgba en dur (148, 371, 2077) ; rgba des états sélectionnés (.scale-row.on, .pos-item.on, .quiz-strip, .mic-line.on, grille de la célébration) qui ne suivent pas Aube. Navigateur : aucun contraste en échec ; 3 halos sur Jouer et Séquences, 2 sur la sélection ; .seq-stage porte un halo hors .btn-primary / .panel-accent.

## Problèmes prioritaires
- [P1] Tablature trop petite pour jouer à distance (chiffres ~11 px, pavé = plus gros objet). Fix : échelle 3 au-dessus de 900 px, consigne en 30-36 px, pavé replié quand le micro écoute, tablature en tête de Jouer sur téléphone. (layout)
- [P1] Après un résultat : ~11 actions, bouton principal différent entre l'écran de fin et le panneau, « Rejouer » après ★★★. Fix : un bouton principal selon l'issue (échec → Revoir ; N2 réussi → Passer au rappel ; N3 → forme suivante), le reste en liens ou masqué, verdict effacé. (distill, clarify)
- [P1] Téléphone : une erreur = petit ✕ dans la barre. Fix : texte du verdict dans la barre ~1,5 s, bordure danger. (adapt)
- [P2] Le pavé saute encore au premier chiffre (réserve liée à startedAt, ScaleTrainingPage.tsx:914). Fix : réserver dès l'ouverture tant qu'il n'y a pas de résultat. (polish)
- [P2] Rangée sous la tablature : degrés ici, doigts sur Séquences ; Silkscreen 11 px casse en densité 1 (C lu O). Fix : nommer la rangée ; Silkscreen à 8 ou 16 px seulement. (typeset)

## Profils d'utilisateur
Alex : aucun raccourci de progression ; Tab ×14 sur Jouer. Sam : étiquettes pixel 11 px déformées, aides 12 px, chrono 9 px. Guitariste à 1-2 m : seuls le « 60 » et le verdict se lisent.

## Mineures
Am7 sans explication ; badges de niveau en vert succès ; double titre EXERCICE/NIVEAU ; tempo affiché deux fois sur Séquences ; « Exercice de mémoire » qui semble désactivé ; pagination désactivée peu contrastée ; rgba des états sélectionnés hors thème.

## Questions
1. Pourquoi le pavé, et non la tablature, est-il le plus gros objet ? 2. Une jauge vue/apprise/maîtrisée à la place de la prose ? 3. Après ★★★, « encore ? » ou « plus dur ? » ?
