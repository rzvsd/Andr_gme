// The whole game rests on this file. One fixed-step integrator is shared by the plate generator,
// the tests and the player, so a line that the generator proved is the same line on the phone.
// Everything is in sheet units: the sheet is 900 wide and 1200 tall, y points down.

export const W = 900;
export const H = 1200;
export const EDGE = 14; // a line that comes this close to the sheet edge is off the chart
export const DT = 1 / 120;
export const V_MIN = 140;
export const V_MAX = 600;
export const MAX_STEPS = 26 * 120;
export const DUST_R = 28;
export const ALL_DUST = 7;
export const A_STEPS = 3600; // aim angle, tenths of a degree, 900 = straight up
export const P_STEPS = 1000; // aim power, tenths of a percent

export const FLYING = 0;
export const WIN = 1;
export const CRASH = 2;
export const LOST = 3;
export const DRY = 4;

// Body kinds. A moon rides a circle around its parent body; the clockwork starts with the line.
export const PLANET = 0;
export const ROCK = 1;
export const PUSH = 2;
export const DARK = 3;
export const MOON = 4;

/**
 * Turn a plate into flat arrays for the integrator.
 * `omit` is a bit mask of bodies to leave out (the aim preview does not know the unseen ones).
 */
export function compile(plate, omit = 0) {
  const n = plate.bodies.length;
  const c = {
    n,
    bx: new Float64Array(n),
    by: new Float64Array(n),
    r2: new Float64Array(n),
    mu: new Float64Array(n),
    par: new Int32Array(n).fill(-1),
    R: new Float64Array(n),
    w: new Float64Array(n),
    ph: new Float64Array(n),
    px: new Float64Array(n),
    py: new Float64Array(n),
    sx: plate.start.x,
    sy: plate.start.y,
    tx: plate.target.x,
    ty: plate.target.y,
    tr2: plate.target.r * plate.target.r,
    tpar: -1,
    tR: 0,
    tw: 0,
    tph: 0,
    gates: plate.gates || [],
    dust: plate.dust || [],
    ink: plate.ink,
    track: false,
  };
  plate.bodies.forEach((b, i) => {
    const gone = (omit >> i) & 1;
    c.bx[i] = b.x;
    c.by[i] = b.y;
    c.r2[i] = gone ? 0 : b.r * b.r;
    c.mu[i] = gone ? 0 : b.mu;
    if (b.k === MOON) {
      c.par[i] = b.of;
      c.R[i] = b.R;
      c.w[i] = b.w;
      c.ph[i] = b.ph;
    }
  });
  const t = plate.target;
  if (t.of !== undefined && t.of >= 0) {
    c.tpar = t.of;
    c.tR = t.R;
    c.tw = t.w;
    c.tph = t.ph;
  }
  return c;
}

/** Where a body is at time t. Used by the renderer; the integrator keeps its own copy in c.px, c.py. */
export function bodyAt(plate, i, t, out = {}) {
  const b = plate.bodies[i];
  if (b.k === MOON) {
    const p = plate.bodies[b.of];
    const g = b.ph + b.w * t;
    out.x = p.x + b.R * Math.cos(g);
    out.y = p.y + b.R * Math.sin(g);
  } else {
    out.x = b.x;
    out.y = b.y;
  }
  return out;
}

export function targetAt(plate, t, out = {}) {
  const tg = plate.target;
  if (tg.of !== undefined && tg.of >= 0) {
    const p = plate.bodies[tg.of];
    const g = tg.ph + tg.w * t;
    out.x = p.x + tg.R * Math.cos(g);
    out.y = p.y + tg.R * Math.sin(g);
  } else {
    out.x = tg.x;
    out.y = tg.y;
  }
  return out;
}

export function launchSpeed(p10) {
  return V_MIN + ((V_MAX - V_MIN) * p10) / P_STEPS;
}

export function createFlight(c, a10, p10) {
  const th = (a10 * Math.PI) / 1800;
  const v = launchSpeed(p10);
  return {
    x: c.sx,
    y: c.sy,
    vx: Math.cos(th) * v,
    vy: -Math.sin(th) * v,
    ax: 0,
    ay: 0,
    n: 0,
    len: 0,
    turn: 0,
    dust: 0,
    gate: -1, // index of the gate mouth the line is still inside after a jump
    jumps: 0,
    jumped: false, // true for the one step in which the line jumped
    result: FLYING,
    hit: -1,
    primed: false,
  };
}

