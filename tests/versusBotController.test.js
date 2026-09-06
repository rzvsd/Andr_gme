import { describe, expect, it } from "vitest";
import {
  findIncomingThreat,
  planVersusBotFrame,
  VersusBotController,
} from "../src/ai/VersusBotController.js";

function createPlayer(overrides = {}) {
  return {
    x: 520,
    y: 240,
    width: 28,
    height: 40,
    facing: -1,
    active: true,
    onGround: true,
    canShoot: () => true,
    ...overrides,
  };
}

function createPlatform(overrides = {}) {
  return {
    x: 400,
    y: 300,
    width: 220,
    height: 32,
    ...overrides,
  };
}

function createBullet(overrides = {}) {
  return {
    x: 470,
    y: 252,
    width: 8,
    height: 8,
    vx: 760,
    vy: 0,
    speed: 760,
    directionX: 1,
    directionY: 0,
    active: true,
    owner: { id: "p1" },
    ...overrides,
  };
}

describe("VersusBotController", () => {
  it("returns neutral actions for invalid combat state", () => {
    const decision = planVersusBotFrame({
      self: null,
      opponent: null,
      bullets: [],
      ownPlatform: createPlatform(),
      nowMs: 1000,
    });

    expect(decision.actions.left).toBe(false);
    expect(decision.actions.right).toBe(false);
    expect(decision.pressed.jump).toBe(false);
    expect(decision.pressed.shoot).toBe(false);
    expect(decision.debug.reason).toBe("inactive");
  });

  it("recenters on its own bridge when idle", () => {
    const self = createPlayer({ x: 575 });
    const opponent = createPlayer({ x: 120 });

    const decision = planVersusBotFrame({
      self,
      opponent,
      bullets: [],
      ownPlatform: createPlatform(),
      nowMs: 1000,
    });

    expect(decision.actions.left).toBe(true);
    expect(decision.actions.right).toBe(false);
    expect(typeof decision.pressed.shoot).toBe("boolean");
  });

  it("anchors toward the opponent instead of drifting deeper into its own bridge", () => {
    const self = createPlayer({ x: 974, facing: -1 });
    const opponent = createPlayer({ x: 438, y: 242 });

    const decision = planVersusBotFrame({
      self,
      opponent,
      bullets: [],
      ownPlatform: createPlatform({ x: 870, width: 420 }),
      nowMs: 1000,
    });

    expect(decision.actions.right).toBe(false);
    expect(decision.pressed.shoot).toBe(true);
  });

  it("fires when the opponent is in lane and the bot is already facing them", () => {
    const self = createPlayer({ x: 520, facing: -1 });
    const opponent = createPlayer({ x: 160, y: 242 });
    const bot = new VersusBotController();

    bot.update(1 / 60, {
      self,
      opponent,
      bullets: [],
      ownPlatform: createPlatform(),
      nowMs: 1000,
    });

    const input = bot.getPlayerInput();
    expect(input.consumePressed("shoot")).toBe(true);
    expect(input.consumePressed("shoot")).toBe(false);
    expect(input.isPressed("right")).toBe(false);
    expect(input.isPressed("left")).toBe(true);
  });

  it("moves away from slower incoming fire when there is bridge room", () => {
    const self = createPlayer({ x: 500 });
    const threat = createBullet({ x: 420, y: 252, vx: 420, speed: 420 });

    const decision = planVersusBotFrame({
      self,
      opponent: createPlayer({ x: 120 }),
      bullets: [threat],
      ownPlatform: createPlatform(),
      nowMs: 1000,
    });

    expect(decision.actions.right).toBe(true);
    expect(decision.pressed.jump).toBe(false);
    expect(decision.debug.reason).toContain("threat");
  });

  it("jumps when an incoming bullet is too close to dodge horizontally", () => {
    const self = createPlayer({ x: 561 });
    const threat = createBullet({ x: 486, y: 252, vx: 760, speed: 760 });

    const decision = planVersusBotFrame({
      self,
      opponent: createPlayer({ x: 120 }),
      bullets: [threat],
      ownPlatform: createPlatform(),
      nowMs: 1000,
    });

    expect(decision.pressed.jump).toBe(true);
    expect(decision.actions.right).toBe(false);
  });

  it("detects only bullets that are actually moving into the bot", () => {
    const self = createPlayer({ x: 520 });
    const away = createBullet({ x: 620, vx: 760, directionX: 1 });
    const toward = createBullet({ x: 440, vx: 760, directionX: 1 });

    expect(findIncomingThreat(self, [away], {})).toBe(null);
    expect(findIncomingThreat(self, [toward], {})).not.toBe(null);
  });
});
