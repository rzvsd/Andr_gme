// The plate generator. It lays out a sky from a seed, then fires a line for every whole degree and
// every 4% of power (9,000 lines) through the same integrator the player uses. From that map of
// wins it measures how wide the easiest answer is, picks a second, more beautiful answer, and puts
// the three stardust motes on it. A plate ships only if both answers hold under small aim errors.
// Runs in Node (tools/generate.mjs); nothing here is in the game bundle.
import {
  W,
  H,
  compile,
  createFlight,
  step,
  simulate,
  WIN,
  ALL_DUST,
  PLANET,
  ROCK,
  PUSH,
  DARK,
  MOON,
  P_STEPS,
  A_STEPS,
} from "../sim/physics.js";
import { rng } from "../sim/rng.js";
import { encode, decode, TARGET_R, GATE_R } from "../sim/codec.js";

export const CHAPTERS = ["fall", "clockwork", "opposition", "passage", "unseen", "tour"];

const NA = 360;
const NP = 25;
const SCAN_INK = 5200;
const PAD = 64;
const aOf = (i) => i * 10;
const pOf = (j) => 40 + j * 40;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** What a plate of this chapter and tier (0 easy, 1 medium, 2 hard) must contain and how hard it may be. */
export function specFor(ch, tier, R) {
  const at = (list) => list[tier];
  const s = {
    ch,
    tier,
    planets: [1, 2],
    rocks: [0, 0],
    push: [0, 0],
    moons: [0, 0],
    dark: [0, 0],
    gate: false,
    orbit: false,
    blocker: tier > 0,
    layouts: ["rise"],
    targetR: at([52, 42, TARGET_R + 4]),
    turn: at([[0.4, 2.4], [1.2, 4.5], [2.2, 9]]), // how far the stardust line must turn, radians
    maxFrac: at([0.2, 0.1, 0.05]),
    solTol: at([[20, 60], [10, 30], [7, 20]]), // aim error the easiest answer must survive: tenths of a degree, tenths of a percent
    must: -1, // body kind that the answers must depend on
  };
  if (ch === "fall") {
    s.planets = at([[1, 2], [2, 3], [3, 4]]);
    s.rocks = at([[0, 0], [0, 2], [1, 3]]);
    s.layouts = at([["rise"], ["rise", "cross"], ["rise", "cross", "return"]]);
  } else if (ch === "clockwork") {
    s.planets = at([[1, 1], [1, 2], [2, 3]]);
    s.moons = at([[1, 1], [1, 2], [1, 2]]);
    s.orbit = tier > 0 && R.chance(0.6);
    s.must = MOON;
    s.layouts = ["rise", "cross"];
  } else if (ch === "opposition") {
    s.planets = at([[1, 1], [1, 2], [2, 3]]);
    s.push = at([[1, 1], [1, 2], [2, 2]]);
    s.rocks = at([[0, 1], [0, 2], [0, 2]]);
    s.must = PUSH;
    s.layouts = ["rise", "cross", "return"];
  } else if (ch === "passage") {
    s.planets = at([[1, 1], [1, 2], [2, 3]]);
    s.rocks = at([[0, 1], [0, 2], [1, 3]]);
    s.gate = true;
    s.layouts = ["rise", "cross"];
  } else if (ch === "unseen") {
    s.planets = at([[0, 1], [1, 2], [1, 2]]);
    s.dark = at([[1, 1], [1, 1], [1, 2]]);
    s.must = DARK;
    s.layouts = ["rise", "cross"];
  } else {
    s.planets = [2, 3];
    s.rocks = [0, 2];
    s.moons = [0, 1];
    s.push = [0, 1];
    s.dark = [0, 1];
    s.gate = R.chance(0.45);
    s.orbit = R.chance(0.3);
    s.layouts = ["rise", "rise", "cross", "cross", "return"];
  }
  return s;
}

