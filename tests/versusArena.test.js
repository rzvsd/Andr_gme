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
} from "../src/scenes/versusArena.js";
import { VersusGameScene } from "../src/scenes/VersusGameScene.js";

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
  it("keeps a fixed duel stage with two combat bridges", () => {
    const layout = calculateVersusArenaLayout();

    expect(layout.panelWorldWidth).toBe(VERSUS_PANEL_WORLD_WIDTH);
    expect(layout.panelWorldHeight).toBe(VERSUS_PANEL_WORLD_HEIGHT);
    expect(layout.platforms).toHaveLength(2);
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

  it("keeps duel spacing inside bullet range and makes falling punitive", () => {
    const layout = calculateVersusArenaLayout();
    const diagnostics = getVersusArenaDiagnostics(layout, {
      bulletSpeed: 760,
      bulletLifetimeMs: 1500,
      jumpSpeed: 600,
      gravity: 1850,
      playerWidth: 28,
    });

    expect(diagnostics.spawnDistance).toBeLessThan(diagnostics.bulletRange * 0.8);
    expect(diagnostics.visualDrop).toBeGreaterThan(diagnostics.jumpApex * 1.15);
    expect(diagnostics.issues).toEqual([]);
  });
});

describe("versus ring-out flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage = createStorageMock();
  });

  it("awards a kill to the surviving player when the opponent falls out", () => {
    const scene = new VersusGameScene();
    scene.layoutWorld();
    scene.createOrResetPlayers();

    const events = [];
    const eventBus = {
      emit(name, payload) {
        events.push({ name, payload });
      },
    };

    scene.p1.y = scene.deathY + 10;
    const handled = scene.handleRingOut(0, eventBus);

    expect(handled).toBe(true);
    expect(scene.p1.active).toBe(false);
    expect(events.map((event) => event.name)).toEqual([
      "versus:player_hit",
      "versus:kill",
    ]);
    expect(events[0].payload.targetIndex).toBe(0);
    expect(events[1].payload.killerIndex).toBe(1);
  });
});
