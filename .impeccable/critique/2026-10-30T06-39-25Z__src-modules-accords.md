---
target: vue accords
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Jiphie\\Desktop\\dev\\fret-wave\\src\\modules\\accords"
timestamp: 2026-10-30T06-39-25Z
slug: src-modules-accords
---
# Critique n° 2 : vue Accords (#/accords, leçon, QCM), après correctifs
Method: dual-agent

## Heuristiques (26/40, Acceptable)
1 Visibilité 3 · 2 Réel 3 · 3 Contrôle 3 · 4 Cohérence 2 · 5 Prévention 3 · 6 Reconnaissance 3 · 7 Efficacité 2 · 8 Sobriété 2 · 9 Récupération 2 · 10 Aide 3

## Spécificité
Authored (boîte d'accord dans le héros et chaque ligne, tablature colorée, Aube réussi) ; traitement uniforme des panneaux (accent + halo + Silkscreen + paragraphe). Détecteur : CLI 0 ; navigateur 15/4/6 (33 avant). Réels : halos simultanés (3 index, 3 QCM), 2 titres Silkscreen mal coupés à 390, 9 tirets cadratins. Mesures : 0 débordement, 0 cible < 38 px, 0 échec de contraste, plan de titres sans saut.

## Problèmes prioritaires
- [P1] Micro éteint par défaut ; primaires = déclarations (Doigt posé, Elle sonne) ; Démarrer désactivé sur Fixer/Enchaîner ; indice micro cite le « pavé numérique » (engine.ts:91). Fix : état micro de leçon, primaire « Ouvrir le micro », déclaration secondaire. (onboard)
- [P1] Halo couplé à l'accent dans Panel (app.css:200) ; 6 couleurs d'accent dans la leçon. Fix : séparer accent / active. (quieter)
- [P1] QCM : verdict et « Suivante » sous la nav à 390 ; bande d'intro et barre prennent l'écran ; couleurs d'intervalle trahissent la qualité dans « Reconnaître » (avis du prof). (adapt)
- [P2] Premier lancement : deux paliers « current » (Fondations total 0 + P1), ouverture en déficit (0/35, JAMAIS VÉRIFIÉ). (onboard)
- [P2] Étapes de leçon : texte avant geste ; boutons d'écoute sous le pli ; « étape suivante » de poids variable. (distill)

## Personas
Jordan : deux paliers dépliés, QCM/pose à froid/note repère, jamais invité au micro. Casey : Suivante sous le pli, boîte héros petite, micro à retrouver par étape, barre Vérifier qui couvre les cordes. Sam : deux nav au même aria-label, verdict QCM sans aria-live, aria-pressed sur réponses, case brute au lieu de Switch.

## Mineurs
Vide de 150 px dans « La leçon, en sept étapes » ; « tu peux toujours entrer quand même » répété ; pastilles QCM violettes ; « G# » ; « réglages au prochain ▶ » ; pas de clôture à l'étape 7.

## Questions
Leçon micro activé par défaut ? Honnêteté derrière un seul « Comment c'est jugé » ? Accords comme instrument unique, parcours à un tap ?
