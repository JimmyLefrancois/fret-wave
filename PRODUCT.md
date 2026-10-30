# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Guitaristes débutants à intermédiaires, francophones, qui travaillent seuls, guitare en main devant l'écran (ordinateur ou téléphone posé devant eux), avec un micro. Sessions courtes et régulières. Le travail se fait les mains occupées : l'interface doit rester lisible à distance et ne jamais exiger d'interaction fine pendant qu'on joue.

## Product Purpose

Fretwave apprend la guitare par la tablature (gammes, accords, accordeur), avec écoute au micro et répétition espacée (Leitner, journal, maîtrise, XP). Projet solo, sans backend, hébergé sur GitHub Pages. Le succès : l'élève progresse réellement, mesuré par ce qu'il a joué et que l'app a entendu.

## Positioning

- Pédagogie par formes plutôt que catalogue : curriculum pensé par un prof (gammes débutant par la pentatonique mineure, accords par paliers, cycle en 7 étapes), pas 1 248 gammes.
- Tablature rendue par un moteur maison en pixel art (canvas, un seul pixel logique à échelle entière), avec deux thèmes : Synthwave Neon et Aube.

## Operating Context

Navigation par hash : `#/hub`, `#/gammes`, `#/accords`, `#/accordeur`, `#/reglages`. Modules : Gammes, Accords, Accordeur (écran de premier rang). Entrées : micro (hauteur mono via pitchy, accord attendu en polyphonie) ; sortie audio Tone.js avec échantillons CC0. Persistance en localStorage avec export/import JSON.

## Capabilities and Constraints

- Interface et textes en français ; notation anglo-saxonne avec affichage solfège.
- Une déclaration de l'élève (« sans micro ») n'est jamais une preuve : aucun score au journal.
- Les verdicts d'écoute sont des niveaux de confiance, jamais binaires ; pas de verdict par corde en strum.
- Pas de backend, pas de nouvelle dépendance sans l'annoncer.
- Règles musicales, barème d'XP et seuils de maîtrise ne changent que sur demande explicite.
- Texte courant en sans-serif système ; polices pixel réservées aux étiquettes.
- Couleurs d'intervalle hors thème ; aucun hex dans `app.css`, tout passe par les tokens.

## Brand Commitments

Nom de travail « Fretwave ». Direction artistique pixel art, thèmes Synthwave Neon et Aube (détails dans `docs/ARCHITECTURE.md` §3 et `BRIEF.md`).

**Engagement contraignant (confirmé par l'auteur) :** le style pixel art est voulu. Le thème Synthwave Neon (et son jumeau Aube) et les tokens de `src/core/themes/` sont conservés ; aucune refonte vers un autre monde visuel. Les améliorations proposées restent dans ce monde. Toute modif de style passe par les tokens de thème, et les deux thèmes (Synthwave, Aube) doivent rester cohérents.

**Hors périmètre du travail de design DOM/CSS :** la tablature, dessinée en canvas par le moteur maison (`src/core/tab/`). Elle est exclue des demandes de design.

## Evidence on Hand

Docs de référence : `PROJECT.md` (statut), `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `MUSIC_DESIGN.md`, `BRIEF.md`. Aucun témoignage, chiffre d'usage ni utilisateur externe documenté : ne rien fabriquer de tel.

## Product Principles

1. L'honnêteté pédagogique d'abord : ce qui est entendu compte, ce qui est déclaré ne compte pas.
2. Des formes et des paliers, pas des catalogues.
3. La tablature est l'objet central ; l'interface s'efface autour d'elle.
4. Local, gratuit, sans compte.

## Accessibility & Inclusion

- Utilisable sur mobile à 390 px de large, sans action principale masquée.
- Contraste WCAG AA pour le texte courant sur les deux thèmes.
