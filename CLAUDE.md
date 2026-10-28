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
- La logique vit dans des modules TS purs testables ; React ne gère que l'UI.
- Aucun hex de couleur dans `app.css` : tout passe par les tokens de thème.
- Les couleurs d'intervalle (`core/tab/colors.ts`) sont hors thème.
- Une déclaration de l'élève (« sans micro ») n'est jamais une preuve : pas de score au journal.
- Texte courant en sans-serif système ; polices pixel réservées aux étiquettes.
- Tout changement de logique s'accompagne d'un test. Pas de nouvelle dépendance sans le dire.
- Ne change aucune règle musicale, barème d'XP ou seuil de maîtrise sans demande explicite.

## Économie de contexte (IMPORTANT)
- NE LIS JAMAIS en entier `PROJECT.md` (228 ko), `MUSIC_DESIGN.md` ni `BRIEF.md`. Utilise `grep -n` pour trouver la section utile, puis lis seulement ces lignes.
- Ignore `package-lock.json`, `public/samples/`, `dist/`, `.shots/`.
- Pour une tâche, ouvre d'abord le dossier concerné, pas tout le dépôt.
- Réponses courtes : montre le diff ou le résumé, pas les fichiers entiers.

## Où est la doc
- `PROJECT.md` : état du projet et prochaine étape (§12). Décisions D1-D70 en §10.
- `MUSIC_DESIGN.md` : conventions musicales, curriculum, avis de prof.
- `docs/archive/` : historique des phases passées (ne pas lire sauf demande).
