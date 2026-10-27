# Polices d'interface (auto-hébergées, hors ligne)

Toutes sous **SIL Open Font License 1.1** — le texte intégral est dans `OFL-*.txt`, à côté de chaque
police. Sous-ensemble **latin** de Google Fonts (couvre le français : accents, `œ`, `’`, flèches),
téléchargé le 2026-10-27 depuis `fonts.gstatic.com` via l'API `fonts.googleapis.com/css2`
(agent Chrome), puis servi localement pour que l'app fonctionne hors connexion (PWA).

| Fichier | Famille | Graisses | Source | Licence | Poids |
|---|---|---|---|---|---|
| `press-start-2p-400.woff2` | Press Start 2P | 400 | `ofl/pressstart2p` | OFL 1.1 (`OFL-pressstart2p.txt`) | 12,5 ko |
| `silkscreen-400.woff2` | Silkscreen | 400 | `ofl/silkscreen` | OFL 1.1 (`OFL-silkscreen.txt`) | 8,4 ko |
| `silkscreen-700.woff2` | Silkscreen | 700 | `ofl/silkscreen` | OFL 1.1 (`OFL-silkscreen.txt`) | 7,5 ko |
| `vt323-400.woff2` | VT323 | 400 | `ofl/vt323` | OFL 1.1 (`OFL-vt323.txt`) | 17,9 ko |

Usage : **Press Start 2P** pour les titres et les gros chiffres (très large, à réserver aux textes
courts), **Silkscreen** pour les étiquettes, boutons et majuscules espacées, **VT323** pour le texte
courant (le plus lisible en petit sur téléphone). Tailles toujours multiples du pixel logique, aucun
lissage.

Rappel : la **tablature** n'utilise aucune de ces polices — elle est dessinée avec la police bitmap
maison 5×7 (`src/core/tab/font.ts`), seule à couvrir ♯ ♭ 𝄪 𝄫 ø Δ ° ↓ ↑.
