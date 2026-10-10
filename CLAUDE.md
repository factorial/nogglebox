# Nogglebox — pre-K edutainment magazine (nogglebox.com)

Static site, no build step. Audience: pre-K kids, mostly on tablets. The site is browser- and OS-agnostic: it must work in any modern browser (Chrome, Safari, Firefox, Edge) on any OS (iOS/iPadOS, Android, Windows, macOS, ChromeOS), on tablets, phones and laptops. Handle browser quirks with standard fallbacks; don't build for one browser. Big touch targets and no instructions needed: kids learn what to do by playing. Very basic phonics reading is fine; written or spoken instructions are not relied on.

## Design rules
- **Video first.** At least 50% of pages should be videos: short ones, like animations, musicals, interviews with children, puppets talking with adults (think 70s Sesame Street). Interactive pages are a surprising change of pace, not the norm. README.md is the public source of truth for contributor guidance.
- **Nothing scrolls.** Every page (landing and sub-pages) fits the viewport exactly. Size things with `vmin`/`vw`/`vh`, not fixed px.
- Fluid layout: must work in portrait and landscape, phone through desktop.
- Sub-pages are full-screen. The harness floats nav buttons over them: Back (bottom-left) and Next (bottom-right). Keep key content out of those spots — `var(--nav-safe)` in `shared/page.css` is the padding to clear them.

## Layout
- `index.html` + `harness/` — the shell. Shows the landing page, or loads a sub-page in an iframe (`/#/<id>`). Handles Next/Back, slide transitions, and the friendly error screen.
- `site.js` — the site's name (logo, tab titles, spoken greeting). Rename the site here, plus `manifest.webmanifest`.
- `CURRICULUM.md` — subject areas, learning goals, page ideas, and coverage. Tag new pages with `areas` and update its coverage table.
- `pages.js` — the page list (`{ id, title, areas }`). Its order doesn't affect navigation. IDs are permanent integers; never reuse one.
- `<id>/index.html` — one folder per page (e.g. `1/`, `2/`). Self-contained; put its assets (videos, images) in the same folder.
- `shared/kit.js` + `shared/page.css` — every sub-page must include both (kit.js first in `<head>`). Without kit.js the harness treats the page as broken.
- `vendor/` — vendored libraries (see `vendor/VERSIONS.txt`). The harness pre-fetches them all on first load.
- `_template/` — starting point for new pages.

## Adding a page
- Interactive: `./new-page.sh "Title"` → creates the next numbered folder from `_template/` and appends it to `pages.js`. Then edit `<id>/index.html`.
- Video: `./new-page.sh "Title" path/to/clip.mov` → converts it to a web-friendly H.264 .mp4 (needs ffmpeg) in the next numbered folder and adds `{ id, title, video }` to `pages.js`. The harness plays these itself (not in an iframe) on one reused `<video>` element, calling `play()` inside the Next/Back tap so sound is allowed in every browser. Optional `fit: "cover"`, `loop: true`. Its sound is normalized to the site's standard loudness (-21 LUFS) by `normalize-audio.sh`, which can also be run on any video by hand.
- Nav buttons fire on `click`, not `pointerdown`: a touch only counts as a user gesture (needed for sound/speech) when the finger lifts.

## Sound It Out recordings (page 5)
One recording per word in `5/audio/raw/<word>.m4a`: each sound with a clear pause after it, then the blend and the whole word ("b… a… ll… b-a-ll… ball!"). Tiles play the single sounds; the finished word plays the blend + word. `./split-sounds.sh` removes plosive pops, normalizes, finds the pieces by silence (the first N are the sounds, the rest is the blend + word), and writes `5/audio/words/<word>.mp3` plus timings in `5/audio/words/index.js`; the page plays exact slices. Words and how they split into sounds (one tile per sound, e.g. "ll") live in `5/words.js`, shared by the page and the script. Run `./split-sounds.sh --list` for the word list and what to say. Raw recordings and `split-sounds.sh` are local-only (git-ignored).

## Kit API (sub-pages)
- `Kit.video(src, { fit, loop, onEnd })` — full-screen autoplay video inside an interactive page, no controls; falls back to muted + "tap for sound" if the browser blocks sound. (Video *pages* in `pages.js` are played by the harness instead and advance to the next page when they finish.)
- `await Kit.use("gsap" | "three" | "matter" | "howler" | "lottie" | "confetti", ...)` — loads vendored libs. For three.js addons, use `<script type="module">` with the import map already in the template (`import * as THREE from "three"`).
- `Kit.audio()`, `Kit.tone(freq, secs, opts)` — Web Audio. Audio unlocks on the first touch.
- `Kit.say(text, { audio })` — speech. Every call passes its `audio: "audio/<name>.mp3"` file (relative to the page folder) up front. Until the recording exists, put a `// TODO voice actor: record "<line>" as <id>/audio/<name>.mp3` comment directly above the call; the missing file falls back to the built-in voice automatically. (README.md "Voices" is the source of truth for this pattern.) Inside the harness, Kit.say hands lines to the shell's voice (`window.__siteVoice` in harness.js), which was unlocked by the kid's first tap, so pages can talk on load.
- `Kit.next() / back() / random() / home()` — ask the harness to navigate.
- `Kit.fail(msg)` — show the "oops" screen. Uncaught errors and rejected promises do this automatically. Broken pages are skipped by Next/Back for the rest of the session.

## Navigation model (harness/harness.js)
A trail of visited ids plus a pointer. Pages are never walked in list order. Next replays the trail if the kid has gone Back; at the end of the trail it appends a random (preferably unseen) page. Back retraces the trail, and before its first page goes to the landing page. Random cuts off anything ahead of the pointer and appends a random page. The trail is stored in sessionStorage.

## Running locally
`./serve.sh` then open http://localhost:8000 (must be http, not file://).

## Hosting
S3 bucket behind CloudFront at nogglebox.com, deployed with `./deploy.sh` (idempotent: sets up anything missing, then uploads; `--dry-run` to preview). Settings in `deploy.env` (git-ignored; template `deploy.env.example`). See `DEPLOY.md`.