// Lay out start, target and bodies. Returns a decoded plate with no dust and no answers yet.
function build(R, spec, seed) {
  const lay = R.pick(spec.layouts);
  const left = R.chance(0.5);
  const mir = (x) => (left ? x : W - x);
  let s;
  let t;
  if (lay === "rise") {
    s = { x: R.int(180, 720), y: R.int(950, 1090) };
    t = { x: R.int(160, 740), y: R.int(120, 330) };
  } else if (lay === "cross") {
    s = { x: mir(R.int(110, 250)), y: R.int(920, 1090) };
    t = { x: mir(R.int(620, 780)), y: R.int(120, 380) };
  } else {
    s = { x: mir(R.int(110, 240)), y: R.int(900, 1080) };
    t = { x: mir(R.int(640, 790)), y: R.int(760, 1040) };
  }

  const taken = [{ x: s.x, y: s.y, r: 110 }];
  const bodies = [];
  const fits = (x, y, r, gap) =>
    x - r >= PAD &&
    x + r <= W - PAD &&
    y - r >= PAD &&
    y + r <= H - PAD &&
    taken.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r + gap);
  const mass = (r) => Math.round(0.36 * r * r * R.range(0.85, 1.25)) * 1e4;

  let moonsLeft = R.int(spec.moons[0], spec.moons[1]);
  const add = (k, at) => {
    let r = R.int(30, 60);
    let mu = 0;
    if (k === ROCK) r = R.int(14, 24);
    else if (k === PUSH) {
      r = R.int(20, 30);
      mu = -R.int(200, 520) * 1e4;
    } else {
      if (k === DARK) r = R.int(30, 48);
      mu = mass(r);
    }
    let moon = null;
    if (k === PLANET && moonsLeft > 0) {
      const rm = R.int(12, 18);
      const Rm = r + R.int(64, 120);
      const w = Math.sqrt(mu / Rm ** 3) * R.range(0.6, 1) * (R.chance(0.5) ? 1 : -1);
      moon = { k: MOON, R: Rm, w, ph: R.range(0, Math.PI * 2), r: rm, mu: Math.round(0.8 * rm * rm) * 1e4 };
    }
    const keep = moon ? moon.R + moon.r : r;
    for (let n = 0; n < 60; n++) {
      const p = at ? at(r) : { x: R.int(PAD, W - PAD), y: R.int(PAD, H - PAD) };
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (!fits(x, y, keep, k === ROCK ? 44 : 64)) continue;
      taken.push({ x, y, r: keep });
      bodies.push({ k, x, y, r, mu });
      if (moon) {
        moonsLeft--;
        bodies.push({ ...moon, of: bodies.length - 1 });
      }
      return true;
    }
    return false;
  };

  let target = { x: t.x, y: t.y, r: spec.targetR, of: -1 };
  let planets = R.int(spec.planets[0], spec.planets[1]);
  let dark = R.int(spec.dark[0], spec.dark[1]);
  let push = R.int(spec.push[0], spec.push[1]);

  if (spec.orbit) {
    // The target rides a circle around a host planet.
    const r = R.int(34, 50);
    const mu = mass(r);
    const Rt = r + R.int(70, 115);
    const keep = Rt + spec.targetR;
    const x = clamp(t.x, PAD + keep, W - PAD - keep);
    const y = clamp(t.y, PAD + keep, H - PAD - keep);
    if (!fits(x, y, keep, 40)) return null;
    taken.push({ x, y, r: keep });
    bodies.push({ k: PLANET, x, y, r, mu });
    const w = Math.sqrt(mu / Rt ** 3) * R.range(0.45, 0.85) * (R.chance(0.5) ? 1 : -1);
    target = { of: 0, R: Rt, w, ph: R.range(0, Math.PI * 2), r: spec.targetR };
    t = { x, y };
    planets--;
  } else {
    taken.push({ x: t.x, y: t.y, r: spec.targetR + 30 });
  }

  if (spec.blocker && !spec.orbit) {
    // One body sits on the straight road from start to target.
    const kind = spec.ch === "unseen" ? DARK : spec.ch === "opposition" && R.chance(0.5) ? PUSH : PLANET;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const L = Math.hypot(dx, dy);
    const at = (r) => {
      const u = R.range(0.34, 0.62);
      const off = R.range(-0.5, 0.5) * r;
      return { x: s.x + dx * u - (dy / L) * off, y: s.y + dy * u + (dx / L) * off };
    };
    if (!add(kind, at)) return null;
    if (kind === DARK) dark--;
    else if (kind === PUSH) push--;
    else planets--;
  }
  for (; planets > 0; planets--) if (!add(PLANET)) return null;
  for (; dark > 0; dark--) if (!add(DARK)) return null;
  for (; push > 0; push--) if (!add(PUSH)) return null;
  if (moonsLeft > 0 && spec.moons[0] > 0 && !spec.orbit) return null;

  const gates = [];
  if (spec.gate) {
    const mouth = (y0, y1) => {
      for (let n = 0; n < 60; n++) {
        const x = R.int(110, 790);
        const y = R.int(y0, y1);
        if (!fits(x, y, GATE_R, 50)) continue;
        taken.push({ x, y, r: GATE_R + 10 });
        return { x, y };
      }
      return null;
    };
    const a = mouth(560, 1000);
    const b = mouth(140, 560);
    if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 380) return null;
    gates.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: GATE_R });
  }
  for (let rocks = R.int(spec.rocks[0], spec.rocks[1]); rocks > 0; rocks--) add(ROCK);

  return decode(encode({ seed, start: s, target, ink: SCAN_INK, bodies, gates, dust: [], sol: null, best: null }));
}

