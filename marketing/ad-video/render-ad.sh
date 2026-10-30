#!/usr/bin/env sh
# PortableBooth ad: one-command local render on macOS / Linux.
# Usage:  ./render-ad.sh                     (voice-over already at public/audio/vo.mp3)
#         ./render-ad.sh ~/Downloads/vo.mp3  (copy the voice-over in first)
set -e
cd "$(dirname "$0")"
if [ -n "$1" ]; then
  vo="$1"; shift
  exec node tools/setup.mjs --vo="$vo" "$@"
fi
exec node tools/setup.mjs "$@"
