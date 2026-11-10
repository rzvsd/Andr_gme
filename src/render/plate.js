// Draws a plate the way an old star atlas would print it: engraved discs, hatching, hairlines.
// All positions are in sheet units (900 x 1200). `v.hair` is the length of one CSS pixel in sheet
// units, so strokes keep their weight at any size, from a 90 px thumbnail to a share image.
import { W, H, PLANET, ROCK, PUSH, DARK, MOON, bodyAt, targetAt, CRASH, DRY } from "../sim/physics.js";
import { rng } from "../sim/rng.js";
import { INK, GOLD, RED, TEAL, PAPER, BODY, serif, rgba } from "./theme.js";

const TAU = Math.PI * 2;
const NAMES =
  "Vesper Halcyon Thule Ione Calder Maris Sable Orrin Lyra Tamsin Corvin Ashby Nyx Soren Wren Isolde Marlowe Quill Ember Rook Thane Liesl Cassia Dorian Elowen Fenn Garnet Hollis Juno Kestrel Lorne Merrow Nerys Oriel Pell Quince Rune Selwyn Tarn Umber Vale Wyck Yarrow Zephyr Alder Briar Cael Dune Eira".split(
    " ",
  );

/** A view maps the sheet onto a canvas that is `cssWidth` CSS pixels wide. */
export function makeView(cssWidth, dpr = 1) {
  return { s: (cssWidth * dpr) / W, hair: W / cssWidth };
}

