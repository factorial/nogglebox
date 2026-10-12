# Nogglebox

**A variety magazine for little kids.** Nogglebox is an ever-growing collection of short videos, games and activities for pre-K children, meant to be put on a tablet for a child to explore on their own. Think Sesame Street: letters and numbers, but also feelings, music, science, community, health, art and the wider world.

We want this app to be at least 50% videos. Videos should be relatively short. Example videos would be animations, musicals, interviews with children, puppets talking with adults. Think 70s Sesame Street content.

Kids move through it with two big buttons: **Next**, which brings something new at random, and **Back**, which revisits what came before. There's nothing to read and nothing to scroll, and every page fills the screen.

Anyone can make a page and submit it for possible inclusion via Pull Request. This README explains how. NOTE: PRs will be reviewed according to undocumented criteria and approved or rejected without comment.


---

## Quick start


```bash
git clone https://github.com/factorial/nogglebox.git
cd nogglebox
./serve.sh            # then open http://localhost:8000
```

There's no build step: it's plain HTML, CSS and JavaScript.

`serve.sh` needs Python 3. The site must be served over http; opening `index.html` directly as a file won't work.

To try it on a tablet, connect it to the same Wi-Fi as your computer and open `http://<your computer's IP>:8000`. On a Mac, `ipconfig getifaddr en0` prints the IP. On a tablet or phone, **Add to Home Screen** (Safari: Share menu; Chrome: ⋮ menu → Add to Home screen / Install app) makes it open full-screen like an app.

---

## How it fits together

```
index.html, harness/   The shell: landing page, Next/Back buttons, transitions,
                       and the friendly "oops" screen if a page breaks
site.js                Site name and settings
pages.js               The list of pages
pages/1/, pages/2/ …   One folder per page, named by its number
shared/kit.js          Helpers every page uses (sound, speech, video, libraries, errors)
shared/page.css        Base styles every page uses
_template/             Starting point for a new page
vendor/                Bundled libraries (three.js, gsap, howler, matter-js, lottie, confetti)
CURRICULUM.md          What Nogglebox teaches, and ideas for pages
DEPLOY.md              Hosting on AWS (S3 + CloudFront)
```

Each page runs in its own frame inside the shell, so a page can't break the rest of the site. If a page throws an error, kids see a friendly "Ooops! This one broke!" screen, and the arrows skip over that page.

---

## Making a page

### 1. Pick an idea
Check [CURRICULUM.md](CURRICULUM.md) for the subject areas and ideas. Areas with nothing yet represented in the app are preferable. Video is most welcome, we want interactives to be a surprising change of pace, not the norm.

### 2. Create it

**A video page:**

```bash
./new-page.sh "How Crayons Are Made" ~/Movies/crayons.mov
```

This puts the video in the next numbered folder in `pages/` and adds it to `pages.js`. Video pages play full-screen with sound as soon as a child lands on them, and go on to the next page when they finish.

