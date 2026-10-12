#!/usr/bin/env bash
# Usage:
#   ./new-page.sh "Page Title"                  interactive page: copies _template/ to pages/<next id>/
#   ./new-page.sh "Page Title" path/to/clip.mp4  video page: puts the video in pages/<next id>/
# Either way, the page is appended to pages.js.
set -euo pipefail
cd "$(dirname "$0")"
title="${1:?Usage: ./new-page.sh \"Page Title\" [video.mp4]}"
video="${2:-}"

mkdir -p pages
last=$(cd pages && ls -d [0-9]*/ 2>/dev/null | tr -d / | grep -E '^[0-9]+$' | sort -n | tail -1 || true)
id=$(( ${last:-0} + 1 ))
dir="pages/$id"
if [ -e "$dir" ]; then echo "Refusing to overwrite existing folder $dir/" >&2; exit 1; fi

js_title=$(printf '%s' "$title" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
if [ -n "$video" ]; then
  [ -f "$video" ] || { echo "No such video file: $video" >&2; exit 1; }
  # Video pages always get converted and volume-leveled, which needs ffmpeg.
  command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null \
    || { echo "Adding a video needs ffmpeg (install it with: brew install ffmpeg)" >&2; exit 1; }
  mkdir "$dir"
  # Convert to H.264/AAC .mp4, the one format every browser plays. (iPhone .mov files are
  # usually HEVC, which Chrome and Firefox often can't play.) "faststart" lets playback
  # begin before the whole file has downloaded.
  # URL-friendly file name: "Telepath Trailer 1080p.mov" -> "telepath-trailer-1080p.mp4"
  base=$(basename "${video%.*}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  name="${base:-video}.mp4"
  codecs=$(ffprobe -v error -show_entries stream=codec_type,codec_name,pix_fmt -of csv=p=0 "$video" | sort | tr '\n' ' ')
  # Web limits, so videos stream smoothly on ordinary Wi-Fi and stay well under GitHub's
  # 100 MB file limit: at most 1280 px on the long side (plenty for tablets and phones), at
  # most 30 frames per second (kids' video doesn't need 60), and at most ~8 Mbit/s overall.
  # A video already within all of these is repackaged untouched; anything else is re-encoded.
  kbps=$(ffprobe -v error -show_entries format=bit_rate -of csv=p=0 "$video" | awk '{printf "%d", $1/1000}')
  fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$video" | awk -F/ '{printf "%d", ($2 ? $1/$2 : $1) + 0.5}')
  longside=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$video" | awk -F, '{print ($1 > $2 ? $1 : $2)}')
  if [[ "$codecs" =~ h264,video,yuv420p ]] && { [[ "$codecs" =~ aac,audio ]] || [[ ! "$codecs" =~ audio ]]; } \
     && (( kbps <= 8000 && fps <= 30 && longside <= 1280 )); then
    echo "Video is already web-friendly; repackaging without re-encoding..."
    ffmpeg -hide_banner -loglevel error -i "$video" -map 0:v:0 -map "0:a:0?" -c copy -write_tmcd 0 -movflags +faststart "$dir/$name" \
      || { rm -rf "$dir"; echo "Video repackaging failed" >&2; exit 1; }
  else
    echo "Converting video for the web (this can take a few minutes for long videos)..."
    (( kbps > 8000 )) && echo "  (it's ${kbps} kbit/s, too heavy to stream smoothly)"
    (( fps > 30 )) && echo "  (it's ${fps} frames per second; reducing to 30)"
    (( longside > 1280 )) && echo "  (it's ${longside} px on its long side; reducing to 1280)"
    # Long side capped at 1280 for both landscape and portrait; frame rate capped at 30;
    # quality-based encoding with a bitrate ceiling so busy footage can't balloon the file.
    ffmpeg -hide_banner -loglevel error -i "$video" -map 0:v:0 -map "0:a:0?" \
      -c:v libx264 -preset slow -crf 23 -maxrate 1600k -bufsize 3200k -pix_fmt yuv420p \
      -vf "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',fps=fps='min(30,source_fps)'" \
      -c:a aac -b:a 160k -ac 2 \
      -write_tmcd 0 -movflags +faststart \
      "$dir/$name" || { rm -rf "$dir"; echo "Video conversion failed" >&2; exit 1; }
  fi
  # Always bring its sound to the site's standard loudness, so no video is louder or quieter
  # than the rest. If that fails, don't leave a half-made page behind.
  ./normalize-audio.sh "$dir/$name" || { rm -rf "$dir"; echo "Volume leveling failed; no page was added" >&2; exit 1; }
  mb=$(( $(stat -f %z "$dir/$name") / 1048576 ))
  echo "  final size: ${mb} MB"
  (( mb > 90 )) && echo "  Warning: that's close to GitHub's 100 MB limit per file. Consider trimming the video." >&2
  js_name=$(printf '%s' "$name" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  entry="  { id: $id, title: \"$js_title\", video: \"$js_name\" },"
else
  cp -R _template/ "$dir/"
  esc_title=$(printf '%s' "$title" | sed -e 's/[&|\\]/\\&/g')
  sed -i.bak "s|__TITLE__|$esc_title|g" "$dir/index.html" && rm "$dir/index.html.bak"
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
