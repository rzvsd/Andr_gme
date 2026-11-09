import { describe, expect, it } from "vitest";
import {
  findIncomingThreat,
  planVersusBotFrame,
  VersusBotController,
} from "../src/ai/VersusBotController.js";
import { buildCourse, nodeAt, routesFrom } from "../src/ai/versusBotCourse.js";
import {
  calculateVersusArenaLayout,
  VERSUS_RIGHT_PLATFORM_CATEGORY,
  versusLevelOf,
} from "../src/scenes/versusArena.js";
import { createShotClip } from "../src/scenes/versus/versusShots.js";

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

  it("fires in short bursts and repositions between them", () => {
    // random() = 0.5 -> 3 shots per burst, 850 ms pause.
    const bot = new VersusBotController({ random: () => 0.5 });
    const self = createPlayer({ x: 520, facing: -1 });
    const opponent = createPlayer({ x: 160, y: 242 });
    const frame = (nowMs) => {
      bot.update(1 / 60, { self, opponent, bullets: [], ownPlatform: createPlatform(), nowMs });
      return bot.consumePressed("shoot");
    };

    let nowMs = 1000;
    let shots = 0;
    for (let index = 0; index < 3; index += 1) {
      if (frame(nowMs)) shots += 1;
      nowMs += 100;
    }
    expect(shots).toBe(3);

    expect(frame(nowMs)).toBe(false);
    expect(["reposition", "hop"]).toContain(bot.lastDecision.reason);

    nowMs += 900;
    expect(frame(nowMs)).toBe(true);
  });
});

describe("bot routes on the arena v3 course (layout C)", () => {
  const layout = calculateVersusArenaLayout({ playerWidth: 40, playerHeight: 84 });
  const byId = (id) => layout.platforms.find((platform) => platform.id === id);

  function standOn(support, centerX, overrides = {}) {
    return createPlayer({
      x: centerX - 20,
      y: support.y - 84,
      width: 40,
      height: 84,
      vx: 0,
      vy: 0,
      facing: -1,
      supportingPlatform: support,
      platformCollisionMask: VERSUS_RIGHT_PLATFORM_CATEGORY,
      ...overrides,
    });
  }

  // Runs the bot, moving it 5 px per frame as it steers, until it presses jump or drop.
  function runUntilPress(bot, self, context, startMs, maxFrames = 200) {
    let nowMs = startMs;
    for (let frame = 0; frame < maxFrames; frame += 1) {
      bot.update(1 / 60, { ...context, self, nowMs });
      if (bot.pressed.jump || bot.pressed.drop) {
        return bot.lastDecision.reason;
      }
      if (bot.actions.left) self.x -= 5;
      if (bot.actions.right) self.x += 5;
      nowMs += 1000 / 60;
    }
    return null;
  }

  it("splits each surface at its blocks, with a covered stretch behind every block", () => {
    const course = buildCourse(layout.platforms, VERSUS_RIGHT_PLATFORM_CATEGORY);
    expect(course.nodes).toHaveLength(9);
    expect(course.blocks).toHaveLength(3);
    // Facing an opponent on the left, one hiding stretch per block.
    expect(course.nodes.filter((node) => node.coverLeft)).toHaveLength(3);
  });

  it("can reach every stretch of its side, the top ledges too, from the ground", () => {
    const course = buildCourse(layout.platforms, VERSUS_RIGHT_PLATFORM_CATEGORY);
    const ground = byId("versus-right-bridge");
    const start = nodeAt(course, standOn(ground, ground.x + 60));
    const reachable = routesFrom(course, start, 40);
    expect(reachable.size).toBe(course.nodes.length);
    const levels = new Set([...reachable.keys()].map((node) => node.level));
    expect([...levels].sort()).toEqual([0, 1, 2, 3]);
  });

  it("climbs toward an opponent standing one level higher", () => {
    const bot = new VersusBotController({ random: () => 0.5 });
    const ground = byId("versus-right-bridge");
    const self = standOn(ground, ground.x + 40);
    const opponent = createPlayer({ x: 500, y: 0, supportingPlatform: byId("versus-left-ledge-2"), onGround: true });
    const context = { opponent, bullets: [], ownPlatform: ground, platforms: layout.platforms };
    // The opponent must stay 300 ms on the new level before the bot follows.
    bot.update(1 / 60, { ...context, self, nowMs: 1000 });
    expect(runUntilPress(bot, self, context, 1400)).toBe("route_climb");
    const centerX = self.x + 20;
    const ledge = byId("versus-right-ledge-2");
    expect(centerX).toBeGreaterThan(ledge.x - 20);
    expect(centerX).toBeLessThan(ledge.x + ledge.width + 20);
  });

  it("hides behind a block while it has no shots, and never fires from there", () => {
    const bot = new VersusBotController({ random: () => 0.5 });
    const ground = byId("versus-right-bridge");
    const block = byId("versus-right-block-1");
    const empty = () => ({ ...createShotClip(), shotsLeft: 0, lastShotAtMs: 1000 });
    const self = standOn(ground, block.x - 30, { shotClip: empty() });
    const opponent = createPlayer({ x: 400, y: 0, supportingPlatform: layout.leftPlatform, onGround: true });
    const context = { opponent, bullets: [], ownPlatform: ground, platforms: layout.platforms };
    // In front of the block it hops over to the covered side.
    expect(runUntilPress(bot, self, context, 1100)).toBe("route_hop");

    const behind = standOn(ground, block.x + block.width + 60, { shotClip: empty() });
    for (let frame = 0; frame < 30; frame += 1) {
      bot.update(1 / 60, { ...context, self: behind, nowMs: 1200 + frame * 16 });
      expect(bot.pressed.shoot).toBe(false);
      if (bot.actions.left) behind.x -= 5;
      if (bot.actions.right) behind.x += 5;
    }
    expect(bot.lastDecision.reason).toBe("route_hide");
    expect(behind.x).toBeGreaterThanOrEqual(block.x + block.width);
    expect(behind.x).toBeLessThan(block.x + block.width + 12);
    expect(versusLevelOf(behind.supportingPlatform)).toBe(0);
  });
});
