# Échantillons de guitare (phase 1c)

Deux banques, **toutes deux CC0 1.0 (domaine public)** : aucune attribution n'est obligatoire, elle est donnée par courtoisie
(page « Audio » de l'application, section « Crédits et licences »).

| Dossier | Instrument | Source | Licence | Fichiers | Poids |
|---|---|---|---|---|---|
| `nylon/` | Guitare classique espagnole | FreePats « Spanish Classical Guitar », version 2019-06-18, roberto@zenvoid.org — https://freepats.zenvoid.org/Guitar/acoustic-guitar.html | CC0 1.0 | 48 FLAC mono 44,1 kHz (G1 → C6, un par demi-ton ou presque) | 5,3 Mo |
| `electric/` | Guitare électrique, son direct, cordes filets plats | Karoryfer Samples « Emilyguitar » (D. Smolken), commit `b4920dc` — https://github.com/sfzinstruments/karoryfer.emilyguitar | CC0 1.0 | 90 FLAC mono 44,1 kHz (Ré♭2 → Ré6, une note sur trois × couches p, mf×3, f) | 6,8 Mo |

Chaque dossier contient : les fichiers audio, `LICENSE.txt` (texte légal fourni par la source), `SOURCE-README.txt`
(lisez-moi de la source) et `manifest.json` (provenance, licence, modifications, et par fichier : taille, SHA-256, durée,
écart de hauteur mesuré en cents, gain de nivellement).

- **nylon** : fichiers FLAC **identiques octet pour octet** à ceux de l'archive d'origine (seulement renommés : `#` → `s`).
- **electric** : WAV 24 bits d'origine → FLAC 16 bits (dither triangulaire), fondu de sortie de 80 ms ; aucun autre traitement.
- La correction de hauteur et le niveau sont appliqués **à la lecture**, pas dans les fichiers.

Régénérer : `node tools/build-samples.mjs [nylon|electric|all]` (ffmpeg, 7z, curl, réseau). Le résultat est
déterministe (les 138 empreintes SHA-256 ont été retrouvées identiques lors d'une seconde génération). Le test
`tests/samples.test.ts` vérifie licence, empreintes, en-têtes FLAC, étiquetage des notes et couverture du manche.

**Écartés** (voir `MUSIC_DESIGN.md` §11.1) : `tonejs-instruments` (chaîne de licences invérifiable), SoundFonts FluidR3 /
Musyng / FatBoy (CC BY / CC BY-SA, attribution ou partage à l'identique), FreePats « FSS Steel-String Acoustic Guitar »
(GPL v3).
