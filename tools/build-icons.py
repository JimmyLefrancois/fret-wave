#!/usr/bin/env python3
"""Génère les icônes de la PWA depuis tools/icon-source.png (dépend de Pillow, hors npm).

Usage : python3 tools/build-icons.py

L'image source est un carré arrondi posé sur une marge noire. Trois rendus en sortent :
- `any` : carré arrondi seul, coins transparents (navigateurs, bureau) ;
- `apple-touch-icon` : plein cadre sur le fond du thème, iOS arrondit lui-même et refuse la transparence ;
- `maskable` : réduit dans la zone sûre d'Android (cercle de 80 %), sinon le masque coupe la tête du manche.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools' / 'icon-source.png'
OUT = ROOT / 'public' / 'icons'

# Carré arrondi mesuré dans la source, marge noire exclue.
CROP = (81, 81, 1173, 1173)
RADIUS_RATIO = 0.135
# Fond du thème Synthwave (--bg), identique au background_color du manifeste.
BG = (13, 2, 33, 255)
# La tête du manche est à 59 % du côté depuis le centre : à 68 %, elle reste dans le cercle sûr de 40 %.
MASKABLE_SCALE = 0.68
SUPERSAMPLE = 4


def rounded(img: Image.Image) -> Image.Image:
    """Applique les coins arrondis, avec un masque suréchantillonné pour éviter le crénelage."""
    big = img.width * SUPERSAMPLE
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * RADIUS_RATIO), fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask.resize(img.size, Image.Resampling.LANCZOS))
    return out


def on_background(img: Image.Image, canvas: int, scale: float = 1.0) -> Image.Image:
    side = round(canvas * scale)
    art = rounded(img.resize((side, side), Image.Resampling.LANCZOS))
    out = Image.new('RGBA', (canvas, canvas), BG)
    offset = (canvas - side) // 2
    out.alpha_composite(art, (offset, offset))
    return out.convert('RGB')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    art = Image.open(SOURCE).convert('RGB').crop(CROP)

    for size in (192, 512):
        rounded(art.resize((size, size), Image.Resampling.LANCZOS)).save(OUT / f'icon-{size}.png', optimize=True)
        on_background(art, size, MASKABLE_SCALE).save(OUT / f'maskable-{size}.png', optimize=True)
    on_background(art, 180).save(OUT / 'apple-touch-icon.png', optimize=True)
    rounded(art.resize((48, 48), Image.Resampling.LANCZOS)).save(OUT / 'favicon-48.png', optimize=True)


if __name__ == '__main__':
    main()
