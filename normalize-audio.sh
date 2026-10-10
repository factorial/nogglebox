#!/usr/bin/env bash
# Usage: ./normalize-audio.sh path/to/video.mp4 [more.mp4 …]
# Brings each video's sound to the site's standard loudness, so no video is much louder or
# quieter than the rest. Only the audio is re-encoded; the picture is copied untouched.
# (new-page.sh runs this automatically on new videos.)
set -euo pipefail
TARGET_LUFS=-21   # the site's standard loudness (integrated, EBU R128)
PEAK=-1.5         # keep peaks below this (dBTP), so nothing clips

for f in "$@"; do
  if ! ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | grep -q .; then
    echo "$f: no audio, skipping"; continue
  fi
  # Pass 1: measure. Pass 2: adjust using those measurements (more accurate than one pass).
  m=$(ffmpeg -hide_banner -nostats -i "$f" -vn \
        -af "loudnorm=I=$TARGET_LUFS:TP=$PEAK:LRA=11:print_format=json" -f null - 2>&1 \
      | sed -n '/^{/,/^}/p')
  get() { echo "$m" | sed -n "s/.*\"$1\" : \"\\(.*\\)\".*/\\1/p"; }
  tmp="${f%.*}.normalizing.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$f" -map 0:v:0 -map 0:a:0 -c:v copy \
    -af "loudnorm=I=$TARGET_LUFS:TP=$PEAK:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
    -c:a aac -b:a 160k -ar 48000 -write_tmcd 0 -movflags +faststart "$tmp"
  mv "$tmp" "$f"
  echo "$f: $(get input_i) LUFS → $TARGET_LUFS LUFS"
done
