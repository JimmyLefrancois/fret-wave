# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

L'auteur du projet, guitariste francophone, qui joue seul, guitare en main devant l'écran (ordinateur ou téléphone posé devant lui), avec un micro. Le travail se fait les mains occupées : l'interface doit rester lisible à distance et ne jamais exiger d'interaction fine pendant qu'on joue.

## Product Purpose

Fretwave est une boîte à outils pour guitariste (D128) : voir et écouter une gamme en tablature, consulter une liste d'accords, s'accorder, jouer au métronome, travailler une gamme en boucle au micro, improviser sur un accompagnement, et revoir à intervalles espacés les formes de gammes qu'on travaille. Ce n'est plus un cours : ni XP, ni niveaux, ni parcours, ni leçons. Le site et le compte facultatif sont servis par un Worker Cloudflare. Le succès : l'outil voulu est à un toucher, et il ne se met pas en travers du jeu.

## Positioning

- Des outils directs plutôt qu'un parcours : on ouvre l'app sur ses gammes, on choisit, on joue.
- Tablature rendue par un moteur maison en pixel art (canvas, un seul pixel logique à échelle entière), avec deux thèmes : Synthwave Neon et Aube.

## Operating Context

Navigation par hash : `#/gammes` (ouverture), `#/accords`, `#/accordeur`, `#/metronome`, `#/reglages`. Gammes regroupe Découvrir, Séquences, Improviser et la séance de révision. Entrées : micro (hauteur mono via pitchy) ; sortie audio Tone.js avec échantillons CC0. Persistance en localStorage avec export/import JSON ; le journal se synchronise avec le compte quand on est connecté. L'app fonctionne entièrement sans compte ni réseau.

## Capabilities and Constraints

- Interface et textes en français ; notation anglo-saxonne avec affichage solfège.
- Une déclaration (« sans micro ») n'est jamais une preuve : aucun score au journal.
- Pas de nouvelle dépendance sans l'annoncer.
- Règles musicales et règles de révision (paliers Leitner, seuils) ne changent que sur demande explicite.
- Texte courant en sans-serif système ; polices pixel réservées aux étiquettes.
- Couleurs d'intervalle hors thème ; aucun hex dans `app.css`, tout passe par les tokens.

## Brand Commitments

Nom de travail « Fretwave ». Direction artistique pixel art, thèmes Synthwave Neon et Aube (détails dans `docs/ARCHITECTURE.md` §3 et `BRIEF.md`).

**Engagement contraignant (confirmé par l'auteur) :** le style pixel art est voulu. Le thème Synthwave Neon (et son jumeau Aube) et les tokens de `src/core/themes/` sont conservés ; aucune refonte vers un autre monde visuel. Les améliorations proposées restent dans ce monde. Toute modif de style passe par les tokens de thème, et les deux thèmes (Synthwave, Aube) doivent rester cohérents.

**Hors périmètre du travail de design DOM/CSS :** la tablature, dessinée en canvas par le moteur maison (`src/core/tab/`). Elle est exclue des demandes de design.

## Evidence on Hand

Docs de référence : `PROJECT.md` (statut), `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `MUSIC_DESIGN.md`, `BRIEF.md`. Aucun témoignage, chiffre d'usage ni utilisateur externe documenté : ne rien fabriquer de tel.

## Product Principles

1. Un outil, pas un cours : rien ne se met entre l'ouverture de l'app et le jeu.
2. L'honnêteté d'abord : ce qui est entendu compte, ce qui est déclaré ne compte pas.
3. La tablature est l'objet central ; l'interface s'efface autour d'elle.
4. Local, gratuit, compte facultatif.

## Accessibility & Inclusion

- Utilisable sur mobile à 390 px de large, sans action principale masquée.
- Contraste WCAG AA pour le texte courant sur les deux thèmes.
