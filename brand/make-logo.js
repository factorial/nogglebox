// Regenerate the logo: (needs Node.js)
//   mkdir /tmp/logo && cd /tmp/logo && npm install opentype.js@1
//   curl -s -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Baloo+2:wght@800"   # gives the URL of Baloo2 ExtraBold .ttf; download it as Baloo2-800.ttf
//   NODE_PATH=/tmp/logo/node_modules node <this project>/brand/make-logo.js <this project>/brand Baloo2-800.ttf
// The wordmark's letters come from Baloo 2 (SIL Open Font License), converted to vector shapes.
//
// Generates the Nogglebox logo SVGs: a friendly open toy box, plus the wordmark
// "Nogglebox" with its letters converted to vector shapes (no font needed to display it).
const fs = require("fs");
const opentype = require("opentype.js");

const OUT = process.argv[2];
const INK = "#1d2b53";
const C = { pink: "#ff5d8f", orange: "#ff9f1c", sun: "#ffd23f", gold: "#ffc300", green: "#3ddc84", sky: "#2ec4ff", blue: "#2a8fff", purple: "#9b5de5" };
const line = `stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- the box (drawn in a 200 × 200 space) ----------
function star(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}
const box = `
  <!-- the dark inside of the open box -->
  <polygon points="36,92 164,92 150,54 50,54" fill="${INK}" ${line}/>
  <!-- things popping out of the box: a star, a ball and a triangle -->
  <polygon points="${star(66, 54, 24, 11)}" fill="${C.sun}" ${line}/>
  <circle cx="134" cy="54" r="18" fill="${C.green}" ${line}/>
  <polygon points="100,14 122,58 78,58" fill="${C.purple}" ${line}/>
  <!-- the open lid flaps -->
  <polygon points="36,92 100,92 84,58 16,66" fill="${C.pink}" ${line}/>
  <polygon points="100,92 164,92 184,66 116,58" fill="${C.gold}" ${line}/>
  <!-- the front of the box, with a friendly face -->
  <rect x="34" y="90" width="132" height="92" rx="14" fill="${C.sky}" ${line}/>
  <circle cx="64" cy="148" r="8" fill="#ff9ec0"/>
  <circle cx="136" cy="148" r="8" fill="#ff9ec0"/>
  <ellipse cx="80" cy="126" rx="7.5" ry="9.5" fill="${INK}"/>
  <ellipse cx="120" cy="126" rx="7.5" ry="9.5" fill="${INK}"/>
  <circle cx="82.5" cy="122.5" r="2.6" fill="#fff"/>
  <circle cx="122.5" cy="122.5" r="2.6" fill="#fff"/>
  <path d="M84 150 Q100 164 116 150" fill="none" ${line}/>`;

// ---------- the wordmark ----------
const font = opentype.loadSync(process.argv[3]);
const WORD = "Nogglebox";
const LETTER_COLORS = [C.pink, C.orange, C.gold, C.green, C.sky, C.purple, C.pink, C.orange, C.green];
const SIZE = 150; // font size, in the same units as the 200-unit box
const glyphPaths = font.getPaths(WORD, 0, 0, SIZE, { kerning: true });
const full = font.getPath(WORD, 0, 0, SIZE, { kerning: true }).getBoundingBox();
const textH = full.y2 - full.y1;
const pathsFor = (dx, dy) => glyphPaths.map((p) => {
  const q = new opentype.Path(); q.commands = p.commands.map((c) => {
    const n = { ...c };
    for (const k of ["x", "y", "x1", "y1", "x2", "y2"]) if (k in n) n[k] = +(n[k] + (k.startsWith("x") ? dx : dy)).toFixed(2);
    return n;
  });
  return q.toPathData(2);
});

function wordmark(dx, dy) {
  const d = pathsFor(dx, dy);
  // A thick dark outline under the colored letters (works in every viewer, unlike paint-order).
  return `
  <g fill="${INK}" stroke="${INK}" stroke-width="14" stroke-linejoin="round">
    ${d.map((p) => `<path d="${p}"/>`).join("\n    ")}
  </g>
  <g>
    ${d.map((p, i) => `<path d="${p}" fill="${LETTER_COLORS[i % LETTER_COLORS.length]}"/>`).join("\n    ")}
  </g>`;
}

const svg = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
  <title>${title}</title>${body}
</svg>
`;

// Box + wordmark, side by side, the letters vertically centered on the box
const PAD = 12, GAP = 28;
const tx = 200 + GAP - full.x1, ty = 100 + 8 - (full.y1 + textH / 2);
const W = Math.ceil(200 + GAP + (full.x2 - full.x1) + PAD), H = 200;
fs.writeFileSync(`${OUT}/nogglebox-logo.svg`,
  svg(W + PAD, H + PAD * 2, `\n  <g transform="translate(${PAD} ${PAD})">${box}\n  ${wordmark(tx, ty)}\n  </g>`, "Nogglebox"));

// The box alone, square
fs.writeFileSync(`${OUT}/nogglebox-icon.svg`,
  svg(200 + PAD * 2, 200 + PAD * 2, `\n  <g transform="translate(${PAD} ${PAD})">${box}\n  </g>`, "Nogglebox"));
if (process.env.PREVIEW) fs.writeFileSync("preview-logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + PAD} ${W + PAD}" width="1200" height="1200"><rect width="100%" height="100%" fill="#fff"/><g transform="translate(0 ${(W - H) / 2})">` +
  fs.readFileSync(`${OUT}/nogglebox-logo.svg`, "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "") + "</g></svg>");
console.log("wrote", OUT, "| logo size", W + PAD, "x", H + PAD * 2);
