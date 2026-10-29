# Fretwave

Application web d'apprentissage de la guitare : tablature en pixel art, écoute au micro, répétition espacée.
Interface et textes en français. Projet solo, sans backend.

## Stack
Vite + TypeScript + React 19 · Canvas 2D (un seul « pixel logique », échelle entière) · `tonal` (théorie) · Tone.js (sortie audio) · `pitchy` (hauteur au micro) · Vitest · localStorage · routeur par hash (`#/hub`, `#/gammes`, `#/accords`, `#/accordeur`, `#/reglages`).

## Commandes
- `npm run dev` : serveur sur :5173 (UN SEUL à la fois, sinon CSS périmé)
- `npx tsc --noEmit` : types
- `npx vitest run <fichier>` : tests ciblés (ne lance pas toute la suite sans raison)
- `npm test` : suite complète, à la fin d'une tâche seulement
- `npm run build` : build de production

## Architecture
- `src/core/theory/` : notes, gammes, accordages, positions, doigtés (logique pure)
- `src/core/tab/` : modèle `TabScore`, générateurs, layout pur, rendu canvas
- `src/core/audio/` : sortie (échantillons, bus master, drone, métronome)
- `src/core/input/` : micro, détection de hauteur, calibration, accordeur, polyphonie
- `src/core/progress/` : journal, maîtrise, Leitner, XP
- `src/core/themes/` : design tokens (thèmes Synthwave Neon et Aube)
- `src/modules/gammes/`, `src/modules/accords/` : modules pédagogiques
- `src/app/` : pages React, `src/data/` : voicings
- `tools/*.mjs` : contrôles de mise en page et de micro simulé (Playwright), hors `npm test`

## Règles
- Le style pixel art est voulu : garde le thème Synthwave Neon (et son jumeau Aube) et les tokens de `src/core/themes/`. Pas de refonte vers un autre style ; les améliorations se font dans ce monde (voir `DESIGN.md`).
- Toute modif de style passe par les tokens de thème, et les deux thèmes (Synthwave, Aube) doivent rester cohérents.
- Impeccable (skill de design) ne concerne pas la tablature : elle est dessinée en canvas par le moteur maison, alors qu'Impeccable travaille sur le DOM et le CSS. `src/core/tab/` est exclu de ses demandes.
- La logique vit dans des modules TS purs testables ; React ne gère que l'UI.
- Aucun hex de couleur dans `app.css` : tout passe par les tokens de thème.
- Les couleurs d'intervalle (`core/tab/colors.ts`) sont hors thème.
- Une déclaration de l'élève (« sans micro ») n'est jamais une preuve : pas de score au journal.
- Texte courant en sans-serif système ; polices pixel réservées aux étiquettes.
- Tout changement de logique s'accompagne d'un test. Pas de nouvelle dépendance sans le dire.
- Ne change aucune règle musicale, barème d'XP ou seuil de maîtrise sans demande explicite.

## Économie de contexte (IMPORTANT)
- NE LIS JAMAIS en entier `PROJECT.md`, `MUSIC_DESIGN.md` ni `BRIEF.md`. Utilise `grep -n` pour trouver la section utile, puis lis seulement ces lignes.
- Ignore `package-lock.json`, `public/samples/`, `dist/`, `.shots/`.
- Pour une tâche, ouvre d'abord le dossier concerné, pas tout le dépôt.
- Réponses courtes : montre le diff ou le résumé, pas les fichiers entiers.
- Les commentaires "docs/ARCHITECTURE.md §X.Y" renvoient à une section : fais grep -n "^### X.Y" docs/ARCHITECTURE.md et lis seulement cette section (pour §X seul : `grep -n "^## X\." docs/ARCHITECTURE.md`).

## Où est la doc
- `PROJECT.md` : statut, état exact, §0, plan des phases (§9) et prochaine étape (§12).
- `docs/ARCHITECTURE.md` : §1-7 (stack, architecture, direction artistique, maquettes, risques).
- `docs/HYPOTHESES.md` : §8 et §8 bis.
- `docs/DECISIONS.md` : §10, décisions D1-D77.
- `MUSIC_DESIGN.md` : conventions musicales, curriculum, avis de prof.
- `docs/archive/` : `PHASES.md` (états exacts 1c-4a, refonte d'interface), `JOURNAL.md` (§11) — ne pas lire sauf demande.
