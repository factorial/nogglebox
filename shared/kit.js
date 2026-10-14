// Kit: shared helpers for every sub-page. Include it first in <head>:
//   <script src="../../shared/kit.js"></script>
//
//   Kit.use("gsap", "three", ...)   -> Promise of { gsap, THREE, ... }  (vendored libs, cached)
//   Kit.video(src, opts)            -> full-screen autoplay <video>, no controls
//   Kit.audio()                     -> shared, unlocked AudioContext
//   Kit.tone(freq, seconds, opts)   -> quick synth blip
//   Kit.say(text, { audio })        -> speak text aloud; plays the recorded file in `audio`
//                                      if given (path relative to the page's folder), else the
//                                      robot voice. Returns a Promise that resolves when done.
//   Kit.next() / back() / random() / home()  -> ask the harness to navigate
//   Kit.fail(message)               -> show the friendly "oops" screen and let the kid move on
//
// Any uncaught error or rejected promise automatically calls Kit.fail().
(function () {
  "use strict";

  const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
  const ROOT = new URL("../", scriptUrl).href; // site root
  const inHarness = window.parent !== window && (() => {
    try { return !!window.parent.document; } catch (_) { return false; } // same-origin check
  })();

  window.__SITE_KIT__ = true; // the harness uses this to know the page loaded properly

  // Kids must never zoom or scroll. Safari on iOS/iPadOS ignores user-scalable=no, so block its pinch
  // gestures and any multi-finger or dragging touch directly. (Pointer events still fire.)
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) =>
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

  // ---------- talking to the harness ----------
  function tell(msg) {
    if (inHarness) window.parent.postMessage(Object.assign({ wh: true }, msg), location.origin);
  }
  const nav = (dir) => () => {
    if (inHarness) tell({ type: "nav", dir });
    else if (dir === "home") location.href = ROOT;
  };

  // ---------- errors ----------
  let failed = false;
  function fail(message) {
    if (failed) return;
    failed = true;
    const text = String(message || "Something went wrong");
    console.error("[Kit] page failed:", message);
    if (inHarness) return tell({ type: "error", message: text });
    const show = () => {
      const el = document.createElement("div");
      el.className = "kit-error";
      el.innerHTML = '<div style="font-size:2.4em">😴</div><div>Ooops! This one broke!</div><small></small>';
      el.querySelector("small").textContent = text;
      document.body.appendChild(el);
    };
    document.body ? show() : addEventListener("DOMContentLoaded", show);
  }
  window.addEventListener("error", (e) => {
    // Ignore failed <img>/<audio> loads etc. (those have no ErrorEvent message); pages can
    // call Kit.fail themselves if a resource is essential.
    if (!(e instanceof ErrorEvent)) return;
    fail(e.message + (e.filename ? " (" + e.filename.split("/").slice(-2).join("/") + ":" + e.lineno + ")" : ""));
  }, true);
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    fail(r && r.message ? r.message : String(r));
  });

  // ---------- vendored libraries ----------
  const LIBS = {
    gsap:     { src: "vendor/gsap.min.js",     global: "gsap" },
    howler:   { src: "vendor/howler.min.js",   global: "Howl", also: ["Howler"] },
    matter:   { src: "vendor/matter.min.js",   global: "Matter" },
    lottie:   { src: "vendor/lottie.min.js",   global: "lottie" },
    confetti: { src: "vendor/confetti.js",     global: "confetti" },
    three:    { module: "vendor/three/three.module.min.js", as: "THREE" },
  };
  const loading = {};
  function loadOne(name) {
    const lib = LIBS[name];
    if (!lib) return Promise.reject(new Error("Kit.use: unknown library '" + name + "'"));
    if (loading[name]) return loading[name];
    if (lib.module) {
      loading[name] = import(ROOT + lib.module).then((mod) => ({ [lib.as]: mod }));
    } else if (window[lib.global]) {
      loading[name] = Promise.resolve();
    } else {
      loading[name] = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = ROOT + lib.src;
        s.onload = () => res(); // don't pass the load Event through as a result
        s.onerror = () => rej(new Error("Couldn't load " + name));
        document.head.appendChild(s);
      });
    }
    loading[name] = loading[name].then((r) => {
      if (r) return r;
      const out = { [lib.global]: window[lib.global] };
      (lib.also || []).forEach((g) => { out[g] = window[g]; });
      return out;
    });
    return loading[name];
  }
  function use(...names) {
    return Promise.all(names.map(loadOne)).then((parts) => Object.assign({}, ...parts));
  }

  // ---------- audio ----------
  let ctx = null;
  function audio() {
    if (!ctx) {
      // Inside the shell, use the sound engine it started with the tap that opened this page,
      // so sound works from the first touch.
      try { ctx = (window.frameElement && window.frameElement.kitAudio) || null; } catch (_) {}
      if (ctx && ctx.state === "closed") ctx = null;
    }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    // "interrupted" is iOS's state after a phone call, Siri, or another app's audio.
    if (ctx.state === "suspended" || ctx.state === "interrupted") ctx.resume().catch(() => {});
    return ctx;
  }
  // Otherwise (a page opened directly), browsers only let audio start inside a tap: keep
  // trying on every touch until one counts.
  ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach((t) =>
    window.addEventListener(t, () => audio(), { capture: true, passive: true })
  );

  function tone(freq, seconds = 0.15, opts = {}) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + (opts.delay || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + seconds);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.volume || 0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  // ---------- speech ----------
  // Every spoken line goes through here. Pages pass { audio: "audio/some-file.mp3" } once a
  // voice actor's recording exists; until the file is there (or if it fails to play), the
  // robot voice reads `text` instead, so adding the option early never breaks anything.
  // Inside the site, lines are spoken by the shell's voice (harness.js): the shell has been
  // tapped, so browsers let it talk even before the kid touches this page. A page opened on
  // its own speaks for itself instead.
  const shellVoice = inHarness ? window.parent.__siteVoice : null;

  let clip = null;
  function stopVoice() {
    if (shellVoice) return shellVoice.stop();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (clip) { clip.pause(); clip = null; }
  }
  function say(text, opts = {}) {
    if (shellVoice) {
      // The shell resolves paths from the site root, so make the audio path absolute.
      const o = Object.assign({}, opts);
      if (o.audio) o.audio = new URL(o.audio, location.href).href;
      return shellVoice.say(text, o);
    }
    if (opts.interrupt !== false) stopVoice();
    return new Promise((resolve) => {
      let finished = false;
      const end = () => { if (!finished) { finished = true; resolve(); } };

      let spoke = false;
      const robot = () => {
        if (spoke || finished) return;
        spoke = true;
        if (!("speechSynthesis" in window)) return setTimeout(end, 300);
        const u = new SpeechSynthesisUtterance(text);
        u.rate = opts.rate || 0.9;
        u.pitch = opts.pitch || 1.2;
        u.onend = end; u.onerror = end;
        speechSynthesis.speak(u);
        setTimeout(end, 1200 + text.length * 110); // some browsers forget to fire onend
      };

      if (!opts.audio) return robot();
      const a = new Audio(opts.audio);
      clip = a;
      a.onended = end;
      a.onerror = () => { console.warn("[Kit] no recording at " + opts.audio + "; using robot voice"); robot(); };
      a.play().catch(robot);
    });
  }
  // On unload, only stop this page's own voice. The shell's voice may already be saying the
  // next page's first line (the harness silences pages itself when the kid navigates).
  window.addEventListener("pagehide", () => {
    if ("speechSynthesis" in window && !shellVoice) speechSynthesis.cancel();
    if (clip) { clip.pause(); clip = null; }
  });

  // ---------- video ----------
  const ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 4l12 8-12 8z"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a6 6 0 11-6 6H4a8 8 0 108-8z"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16 8a5 5 0 010 8M18.5 5.5a8.5 8.5 0 010 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  function bigButton(kind, parent, onTap) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kit-bigbtn " + kind;
    b.setAttribute("aria-label", kind);
    b.innerHTML = ICONS[kind];
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.remove(); onTap(); });
    parent.appendChild(b);
    return b;
  }

  // opts: { fit: "contain"|"cover", loop: false, poster, parent: document.body, onEnd }
  function video(src, opts = {}) {
    const parent = opts.parent || document.body;
    const v = document.createElement("video");
    v.className = "kit-video" + (opts.fit === "cover" ? " cover" : "");
    v.src = src;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.controls = false;
    v.disablePictureInPicture = true;
    v.preload = "auto";
    v.loop = !!opts.loop;
    if (opts.poster) v.poster = opts.poster;
    parent.appendChild(v);

    v.addEventListener("error", () => fail("Video couldn't play: " + src));
    v.addEventListener("ended", () => {
      if (opts.onEnd) opts.onEnd(v);
      else bigButton("replay", parent, () => { v.currentTime = 0; v.play(); });
    });

    // Try with sound; if the browser says no, play muted and offer a sound button;
    // if even that fails, show a big play button.
    v.play().catch(() => {
      v.muted = true;
      return v.play().then(
        () => bigButton("sound", parent, () => { v.muted = false; }),
        () => bigButton("play", parent, () => { v.muted = false; v.play(); })
      );
    });
    return v;
  }

  // Called by the harness the instant the kid navigates away (before the slide animation),
  // so nothing keeps playing on the way out.
  function silence() {
    document.querySelectorAll("video, audio").forEach((m) => { try { m.pause(); m.muted = true; } catch (_) {} });
    stopVoice();
    if (ctx) ctx.suspend().catch(() => {});
    if (window.Howler) window.Howler.mute(true);
  }

  window.Kit = {
    use, video, audio, tone, say, stopVoice, fail, silence,
    next: nav("next"), back: nav("back"), random: nav("random"), home: nav("home"),
    inHarness,
    root: ROOT,
    LIBS: Object.keys(LIBS),
  };
})();