export function begin(ctx, v) {
  ctx.setTransform(v.s, 0, 0, v.s, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function seg(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Paper, grain, background stars, graticule and the frame. `rich` adds the fine detail. */
export function drawSheet(ctx, plate, v, rich = true) {
  const R = rng(plate.seed * 31 + 7);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.5, H * 0.8);
  g.addColorStop(0, PAPER[0]);
  g.addColorStop(0.55, PAPER[1]);
  g.addColorStop(1, PAPER[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (rich) {
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = i % 3 ? "rgba(239,230,207,0.04)" : "rgba(0,0,0,0.12)";
      const d = v.hair * R.range(0.6, 1.5);
      ctx.fillRect(R() * W, R() * H, d, d);
    }
  }

  ctx.lineWidth = 0.6 * v.hair;
  ctx.strokeStyle = rgba(INK, 0.055);
  ctx.beginPath();
  for (let x = 150; x < W; x += 150) {
    ctx.moveTo(x, 34);
    ctx.lineTo(x, H - 34);
  }
  for (let y = 150; y < H; y += 150) {
    ctx.moveTo(34, y);
    ctx.lineTo(W - 34, y);
  }
  ctx.stroke();
  if (rich) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(34, 34, W - 68, H - 68);
    ctx.clip();
    ctx.strokeStyle = rgba(INK, 0.085);
    ctx.setLineDash([7 * v.hair, 8 * v.hair]);
    for (let k = 0; k < 2; k++) {
      const cx = R.range(-700, W + 700);
      const cy = k ? R.range(-1400, -500) : R.range(H + 500, H + 1400);
      disc(ctx, cx, cy, Math.hypot(cx - R.range(200, 700), cy - R.range(350, 850)));
      ctx.stroke();
    }
    ctx.restore();
  }

  const stars = [];
  const n = rich ? 130 : 44;
  for (let i = 0; i < n; i++) {
    const m = R() ** 3;
    const st = { x: R.range(48, W - 48), y: R.range(48, H - 48), m };
    stars.push(st);
    ctx.fillStyle = rgba(INK, 0.22 + 0.6 * m);
    disc(ctx, st.x, st.y, (0.45 + 1.15 * m) * v.hair);
    ctx.fill();
    if (rich && m > 0.7) {
      const L = (3 + 6 * m) * v.hair;
      ctx.strokeStyle = rgba(INK, 0.35);
      ctx.lineWidth = 0.5 * v.hair;
      seg(ctx, st.x - L, st.y, st.x + L, st.y);
      seg(ctx, st.x, st.y - L, st.x, st.y + L);
    }
  }
  if (rich) {
    // Two faint constellations, only for the look.
    ctx.strokeStyle = rgba(INK, 0.12);
    ctx.lineWidth = 0.6 * v.hair;
    for (let k = 0; k < 2; k++) {
      let cur = stars[R.int(0, n - 1)];
      const used = new Set([cur]);
      ctx.beginPath();
      ctx.moveTo(cur.x, cur.y);
      for (let j = 0; j < 4; j++) {
        let best = null;
        let bd = 280;
        for (const s of stars) {
          const d = Math.hypot(s.x - cur.x, s.y - cur.y);
          if (!used.has(s) && d > 70 && d < bd) {
            bd = d;
            best = s;
          }
        }
        if (!best) break;
        ctx.lineTo(best.x, best.y);
        used.add(best);
        cur = best;
      }
      ctx.stroke();
    }
  }

  // Frame: two rules with a scale of ticks between them.
  const a = 22;
  const b = 34;
  ctx.strokeStyle = rgba(INK, 0.85);
  ctx.lineWidth = 1.2 * v.hair;
  ctx.strokeRect(a, a, W - 2 * a, H - 2 * a);
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 0.6 * v.hair;
  ctx.strokeRect(b, b, W - 2 * b, H - 2 * b);
  if (rich) {
    ctx.beginPath();
    for (let x = b + 26; x < W - b; x += 30) {
      const long = Math.round(x - b - 26) % 150 === 124;
      ctx.moveTo(x, a);
      ctx.lineTo(x, long ? b : b - 5);
      ctx.moveTo(x, H - a);
      ctx.lineTo(x, long ? H - b : H - b + 5);
    }
    for (let y = b + 26; y < H - b; y += 30) {
      const long = Math.round(y - b - 26) % 150 === 124;
      ctx.moveTo(a, y);
      ctx.lineTo(long ? b : b - 5, y);
      ctx.moveTo(W - a, y);
      ctx.lineTo(long ? W - b : W - b + 5, y);
    }
    ctx.stroke();
  }
}

function hatch(ctx, x, y, r, v, alpha, color = INK) {
  ctx.save();
  disc(ctx, x, y, r);
  ctx.clip();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 0.7 * v.hair;
  const gap = Math.max(4.2 * v.hair, r / 7);
  ctx.beginPath();
  for (let d = -2 * r; d <= 2 * r; d += gap) {
    ctx.moveTo(x + d - r, y + r);
    ctx.lineTo(x + d + r, y - r);
  }
  ctx.stroke();
  ctx.restore();
}

// A lit sphere: hatching everywhere, then the lit side is wiped clean, which leaves a crescent.
function sphere(ctx, x, y, r, v, bands, tilt) {
  ctx.fillStyle = BODY;
  disc(ctx, x, y, r);
  ctx.fill();
  hatch(ctx, x, y, r, v, 0.5);
  ctx.save();
  disc(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = rgba(BODY, 0.95);
  disc(ctx, x - r * 0.3, y - r * 0.34, r * 0.96);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.3);
  ctx.lineWidth = 0.7 * v.hair;
  for (let k = 0; k < bands; k++) {
    ctx.beginPath();
    ctx.ellipse(x, y + r * (k ? 0.2 : -0.36), r * 1.05, r * 0.24, tilt, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4 * v.hair;
  disc(ctx, x, y, r);
  ctx.stroke();
}

// Dotted circles where the pull has a set strength: wide rings mean a heavy body.
function wells(ctx, x, y, mu, v, color, strong = 1) {
  ctx.lineWidth = 0.75 * v.hair;
  ctx.setLineDash([1.2 * v.hair, 4.4 * v.hair]);
  [800, 300].forEach((a, k) => {
    ctx.strokeStyle = rgba(color, (k ? 0.14 : 0.24) * strong);
    disc(ctx, x, y, Math.sqrt(Math.abs(mu) / a));
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function orbitRing(ctx, x, y, R, w, v, color, alpha) {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 0.8 * v.hair;
  ctx.setLineDash([5 * v.hair, 5 * v.hair]);
  disc(ctx, x, y, R);
  ctx.stroke();
  ctx.setLineDash([]);
  const s = 6 * v.hair;
  for (const g of [0.7, 0.7 + Math.PI]) {
    const px = x + R * Math.cos(g);
    const py = y + R * Math.sin(g);
    const dir = g + (Math.sign(w) * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(dir + 2.6) * s, py + Math.sin(dir + 2.6) * s);
    ctx.lineTo(px, py);
    ctx.lineTo(px + Math.cos(dir - 2.6) * s, py + Math.sin(dir - 2.6) * s);
    ctx.stroke();
  }
}

function label(ctx, text, x, y, v, color, align = "left", size = 20) {
  ctx.font = serif(Math.max(11 * v.hair, size), "italic");
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Everything that does not move during a line: wells, orbits, planets, rocks, gates, the start.
 * st.rev is the bit mask of unseen bodies the player has found. st.labels turns the names on.
 */
export function drawFixed(ctx, plate, v, st = {}) {
  const rev = st.rev || 0;
  const shown = (b, i) => b.k !== DARK || (rev >> i) & 1;

  plate.bodies.forEach((b, i) => {
    if (b.k === MOON) {
      const p = plate.bodies[b.of];
      orbitRing(ctx, p.x, p.y, b.R, b.w, v, INK, 0.3);
    } else if (b.mu && shown(b, i)) {
      wells(ctx, b.x, b.y, b.mu, v, b.k === PUSH ? RED : INK, b.k === DARK ? 0.7 : 1);
    }
  });
  const tg = plate.target;
  if (tg.of >= 0) {
    const p = plate.bodies[tg.of];
    orbitRing(ctx, p.x, p.y, tg.R, tg.w, v, GOLD, 0.4);
  }
  for (const g of plate.gates) {
    ctx.strokeStyle = rgba(TEAL, 0.2);
    ctx.lineWidth = 0.8 * v.hair;
    ctx.setLineDash([1.2 * v.hair, 6 * v.hair]);
    seg(ctx, g.ax, g.ay, g.bx, g.by);
    ctx.setLineDash([]);
  }

  plate.bodies.forEach((b, i) => {
    if (b.k === MOON || !shown(b, i)) return;
    const R = rng(plate.seed + i * 977);
    if (b.k === PLANET) {
      sphere(ctx, b.x, b.y, b.r, v, R.int(0, 2), R.range(-0.35, 0.35));
    } else if (b.k === ROCK) {
      const n = R.int(7, 9);
      const turn = R.range(0, TAU);
      const corners = [];
      for (let k = 0; k < n; k++) {
        const rr = b.r * R.range(0.8, 1);
        const g = turn + (k / n) * TAU;
        corners.push(b.x + Math.cos(g) * rr, b.y + Math.sin(g) * rr);
      }
      const outline = () => {
        ctx.beginPath();
        for (let k = 0; k < corners.length; k += 2) ctx.lineTo(corners[k], corners[k + 1]);
        ctx.closePath();
      };
      outline();
      ctx.fillStyle = BODY;
      ctx.fill();
      ctx.save();
      ctx.clip();
      hatch(ctx, b.x + b.r * 0.5, b.y + b.r * 0.5, b.r, v, 0.5);
      ctx.restore();
      outline();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * v.hair;
      ctx.stroke();
    } else if (b.k === PUSH) {
      ctx.fillStyle = BODY;
      disc(ctx, b.x, b.y, b.r);
      ctx.fill();
      hatch(ctx, b.x, b.y, b.r, v, 0.35, RED);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.5 * v.hair;
      disc(ctx, b.x, b.y, b.r);
      ctx.stroke();
      ctx.lineWidth = 1.1 * v.hair;
      for (let k = 0; k < 12; k++) {
        const g = (k / 12) * TAU;
        const r0 = b.r + 5;
        const r1 = b.r + (k % 2 ? 11 : 17);
        seg(ctx, b.x + Math.cos(g) * r0, b.y + Math.sin(g) * r0, b.x + Math.cos(g) * r1, b.y + Math.sin(g) * r1);
      }
      ctx.fillStyle = RED;
      disc(ctx, b.x, b.y, 2.2 * v.hair);
      ctx.fill();
    } else {
      // An unseen body that the player has found: drawn as a guess.
      ctx.fillStyle = rgba(BODY, 0.7);
      disc(ctx, b.x, b.y, b.r);
      ctx.fill();
      ctx.strokeStyle = rgba(INK, 0.75);
      ctx.lineWidth = 1.2 * v.hair;
      ctx.setLineDash([4 * v.hair, 4 * v.hair]);
      disc(ctx, b.x, b.y, b.r);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, "?", b.x, b.y + Math.max(11 * v.hair, 24) * 0.32, v, rgba(INK, 0.8), "center", 24);
    }
    if (st.labels && b.k === PLANET) {
      const right = b.x < W - 220;
      const name = NAMES[(plate.seed + i * 7) % NAMES.length];
      const off = b.r * 0.72 + 5 * v.hair;
      label(ctx, name, b.x + (right ? off : -off), b.y + off + 9 * v.hair, v, rgba(INK, 0.62), right ? "left" : "right");
    }
  });

  for (const g of plate.gates) {
    for (const [x, y] of [
      [g.ax, g.ay],
      [g.bx, g.by],
    ]) {
      ctx.fillStyle = rgba(TEAL, 0.07);
      disc(ctx, x, y, g.r);
      ctx.fill();
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 1.4 * v.hair;
      ctx.stroke();
      ctx.strokeStyle = rgba(TEAL, 0.7);
      ctx.lineWidth = 0.9 * v.hair;
      ctx.setLineDash([3 * v.hair, 3.5 * v.hair]);
      disc(ctx, x, y, g.r * 0.58);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.785;
        seg(ctx, x + Math.cos(a) * g.r, y + Math.sin(a) * g.r, x + Math.cos(a) * (g.r + 8), y + Math.sin(a) * (g.r + 8));
      }
    }
  }

  const s = plate.start;
  ctx.strokeStyle = rgba(INK, 0.75);
  ctx.lineWidth = 1 * v.hair;
  disc(ctx, s.x, s.y, 13);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    seg(ctx, s.x + Math.cos(a) * 13, s.y + Math.sin(a) * 13, s.x + Math.cos(a) * 21, s.y + Math.sin(a) * 21);
  }
  ctx.fillStyle = INK;
  disc(ctx, s.x, s.y, 4.5);
  ctx.fill();
  if (st.labels) label(ctx, "α", s.x + 22, s.y + 34, v, rgba(INK, 0.8), "left", 26);
}

function mote(ctx, x, y, size, v, got) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const r = k % 2 ? size * 0.3 : size;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = got ? GOLD : rgba(GOLD, 0.14);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.1 * v.hair;
  ctx.stroke();
}

/** Moons, the target and the stardust at flight time t. st.dust = motes taken, st.clock for the pulse. */
export function drawMoving(ctx, plate, v, t, st = {}) {
  const clock = st.clock || 0;
  const p = {};
  plate.bodies.forEach((b, i) => {
    if (b.k !== MOON) return;
    bodyAt(plate, i, t, p);
    ctx.lineWidth = 0.75 * v.hair;
    ctx.setLineDash([1.2 * v.hair, 4.4 * v.hair]);
    ctx.strokeStyle = rgba(INK, 0.22);
    disc(ctx, p.x, p.y, Math.sqrt(b.mu / 800));
    ctx.stroke();
    ctx.setLineDash([]);
    sphere(ctx, p.x, p.y, b.r, v, 0, 0);
  });

  const tg = plate.target;
  targetAt(plate, t, p);
  const r = tg.r * (1 + 0.035 * Math.sin(clock * 2.4));
  ctx.fillStyle = rgba(GOLD, 0.07);
  disc(ctx, p.x, p.y, r);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6 * v.hair;
  ctx.stroke();
  ctx.strokeStyle = rgba(GOLD, 0.55);
  ctx.lineWidth = 0.9 * v.hair;
  disc(ctx, p.x, p.y, tg.r * 0.58);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  disc(ctx, p.x, p.y, Math.max(3, 1.8 * v.hair));
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1 * v.hair;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    seg(ctx, p.x + Math.cos(a) * (tg.r + 5), p.y + Math.sin(a) * (tg.r + 5), p.x + Math.cos(a) * (tg.r + 14), p.y + Math.sin(a) * (tg.r + 14));
  }
  if (st.labels) label(ctx, "ω", p.x + tg.r * 0.72 + 8, p.y - tg.r * 0.72 - 6, v, GOLD, "left", 26);

  plate.dust.forEach((d, i) => {
    const got = ((st.dust || 0) >> i) & 1;
    const size = Math.max(15, (st.mini ? 3 : 6.5) * v.hair) * (1 + 0.1 * Math.sin(clock * 3 + i * 2.1));
    mote(ctx, d.x, d.y, size, v, got);
  });
}

/** Stroke a path. `pts` is x,y pairs; a NaN pair lifts the pen (a jump through a gate). */
export function drawLine(ctx, pts, v, color, width, upto = pts.length) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width * v.hair;
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < upto; i += 2) {
    const x = pts[i];
    if (x !== x) {
      pen = false;
    } else if (pen) {
      ctx.lineTo(x, pts[i + 1]);
    } else {
      ctx.moveTo(x, pts[i + 1]);
      pen = true;
    }
  }
  ctx.stroke();
}

/** A finished line that did not arrive: faint, with a mark that says how it ended. */
export function drawGhost(ctx, line, v, alpha) {
  const { pts, result } = line;
  drawLine(ctx, pts, v, rgba(INK, alpha), 1);
  const x = pts[pts.length - 2];
  const y = pts[pts.length - 1];
  ctx.strokeStyle = rgba(result === CRASH ? RED : INK, Math.min(1, alpha * 2.2));
  ctx.lineWidth = 1.1 * v.hair;
  if (result === CRASH) {
    const s = 4.5 * v.hair;
    seg(ctx, x - s, y - s, x + s, y + s);
    seg(ctx, x - s, y + s, x + s, y - s);
  } else if (result === DRY) {
    disc(ctx, x, y, 3 * v.hair);
    ctx.stroke();
  }
}

/** The aim: a shaft from the start, and dots for the first moments of the flight. */
export function drawAim(ctx, plate, v, a10, p10, dots, alpha = 1, color = INK) {
  const th = (a10 * Math.PI) / 1800;
  const len = 44 + (p10 / 1000) * 150;
  const s = plate.start;
  const dx = Math.cos(th);
  const dy = -Math.sin(th);
  if (dots) {
    for (let i = 0; i < dots.length; i += 2) {
      ctx.fillStyle = rgba(color, alpha * 0.75 * (1 - i / dots.length));
      disc(ctx, dots[i], dots[i + 1], 1.5 * v.hair);
      ctx.fill();
    }
  }
  const ex = s.x + dx * len;
  const ey = s.y + dy * len;
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.8 * v.hair;
  seg(ctx, s.x + dx * 24, s.y + dy * 24, ex, ey);
  const h = 9 * v.hair;
  const back = Math.atan2(dy, dx) + Math.PI;
  ctx.beginPath();
  ctx.moveTo(ex + Math.cos(back + 0.42) * h, ey + Math.sin(back + 0.42) * h);
  ctx.lineTo(ex, ey);
  ctx.lineTo(ex + Math.cos(back - 0.42) * h, ey + Math.sin(back - 0.42) * h);
  ctx.stroke();
}

/** The bright tip of the line while it is being drawn. */
export function drawHead(ctx, x, y, v) {
  const r = 11 * v.hair;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(GOLD, 0.85));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  disc(ctx, x, y, r);
  ctx.fill();
  ctx.fillStyle = "#fff8e6";
  disc(ctx, x, y, 2.4 * v.hair);
  ctx.fill();
}

/** A winning line: gold with a soft halo. */
export function drawGold(ctx, pts, v, upto) {
  drawLine(ctx, pts, v, rgba(GOLD, 0.22), 6, upto);
  drawLine(ctx, pts, v, GOLD, 2.2, upto);
}

/** A whole plate at rest, with the lines of a sheet on it. Used for thumbnails and share images. */
export function drawStill(ctx, plate, v, { rich = false, labels = false, rev = 0, ghosts = [], gold = null, dust = 0 } = {}) {
  begin(ctx, v);
  drawSheet(ctx, plate, v, rich);
  drawFixed(ctx, plate, v, { rev, labels });
  ghosts.forEach((line) => drawGhost(ctx, line, v, 0.26));
  drawMoving(ctx, plate, v, 0, { dust, labels, mini: !rich });
  if (gold) drawGold(ctx, gold, v);
}
