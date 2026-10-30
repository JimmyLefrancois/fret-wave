---
target: gammes
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\Jiphie\\Desktop\\dev\\fret-wave\\src\\modules\\gammes"
timestamp: 2026-10-29T06-15-49Z
slug: src-modules-gammes
closed: true
---
# Critique : module Gammes (src/modules/gammes/)
Method: dual-agent (A: revue design, reprise après limite d'usage · B: détecteur + navigateur)

## Note de santé : 22/40 (Acceptable)
| # | Heuristique | Note | Problème clé |
|---|---|---|---|
| 1 | Visibilité de l'état | 2 | Verdicts en 14,5 px au bas du pavé, loin de la tablature ; palier de tempo en t-small |
| 2 | Monde réel | 3 | Codes N2/N3, « Boxes », racine nommée « unisson juste » |
| 3 | Contrôle et liberté | 2 | Niveau/Découpage efface la série sans prévenir ; #/gammes/revision réécrit la position |
| 4 | Cohérence | 2 | 3 réglages de tempo ; h1 Impro ~30 px ; légende ≠ tablature |
| 5 | Prévention des erreurs | 2 | Chiffres sans trou choisi ignorés ; « Passer au rappel (N3) » après 0 % |
| 6 | Reconnaître > se souvenir | 3 | Pas de statut par position sur la sélection |
| 7 | Souplesse | 1 | Aucun choix de trou au clavier, aucun raccourci |
| 8 | Sobriété | 2 | Explication plus grosse que la consigne ; halo d'accent partout |
| 9 | Récupération d'erreurs | 2 | « Not supported » en anglais brut ; 4 boutons égaux après un échec |
| 10 | Aide | 3 | Riche mais encombrante |

## Spécificité
Propre au produit dans la tablature et le décor ; générique dans la composition (panneaux de même poids, paragraphes de règles). Détecteur CLI : 0 alerte. Navigateur : aucune erreur de contraste ; vrais problèmes : .linkish 6 px de marge (app.css:2319, ×3), foot-note ~123 caractères/ligne, mot seul sur Séquences ; halo sur 6 panneaux + 3 primaires (Jouer), contre « rare par écran » dans DESIGN.md ; text-shadow sur .numpad-digits hors système. Fausses alertes : ombres décalées, lignes de balayage, néons cyan/violet.

## Problèmes prioritaires
- [P1-a] Légende des couleurs fausse pour les degrés altérés : legendFor (resolve.ts:59) passe « ♭3 » à intervalStyle, parseFn n'accepte que l'ASCII → gris #B8B0C8. Fix : intervalStyle(raw) + test. (harden)
- [P1-b] Verdicts et erreurs micro dans .numpad-feedback, loin de la tablature ; micro refusé invisible sur mobile, texte anglais. Fix : bande de verdict ≥ 20 px sous la tablature, role=status ; erreurs micro en français dans .mic-line. (layout, clarify)
- [P1-c] Après une série, les cases révélées ou manquées sont dessinées comme les justes (withRevealed). Fix : marquage hors couleur + « 3 cases manquées : Sol ×2, Si ×1 ». (harden)
- [P1-d] Pas de choix de trou au clavier, pas de présélection ; describe() (TabView.tsx:86) lit les notes cachées au lecteur d'écran. Fix : premier trou auto, ←/→ + aria-live, filtrer les notes cachées. (harden, audit)
- [P2] Écran d'entraînement non pensé pour jouer debout : à 390 px pavé > 1 000 px sous la tablature ; « Commencer » de Séquences sous la ligne de flottaison ; explication en plus gros texte. Fix : mode jeu, pavé collé, un seul « Comment c'est noté ? », un seul panneau en accent. (layout, distill)

## Profils d'utilisateur
- Alex : pas de clavier sur les trous, pas de raccourcis, ~27 cibles avant de jouer, révision vide silencieuse.
- Sam : réponses N3 lues dans l'aria-label, trous non focusables, consignes en Silkscreen 11 px, pavé désactivé à opacity .35 (< 4,5:1 en Aube), 0 % en cyan, célébration sans piège de focus.
- Guitariste à 1-2 m : pastilles ~18-20 px, verdicts 14,5 px, aveugle « temps 3 / 24 » en 20 px, palier de tempo ni vu ni entendu.

## Mineures
Hooks après le return anticipé (ScaleTrainingPage.tsx:807) ; chronomètre « -1:-2 » ; messages contraires (« +6 XP » et 9/23 ☆☆☆) ; « apprise » après 0 % ; positions dans l'ordre de la box ; formules en pixel 9 px ; « S'exercer · trous » en double ; question du quiz minuscule et loin ; Impro : Démarrer collé au Micro, N4 sans .tag-on ; bas de page répétitifs.

## Questions
1. Micro par défaut, pavé en recours ?
2. À qui servent les cinq explications du barème par écran ?
3. Un « mode scène » commun à l'aveugle, aux séquences et au rappel à froid ?
