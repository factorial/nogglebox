// Harness: shows the landing page or a sub-page (in an iframe) and handles
// Next / Back / Random / Home.
//
// Navigation model — a "trail" of visited page ids plus a pointer into it. Kids never walk
// the page list in order; new pages always come at random:
//   Next:   if we've gone back, step forward through the trail (same order as before);
//           at the end of the trail, append a random page (preferring unseen ones).
//   Back:   step backward through the trail; before its first page, go to the landing page.
//   Random: drop anything ahead of the pointer, append a random page, step onto it.
// So after Next→7, Next→3, Next→9 the trail is [7,3,9]; Back walks 3, 7, then the landing
// page, and Next from there walks 7, 3, 9 again, then something new and random.
//
// Pages that fail (missing folder, didn't include kit.js, threw an error) get the
// friendly "oops" screen and are remembered as broken for this session, so
// Next and Back step right over them.
(function () {
  "use strict";

  const PAGES = (window.PAGES || []).filter((p) => p && Number.isInteger(p.id));
  const SITE = window.SITE || { name: "", spokenName: "" };
  const STORE_KEY = "trail.v1"; // storage is per-site already, so no name prefix needed
  const stage = document.getElementById("stage");
  const body = document.body;

  const byId = new Map(PAGES.map((p, i) => [p.id, i]));
  const exists = (id) => byId.has(id);

  // ---------- trail state ----------
  let trail = [];
  let pos = -1;
  // Every page shown in this round. New random picks come only from pages not in here, so
  // nothing repeats until every page has been seen; then a fresh round starts. (Kept apart
  // from the trail, which forgets pages when "Let's go!" cuts it short.)
  let seen = new Set();

  function load() {
    try {
      const s = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      if (s && Array.isArray(s.trail)) {
        trail = s.trail.filter(exists);
        pos = Math.min(Math.max(0, s.pos | 0), trail.length - 1);
        seen = new Set((Array.isArray(s.seen) ? s.seen : trail).filter(exists));
      }
    } catch (_) { /* storage unavailable; start fresh */ }
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ trail, pos, seen: [...seen] })); } catch (_) {}
  }


  const broken = new Set();
  function current() { return pos >= 0 ? trail[pos] : null; }

  // Step forward through the trail, skipping pages known to be broken; at the end, go somewhere new.
  function goNext() {
    if (!PAGES.length) return null;
    while (pos < trail.length - 1) {
      pos++;
      if (!broken.has(current())) return current();
    }
    return goRandom();
  }

  // Step back through the trail; returns null before its first page (= the landing page).
  function goBack() {
    while (pos > 0) {
      pos--;
      if (!broken.has(current())) return current();
    }
    return null;
  }

  function goRandom() {
    if (!PAGES.length) return null;
    const here = current();
    trail = trail.slice(0, pos + 1);
    const ok = PAGES.filter((p) => !broken.has(p.id));
    let pool = ok.filter((p) => !seen.has(p.id));
    if (!pool.length) {
      // Every page has been seen: start a fresh round (not repeating the page we're on).
      seen = new Set(here == null ? [] : [here]);
      pool = ok.filter((p) => p.id !== here);
    }
    if (!pool.length) pool = PAGES.filter((p) => p.id !== here);
    if (!pool.length) pool = PAGES;
    trail.push(pool[Math.floor(Math.random() * pool.length)].id);
    pos = trail.length - 1;
    return current();
  }

  // Jump to an id (e.g. from a shared URL); reuse its trail spot if present.
  function goTo(id) {
    const at = trail.lastIndexOf(id);
    if (at >= 0) pos = at;
    else { trail = trail.slice(0, pos + 1).concat(id); pos = trail.length - 1; }
    return id;
  }

  // ---------- views ----------
  let shownId = null;
  let navToken = 0;

  function pageUrl(id) { return "pages/" + id + "/index.html"; }

  function setHash(id) {
    const h = id == null ? location.pathname + location.search : "#/" + id;
    history.replaceState(null, "", h);
  }

  // ---------- friendly error screen ----------
  const oops = document.getElementById("oops");
  function showOops(id, why) {
    if (id !== shownId) return;
    console.warn("[harness] page " + id + " failed:", why);
    broken.add(id);
    oops.hidden = false;
    stage.querySelectorAll("iframe").forEach((f) => { f.style.pointerEvents = "none"; });
    if (stage.lastElementChild && stage.lastElementChild.classList.contains("video-view")) player.pause();
  }
  function hideOops() { oops.hidden = true; }

  // Stop all sound in a page that's leaving, right away rather than after the slide-out.
  function silence(frame) {
    try {
      const w = frame.contentWindow;
      if (w.Kit && w.Kit.silence) w.Kit.silence();
      else w.document.querySelectorAll("video, audio").forEach((m) => m.pause());
    } catch (_) { /* page never loaded; nothing to stop */ }
  }

  function showHome() {
    hideOops();
    document.getElementById("info").hidden = true;
    shownId = null;
    body.classList.add("is-home");
    Array.from(stage.children).forEach(leave);
    stage.replaceChildren();
    setHash(null);
    document.title = SITE.name;
  }

  // dir: "right" (next), "left" (back), "pop" (random), "none"
  function showPage(id, dir) {
    if (id == null) return;
    seen.add(id);
    save();
    setHash(id);
    const page = PAGES[byId.get(id)];
    document.title = page.title + " · " + SITE.name;
    if (id === shownId && stage.firstElementChild) return;
    shownId = id;
    body.classList.remove("is-home");
    hideOops();

    const token = ++navToken;
    const old = Array.from(stage.children);
    old.forEach(leave); // silence the outgoing page immediately

    let frame;
    if (page.video) {
      frame = videoView(page, token); // starts playing right now, inside the tap
    } else {
      frame = document.createElement("iframe");
      frame.src = pageUrl(id);
      frame.title = page.title;
      frame.allow = "autoplay; fullscreen; microphone; camera";
    }
    if (old.length && dir !== "none") frame.className += " from-" + dir;
    stage.appendChild(frame);
    if (!page.video) watch(frame, id, token);
    // If Next would replay history, warm up that page (but don't pre-download whole videos).
    const nextPage = pos < trail.length - 1 ? PAGES[byId.get(trail[pos + 1])] : null;
    if (nextPage && !nextPage.video) prefetch(pageUrl(nextPage.id));

    if (!old.length || dir === "none") { old.forEach((f) => f.remove()); return; }

    let done = false;
    const swap = () => {
      if (done || token !== navToken) return;
      done = true;
      requestAnimationFrame(() => {
        frame.classList.remove("from-" + dir);
        const out = dir === "right" ? "to-left" : dir === "left" ? "to-right" : "to-pop";
        old.forEach((f) => { f.classList.add(out); });
        setTimeout(() => old.forEach((f) => f.remove()), 450);
      });
    };
    if (page.video) swap();
    else {
      frame.addEventListener("load", swap, { once: true });
      setTimeout(swap, 1500); // slow load: slide in anyway
    }
  }

  // ---------- video pages ----------
  // Pages listed in pages.js with a `video` play in the harness itself, on one <video> element
  // reused all session. Browsers (Safari most strictly) only allow sound when play() runs
  // during a tap, and here it runs inside the Next/Back tap, so sound starts right away.
  const player = document.createElement("video");
  player.playsInline = true;
  player.setAttribute("playsinline", "");
  player.setAttribute("webkit-playsinline", "");
  player.preload = "auto";
  player.controls = false;
  player.disablePictureInPicture = true;

  const vbtn = document.createElement("button");
  vbtn.type = "button";
  vbtn.className = "vbtn";
  vbtn.hidden = true;
  const VICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 4l12 8-12 8z"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16 8a5 5 0 010 8M18.5 5.5a8.5 8.5 0 010 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  function showVbtn(kind) {
    vbtn.dataset.kind = kind;
    vbtn.className = "vbtn " + kind;
    vbtn.setAttribute("aria-label", kind);
    vbtn.innerHTML = VICONS[kind];
    vbtn.hidden = false;
  }
  vbtn.addEventListener("click", (e) => {
    e.preventDefault();
    const kind = vbtn.dataset.kind;
    vbtn.hidden = true;
    player.muted = false;
    if (kind !== "sound") player.play().catch(() => {});
  });

  function videoView(page, token) {
    const view = document.createElement("div");
    view.className = "video-view";
    view.append(player, vbtn);
    vbtn.hidden = true;
    player.className = page.fit === "cover" ? "cover" : "";
    player.loop = !!page.loop;
    player.muted = false;
    player.src = "pages/" + page.id + "/" + page.video;
    player.onerror = () => { if (token === navToken) showOops(page.id, "video couldn't load: " + player.src); };
    // When the video finishes, move on to the next page after a short beat.
    // (Same <video> element as the tap that started it, so the next video may play with sound.)
    player.onended = () => {
      if (token !== navToken || player.loop) return;
      setTimeout(() => { if (token === navToken) onNext(); }, 800);
    };
    player.play().catch((err) => {
      if (token !== navToken || err.name !== "NotAllowedError") return;
      // No tap to ride on (e.g. opened from a link): play muted and offer sound.
      player.muted = true;
      player.play().then(() => showVbtn("sound"), () => showVbtn("play"));
    });
    return view;
  }

  // Silence a page that's leaving. A video view keeps a still of its last frame for the
  // slide-out, since the one <video> element moves on to the next page.
  function leave(view) {
    if (view.tagName === "IFRAME") return silence(view);
    if (!view.contains(player)) return;
    player.pause();
    try {
      const c = document.createElement("canvas");
      c.width = player.videoWidth || 1;
      c.height = player.videoHeight || 1;
      c.getContext("2d").drawImage(player, 0, 0, c.width, c.height);
      c.className = "still " + player.className;
      view.appendChild(c);
    } catch (_) {}
  }

  // A page counts as loaded once its kit.js has run; otherwise it's a 404 or broken markup.
  function watch(frame, id, token) {
    let loaded = false;
    frame.addEventListener("load", () => {
      loaded = true;
      if (token !== navToken) return;
      let ok = false;
      try { ok = !!frame.contentWindow.__SITE_KIT__; } catch (_) {}
      if (!ok) showOops(id, "page missing, or it doesn't include shared/kit.js");
    }, { once: true });
    setTimeout(() => {
      if (!loaded && token === navToken) showOops(id, "page took too long to load");
    }, 15000);
  }

  // Messages from sub-pages (via Kit): errors and navigation requests.
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (e.origin !== location.origin || !d || !d.wh) return;
    const frame = stage.lastElementChild;
    if (!frame || e.source !== frame.contentWindow) return; // only the page on screen
    if (d.type === "error") showOops(shownId, d.message);
    else if (d.type === "nav") {
      ({ next: onNext, back: onBack, random: onRandom, home: showHome })[d.dir]?.();
    }
  });

  // fetch() rather than <link rel=prefetch>, which Safari ignores.
  const fetched = new Set();
  function prefetch(url) {
    if (fetched.has(url)) return;
    fetched.add(url);
    fetch(url, { priority: "low" }).catch(() => fetched.delete(url));
  }

  // ---------- voice (for the landing page and every sub-page) ----------
  // Browsers only let a document talk after a tap *in that document*. Sub-pages load after
  // the kid taps Next out here, so on their own they'd be silent until tapped. Instead,
  // Kit.say in a sub-page hands its lines to this voice, which can speak because the shell
  // has been tapped. One reused <audio> element plays recordings; Safari only allows
  // that element (and speech) once it has been "warmed up" inside a tap; see unlockVoice().
  const voiceClip = new Audio();
  voiceClip.preload = "auto";
  let voiceUnlocked = false, finishCurrent = null;

  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, t) => [...t].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }
  function unlockVoice() {
    if (voiceUnlocked) return;
    voiceUnlocked = true;
    try { voiceClip.src = silentWav(); voiceClip.play().catch(() => {}); } catch (_) {}
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  }

  let speaking = null; // the line being said: { end, done }
  function stopVoice() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    voiceClip.pause();
    if (speaking) speaking.end(); // let anyone awaiting the cut-off line move on
  }

  // say(text, { audio, rate, pitch, interrupt }) -> Promise, same as Kit.say.
  // `audio` here must be a full URL or a path from the site root.
  async function say(text, opts = {}) {
    if (typeof opts === "string") opts = { audio: opts };
    if (opts.interrupt !== false) stopVoice();
    else if (speaking) await speaking.done; // wait our turn

    let end;
    const done = new Promise((resolve) => {
      let finished = false;
      end = () => {
        if (finished) return;
        finished = true;
        if (speaking && speaking.end === end) speaking = null;
        resolve();
      };
    });
    speaking = { end, done };
    const mine = () => speaking && speaking.end === end;

    let spoke = false;
    const robot = () => {
      if (spoke || !mine()) return;
      spoke = true;
      if (!("speechSynthesis" in window)) return setTimeout(end, 300);
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate || 0.9;
      u.pitch = opts.pitch || 1.2;
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      setTimeout(end, 1200 + text.length * 110); // some browsers forget to fire onend
    };

    if (!opts.audio) robot();
    else {
      voiceClip.onended = () => { if (mine()) end(); };
      voiceClip.onerror = () => {
        if (!mine()) return;
        console.warn("[voice] no recording at " + opts.audio + "; using the built-in voice");
        robot();
      };
      voiceClip.src = opts.audio;
      voiceClip.play().catch(() => { if (mine()) robot(); });
    }
    return done;
  }
  window.__siteVoice = { say, stop: stopVoice }; // used by Kit.say in sub-pages

  // ---------- wiring ----------
  const $ = (id) => document.getElementById(id);
  function bump(el, cls = "bump") {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function onNext() {
    bump($("btn-next"));
    // From the landing page, resume where we were (or go somewhere new).
    if (shownId == null && trail.length) return showPage(current(), "right");
    showPage(goNext(), "right");
  }
  function onBack() {
    bump($("btn-back"));
    if (shownId == null) {
      if (trail.length) return showPage(current(), "left");
      // TODO voice actor: record "The orange arrow goes back to the one before!" as audio/back-arrow.mp3 (site root)
      return say("The orange arrow goes back to the one before!", "audio/back-arrow.mp3");
    }
    const id = goBack();
    if (id == null) showHome(); // back past the first page: the landing page
    else showPage(id, "left");
  }
  // A random new page (used by "Let's go!" and Kit.random(); Next is random at the end of history too).
  function onRandom() {
    showPage(goRandom(), "pop");
  }

  // "click" (finger lifted), not pointerdown: browsers only count a touch as a user gesture
  // once it ends, and video sound / speech need a real gesture. touch-action: none
  // removes the old 300ms click delay, so this is still instant.
  function tap(el, fn) {
    let last = 0;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now - last < 350) return;
      last = now;
      unlockVoice(); // first tap: warm up audio + speech so pages can talk later
      stopVoice();
      fn();
    });
  }

  tap($("btn-next"), onNext);
  tap($("btn-back"), onBack);
  tap($("go"), onRandom); // "Let's go!" is the landing page's surprise button

  // Kids must never zoom or scroll. Safari on iOS/iPadOS ignores user-scalable=no, so block its pinch
  // gestures and any multi-finger or dragging touch directly. (Pointer events still fire.)
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

  function route() {
    const m = /^#\/(\d+)$/.exec(location.hash);
    const id = m ? Number(m[1]) : null;
    if (id != null && exists(id)) showPage(goTo(id), "none");
    else showHome();
  }
  window.addEventListener("hashchange", route);

  // Warm the browser cache with every shared library during the first visit, so
  // sub-pages that use them start instantly.
  const SHARED = [
    "shared/kit.js", "shared/page.css", "shared/fonts/fonts.css",
    "shared/fonts/baloo2-latin.woff2", "shared/fonts/baloo2-latin-ext.woff2",
    "vendor/three/three.module.min.js", "vendor/three/three.core.js",
    "vendor/three/addons/controls/OrbitControls.js", "vendor/three/addons/loaders/GLTFLoader.js",
    "vendor/three/addons/utils/BufferGeometryUtils.js", "vendor/three/addons/utils/SkeletonUtils.js",
    "vendor/gsap.min.js", "vendor/howler.min.js", "vendor/matter.min.js",
    "vendor/lottie.min.js", "vendor/confetti.js",
  ];
  function warmCache() { SHARED.forEach(prefetch); }
  if (document.readyState === "complete") warmCache();
  else window.addEventListener("load", warmCache);

  // For grown-ups: "?" opens an info card; tap ×, or outside the card, to close it.
  const info = $("info");
  document.querySelectorAll(".site-name").forEach((el) => { el.textContent = SITE.spokenName || SITE.name; });
  $("repo-link").href = SITE.repoUrl;
  $("repo-link").textContent = SITE.repoUrl.replace(/^https?:\/\//, "");
  tap($("btn-info"), () => { info.hidden = false; });
  tap($("info-close"), () => { info.hidden = true; });
  info.addEventListener("click", (e) => { if (e.target === info) info.hidden = true; });

  document.querySelector(".logo img").alt = SITE.name;
  document.title = SITE.name;

  load();
  route();
})();
