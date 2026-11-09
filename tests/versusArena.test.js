import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateVersusArenaLayout,
  getVersusArenaDiagnostics,
  VERSUS_LEFT_PLATFORM_CATEGORY,
  VERSUS_LEFT_PLATFORM_ID,
  VERSUS_LEFT_PLATFORM_NAME,
  VERSUS_PANEL_WORLD_HEIGHT,
  VERSUS_PANEL_WORLD_WIDTH,
  VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
  VERSUS_RIGHT_PLATFORM_CATEGORY,
  VERSUS_RIGHT_PLATFORM_ID,
  VERSUS_RIGHT_PLATFORM_NAME,
  VERSUS_BLOCK_SIZE,
  VERSUS_HUD_BAND_BOTTOM,
  VERSUS_LEVEL_STEP,
  versusLevelOf,
} from "../src/scenes/versusArena.js";
import { VersusGameScene } from "../src/scenes/VersusGameScene.js";
import {
  BULLET_LIFETIME_MS,
  BULLET_SPEED,
  PLAYER_DRAW_HEIGHT,
  PLAYER_SHOT_ABOVE_FEET,
  PLAYER_WIDTH,
  VERSUS_GRAVITY,
  VERSUS_JUMP_SPEED,
} from "../src/scenes/versus/versusConfig.js";

function createStorageMock() {
  const store = new Map();
  return {
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
  };
}

describe("versus arena layout", () => {
  it("keeps a fixed duel stage: per side a ground, five ledges and three blocks (layout C)", () => {
    const layout = calculateVersusArenaLayout();

    expect(layout.panelWorldWidth).toBe(VERSUS_PANEL_WORLD_WIDTH);
    expect(layout.panelWorldHeight).toBe(VERSUS_PANEL_WORLD_HEIGHT);
    expect(layout.platforms).toHaveLength(18);
    expect(layout.platforms.slice(0, 2)).toEqual([layout.leftPlatform, layout.rightPlatform]);
    for (const [category, side] of [[VERSUS_LEFT_PLATFORM_CATEGORY, "left"], [VERSUS_RIGHT_PLATFORM_CATEGORY, "right"]]) {
      const own = layout.platforms.filter((platform) => platform.collisionCategory === category);
      expect(own.map((platform) => platform.kind).sort()).toEqual(
        ["block", "block", "block", "ground", "ledge", "ledge", "ledge", "ledge", "ledge"]
      );
      expect(own.every((platform) => platform.id.startsWith(`versus-${side}-`))).toBe(true);
    }
    expect(layout.spawnPoints).toHaveLength(2);
    expect(layout.cameraRanges).toHaveLength(2);
    expect(layout.leftPlatform).toMatchObject({
      id: VERSUS_LEFT_PLATFORM_ID,
      name: VERSUS_LEFT_PLATFORM_NAME,
      collisionCategory: VERSUS_LEFT_PLATFORM_CATEGORY,
      playerCollisionHeight: VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
    });
    expect(layout.rightPlatform).toMatchObject({
      id: VERSUS_RIGHT_PLATFORM_ID,
      name: VERSUS_RIGHT_PLATFORM_NAME,
      collisionCategory: VERSUS_RIGHT_PLATFORM_CATEGORY,
      playerCollisionHeight: VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
    });
  });

  it("places spawn points over the two bridges", () => {
    const layout = calculateVersusArenaLayout();
    const [leftBridge, rightBridge] = layout.platforms;
    const [leftSpawn, rightSpawn] = layout.spawnPoints;

    expect(leftSpawn.x).toBeGreaterThan(leftBridge.x);
    expect(leftSpawn.x).toBeLessThan(leftBridge.x + leftBridge.width);
    expect(rightSpawn.x).toBeGreaterThan(rightBridge.x);
    expect(rightSpawn.x).toBeLessThan(rightBridge.x + rightBridge.width);
    expect(leftSpawn.y).toBeLessThan(leftBridge.y);
    expect(rightSpawn.y).toBeLessThan(rightBridge.y);
  });

  it("keeps duel spacing inside bullet range, every next level in jump reach and the HUD band clear", () => {
    const layout = calculateVersusArenaLayout();
    const diagnostics = getVersusArenaDiagnostics(layout, {
      bulletSpeed: BULLET_SPEED,
      bulletLifetimeMs: BULLET_LIFETIME_MS,
      jumpSpeed: VERSUS_JUMP_SPEED,
      gravity: VERSUS_GRAVITY,
      playerWidth: PLAYER_WIDTH,
      rigHeight: PLAYER_DRAW_HEIGHT,
    });

    expect(diagnostics.spawnDistance).toBeLessThan(diagnostics.bulletRange * 0.8);
    expect(diagnostics.jumpApex).toBeGreaterThan(VERSUS_LEVEL_STEP * 1.15);
    expect(diagnostics.apexHeadY).toBeGreaterThanOrEqual(VERSUS_HUD_BAND_BOTTOM);
    expect(diagnostics.issues).toEqual([]);
  });

  it("mirrors the right side and leaves room for a drawn fighter under every ledge and on every block", () => {
    const layout = calculateVersusArenaLayout();
    const left = layout.platforms.filter((p) => p.collisionCategory === VERSUS_LEFT_PLATFORM_CATEGORY);
    const right = layout.platforms.filter((p) => p.collisionCategory === VERSUS_RIGHT_PLATFORM_CATEGORY);
    for (let index = 0; index < left.length; index += 1) {
      expect(right[index].x).toBe(layout.worldWidth - left[index].x - left[index].width);
      expect(right[index].y).toBe(left[index].y);
    }
    // Head room: from any surface a fighter stands on (ground, ledge or block top) to the ledge above.
    const surfaces = left.filter((p) => p.kind !== "block").concat(left.filter((p) => p.kind === "block"));
    for (const surface of surfaces) {
      for (const ledge of left.filter((p) => p.kind === "ledge" && p.y < surface.y)) {
        const overlaps = ledge.x < surface.x + surface.width && surface.x < ledge.x + ledge.width;
        if (overlaps) {
          expect(surface.y - (ledge.y + ledge.height)).toBeGreaterThan(PLAYER_DRAW_HEIGHT);
        }
      }
    }
    // Every block stands on a ground or ledge of its level.
    for (const block of left.filter((p) => p.kind === "block")) {
      expect(block.height).toBe(VERSUS_BLOCK_SIZE);
      const floor = left.find((p) => p.kind !== "block" && p.y === block.y + block.height
        && p.x <= block.x && block.x + block.width <= p.x + p.width);
      expect(floor).toBeDefined();
      expect(versusLevelOf(block)).toBe(versusLevelOf(floor));
    }
    // A standing shot is under a block's top; a shot from on top of a block clears it.
    expect(PLAYER_SHOT_ABOVE_FEET + 4).toBeLessThan(VERSUS_BLOCK_SIZE);
    expect(VERSUS_BLOCK_SIZE + PLAYER_SHOT_ABOVE_FEET - 4).toBeGreaterThan(VERSUS_BLOCK_SIZE);
  });
});

