// Words for Sound It Out, shared by the page (5/index.html) and the recording splitter
// (split-sounds.sh), so the two always agree.
//
// Each word is split into its sounds, one tile per sound. Usually that's one letter each, but
// some letter pairs make a single sound and share one tile, like the "ll" in "ball". To split a
// word some other way, write it with hyphens: ["sh-i-p", "🚢"] gives SH · I · P.
(function (root) {
  const WORDS = [
    ["cat", "🐱"], ["hat", "🎩"], ["bat", "🦇"], ["rat", "🐀"], ["pad", "🗒️"], ["map", "🗺️"],
    ["lamp", "🪔"], ["fan", "🪭"], ["van", "🚐"], ["ant", "🐜"],
    ["bed", "🛏️"], ["hen", "🐔"], ["pen", "🖊️"], ["net", "🥅"], ["web", "🕸️"], ["ten", "🔟"],
    ["pig", "🐷"], ["six", "6️⃣"],
    ["dog", "🐶"], ["box", "📦"], ["fox", "🦊"], ["log", "🪵"],
    ["sun", "☀️"], ["bus", "🚌"], ["cup", "🥤"], ["bug", "🐛"],
    ["ball", "⚽"],
  ];

  // Letter pairs that make one sound, so they share a tile.
  const GROUPS = ["ll", "ss", "ff", "zz", "ck", "sh", "ch", "th", "wh", "ng", "qu"];

  const plain = (w) => w.replace(/-/g, "");          // "sh-i-p" → "ship"
  function sounds(w) {                                // "ball" → ["b", "a", "ll"]
    if (w.includes("-")) return w.split("-");
    const out = [];
    for (let i = 0; i < w.length;) {
      const pair = w.slice(i, i + 2);
      if (GROUPS.includes(pair)) { out.push(pair); i += 2; } else { out.push(w[i]); i += 1; }
    }
    return out;
  }

  // Spellings for the built-in voice, used only until a word's real recording exists.
  // (A single spelling per letter can't be right for every word, e.g. the A in "rat" vs
  // "ball"; that's why each word gets its own recording.)
  const SPOKEN = {
    a: "ah", b: "buh", c: "kuh", d: "duh", e: "eh", f: "fff", g: "guh", h: "huh", i: "ih",
    j: "juh", k: "kuh", l: "ull", m: "mmm", n: "nnn", o: "aw", p: "puh", r: "rrr", s: "sss",
    t: "tuh", u: "uh", v: "vvv", w: "wuh", x: "ks", y: "yuh", z: "zzz",
    ll: "ull", ss: "sss", ff: "fff", zz: "zzz", ck: "kuh", sh: "shh", ch: "chuh", th: "thh",
    wh: "wuh", ng: "ng", qu: "kwuh",
  };

  root.SOUND_IT_OUT = { WORDS, GROUPS, sounds, plain, SPOKEN };
})(typeof window !== "undefined" ? window : globalThis);
