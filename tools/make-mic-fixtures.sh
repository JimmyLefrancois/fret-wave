#!/usr/bin/env bash
# Faux micro pour la vérification de l'entrée audio (phase 3).
#
# Construit des WAV à partir des **échantillons nylon CC0** du dépôt, que Chromium peut rejouer comme
# s'ils venaient d'un micro (`--use-file-for-fake-audio-capture`). C'est la seule façon de vérifier
# la chaîne getUserMedia → AudioWorklet → pitchy → tablature sans guitare.
#
#   tools/make-mic-fixtures.sh
#   node tools/mic-check.mjs "$(pwd)/.shots/mic/strings2.wav"
#
# Prérequis : ffmpeg. Les fichiers vont dans .shots/mic (ignoré par git).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.shots/mic"
SR=48000
NOTE_LEN=1.3
SILENCE=0.45

command -v ffmpeg >/dev/null || { echo "ffmpeg manquant"; exit 1; }
mkdir -p "$OUT"

# une corde pincée d'un peu plus d'une seconde, fondu de sortie pour éviter le clic de coupe
note() { # $1 = fichier de sortie, $2 = nom de note dans public/samples/nylon
  ffmpeg -v error -y -i "$ROOT/public/samples/nylon/$2.flac" \
    -ar "$SR" -ac 1 -t "$NOTE_LEN" -af "afade=t=out:st=$(echo "$NOTE_LEN - 0.25" | bc):d=0.25" \
    -c:a pcm_s16le "$1"
}

concat_notes() { # $1 = fichier de sortie, $@ = notes dans l'ordre
  local out="$1"; shift
  local list="$OUT/.list.txt"
  rm -f "$list"
  ffmpeg -v error -y -f lavfi -i "anullsrc=r=$SR:cl=mono" -t "$SILENCE" -c:a pcm_s16le "$OUT/.silence.wav"
  local i=0
  for n in "$@"; do
    i=$((i + 1))
    note "$OUT/.n$i-$n.wav" "$n"
    printf "file '%s'\n" "$OUT/.n$i-$n.wav" >> "$list"
    printf "file '%s'\n" "$OUT/.silence.wav" >> "$list"
  done
  # volume 0,7 : les échantillons d'origine crêtent près de 0 dBFS
  ffmpeg -v error -y -f concat -safe 0 -i "$list" -af volume=0.7 -c:a pcm_s16le "$out"
  rm -f "$list" "$OUT"/.n*-*.wav "$OUT/.silence.wav"
  printf '%s : ' "$(basename "$out")"
  ffmpeg -hide_banner -i "$out" -af volumedetect -f null - 2>&1 | grep -o 'max_volume: .*'
}

# Le segment par défaut de l'entraînement (2 cordes graves, box 1 de La mineur pentatonique)
concat_notes "$OUT/strings2.wav" A2 C3 D3 E3

# La box entière, montée puis descente : de quoi remplir n'importe quel trou de la position
concat_notes "$OUT/box.wav" A2 C3 D3 E3 G3 A3 C4 D4 E4 G4 A4 C5 C5 A4 G4 E4 D4 C4 A3 G3 E3 D3 C3 A2

# Une note fausse (Fa3, un demi-ton au-dessus de Mi3) pour vérifier le chemin d'erreur
concat_notes "$OUT/faux.wav" F3 F3 D3

echo "fichiers prêts dans $OUT"