// Does the line still pass when the aim is off by up to (da, dp)?
function holds(c, a, p, da, dp, ok) {
  for (const s of [1, 0.75, 0.5]) {
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        const aa = (a + Math.round(x * da * s) + A_STEPS) % A_STEPS;
        const pp = Math.min(P_STEPS, p + Math.round(y * dp * s));
        if (pp < 40 || !ok(simulate(c, aa, pp))) return false;
      }
    }
  }
  return true;
}

// Is this line a win only because bodies of `kind` are there?
function dependsOn(plate, a, p, kind) {
  if (kind === MOON && plate.target.of >= 0) return true;
  let omit = 0;
  plate.bodies.forEach((b, i) => {
    if (b.k === kind) omit |= 1 << i;
  });
  if (!omit) return false;
  const c = compile(plate, omit);
  return simulate(c, a, p).result !== WIN;
}

// Put three motes on the path of the chosen line, clear of everything else on the plate.
function placeDust(plate, c, a, p, R) {
  const f = createFlight(c, a, p);
  const xs = [f.x];
  const ys = [f.y];
  const ls = [0];
  while (!step(c, f)) {
    xs.push(f.x);
    ys.push(f.y);
    ls.push(f.len);
  }
  const total = f.len;
  const tg = plate.target;
  const dust = [];
  const clear = (x, y) => {
    if (x < 70 || x > W - 70 || y < 70 || y > H - 70) return false;
    if (Math.hypot(x - plate.start.x, y - plate.start.y) < 100) return false;
    if (tg.of >= 0) {
      const host = plate.bodies[tg.of];
      if (Math.abs(Math.hypot(x - host.x, y - host.y) - tg.R) < tg.r + 30) return false;
    } else if (Math.hypot(x - tg.x, y - tg.y) < tg.r + 50) return false;
    for (const b of plate.bodies) {
      if (b.k === MOON) {
        const host = plate.bodies[b.of];
        if (Math.abs(Math.hypot(x - host.x, y - host.y) - b.R) < b.r + 30) return false;
      } else if (Math.hypot(x - b.x, y - b.y) < b.r + 34) return false;
    }
    for (const g of plate.gates) {
      if (Math.hypot(x - g.ax, y - g.ay) < GATE_R + 34 || Math.hypot(x - g.bx, y - g.by) < GATE_R + 34) return false;
    }
    return dust.every((d) => Math.hypot(x - d.x, y - d.y) >= 110);
  };
  for (const base of [R.range(0.16, 0.28), R.range(0.4, 0.52), R.range(0.62, 0.76)]) {
    let put = null;
    for (const shift of [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12]) {
      const L = (base + shift) * total;
      const i = ls.findIndex((l) => l >= L);
      if (i < 0) continue;
      const x = Math.round(xs[i]);
      const y = Math.round(ys[i]);
      if (clear(x, y)) {
        put = { x, y };
        break;
      }
    }
    if (!put) return null;
    dust.push(put);
  }
  return dust;
}

/**
 * Try to make one plate from one seed.
 * Returns { code, m, sims } on success or { why, sims } when the sky is rejected.
 */
