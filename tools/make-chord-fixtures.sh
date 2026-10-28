#!/usr/bin/env bash
# Faux micro pour l'écoute **polyphonique** (phase 5) : des accords plaqués, pas des notes seules.
#
# Construit des WAV à partir des échantillons nylon CC0 du dépôt (mêmes fichiers que la banque de sons),
# en superposant six cordes avec un léger étalement — c'est un strum, pas six attaques simultanées.
#
#   tools/make-chord-fixtures.sh
#   node tools/chord-poly-check.mjs .shots/mic/em-strum.wav
#
# Ce que ça prouve : la chaîne complète micro → Worklet → tampon → analyse polyphonique → écran.
# Ce que ça ne prouve pas : une vraie guitare, un vrai micro, une vraie pièce (voir PROJECT.md §12).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.shots/mic"
SR=48000
STRUM_MS=18        # 18 ms entre deux cordes : 90 ms du Mi grave au Mi aigu, un strum humain
LEAD_MS=350        # silence avant le strum (l'app doit trouver l'attaque)
TAIL=1.6           # tenue après le dernier départ

command -v ffmpeg >/dev/null || { echo "ffmpeg manquant"; exit 1; }
mkdir -p "$OUT"

# $1 sortie · $2 gain corde aiguë (1 = normale, 0.12 = étouffée) · $3.. notes dans l'ordre grave → aigu
chord() {
  local out="$1"; shift
  local muteGain="$1"; shift
  local inputs=() filters=() mix="" i=0
  for note in "$@"; do
    inputs+=(-i "$ROOT/public/samples/nylon/$note.flac")
    local delay=$(( i * STRUM_MS ))
    local gain=1
    # la dernière corde passée en argument est celle qu'on veut étouffer
    if [[ "$i" -eq $(( $# - 1 )) && "$muteGain" != "1" ]]; then gain="$muteGain"; fi
    filters+=("[$i:a]atrim=0:2.2,adelay=${delay}|${delay},volume=${gain}[s$i]")
    mix+="[s$i]"
    i=$(( i + 1 ))
  done
  ffmpeg -v error -y "${inputs[@]}" \
    -filter_complex "$(IFS=';'; echo "${filters[*]}");${mix}amix=inputs=$i:normalize=1,volume=1.6,apad=pad_dur=${TAIL}[mix];[mix]adelay=${LEAD_MS}|${LEAD_MS}" \
    -ar "$SR" -ac 1 -t "$(LC_ALL=C awk "BEGIN{printf \"%.2f\", $LEAD_MS/1000 + 2.2}")" -c:a pcm_s16le "$out"
  echo "$(basename "$out")"
}

# Em ouvert : E2 B2 E3 G3 B3 E4 (Mi grave → Mi aigu)
chord "$OUT/em-strum.wav" 1 E2 B2 E3 G3 B3 E4
# Mi majeur : la même chose mais Sol♯ — sert à vérifier le message « Sol♯ au lieu de Sol »
chord "$OUT/e-major-strum.wav" 1 E2 B2 E3 Gs3 B3 E4
# Em avec la corde de Si aiguë étouffée : la seule qui manque doit être signalée
chord "$OUT/em-muted.wav" 0.12 E2 B2 E3 G3 B3 E4
