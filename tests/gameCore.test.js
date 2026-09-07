import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "../src/core/Game.js";
import { EventBus } from "../src/core/EventBus.js";

function installDomMocks() {
  const listeners = new Map();
  const ctxStub = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "canvas") return undefined;
        if (typeof prop === "string") {
          return (...args) => undefined;
        }
        return undefined;
      },
      set() {
        return true;
      },
    }
  );
  ctxStub.setTransform = () => {};
  ctxStub.fillRect = () => {};

  class FakeCanvas {
    constructor() {
      this.style = {};
      this.width = 0;
      this.height = 0;
    }
    getContext() {
      return ctxStub;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    }
    addEventListener() {}
    removeEventListener() {}
  }

  globalThis.HTMLCanvasElement = FakeCanvas;
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: (type, fn) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type) => {
      listeners.delete(type);
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  };
  return { FakeCanvas, listeners };
}

function makeScene(name, log) {
  return {
    onEnter: (game, transition) => {
      log.push(`${name}:enter:${transition?.to ?? name}`);
    },
    onExit: () => {
      log.push(`${name}:exit`);
    },
    update: () => {},
    render: () => {},
  };
}

describe("Game core lifecycle", () => {
  let mocks;

  beforeEach(() => {
    mocks = installDomMocks();
    vi.restoreAllMocks();
  });

  it("constructs on a canvas and emits game:start", () => {
    const canvas = new mocks.FakeCanvas();
    const game = new Game(canvas);
    const events = [];
    game.eventBus.on("game:start", () => events.push("start"));
    game.start();
    expect(game.running).toBe(true);
    expect(events).toEqual(["start"]);
    game.stop();
    expect(game.running).toBe(false);
  });

  it("routes Menu -> game -> pause -> game with resume payload intact", () => {
    const canvas = new mocks.FakeCanvas();
    const game = new Game(canvas);
    const log = [];
    game.registerScene("menu", makeScene("menu", log));
    game.registerScene("game", makeScene("game", log));
    game.registerScene("pause", makeScene("pause", log));

    const seen = [];
    game.eventBus.on("scene:switch", (t) => seen.push(t));

    expect(game.switchScene("menu")).toBe(true);
    expect(game.switchScene("game", { restart: true })).toBe(true);
    expect(game.switchScene("pause", { resume: true })).toBe(true);
    expect(game.switchScene("game", { resume: true })).toBe(true);

    expect(log).toEqual([
      "menu:enter:menu",
      "menu:exit",
      "game:enter:game",
      "game:exit",
      "pause:enter:pause",
      "pause:exit",
      "game:enter:game",
    ]);
    expect(seen).toHaveLength(4);
    expect(seen[3].payload).toMatchObject({ resume: true });
  });

  it("rejects unknown scenes and keeps the current one", () => {
    const canvas = new mocks.FakeCanvas();
    const game = new Game(canvas);
    game.registerScene("menu", makeScene("menu", []));
    game.switchScene("menu");
    expect(game.switchScene("nope")).toBe(false);
    expect(game.currentSceneName).toBe("menu");
  });

  it("real EventBus decouples publishers from subscribers", () => {
    const bus = new EventBus();
    const order = [];
    const off = bus.on("versus:kill", () => order.push("first"));
    bus.on("versus:kill", () => order.push("second"));
    bus.emit("versus:kill", {});
    off();
    bus.emit("versus:kill", {});
    expect(order).toEqual(["first", "second", "second"]);
  });
});