export function makePlate(seed, spec) {
  const R = rng(seed);
  const plate = build(R, spec, seed);
  if (!plate) return { why: "layout", sims: 0 };
  let sims = NA * NP;
  const c = compile(plate);

  const win = new Uint8Array(NA * NP);
  const len = new Float32Array(NA * NP);
  let wins = 0;
  for (let i = 0; i < NA; i++) {
    for (let j = 0; j < NP; j++) {
      const f = simulate(c, aOf(i), pOf(j));
      if (f.result !== WIN) continue;
      win[i * NP + j] = 1;
      len[i * NP + j] = f.len;
      wins++;
    }
  }
  if (!wins) return { why: "no answer", sims };
  const frac = wins / (NA * NP);
  if (frac > spec.maxFrac) return { why: "too easy", sims };

  if (spec.blocker && plate.target.of < 0) {
    const t = plate.target;
    const dir = Math.round((Math.atan2(plate.start.y - t.y, t.x - plate.start.x) * 180) / Math.PI);
    for (let di = -2; di <= 2; di++) {
      for (let j = 0; j < NP; j++) if (win[((dir + di + NA) % NA) * NP + j]) return { why: "straight road", sims };
    }
  }

  // Half-width of the run of wins through a cell, along the angle and along the power.
  const runA = (i, j) => {
    let k = 0;
    while (k < 12 && win[((i + k + 1) % NA) * NP + j] && win[((i - k - 1 + NA) % NA) * NP + j]) k++;
    return k;
  };
  const runP = (i, j) => {
    let k = 0;
    while (k < 12 && j - k - 1 >= 0 && win[i * NP + j - k - 1] && win[i * NP + Math.min(NP - 1, j + k + 1)]) k++;
    return k; // a drag past full power is still full power
  };

  // The easiest answer: the most forgiving cell that survives the aim error of this tier.
  const cells = [];
  for (let n = 0; n < NA * NP; n++) {
    if (!win[n]) continue;
    const i = Math.floor(n / NP);
    const j = n % NP;
    const room = Math.min((runA(i, j) + 0.5) / (spec.solTol[0] / 10), ((runP(i, j) + 0.5) * 4) / (spec.solTol[1] / 10));
    cells.push({ n, i, j, room });
  }
  cells.sort((x, y) => y.room - x.room || len[x.n] - len[y.n]);
  let sc = null;
  for (const cell of cells.slice(0, 16)) {
    sims += 27;
    if (holds(c, aOf(cell.i), pOf(cell.j), spec.solTol[0], spec.solTol[1], (f) => f.result === WIN)) {
      sc = cell;
      break;
    }
  }
  if (!sc) return { why: "too tight", sims };
  const sol = [aOf(sc.i), pOf(sc.j)];
  if ((spec.must === PUSH || spec.must === DARK) && !dependsOn(plate, sol[0], sol[1], spec.must)) {
    return { why: "feature idle", sims };
  }

  // Candidates for the stardust line: wins that turn enough to be worth drawing.
  c.track = true;
  const cands = [];
  for (const cell of cells) {
    const f = simulate(c, aOf(cell.i), pOf(cell.j));
    sims++;
    if (f.turn < spec.turn[0] || f.turn > spec.turn[1]) continue;
    if (spec.gate && !f.jumps) continue;
    const da = Math.min(Math.abs(cell.i - sc.i), NA - Math.abs(cell.i - sc.i));
    const far = Math.max(da, Math.abs(cell.j - sc.j));
    // Slow lines turn the most, so without a penalty every stardust line would be a crawl.
    const crawl = Math.max(0, 280 - pOf(cell.j)) / 280;
    const score =
      (spec.tier > 0 ? Math.min(far, 12) * 0.25 : 0) +
      (f.turn / spec.turn[1]) * 2 +
      Math.min(cell.room, 2) * 0.8 -
      crawl * 4 +
      R() * 0.5;
    cands.push({ a: aOf(cell.i), p: pOf(cell.j), turn: f.turn, len: f.len, jumps: f.jumps, score });
  }
  c.track = false;
  if (!cands.length) return { why: "no stardust line", sims };
  cands.sort((x, y) => y.score - x.score);

  // An unseen body that changes nothing is only noise, so the stardust line must need it.
  const needs = spec.must >= 0 ? [spec.must] : [];
  if (!needs.includes(DARK) && plate.bodies.some((b) => b.k === DARK)) needs.push(DARK);
  for (const cand of cands.slice(0, 20)) {
    if (!needs.every((kind) => dependsOn(plate, cand.a, cand.p, kind))) continue;
    const dust = placeDust(plate, c, cand.a, cand.p, R);
    if (!dust) continue;
    const ink = clamp(Math.ceil((Math.max(cand.len, len[sc.n]) * 1.3 + 250) / 50) * 50, 1700, SCAN_INK);
    const done = decode(encode({ ...plate, dust, ink, sol, best: [cand.a, cand.p] }));
    const c2 = compile(done);
    sims += 54;
    if (!holds(c2, cand.a, cand.p, 4, 10, (f) => f.result === WIN && f.dust === ALL_DUST)) continue;
    if (!holds(c2, sol[0], sol[1], spec.solTol[0], spec.solTol[1], (f) => f.result === WIN)) {
      return { why: "answer does not hold", sims };
    }
    return {
      code: encode(done),
      sims,
      m: {
        frac: +frac.toFixed(4),
        room: +sc.room.toFixed(2),
        turn: +cand.turn.toFixed(2),
        len: Math.round(cand.len),
        jumps: cand.jumps,
        bodies: done.bodies.length,
      },
    };
  }
  return { why: "stardust does not hold", sims };
}
