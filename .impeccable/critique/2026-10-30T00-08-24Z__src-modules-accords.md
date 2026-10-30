---
target: vue accords
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\Jiphie\\Desktop\\dev\\fret-wave\\src\\modules\\accords"
timestamp: 2026-10-30T00-08-24Z
slug: src-modules-accords
---
# Critique : vue Accords (#/accords, leçon, QCM)
Method: dual-agent

## Heuristiques (21/40, Acceptable)
1 Visibilité 2 · 2 Réel 2 · 3 Contrôle 3 · 4 Cohérence 2 · 5 Prévention 1 · 6 Reconnaissance 2 · 7 Efficacité 2 · 8 Sobriété 1 · 9 Récupération 3 · 10 Aide 3

## Spécificité
Habillage propre au produit ; structure de l'index générique (catalogue de 35 lignes dépliées, aucune boîte d'accord). Détecteur : CLI 0 ; navigateur 33/4/6, dont faux positifs (ombres dures, néons, rayures). Constats réels : h2→h4 (ChordsPage.tsx:158,192), h4 « Em0 2 2 0 0 0 », 7 halos violets sur cartes, cibles < 38 px (Avis de prof 28, .linklike 24, case 16).

## Problèmes prioritaires
- [P0] QCM « Reconnaître » affiche la réponse : anonymousScore (quiz.ts:127) garde ev.chord, layout.ts:332 l'affiche. Fix : retirer chord des événements + test. (harden)
- [P1] .chord-name en Silkscreen capitales (app.css:1349) : EM/E, AM/A. Fix : sans-serif 700 17-18 px. (typeset)
- [P1] Index de 10 écrans, 35 lignes identiques, « PRÉREQUIS » + « entrer », 35 boutons « entrer » sans nom. Fix : replier les paliers hors cours, vignette de boîte, aria-label, 2 colonnes ≥ 900. (distill, layout)
- [P2] Héros sans poids : Em 17 px < titre 22 px, Power chords au poids d'Apprendre, règles dans le héros, lead-band redondant. (layout)
- [P2] Leçon illisible à distance : boîte ~140 px, nav 7 étapes sur 2 lignes, action d'étape non primaire au ras de la nav. (adapt)

## Personas
Jordan : jargon P1-P7/palier/prérequis, EM vs E, « pose majeur », « nœud savoir ». Casey : 9000 px, QCM option A seule au-dessus du pli, « Nouvelle série » sans confirmation, boîte trop petite. Sam : 35 « entrer », h4 avec cases, progressbar sans nom, « en vert », aria-label tab de 24 notes.

## Mineurs
« branche » doublé dans P2b ; « Et après ? » recommande Em après Em ; « Retour à la leçon » vers leçon jamais ouverte ; .chord-row.locked 0.82 ; « Avis de prof » sans ▸ ; 20 tirets cadratins.

## Questions
Boîte d'accord absente de l'index ? Doctrine d'honnêteté écrite 4 fois ? #/accords devrait-il ouvrir directement sur la leçon du prochain accord ?
