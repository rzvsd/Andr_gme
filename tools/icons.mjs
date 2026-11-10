// Draws the app icon without any image library: each pixel asks "how far am I from this shape?",
// and the answer becomes colour. Writes public/icon-192.png, icon-512.png and icon.svg.
//   node tools/icons.mjs
import zlib from "node:zlib";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const NIGHT = [10, 17, 38];
const NIGHT_HI = [28, 43, 87];
const INK = [239, 230, 207];
const GOLD = [232, 184, 74];
const BODY = [23, 36, 75];

// The mark, in a 0..1 square: a line leaves the start, swings under a planet and reaches the target.
const START = [0.2, 0.74];
const BEND = [0.86, 0.98];
const END = [0.74, 0.27];
const PLANET = [0.43, 0.5, 0.135];

const curve = [];
for (let i = 0; i <= 80; i++) {
  const t = i / 80;
  const u = 1 - t;
  curve.push([u * u * START[0] + 2 * u * t * BEND[0] + t * t * END[0], u * u * START[1] + 2 * u * t * BEND[1] + t * t * END[1]]);
}
function toCurve(x, y) {
  let best = 1;
  for (let i = 0; i < curve.length - 1; i++) {
    const [ax, ay] = curve[i];
    const [bx, by] = curve[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

function colourAt(x, y) {
  const glow = Math.max(0, 1 - Math.hypot(x - 0.5, y - 0.42) / 0.75);
  let c = NIGHT.map((n, i) => n + (NIGHT_HI[i] - n) * glow * glow);
  const over = (rgb, a) => {
    c = c.map((n, i) => n + (rgb[i] - n) * a);
  };
  const edge = (d, w) => Math.max(0, Math.min(1, (w - d) / 0.004)); // soft edge, about one pixel wide at 512

  const dp = Math.hypot(x - PLANET[0], y - PLANET[1]);
  over(BODY, edge(dp, PLANET[2]));
  // Hatching on the dark side of the planet.
  const shade = Math.hypot(x - PLANET[0] + 0.045, y - PLANET[1] + 0.05) > PLANET[2] * 0.96;
  if (dp < PLANET[2] && shade && (((x + y) * 34) % 1 + 1) % 1 < 0.3) over(INK, 0.6);
  over(INK, edge(Math.abs(dp - PLANET[2]), 0.011));

  over(GOLD, edge(toCurve(x, y), 0.017));
  const dt = Math.hypot(x - END[0], y - END[1]);
  over(NIGHT, edge(dt, 0.085));
  over(GOLD, edge(Math.abs(dt - 0.085), 0.013));
  over(GOLD, edge(dt, 0.026));
  over(INK, edge(Math.hypot(x - START[0], y - START[1]), 0.03));
  return c;
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const S = 3; // samples per pixel, each way
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = colourAt((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          for (let i = 0; i < 3; i++) sum[i] += c[i];
        }
      }
      const at = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[at + i] = Math.round(sum[i] / (S * S));
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const rgb = (c) => `rgb(${c.join(",")})`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><radialGradient id="g" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${rgb(NIGHT_HI)}"/><stop offset="1" stop-color="${rgb(NIGHT)}"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#g)"/>
  <circle cx="${PLANET[0] * 100}" cy="${PLANET[1] * 100}" r="${PLANET[2] * 100}" fill="${rgb(BODY)}" stroke="${rgb(INK)}" stroke-width="2.2"/>
  <path d="M${START[0] * 100} ${START[1] * 100} Q${BEND[0] * 100} ${BEND[1] * 100} ${END[0] * 100} ${END[1] * 100}" fill="none" stroke="${rgb(GOLD)}" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="${END[0] * 100}" cy="${END[1] * 100}" r="8.5" fill="${rgb(NIGHT)}" stroke="${rgb(GOLD)}" stroke-width="2.6"/>
  <circle cx="${END[0] * 100}" cy="${END[1] * 100}" r="2.6" fill="${rgb(GOLD)}"/>
  <circle cx="${START[0] * 100}" cy="${START[1] * 100}" r="3" fill="${rgb(INK)}"/>
</svg>
`;

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
fs.mkdirSync(out(""), { recursive: true });
fs.writeFileSync(out("icon-192.png"), png(192));
fs.writeFileSync(out("icon-512.png"), png(512));
fs.writeFileSync(out("icon.svg"), svg);
console.log("icons written");
