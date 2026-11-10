// Plates are stored as short arrays of whole numbers. Whole numbers make a plate identical on every
// machine, and keep 400 plates small. The generator always works on a decoded plate, so what it
// proved is exactly what ships.
import { MOON } from "./physics.js";

export const TARGET_R = 34; // the smallest target; easy plates use a wider one
export const GATE_R = 30;

const MU = 1e4; // mass unit in the stored form
const MILLI = 1000; // angles and turn rates are stored in thousandths of a radian

export function encode(p) {
  const t = p.target;
  return [
    p.seed,
    p.start.x,
    p.start.y,
    t.of >= 0 ? [t.of, t.R, Math.round(t.w * MILLI), Math.round(t.ph * MILLI), t.r] : [t.x, t.y, t.r],
    p.ink,
    p.bodies.map((b) =>
      b.k === MOON
        ? [MOON, b.of, b.R, Math.round(b.w * MILLI), Math.round(b.ph * MILLI), b.r, Math.round(b.mu / MU)]
        : [b.k, b.x, b.y, b.r, Math.round(b.mu / MU)],
    ),
    (p.gates || []).map((g) => [g.ax, g.ay, g.bx, g.by]),
    (p.dust || []).flatMap((d) => [d.x, d.y]),
    [...(p.sol || []), ...(p.best || [])],
  ];
}

export function decode(a) {
  const [seed, sx, sy, t, ink, rawBodies, rawGates, rawDust, lines] = a;
  const bodies = rawBodies.map((b) =>
    b[0] === MOON
      ? { k: MOON, of: b[1], R: b[2], w: b[3] / MILLI, ph: b[4] / MILLI, r: b[5], mu: b[6] * MU, x: 0, y: 0 }
      : { k: b[0], x: b[1], y: b[2], r: b[3], mu: b[4] * MU },
  );
  for (const b of bodies) {
    if (b.k !== MOON) continue;
    b.x = bodies[b.of].x + b.R * Math.cos(b.ph);
    b.y = bodies[b.of].y + b.R * Math.sin(b.ph);
  }
  let target;
  if (t.length === 5) {
    const [of, R, w, ph] = [t[0], t[1], t[2] / MILLI, t[3] / MILLI];
    target = { of, R, w, ph, r: t[4], x: bodies[of].x + R * Math.cos(ph), y: bodies[of].y + R * Math.sin(ph) };
  } else {
    target = { x: t[0], y: t[1], r: t[2], of: -1 };
  }
  const dust = [];
  for (let i = 0; i < rawDust.length; i += 2) dust.push({ x: rawDust[i], y: rawDust[i + 1] });
  return {
    seed,
    start: { x: sx, y: sy },
    target,
    ink,
    bodies,
    gates: rawGates.map((g) => ({ ax: g[0], ay: g[1], bx: g[2], by: g[3], r: GATE_R })),
    dust,
    sol: lines.length >= 2 ? [lines[0], lines[1]] : null,
    best: lines.length >= 4 ? [lines[2], lines[3]] : null,
  };
}