// Sum the pull of every body at the flight's position and report a body it is inside, if any.
function field(c, f, t) {
  let ax = 0;
  let ay = 0;
  let hit = -1;
  for (let i = 0; i < c.n; i++) {
    let bx = c.bx[i];
    let by = c.by[i];
    const p = c.par[i];
    if (p >= 0) {
      const g = c.ph[i] + c.w[i] * t;
      bx = c.bx[p] + c.R[i] * Math.cos(g);
      by = c.by[p] + c.R[i] * Math.sin(g);
    }
    c.px[i] = bx;
    c.py[i] = by;
    const dx = bx - f.x;
    const dy = by - f.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < c.r2[i]) hit = i;
    const mu = c.mu[i];
    if (mu !== 0) {
      const inv = mu / (d2 * Math.sqrt(d2));
      ax += dx * inv;
      ay += dy * inv;
    }
  }
  f.ax = ax;
  f.ay = ay;
  return hit;
}

/** Advance one fixed step (leapfrog). Returns the flight's result code. */
export function step(c, f) {
  if (f.result) return f.result;
  if (!f.primed) {
    f.primed = true;
    field(c, f, 0);
  }
  f.jumped = false;
  const h = DT / 2;
  const hx = f.vx + f.ax * h;
  const hy = f.vy + f.ay * h;
  f.x += hx * DT;
  f.y += hy * DT;
  f.len += Math.sqrt(hx * hx + hy * hy) * DT;
  f.n++;
  const t = f.n * DT;
  let hit = field(c, f, t);
  const nvx = hx + f.ax * h;
  const nvy = hy + f.ay * h;
  if (c.track) {
    f.turn += Math.abs(Math.atan2(f.vx * nvy - f.vy * nvx, f.vx * nvx + f.vy * nvy));
  }
  f.vx = nvx;
  f.vy = nvy;

  if (hit < 0 && c.gates.length) {
    if (f.gate >= 0) {
      const g = c.gates[f.gate >> 1];
      const mx = f.gate & 1 ? g.bx : g.ax;
      const my = f.gate & 1 ? g.by : g.ay;
      const dx = f.x - mx;
      const dy = f.y - my;
      if (dx * dx + dy * dy > g.r * g.r * 1.1) f.gate = -1;
    } else {
      for (let i = 0; i < c.gates.length; i++) {
        const g = c.gates[i];
        const da = (f.x - g.ax) ** 2 + (f.y - g.ay) ** 2;
        const db = (f.x - g.bx) ** 2 + (f.y - g.by) ** 2;
        const r2 = g.r * g.r;
        if (da < r2 || db < r2) {
          const fromA = da < r2;
          f.x += fromA ? g.bx - g.ax : g.ax - g.bx;
          f.y += fromA ? g.by - g.ay : g.ay - g.by;
          f.gate = i * 2 + (fromA ? 1 : 0);
          f.jumps++;
          f.jumped = true;
          hit = field(c, f, t);
          break;
        }
      }
    }
  }

  if (hit >= 0) {
    f.hit = hit;
    return (f.result = CRASH);
  }
  for (let i = 0; i < c.dust.length; i++) {
    if ((f.dust >> i) & 1) continue;
    const dx = f.x - c.dust[i].x;
    const dy = f.y - c.dust[i].y;
    if (dx * dx + dy * dy < DUST_R * DUST_R) f.dust |= 1 << i;
  }
  let tx = c.tx;
  let ty = c.ty;
  if (c.tpar >= 0) {
    const g = c.tph + c.tw * t;
    tx = c.bx[c.tpar] + c.tR * Math.cos(g);
    ty = c.by[c.tpar] + c.tR * Math.sin(g);
  }
  const dx = f.x - tx;
  const dy = f.y - ty;
  if (dx * dx + dy * dy < c.tr2) return (f.result = WIN);
  if (f.x < EDGE || f.x > W - EDGE || f.y < EDGE || f.y > H - EDGE) return (f.result = LOST);
  if (f.len >= c.ink || f.n >= MAX_STEPS) return (f.result = DRY);
  return FLYING;
}

/** Fly a whole line and return the finished flight. */
export function simulate(c, a10, p10) {
  const f = createFlight(c, a10, p10);
  while (!step(c, f));
  return f;
}

/**
 * Fly a whole line and keep its path, for drawing.
 * `pts` is x,y pairs; a NaN pair marks a jump through a gate.
 */
export function trace(c, a10, p10, every = 2) {
  const f = createFlight(c, a10, p10);
  const pts = [f.x, f.y];
  while (!step(c, f)) {
    if (f.jumped) pts.push(NaN, NaN, f.x, f.y);
    else if (f.n % every === 0) pts.push(f.x, f.y);
  }
  pts.push(f.x, f.y);
  return { pts, f };
}
