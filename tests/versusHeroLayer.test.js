import { describe, expect, it } from "vitest";
import {
  GAME_TO_RIG_VELOCITY,
  HERO_RIG_HEIGHT_UNITS,
  HeroLayer,
  deriveActorEvents,
  getHeroDef,
} from "../src/scenes/versus/versusHeroLayer.js";
import { PLAYER_CHARACTER_ROSTER } from "../src/theme/playerRoster.js";

describe("hero layer", () => {
  it("maps every roster key to a hero-lab definition of the same id", () => {
    for (const character of PLAYER_CHARACTER_ROSTER) {
      expect(getHeroDef(character.key).id).toBe(character.key);
    }
    expect(getHeroDef("pear").id).toBe("pudd");
  });

  it("derives shoot, hit, jump and land events from fighter state changes", () => {
    const grounded = { onGround: true, vy: 0, lastShotAtMs: 100, hitFlash: 0 };
    expect(deriveActorEvents(null, grounded)).toEqual({ shoot: false, hit: false, jump: false, land: false });

    const shot = { ...grounded, lastShotAtMs: 250 };
    expect(deriveActorEvents(grounded, shot).shoot).toBe(true);

    const hit = { ...grounded, hitFlash: 0.14 };
    expect(deriveActorEvents(grounded, hit).hit).toBe(true);
    expect(deriveActorEvents(hit, { ...hit, hitFlash: 0.1 }).hit).toBe(false);

    const jumping = { ...grounded, onGround: false, vy: -600 };
    expect(deriveActorEvents(grounded, jumping).jump).toBe(true);
    const falling = { ...grounded, onGround: false, vy: 200 };
    expect(deriveActorEvents(grounded, falling).jump).toBe(false);

    expect(deriveActorEvents(falling, grounded).land).toBe(true);
  });

  it("keeps game speeds in the range the alive layer was tuned for", () => {
    expect(330 * GAME_TO_RIG_VELOCITY).toBeCloseTo(4.1, 1);
    expect(600 * GAME_TO_RIG_VELOCITY).toBeCloseTo(7.5, 1);
    expect(HERO_RIG_HEIGHT_UNITS).toBeGreaterThan(1);
  });

  it("reports unavailable without a DOM and renders nothing", () => {
    const layer = new HeroLayer();
    expect(layer.isAvailable()).toBe(false);
    expect(layer.render({ width: 800, height: 400, actors: [] })).toBe(false);
    expect(() => layer.clear()).not.toThrow();
  });
});
