import { describe, expect, it } from "vitest";
import {
  VersusEffects,
  isFeedbackRateLimited,
  shakeOffset,
  slabFlashAt,
  timeScaleAt,
} from "../src/scenes/versus/versusEffects.js";
import { FEEDBACK, SLAB } from "../src/scenes/versus/versusConfig.js";

function createScene() {
  const emitted = [];
  const platforms = [{ id: "left" }, { id: "right" }];
  const players = [
    { active: true, onGround: true, supportingPlatform: platforms[0] },
    { active: true, onGround: true, supportingPlatform: platforms[1] },
  ];
  return {
    platforms,
    players,
    particles: {
      emit(options) {
        emitted.push({ ...options });
        return true;
      },
    },
    emitted,
  };
}

describe("feedback timing (pure)", () => {
  it("freezes the simulation clock only until the freeze ends", () => {
    expect(timeScaleAt(1140, 1000)).toBe(0);
    expect(timeScaleAt(1140, 1139)).toBe(0);
    expect(timeScaleAt(1140, 1140)).toBe(1);
  });

  it("caps feedback at five triggers per second", () => {
    const stamps = [100, 200, 300, 400];
    expect(isFeedbackRateLimited(stamps, 500)).toBe(false);
    stamps.push(500);
    expect(isFeedbackRateLimited(stamps, 600)).toBe(true);
    // The first trigger ages out after a second.
    expect(isFeedbackRateLimited(stamps, 1100)).toBe(false);
  });

  it("kicks along the shot direction, stays inside the amplitude and decays to zero", () => {
    const start = 2000;
    const before = shakeOffset(start, 240, 9, 1, 1999);
    expect(before).toEqual({ x: 0, y: 0 });

    const right = shakeOffset(start, 240, 9, 1, start);
    expect(right.x).toBeCloseTo(9, 5);
    const left = shakeOffset(start, 240, 9, -1, start);
    expect(left.x).toBeCloseTo(-9, 5);

    for (let ms = 0; ms < 240; ms += 7) {
      const sample = shakeOffset(start, 240, 9, 1, start + ms);
      expect(Math.abs(sample.x)).toBeLessThanOrEqual(9 * (1 - ms / 240) + 1e-9);
      expect(Math.abs(sample.y)).toBeLessThanOrEqual(9 * 0.35 * (1 - ms / 240) + 1e-9);
    }
    expect(shakeOffset(start, 240, 9, 1, start + 240)).toEqual({ x: 0, y: 0 });
  });

  it("brightens a slab fully on contact and fades it out over the flash window", () => {
    expect(slabFlashAt(500, 499)).toBe(0);
    expect(slabFlashAt(500, 500)).toBe(1);
    expect(slabFlashAt(500, 500 + SLAB.flashMs * 0.5)).toBeCloseTo(0.5, 5);
    expect(slabFlashAt(500, 500 + SLAB.flashMs)).toBe(0);
  });
});

describe("VersusEffects state", () => {
  it("applies the tuned hit stop and kill freeze", () => {
    const fx = new VersusEffects(createScene());
    expect(fx.trigger("hit", 1000, 1)).toBe(true);
    expect(fx.getTimeScale(1000 + FEEDBACK.hitStopMs - 1)).toBe(0);
    expect(fx.getTimeScale(1000 + FEEDBACK.hitStopMs)).toBe(1);

    expect(fx.trigger("kill", 2000, -1)).toBe(true);
    expect(fx.getTimeScale(2000 + FEEDBACK.killFreezeMs - 1)).toBe(0);
    expect(fx.getTimeScale(2000 + FEEDBACK.killFreezeMs)).toBe(1);

    const t = fx.getArenaTransform(2000, { x: 0, y: 0, zoom: 1 });
    expect(t.x).toBeCloseTo(-FEEDBACK.killShakePx, 5);
    expect(t.zoom).toBeCloseTo(1 + FEEDBACK.killZoom, 5);
    const later = fx.getArenaTransform(2000 + FEEDBACK.killShakeMs, { x: 0, y: 0, zoom: 1 });
    expect(later).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("drops the sixth trigger inside one second and accepts again later", () => {
    const fx = new VersusEffects(createScene());
    for (let i = 0; i < FEEDBACK.maxPerSecond; i += 1) {
      expect(fx.trigger("hit", 1000 + i * 50)).toBe(true);
    }
    expect(fx.trigger("hit", 1300)).toBe(false);
    expect(fx.trigger("hit", 2001)).toBe(true);
  });

  it("runs the kill frame for the freeze window", () => {
    const fx = new VersusEffects(createScene());
    expect(fx.getKillFrame(1000)).toBeNull();
    fx.startKillFrame(0, 1, 1000);
    expect(fx.getKillFrame(1000)).toMatchObject({ shooterIndex: 0, victimIndex: 1 });
    expect(fx.getKillFrame(1000 + FEEDBACK.killFreezeMs - 1)).not.toBeNull();
    expect(fx.getKillFrame(1000 + FEEDBACK.killFreezeMs)).toBeNull();
    fx.reset();
    expect(fx.getKillFrame(1000)).toBeNull();
  });

  it("keeps the killing bullet's centre and direction for the path", () => {
    const fx = new VersusEffects(createScene());
    fx.startKillFrame(1, 0, 1000, { x: 420, y: 591 }, -1);
    expect(fx.getKillFrame(1000)).toMatchObject({ shooterIndex: 1, victimIndex: 0, x: 420, y: 591, dirX: -1 });
    fx.startKillFrame(0, 1, 2000);
    const bare = fx.getKillFrame(2000);
    expect(Number.isNaN(bare.x)).toBe(true);
    expect(Number.isNaN(bare.y)).toBe(true);
    expect(bare.dirX).toBe(1);
  });

  it("flashes the supporting slab once per landing", () => {
    const scene = createScene();
    const fx = new VersusEffects(scene);
    fx.trackLandings(100);
    expect(fx.getSlabFlash(0, 100)).toBe(0);

    scene.players[0].onGround = false;
    fx.trackLandings(200);
    scene.players[0].onGround = true;
    fx.trackLandings(300);
    expect(fx.getSlabFlash(0, 300)).toBe(1);
    expect(fx.getSlabFlash(1, 300)).toBe(0);

    // Staying grounded does not retrigger.
    fx.trackLandings(300 + SLAB.flashMs);
    expect(fx.getSlabFlash(0, 300 + SLAB.flashMs)).toBe(0);
  });

  it("puffs three grey dots at the feet", () => {
    const scene = createScene();
    const fx = new VersusEffects(scene);
    fx.spawnDustPuff(300, 620);
    expect(scene.emitted).toHaveLength(3);
    for (const dot of scene.emitted) {
      expect(dot.shape).toBe("circle");
      expect(dot.y).toBeLessThan(620);
      expect(dot.vy).toBeLessThan(0);
    }
  });
});
