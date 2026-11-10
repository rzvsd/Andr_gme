import { describe, it, expect } from "vitest";
import { compile, createFlight, step, simulate, trace, WIN, CRASH, LOST, DRY, PLANET, MOON, DT, W } from "../src/sim/physics.js";
import { encode, decode } from "../src/sim/codec.js";

const plate = (over = {}) =>
  decode(
    encode({
      seed: 1,
      start: { x: 450, y: 1000 },
      target: { x: 450, y: 200, r: 40, of: -1 },
      ink: 5000,
      bodies: [],
      gates: [],
      dust: [],
      sol: null,
      best: null,
      ...over,
    }),
  );

describe("flight", () => {
  it("goes straight up to the target through an empty sky", () => {
    const f = simulate(compile(plate()), 900, 500);
    expect(f.result).toBe(WIN);
    expect(Math.abs(f.x - 450)).toBeLessThan(1e-6);
  });

  it("gives the same flight for the same aim, every time", () => {
    const p = plate({ bodies: [{ k: PLANET, x: 300, y: 600, r: 50, mu: 6e6 }] });
    const a = simulate(compile(p), 1012, 437);
    const b = simulate(compile(p), 1012, 437);
    expect([a.x, a.y, a.vx, a.vy, a.n, a.result]).toEqual([b.x, b.y, b.vx, b.vy, b.n, b.result]);
  });

  it("bends toward a planet and ends on its surface when aimed at it", () => {
    const p = plate({ bodies: [{ k: PLANET, x: 450, y: 600, r: 50, mu: 6e6 }] });
    const f = simulate(compile(p), 900, 300);
    expect(f.result).toBe(CRASH);
    expect(f.hit).toBe(0);
  });

  it("leaves the chart when nothing stops it", () => {
    expect(simulate(compile(plate()), 0, 500).result).toBe(LOST);
  });

  it("stops when the ink is spent", () => {
    const f = simulate(compile(plate({ ink: 300 })), 900, 500);
    expect(f.result).toBe(DRY);
    expect(f.len).toBeGreaterThanOrEqual(300);
    expect(f.len).toBeLessThan(310);
  });

  it("keeps a circular orbit circular (the integrator does not gain or lose energy)", () => {
    const mu = 6e6;
    const R = 200;
    const p = plate({ start: { x: 450 + R, y: 600 }, target: { x: 60, y: 60, r: 20, of: -1 }, bodies: [{ k: PLANET, x: 450, y: 600, r: 40, mu }] });
    const c = compile(p);
    c.ink = 1e9;
    const f = createFlight(c, 900, 0);
    const v = Math.sqrt(mu / R);
    f.vx = 0;
    f.vy = -v;
    let lo = R;
    let hi = R;
    for (let i = 0; i < 3000; i++) {
      step(c, f);
      const d = Math.hypot(f.x - 450, f.y - 600);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    expect(f.result).toBe(0);
    expect(hi - lo).toBeLessThan(0.5);
  });

  it("carries a line through a gate with its velocity unchanged", () => {
    const p = plate({ target: { x: 200, y: 200, r: 40, of: -1 }, gates: [{ ax: 450, ay: 700, bx: 200, by: 500, r: 30 }] });
    const c = compile(p);
    const f = createFlight(c, 900, 500);
    const vy = f.vy;
    while (!step(c, f) && !f.jumps);
    expect(f.jumps).toBe(1);
    expect(Math.abs(f.x - 200)).toBeLessThan(1);
    expect(f.vy).toBeCloseTo(vy, 9);
    while (!step(c, f));
    expect(f.result).toBe(WIN);
    expect(f.jumps).toBe(1);
  });

  it("moves a moon around its planet at the stored rate", () => {
    const p = plate({
      bodies: [
        { k: PLANET, x: 200, y: 600, r: 40, mu: 6e6 },
        { k: MOON, of: 0, R: 100, w: 1, ph: 0, r: 14, mu: 1e6 },
      ],
    });
    const c = compile(p);
    const f = createFlight(c, 900, 0);
    for (let i = 0; i < 120; i++) step(c, f);
    expect(f.result).toBe(0);
    expect(c.px[1]).toBeCloseTo(200 + 100 * Math.cos(1), 6);
    expect(c.py[1]).toBeCloseTo(600 + 100 * Math.sin(1), 6);
  });

  it("records a path that starts at the start and ends where the flight ended", () => {
    const { pts, f } = trace(compile(plate()), 900, 500);
    expect(pts.slice(0, 2)).toEqual([450, 1000]);
    expect(pts.slice(-2)).toEqual([f.x, f.y]);
    expect(f.n * DT).toBeGreaterThan(1);
    expect(Math.max(...pts.filter((_, i) => i % 2 === 0))).toBeLessThan(W);
  });
});

describe("plate code", () => {
  it("survives a round trip", () => {
    const p = plate({
      bodies: [
        { k: PLANET, x: 200, y: 600, r: 40, mu: 6e6 },
        { k: MOON, of: 0, R: 100, w: -0.731, ph: 2.5, r: 14, mu: 1e6 },
      ],
      target: { of: 0, R: 160, w: 0.4, ph: 1.2, r: 34 },
      gates: [{ ax: 1, ay: 2, bx: 3, by: 4, r: 30 }],
      dust: [
        { x: 5, y: 6 },
        { x: 7, y: 8 },
        { x: 9, y: 10 },
      ],
      sol: [900, 500],
      best: [1200, 300],
    });
    expect(encode(decode(encode(p)))).toEqual(encode(p));
    expect(decode(encode(p))).toEqual(p);
  });
});
