---
target: gammes
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Jiphie\\Desktop\\dev\\fret-wave\\src\\modules\\gammes"
timestamp: 2026-10-29T11-54-00Z
slug: src-modules-gammes
---
# Critique n° 4 : module Gammes — 28/40 (22 → 27 → 28 → 28)
Method: dual-agent

## Problèmes prioritaires
- [P1] Entraînement au repos : micro rose plus fort que le geste du moment ; consigne « Corde de X · case ? » en double (bandeau + en-tête du pavé) ; paragraphe d'aide clavier. Fix : puce micro d'une ligne, doublon supprimé, aide repliée. (distill)
- [P1] Fin d'un échec : ~6 lignes de prose, boutons ~180×40 px, cases manquées listées 3 fois. Fix : une ligne de résumé + 2 gros boutons ; « 0 XP… apprise » dans « Comment c'est noté ? ». (distill, clarify)
- [P2] Jouer : pile de ~8 blocs ; 3 gestes au milieu, phrase collée. Fix : Comparer/Couleurs/Instrument/« Ce que tu écoutes » dans un « Plus ». (layout)
- [P2] Défilement horizontal 2 px sur Entraînement à 320 et 390 px (pas à 1280) ; bandeau de consigne en Aube : 14 px de marge pour 30 px de texte. (adapt)
- [P3] Étiquettes pixel 8-11 px, texte secondaire ~13 px, « ‹ Position » désactivé quasi invisible ; N1/N4 en bas de page. (typeset)

## Détecteur
CLI : 0 sur le module ; app.css : 51 alertes connues, sans hex. Navigateur : aucun contraste en échec ; 3 halos sur Jouer et Séquences ; ligne ~92 caractères sur Jouer ; cramped-padding sur la consigne en Aube.
