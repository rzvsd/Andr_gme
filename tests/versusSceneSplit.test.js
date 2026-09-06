import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EventBus } from "../src/core/EventBus.js";
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

function createCtxStub() {
  const gradient = { addColorStop: () => {} };
  const noop = () => {};
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "measureText") return () => ({ width: 10 });
        if (prop === "createLinearGradient") return () => gradient;
        if (typeof prop === "string") return noop;
        return undefined;
      },
      set() {
        return true;
      },
    }
  );
}

function createFakeGame() {
  return {
    viewWidth: 1280,
    viewHeight: 720,
    sceneData: {},
    eventBus: new EventBus(),
    audioManager: { setEnabled: () => {} },
    musicManager: { setEnabled: () => {} },
    input: { attached: false, setTouchControlsEnabled: () => {} },
  };
}

describe("VersusGameScene split (M11)", () => {
  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
  });

  it("stays a thin conductor with instruments wired", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "../src/scenes/VersusGameScene.js"), "utf8");
    const lines = source.split("\n").length;
    expect(lines).toBeLessThan(600);

    const scene = new VersusGameScene();
    for (const key of ["assets", "playersCtl", "projectiles", "effects", "matchCtl", "renderer"]) {
      expect(scene[key], key).toBeDefined();
    }
  });

  it("runs enter -> update -> render -> exit end to end", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();

    scene.onEnter(game, {});
    expect(scene.p1.active).toBe(true);
    expect(scene.p2.active).toBe(true);

    for (let i = 0; i < 120; i += 1) {
      scene.update(1 / 60, game);
    }
    expect(scene.spawnProtectionMs).toEqual([0, 0]);
    expect(scene.p1.invulnerable).toBe(false);

    expect(() => scene.render(createCtxStub(), 0, game)).not.toThrow();
    expect(() => scene.onExit(game)).not.toThrow();
    expect(scene.p1.invulnerable).toBe(false);
  });

  it("reaches a terminal versus result through the match module", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    const seen = [];
    game.switchScene = (name, payload) => {
      seen.push({ name, payload });
      return true;
    };

    scene.onEnter(game, {});
    for (let i = 0; i < 5; i += 1) {
      game.eventBus.emit("versus:kill", { killerIndex: 0, victimIndex: 1 });
    }
    scene.update(1 / 60, game);

    expect(seen).toHaveLength(1);
    expect(seen[0].name).toBe("game_over");
    expect(seen[0].payload.versus.winnerIndex).toBe(0);
    scene.onExit(game);
  });
});