You can hand it a video straight from your phone or editor: it needs [ffmpeg](https://ffmpeg.org), and it prepares the video for the web automatically:
- **Format:** converted to H.264 `.mp4`, which every browser plays (phone `.mov` files are often HEVC, which many browsers can't).
- **Size:** at most 1280 pixels on its long side, at most 30 frames per second, and a capped bitrate, so it streams smoothly on ordinary Wi-Fi. A video already within these limits is just repackaged, with no loss in quality.
- **Volume:** evened out to the site's standard loudness, so no video is louder or quieter than the others.
- **Streaming:** arranged so playback can start before the whole file has downloaded.

It prints the final file size, and warns if it's near GitHub's 100 MB per-file limit. If you see that warning, trim the video. Short videos suit the audience better anyway.

We want this app to be at least 50% videos. Videos should be relatively short. Example videos would be animations, musicals, interviews with children, puppets talking with adults. Think 70s Sesame Street content.

**Or an interactive page** (a game, activity or JavaScript animation):

```bash
./new-page.sh "Animal Sounds"
```

This creates the next numbered folder (e.g. `pages/42/index.html`) from `_template/` and adds it to `pages.js`. Build your page in that `index.html`. Images, sounds and other files for the page go in the same folder.


### 3. Tag it
In `pages.js`, add the curriculum areas your page teaches:

```js
{ id: 42, title: "Animal Sounds", areas: ["science", "music"] },
```

Then update the coverage table at the bottom of `CURRICULUM.md`.

### 4. Test it on a real tablet
Little fingers on a real tablet behave very differently from a mouse. Try it in more than one browser, too.

---

## Example videos currently desired

Want to contribute but not sure what to make? We'd love videos like these. Keep them short, and follow the design rules below.

- **Jobs on our street** (`community`): walking down the street, how many jobs we see people doing that you can do when you grow up.
- **Counting and letter hunt** (`math`, `letters`): walking down the street counting things and/or finding things that start with different letters.
- **Vowel faces** (`letters`): people saying the vowels and the different sounds they make, with close-ups on their funny faces as they do. For example, a man comes on screen and says "Ayyy!" to greet someone, with the letter **A** appearing beside his face. Then he takes a drink of water and goes "Ahhh," then sees something scary and goes "Aaaa!" Likewise, a woman comes on screen and says "Eeee!" in excitement, then "Ehhh"… and so on for every vowel.
- **Washing hands** (`health`): children washing their hands, teaching how to wash hands.
- **Kids' big ideas** (`feelings`, `community`): several interviews with children, asking them imaginative questions.
- **Make a flip book** (`art`): a person teaching how to make a flip book.
- **Hellos from around the world** (`languages`): people saying "Hello" in languages from around the world. This could also be an interactive.

---

## Design rules

These matter more than anything else. The audience is 3–5 years old.

- **Nothing scrolls, and nothing zooms.** Your page must fit any screen exactly, in portrait and landscape, on a phone or a big tablet. Size things with `vmin`, `vw` and `vh`, not fixed pixels. (Zooming and scrolling are already blocked for you.)
- **No instructions needed.** Kids should learn what to do just by playing: make the first touch do something fun and obvious, and let the page teach through what happens. Very basic phonics reading is fine (it's part of what Nogglebox teaches), but never rely on written or spoken instructions.
- **Big targets.** Small fingers miss. Make anything tappable large, and be forgiving about where taps land.
- **Leave room for the nav buttons.** The shell floats buttons over your page: Back at bottom-left and Next at bottom-right. Keep important things out of those spots; `var(--nav-safe)` is the padding that clears them.
- **Reward, don't punish.** No "wrong!" buzzers. Celebrate success (confetti is one line), and let kids try again freely.
- **Kind and inclusive.** Show many kinds of faces, families, names and voices.

### What pages must not do
Nogglebox is for children, so pages must never:
- show ads, or link out to other sites;
- collect, store or send any personal information;
- load trackers or analytics, or anything from servers other than Nogglebox itself;

---

## The Kit

Every page includes `shared/kit.js` (the template already does), which provides a global `Kit`:

```js
// Sound
Kit.tone(440, 0.2);                                  // a quick beep: frequency (Hz) and seconds
Kit.audio();                                         // the shared Web Audio context, for your own sounds

// Speech: say a line by playing a recorded file (falls back to a built-in voice if the file is missing)
Kit.say("Find the red apple!", { audio: "audio/find-red-apple.mp3" });

// Video inside an interactive page (full-screen, autoplay, no controls)
Kit.video("clip.mp4", { fit: "cover", loop: true });

// Bundled libraries, loaded on demand
const { confetti } = await Kit.use("confetti");
confetti();
const { gsap } = await Kit.use("gsap");             // also "three", "matter", "howler", "lottie"

// Ask the shell to navigate
Kit.next();   Kit.back();   Kit.random();   Kit.home();

// Something essential failed: show the friendly "oops" screen
Kit.fail("Couldn't load the picture");
```

For 3D, use three.js as a module. The template already includes the import map that makes this work:

```html
<script type="module">
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
</script>
```

Uncaught errors are caught automatically: kids see the friendly error screen, and the error is logged to the console for you.

### Voices
`Kit.say(text, options)` speaks a line. It plays a real recording when you give it one, and otherwise reads `text` with the device's built-in voice.

```js
Kit.say("Find the red apple!", { audio: "audio/find-red-apple.mp3" });
```

| Option | What it does |
|---|---|
| `audio` | A recorded file to play instead of the built-in voice. The path is relative to your page's folder, so `"audio/hi.mp3"` means `pages/42/audio/hi.mp3` for page 42. Use `.mp3` (or `.m4a`); every browser plays them. If the file is missing or won't play, the built-in voice reads `text` instead, and a warning is logged to the console. |
| `rate`, `pitch` | Speed and pitch for the built-in voice (defaults `0.9` and `1.2`). Ignored when a recording plays. |
| `interrupt` | By default, a new line cuts off whatever is still being said. Pass `false` to let the current line finish first; the new one waits its turn. |

`Kit.say` returns a Promise that resolves when the line has finished, which is handy for doing things in order:

```js
await Kit.say("Ready?", { audio: "audio/ready.mp3" });
startGame();
```

`Kit.stopVoice()` stops whatever is being said.

Pages can speak as soon as they open, before the child has touched them. Browsers normally block that, but inside Nogglebox the shell speaks those lines for the page, since the child just tapped the shell to get there.

#### Getting lines ready for a voice actor

Write every spoken line so it's either got a voice file or is ready for one: for each `Kit.say` that is lacking an audio file, add a `TODO voice actor` comment

```js
// TODO voice actor: record "Find the red apple!" as pages/42/audio/find-red-apple.mp3
Kit.say("Find the red apple!", { audio: "audio/find-red-apple.mp3" });
```

Because a missing file falls back to the built-in voice, pages work before their recordings exist. Searching the project for `TODO voice actor` gives a complete script of everything that needs recording.

### Videos' sound needs a tap
Browsers only allow sound in a video to play after a user has tapped something. Start sounds in response to taps. On touch screens, browsers only count a touch as a tap once the finger lifts, so listen for `click` (or `pointerup`) when you need to start audio, video or speech.

---

## License and contributing

Nogglebox is source-available, not open source; see [LICENSE](LICENSE). You're welcome to fork this repository, run it on your own computer, and build a page to send back as a pull request. You may not host your own copy of Nogglebox, or any part of it, anywhere public; accepted contributions go live on Nogglebox itself. **By submitting a contribution, you hand over all rights to it** (see section 2 of the license). You also confirm it's your own work, and that everyone who appears in it agreed to be included; for children, that means a parent or guardian.

## Third-party libraries

Bundled in `vendor/` (versions in `vendor/VERSIONS.txt`), each under its own license:
[three.js](https://threejs.org) (MIT),
[GSAP](https://gsap.com) (GSAP standard license),
[howler.js](https://howlerjs.com) (MIT),
[matter-js](https://brm.io/matter-js/) (MIT),
[lottie-web](https://github.com/airbnb/lottie-web) (MIT),
[canvas-confetti](https://github.com/catdad/canvas-confetti) (ISC).
