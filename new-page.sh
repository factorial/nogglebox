#!/usr/bin/env bash
# Usage:
#   ./new-page.sh "Page Title"                  interactive page: copies _template/ to /<next id>/
#   ./new-page.sh "Page Title" path/to/clip.mp4  video page: copies the video to /<next id>/
# Either way, the page is appended to pages.js.
set -euo pipefail
cd "$(dirname "$0")"
title="${1:?Usage: ./new-page.sh \"Page Title\" [video.mp4]}"
video="${2:-}"

last=$(ls -d [0-9]*/ 2>/dev/null | tr -d / | grep -E '^[0-9]+$' | sort -n | tail -1 || true)
id=$(( ${last:-0} + 1 ))
if [ -e "$id" ]; then echo "Refusing to overwrite existing folder $id/" >&2; exit 1; fi

js_title=$(printf '%s' "$title" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
if [ -n "$video" ]; then
  [ -f "$video" ] || { echo "No such video file: $video" >&2; exit 1; }
  # Video pages always get converted and volume-leveled, which needs ffmpeg.
  command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null \
    || { echo "Adding a video needs ffmpeg (install it with: brew install ffmpeg)" >&2; exit 1; }
  mkdir "$id"
  # Convert to H.264/AAC .mp4, the one format every browser plays. (iPhone .mov files are
  # usually HEVC, which Chrome and Firefox often can't play.) "faststart" lets playback
  # begin before the whole file has downloaded.
  # URL-friendly file name: "Telepath Trailer 1080p.mov" -> "telepath-trailer-1080p.mp4"
  base=$(basename "${video%.*}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  name="${base:-video}.mp4"
  codecs=$(ffprobe -v error -show_entries stream=codec_type,codec_name,pix_fmt -of csv=p=0 "$video" | sort | tr '\n' ' ')
  # Overall bitrate in kbit/s. Anything above ~8 Mbit/s is too heavy to stream smoothly on
  # ordinary Wi-Fi, so it gets re-encoded even if the format is already fine.
  kbps=$(ffprobe -v error -show_entries format=bit_rate -of csv=p=0 "$video" | awk '{printf "%d", $1/1000}')
  if [[ "$codecs" =~ h264,video,yuv420p ]] && { [[ "$codecs" =~ aac,audio ]] || [[ ! "$codecs" =~ audio ]]; } && (( kbps <= 8000 )); then
    echo "Video is already web-friendly; repackaging without re-encoding..."
    ffmpeg -hide_banner -loglevel error -i "$video" -map 0:v:0 -map "0:a:0?" -c copy -write_tmcd 0 -movflags +faststart "$id/$name" \
      || { rm -rf "$id"; echo "Video repackaging failed" >&2; exit 1; }
  else
    echo "Converting video for the web (this can take a minute)..."
    (( kbps > 8000 )) && echo "  (it's ${kbps} kbit/s, too heavy to stream smoothly, so it's being made lighter)"
    ffmpeg -hide_banner -loglevel error -i "$video" -map 0:v:0 -map "0:a:0?" \
      -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p \
      -vf "scale='min(1920,iw)':-2" \
      -c:a aac -b:a 160k -ac 2 \
      -write_tmcd 0 -movflags +faststart \
      "$id/$name" || { rm -rf "$id"; echo "Video conversion failed" >&2; exit 1; }
  fi
  # Always bring its sound to the site's standard loudness, so no video is louder or quieter
  # than the rest. If that fails, don't leave a half-made page behind.
  ./normalize-audio.sh "$id/$name" || { rm -rf "$id"; echo "Volume leveling failed; no page was added" >&2; exit 1; }
  js_name=$(printf '%s' "$name" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  entry="  { id: $id, title: \"$js_title\", video: \"$js_name\" },"
else
  cp -R _template/ "$id/"
  esc_title=$(printf '%s' "$title" | sed -e 's/[&|\\]/\\&/g')
  sed -i.bak "s|__TITLE__|$esc_title|g" "$id/index.html" && rm "$id/index.html.bak"
  entry="  { id: $id, title: \"$js_title\" },"
fi

python3 - "$entry" <<'PY'
import sys
p = "pages.js"
s = open(p).read()
i = s.rindex("];")
open(p, "w").write(s[:i] + sys.argv[1] + "\n" + s[i:])
PY

echo "Created page $id ($([ -n "$video" ] && echo video || echo interactive)) and added it to pages.js"
