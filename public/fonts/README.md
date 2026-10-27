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

Usage (revu en 1d, seconde passe typographique) :
- **Press Start 2P** : uniquement le mot-symbole (FRETWAVE) et les très rares libellés de marque. En dessous
  de 20 px, ses capitales pleines et son absence de minuscules fatiguent la lecture — elle n'est plus utilisée
  pour les titres de page.
- **Silkscreen** (400/700) : le **chrome** — étiquettes de panneau, badges, tags, boutons, onglets, segments.
  Capitales épaisses, très lisibles **en court** (1 à 4 mots), c'est là qu'elle porte l'identité pixel.
- **Texte courant, titres de page et de carte : une sans-serif système** (aucun téléchargement, rendu natif,
  accents et ligatures parfaits). Constat de la 1d : ni VT323 ni Pixelify Sans (trait d'un pixel, capitales
  pleines pour Silkscreen) ne tiennent la lecture de paragraphes sur téléphone. La leçon retenue : **le pixel
  reste dans le chrome, le texte passe en sans**. L'identité tient par le décor, la tablature bitmap, les
  bordures, les néons et les étiquettes.
- **VT323** reste embarquée comme secours de la tablature (aucune utilisation DOM aujourd'hui) ; à retirer
  si elle reste inutilisée après la phase 2.

Rappel : la **tablature** n'utilise aucune de ces polices — elle est dessinée avec la police bitmap
maison 5×7 (`src/core/tab/font.ts`), seule à couvrir ♯ ♭ 𝄪 𝄫 ø Δ ° ↓ ↑.
