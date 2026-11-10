// Every plate that ships is flown here: its easy answer and its stardust line must both work,
// and must keep working when the aim is a little off.
import { describe, it, expect } from "vitest";
import atlas from "../src/data/plates.json";
import daily from "../src/data/daily.json";
import { decode } from "../src/sim/codec.js";
import { compile, simulate, WIN, ALL_DUST, W, H, DARK, MOON } from "../src/sim/physics.js";

const sets = [
  ["atlas", atlas.plates, 48],
  ["daily", daily.plates, 366],
];

describe.each(sets)("%s plates", (_name, codes, count) => {
  const plates = codes.map(decode);

  it(`has ${count} plates`, () => {
    expect(plates.length).toBe(count);
  });

  it("has an easy answer that arrives", () => {
    const bad = plates.filter((p) => simulate(compile(p), p.sol[0], p.sol[1]).result !== WIN).map((p) => p.seed);
    expect(bad).toEqual([]);
  });

  it("has a stardust line that arrives with all three motes", () => {
    const bad = plates
      .filter((p) => {
        const f = simulate(compile(p), p.best[0], p.best[1]);
        return f.result !== WIN || f.dust !== ALL_DUST;
      })
      .map((p) => p.seed);
    expect(bad).toEqual([]);
  });

  it("forgives an aim that is 0.3 degrees and 0.8 percent off", () => {
    const bad = [];
    for (const p of plates) {
      const c = compile(p);
      for (const [da, dp] of [[3, 8], [-3, 8], [3, -8], [-3, -8]]) {
        const sol = simulate(c, (p.sol[0] + da + 3600) % 3600, Math.min(1000, p.sol[1] + dp));
        const best = simulate(c, (p.best[0] + da + 3600) % 3600, Math.min(1000, p.best[1] + dp));
        if (sol.result !== WIN || best.result !== WIN || best.dust !== ALL_DUST) bad.push(p.seed);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("keeps everything on the sheet and apart", () => {
    for (const p of plates) {
      expect(p.dust.length).toBe(3);
      for (const b of p.bodies) {
        if (b.k === MOON) continue;
        expect(b.x - b.r).toBeGreaterThan(0);
        expect(b.x + b.r).toBeLessThan(W);
        expect(b.y - b.r).toBeGreaterThan(0);
        expect(b.y + b.r).toBeLessThan(H);
        expect(Math.hypot(b.x - p.start.x, b.y - p.start.y)).toBeGreaterThan(b.r + 100);
      }
    }
  });

  it("has unseen bodies only where the answers need them", () => {
    for (const p of plates) {
      let omit = 0;
      p.bodies.forEach((b, i) => {
        if (b.k === DARK) omit |= 1 << i;
      });
      if (!omit) continue;
      // With the unseen bodies taken away, the stardust line must fail: the plate is about them.
      expect(simulate(compile(p, omit), p.best[0], p.best[1]).result).not.toBe(WIN);
    }
  });
});
