import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameScene } from "../src/scenes/GameScene.js";
import { EventBus } from "../src/core/EventBus.js";

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

function createFakeGame() {
  return {
    viewWidth: 1280,
    viewHeight: 720,
    sceneData: {},
    eventBus: new EventBus(),
    camera: { follow: () => {} },
    input: {
      attached: true,
      detach: () => {},
      setTouchControlsEnabled: () => {},
      isPressed: () => false,
      consumePressed: () => false,
    },
  };
}

describe("GameScene pause timer (M12 regression)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.localStorage = createStorageMock();
    globalThis.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });

  it("excludes paused time from the run timer on resume", () => {
    const scene = new GameScene();
    const game = createFakeGame();

    scene.onEnter(game, { payload: { restart: true } });
    scene.assetsReady = true;
    const startedAt = scene.runStartedAtMs;
    expect(startedAt).toBeGreaterThan(0);

    // Simulate 30s of play, then pause.
    const pauseAt = startedAt + 30_000;
    vi.spyOn(performance, "now").mockReturnValue(pauseAt);
    scene.pauseRequested = true;
    const switched = [];
    game.switchScene = (name, payload) => {
      switched.push({ name, payload });
      return true;
    };
    scene.update(1 / 60, game);
    expect(switched).toEqual([{ name: "pause", payload: { resume: true } }]);
    expect(scene.pausedAtMs).toBe(pauseAt);

    // Simulate 5 minutes paused, then resume.
    vi.spyOn(performance, "now").mockReturnValue(pauseAt + 300_000);
    scene.onEnter(game, { payload: { resume: true } });

    expect(scene.runStartedAtMs).toBe(startedAt + 300_000);
    expect(scene.pausedAtMs).toBe(0);

    // One more second of play -> elapsed is ~31s, not ~331s.
    vi.spyOn(performance, "now").mockReturnValue(pauseAt + 301_000);
    scene.assetsReady = true;
    scene.update(1 / 60, game);
    expect(scene.elapsedMs).toBeLessThan(40_000);
    expect(scene.elapsedMs).toBeGreaterThanOrEqual(30_000);
  });

  it("resetRun clears pause compensation state", () => {
    const scene = new GameScene();
    const game = createFakeGame();
    scene.onEnter(game, { payload: { restart: true } });
    scene.pausedAtMs = 12345;
    scene.resetRun(game);
    expect(scene.pausedAtMs).toBe(0);
    expect(scene.elapsedMs).toBe(0);
  });
});
