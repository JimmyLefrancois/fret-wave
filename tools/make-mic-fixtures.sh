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

# --- phase 4b ---------------------------------------------------------------------------------
# La forme de Mi mineur arpégée, une corde après l'autre : la pose à froid et la vérification.
concat_notes "$OUT/em.wav" E2 B2 E3 G3 B3 E4

# Deux basses alternées (Mi grave de Em, La de Am) : l'exercice d'enchaînement.
# Le fichier est rejoué en boucle par Chromium : l'alternance continue pendant les 30 s du drill.
concat_notes "$OUT/basses-em-am.wav" E2 A2 E2 A2 E2 A2

# Les six cordes à vide, **corrigées en hauteur** : les échantillons CC0 sont jusqu'à +17 cents haut
# (mesuré en 1c, `public/samples/nylon/manifest.json`), et l'accordage guidé exige ±5 cents. Un fichier
# brut ne peut donc jamais finir l'accordage — ce n'est pas l'app qui échoue, c'est l'instrument du test.
meas_cents() { python3 -c "
import json,sys
m=json.load(open('$ROOT/public/samples/nylon/manifest.json'))
print(next(s['measuredCents'] for s in m['samples'] if s['file']=='$1.flac'))
"; }
tuned_note() { # $1 = sortie, $2 = note, $3 = cents mesurés
  # asetrate n'accepte pas d'expression : on calcule la fréquence cible en python, à partir du taux
  # RÉEL du fichier (les FLAC ne sont pas tous à 48 kHz) — sinon on transpose de deux demi-tons
  local inrate; inrate=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$ROOT/public/samples/nylon/$2.flac")
  local rate; rate=$(python3 -c "print(round($inrate*2**(-($3)/1200)))")
  ffmpeg -v error -y -i "$ROOT/public/samples/nylon/$2.flac" \
    -af "asetrate=$rate,aresample=48000,afade=t=out:st=$(echo "$NOTE_LEN - 0.25" | bc):d=0.25" \
    -t "$NOTE_LEN" -ac 1 -ar "$SR" -c:a pcm_s16le "$1"
}
concat_tuned() { # $1 = sortie, $@ = notes
  local out="$1"; shift
  local list="$OUT/.list.txt"
  rm -f "$list"
  ffmpeg -v error -y -f lavfi -i "anullsrc=r=$SR:cl=mono" -t "$SILENCE" -c:a pcm_s16le "$OUT/.silence.wav"
  local i=0
  for n in "$@"; do
    i=$((i + 1))
    tuned_note "$OUT/.t$i-$n.wav" "$n" "$(meas_cents "$n")"
    printf "file '%s'\n" "$OUT/.t$i-$n.wav" >> "$list"
    printf "file '%s'\n" "$OUT/.silence.wav" >> "$list"
  done
  ffmpeg -v error -y -f concat -safe 0 -i "$list" -af volume=0.7 -c:a pcm_s16le "$out"
  rm -f "$list" "$OUT"/.t*-*.wav "$OUT/.silence.wav"
  printf '%s : ' "$(basename "$out")"
  ffmpeg -hide_banner -i "$out" -af volumedetect -f null - 2>&1 | grep -o 'max_volume: .*'
}

# Les six cordes à vide dans l'ordre de l'accordage guidé (6 → 1), en hauteur juste.
concat_tuned "$OUT/accordage.wav" E2 A2 D3 G3 B3 E4

# Un accord faux (Mi mineur avec la tierce majeure) : la vérification doit le voir.
concat_notes "$OUT/em-faux.wav" E2 B2 E3 Gs3 B3 E4

echo "fichiers prêts dans $OUT"