describe("versus bridge edge walls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage = createStorageMock();
  });

  it("stops a fighter at the end of its own bridge instead of letting it fall", () => {
    const scene = new VersusGameScene();
    scene.layoutWorld();
    scene.createOrResetPlayers();
    const leftBridge = scene.layout.leftPlatform;

    scene.p1.x = leftBridge.x - 60;
    scene.p1.vx = -200;
    scene.collisionSystem.update(1 / 60, {
      p1: scene.p1,
      p2: scene.p2,
      players: scene.players,
      bullets: [],
      platforms: scene.platforms,
    });

    expect(scene.p1.x).toBe(leftBridge.x);
    expect(scene.p1.vx).toBe(0);
    expect(scene.p1.onGround).toBe(true);
    expect(scene.p1.active).toBe(true);
    expect(typeof scene.matchCtl.applyFallDeaths).toBe("undefined");
  });
});

describe("arena v3 movement (layout C)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage = createStorageMock();
  });

  function createArena() {
    const scene = new VersusGameScene();
    scene.layoutWorld();
    scene.createOrResetPlayers();
    const byId = (id) => scene.platforms.find((platform) => platform.id === id);
    const step = (input = null) => {
      const dt = 1 / 60;
      scene.p1.applyInput(input, dt);
      scene.physicsSystem.update(dt, { players: scene.players, enemies: [], bullets: [], platforms: scene.platforms, nowMs: 0 });
      scene.collisionSystem.update(dt, { p1: scene.p1, p2: scene.p2, players: scene.players, bullets: [], platforms: scene.platforms });
    };
    const stand = (player, support, x) => {
      player.x = x;
      player.y = support.y - player.height;
      player.vx = 0;
      player.vy = 0;
      step();
    };
    return { scene, byId, step, stand };
  }

  const press = (...actions) => ({
    isPressed: (action) => actions.includes(action),
    consumePressed: (action) => actions.includes(action),
  });

  it("lands a jump on the ledge above, but not when only the head gets through", () => {
    const { scene, byId, step, stand } = createArena();
    const ground = byId("versus-left-bridge");
    const ledge = byId("versus-left-ledge-2");
    stand(scene.p1, ground, 500);
    expect(scene.p1.supportingPlatform).toBe(ground);

    step(press("jump"));
    for (let frame = 0; frame < 90; frame += 1) step();
    expect(scene.p1.onGround).toBe(true);
    expect(scene.p1.supportingPlatform).toBe(ledge);
    expect(scene.p1.y + scene.p1.height).toBe(ledge.y);

    // A weak jump (apex 100 < the 115 level step) passes the head through the ledge and falls back.
    stand(scene.p1, ground, 500);
    scene.p1.vy = -Math.sqrt(2 * VERSUS_GRAVITY * 100);
    scene.p1.onGround = false;
    for (let frame = 0; frame < 90; frame += 1) step();
    expect(scene.p1.supportingPlatform).toBe(ground);
  });

  it("drops through a ledge on request and lands on the surface below; the ground never drops", () => {
    const { scene, byId, step, stand } = createArena();
    const ground = byId("versus-left-bridge");
    stand(scene.p1, byId("versus-left-ledge-2"), 500);
    expect(scene.p1.supportingPlatform.kind).toBe("ledge");

    step(press("drop"));
    for (let frame = 0; frame < 60; frame += 1) step();
    expect(scene.p1.supportingPlatform).toBe(ground);

    step(press("drop"));
    step();
    expect(scene.p1.onGround).toBe(true);
    expect(scene.p1.supportingPlatform).toBe(ground);
  });

  it("makes blocks solid: a walking fighter stops at the side, a falling one stands on top", () => {
    const { scene, byId, step, stand } = createArena();
    const ground = byId("versus-left-bridge");
    const block = byId("versus-left-block-1");
    stand(scene.p1, ground, block.x - 120);
    for (let frame = 0; frame < 60; frame += 1) step(press("right"));
    expect(scene.p1.x + scene.p1.width).toBe(block.x);
    expect(scene.p1.supportingPlatform).toBe(ground);

    scene.p1.x = block.x + 2;
    scene.p1.y = block.y - scene.p1.height - 40;
    scene.p1.vy = 0;
    scene.p1.onGround = false;
    for (let frame = 0; frame < 30; frame += 1) step();
    expect(scene.p1.supportingPlatform).toBe(block);
    expect(scene.p1.y + scene.p1.height).toBe(block.y);
  });

  it("stops a standing shot on a block; a shot fired from on top of a block passes over it", () => {
    const { scene, byId, stand } = createArena();
    const ground = byId("versus-left-bridge");
    const block = byId("versus-left-block-1");
    stand(scene.p1, ground, block.x - 60);
    const events = [];
    const shot = (lineY) => ({
      x: block.x + block.width + 4,
      y: lineY - 4,
      width: 22,
      height: 8,
      damage: 34,
      owner: scene.p2,
      directionX: -1,
      active: true,
      deactivate() {
        this.active = false;
      },
    });
    const standing = shot(ground.y - PLAYER_SHOT_ABOVE_FEET);
    const fromBlock = shot(ground.y - VERSUS_BLOCK_SIZE - PLAYER_SHOT_ABOVE_FEET);
    const run = (bullet) => {
      for (let frame = 0; frame < 20 && bullet.active; frame += 1) {
        bullet.x -= 12;
        scene.collisionSystem.update(1 / 60, {
          p1: scene.p1,
          p2: scene.p2,
          players: scene.players,
          bullets: [bullet],
          platforms: scene.platforms,
          eventBus: { emit: (name, payload) => events.push({ name, payload }) },
        });
      }
    };
    scene.p1.invulnerable = false;
    run(standing);
    expect(events.map((event) => event.name)).toEqual(["versus:bullet_blocked"]);
    expect(events[0].payload.platform).toBe(block);

    events.length = 0;
    run(fromBlock);
    expect(events.some((event) => event.name === "versus:player_hit")).toBe(true);
    expect(events.some((event) => event.name === "versus:bullet_blocked")).toBe(false);
  });
});
