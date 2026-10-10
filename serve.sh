#!/usr/bin/env bash
# Serve the site locally (pages must be served over http, not opened as files).
# On a tablet on the same Wi-Fi, open http://<this computer's IP>:8000
# - Sends "no-store" so the browser never uses stale copies of edited files.
# - Supports HTTP Range requests, which Safari requires to play video.
cd "$(dirname "$0")"
exec python3 - "${1:-8000}" <<'PY'
import os, re, sys
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json",
                      ".js": "text/javascript",
                      ".mp4": "video/mp4"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            self.range = None
            return super().send_head()
        size = os.path.getsize(path)
        start, end = m.groups()
        if start == "":                      # "bytes=-500": last 500 bytes
            start, end = max(0, size - int(end or 0)), size - 1
        else:
            start, end = int(start), min(int(end) if end else size - 1, size - 1)
        if start >= size or start > end:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.range = end - start + 1
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.range))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "range", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

port = int(sys.argv[1])
print(f"Serving on http://localhost:{port}  (Ctrl+C to stop)")
ThreadingHTTPServer(("", port), Handler).serve_forever()
PY
