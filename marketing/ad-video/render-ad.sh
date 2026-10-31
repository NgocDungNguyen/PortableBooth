#!/usr/bin/env sh
# PortableBooth ad: one-command local render on macOS / Linux.
# Usage:  ./render-ad.sh                     (voice-over already at public/audio/vo.mp3)
#         ./render-ad.sh ~/Downloads/vo.mp3  (copy the voice-over in first)
#         ./render-ad.sh --no-capture        (re-render only: reuse the last app recordings)
set -e
cd "$(dirname "$0")"
case "$1" in
  ""|--*) exec node tools/setup.mjs "$@" ;;
  *) vo="$1"; shift; exec node tools/setup.mjs --vo="$vo" "$@" ;;
esac
