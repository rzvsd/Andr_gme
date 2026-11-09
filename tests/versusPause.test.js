import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { VersusGameScene } from "../src/scenes/VersusGameScene.js";
import { PAUSE_HERO_DIM, PAUSE_TAP, VersusPauseOverlay, buildPauseLayout } from "../src/ui/VersusPauseOverlay.js";
import { MUTE_LAYOUT } from "../src/ui/VersusHUD.js";
import { loadSettings } from "../src/config/settings.js";
import { COLORS, DESIGN_BOX, HIT, MOTION, SPACE, withAlpha } from "../src/theme/tokens.js";

// Tap zone: safe insets plus 16 px.
const TAP = {
  x0: SPACE.insetX + 16,
  x1: DESIGN_BOX.width - SPACE.insetX - 16,
  y0: SPACE.insetTop + 16,
  y1: DESIGN_BOX.height - SPACE.insetBottom - 16,
};
const DIM = withAlpha(COLORS.bg, 0.55);

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

// 891 x 411: design px are screen px, so the mockup numbers tap directly.
function createFakeGame() {
  return {
    viewWidth: 891,
    viewHeight: 411,
    dpr: 1,
    sceneData: {},
    eventBus: new EventBus(),
    audioManager: { setEnabled: vi.fn() },
    musicManager: { setEnabled: vi.fn(), play: vi.fn() },
    input: { attached: false, setTouchControlsEnabled: () => {} },
    switchScene: vi.fn(() => true),
  };
}

// Records every draw call in order, with the fill style in force, so the layering of a whole scene
// frame can be checked without a DOM.
function createOrderedCtx() {
  const ops = [];
  const recorded = new Set(["fillRect", "fillText"]);
  const state = { font: "", fillStyle: "", strokeStyle: "", textAlign: "left", letterSpacing: "0px", globalAlpha: 1 };
  const noop = () => {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return (text) => ({ width: text.length * 7 });
      if (recorded.has(prop)) return (...args) => ops.push({ op: prop, args, fillStyle: target.fillStyle });
      if (prop === "canvas") return undefined;
      return noop;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, ops };
}

const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// Smallest axis separation between two rects (negative when they overlap).
function separation(a, b) {
  return Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), b.y - (a.y + a.height), a.y - (b.y + b.height));
}

function tapTargets(layout) {
  return [
    { id: "resume", rect: layout.resume },
    { id: "quit", rect: layout.quit },
    { id: "sfx", rect: layout.sfx.hit },
    { id: "music", rect: layout.music.hit },
  ];
}

function tap(scene, game, point, id = 1) {
  scene.handlePointerDown({ x: point.x, y: point.y, id }, game);
  scene.handlePointerUp({ x: point.x, y: point.y, id }, game);
}

function clicks(events, source) {
  return events.filter((event) => event.source === source).length;
}

describe("pause layout (891 x 411 design box)", () => {
  it("keeps every control 48 px, inside the tap zone, off the edge strips and 8 px apart", () => {
    const layout = buildPauseLayout();
    const targets = tapTargets(layout);
    expect(PAUSE_TAP).toEqual(TAP);
    for (const { id, rect } of targets) {
      expect(rect.width, `${id} width`).toBeGreaterThanOrEqual(HIT.min);
      expect(rect.height, `${id} height`).toBeGreaterThanOrEqual(HIT.min);
      expect(rect.x, `${id} left`).toBeGreaterThanOrEqual(TAP.x0);
      expect(rect.x + rect.width, `${id} right`).toBeLessThanOrEqual(TAP.x1);
      expect(rect.y, `${id} top`).toBeGreaterThanOrEqual(TAP.y0);
      expect(rect.y + rect.height, `${id} bottom`).toBeLessThanOrEqual(TAP.y1);
      expect(rect.x, `${id} back-gesture strip`).toBeGreaterThanOrEqual(SPACE.noTapX);
      expect(DESIGN_BOX.width - (rect.x + rect.width), `${id} back-gesture strip`).toBeGreaterThanOrEqual(SPACE.noTapX);
    }
    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        expect(separation(targets[i].rect, targets[j].rect), `${targets[i].id} vs ${targets[j].id}`).toBeGreaterThanOrEqual(HIT.gap);
      }
    }
    // RESUME is the one primary; the toggles draw 40 px tall but take 48 px taps.
    expect(layout.resume.height).toBe(HIT.primary);
    expect(targets.filter((t) => t.rect.height === HIT.primary)).toHaveLength(1);
    expect(layout.sfx.rect.height).toBe(HIT.compact);
    expect(layout.sfx.hit.height).toBe(HIT.min);
    expect(layout.music.hit.height).toBe(HIT.min);
  });

  it("matches the approved mockup geometry", () => {
    const layout = buildPauseLayout();
    expect(layout.title).toEqual({ x: 445, y: 118 });
    expect(layout.resume).toEqual({ x: 286, y: 176, width: 320, height: 64 });
    expect(layout.quit).toEqual({ x: 286, y: 256, width: 320, height: 48 });
    expect(layout.sfx.rect).toEqual({ x: 291, y: 320, width: 150, height: 40 });
    expect(layout.sfx.hit).toEqual({ x: 291, y: 316, width: 150, height: 48 });
    expect(layout.music.rect).toEqual({ x: 449, y: 320, width: 150, height: 40 });
    // The pair is centred on x 445 with an 8 px gap.
    expect(layout.music.rect.x - (layout.sfx.rect.x + layout.sfx.rect.width)).toBe(HIT.gap);
    expect((layout.sfx.rect.x + layout.music.rect.x + layout.music.rect.width) / 2).toBe(445);
  });
});

describe("pause overlay presses", () => {
  it("fires a tap on pointer-up inside the control the finger pressed, per pointer", () => {
    const overlay = new VersusPauseOverlay();
    const { resume, quit, sfx } = overlay.layout;
    const w = 891;
    const h = 411;

    expect(overlay.handlePointerDown({ ...centre(resume), id: 1 }, w, h)).toBe(true);
    expect(overlay.handlePointerMove({ x: resume.x - 10, y: resume.y, id: 1 }, w, h)).toBe(true);
    expect(overlay.handlePointerUp({ x: resume.x - 10, y: resume.y, id: 1 }, w, h)).toBeNull();

    // Two fingers on two controls: each one's up fires its own control.
    overlay.handlePointerDown({ ...centre(quit), id: 2 }, w, h);
    overlay.handlePointerDown({ ...centre(sfx.hit), id: 3 }, w, h);
    expect(overlay.handlePointerUp({ ...centre(sfx.hit), id: 3 }, w, h)).toBe("sfx");
    expect(overlay.handlePointerUp({ ...centre(quit), id: 2 }, w, h)).toBe("quit");

    // Outside every control nothing is pressed; a cancel forgets a press without firing it.
    expect(overlay.handlePointerDown({ x: 100, y: 100, id: 4 }, w, h)).toBe(false);
    overlay.handlePointerDown({ ...centre(resume), id: 5 }, w, h);
    expect(overlay.handlePointerCancel({ id: 5 })).toBe(true);
    expect(overlay.handlePointerUp({ ...centre(resume), id: 5 }, w, h)).toBeNull();
  });

  it("scales a pressed control for pressMs and eases back; the screen fades in over fadeMs", () => {
    const overlay = new VersusPauseOverlay();
    const w = 891;
    const h = 411;
    overlay.show();
    expect(overlay.fadeAlpha()).toBe(0);
    overlay.update(MOTION.fadeMs / 2000);
    expect(overlay.fadeAlpha()).toBeCloseTo(0.5);
    overlay.update(MOTION.fadeMs / 1000);
    expect(overlay.fadeAlpha()).toBe(1);

    const resume = centre(overlay.layout.resume);
    overlay.handlePointerDown({ ...resume, id: 1 }, w, h);
    overlay.update(0.001);
    expect(overlay.pressAmount("resume")).toBe(1);
    overlay.handlePointerUp({ ...resume, id: 1 }, w, h);
    // Still fully pressed until pressMs after the touch, even though the finger has lifted.
    overlay.update((MOTION.pressMs - 2) / 1000);
    expect(overlay.pressAmount("resume")).toBe(1);
    // Then eases back linearly over releaseMs: 2 ms + half of releaseMs in.
    overlay.update(0.002 + MOTION.releaseMs / 2000);
    expect(overlay.pressAmount("resume")).toBeCloseTo(1 - (2 + MOTION.releaseMs / 2) / MOTION.releaseMs);
    overlay.update(1);
    expect(overlay.pressAmount("resume")).toBe(0);
  });
});

describe("versus pause state", () => {
  let nowSpy;

  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
    nowSpy = vi.spyOn(performance, "now").mockReturnValue(5000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("toggles on Escape, KeyP and Backspace, ignores key repeat and swaps the music loop", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    expect(scene.paused).toBe(false);

    const preventDefault = vi.fn();
    scene.onKeyDown({ code: "Escape", cancelable: true, preventDefault });
    expect(scene.paused).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    scene.onKeyDown({ code: "Escape" });
    expect(scene.paused).toBe(false);
    scene.onKeyDown({ code: "KeyP" });
    expect(scene.paused).toBe(true);
    scene.onKeyDown({ code: "KeyP", repeat: true });
    expect(scene.paused).toBe(true);
    scene.onKeyDown({ code: "Backspace" });
    expect(scene.paused).toBe(false);
    scene.onKeyDown({ code: "KeyA" });
    expect(scene.paused).toBe(false);

    expect(game.musicManager.play.mock.calls.map(([track]) => track)).toEqual([
      "bgm_pause", "bgm_battle", "bgm_pause", "bgm_battle",
    ]);
    scene.onExit(game);
  });

  it("holds the simulation, its clock and the match timer while paused; the overlay still animates", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    const steps = vi.spyOn(scene, "stepSimulation");
    scene.onEnter(game, {});
    scene.update(1 / 60, game);
    expect(steps).toHaveBeenCalledTimes(1);
    expect(scene.cachedNowMs).toBe(5000);
    expect(scene.roundStartedAtMs).toBe(5000);

    scene.onKeyDown({ code: "Escape" });
    nowSpy.mockReturnValue(9000);
    scene.update(1 / 60, game);
    scene.update(1 / 60, game);
    expect(steps).toHaveBeenCalledTimes(1);
    expect(scene.cachedNowMs).toBe(5000);
    expect(scene.pauseOverlay.fadeAlpha()).toBeCloseTo((2000 / 60) / MOTION.fadeMs);
    scene.update(1, game);
    expect(scene.pauseOverlay.fadeAlpha()).toBe(1);

    scene.onKeyDown({ code: "Escape" });
    scene.update(1 / 60, game);
    expect(steps).toHaveBeenCalledTimes(2);
    expect(scene.cachedNowMs).toBe(9000);
    // The 4 s pause does not count as match time.
    expect(scene.roundStartedAtMs).toBe(9000);
    scene.onExit(game);
  });

  it("forgets held input on resume so a finger that was holding fire does not shoot", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    scene.update(1 / 60, game);

    // P1 touch zone, held long enough to count as a shoot hold.
    expect(scene.handlePointerDown({ x: 100, y: 300, id: 1 }, game)).toBe(true);
    nowSpy.mockReturnValue(5300);
    expect(scene.versusInput.getPlayerInput(0).isPressed("shoot")).toBe(true);
    expect(scene.versusInput.pointerSessions.size).toBe(1);

    scene.onKeyDown({ code: "Escape" });
    // The lift goes to the pause screen, not to the fighter.
    expect(scene.handlePointerUp({ x: 100, y: 300, id: 1 }, game)).toBe(true);
    expect(scene.versusInput.pointerSessions.size).toBe(1);

    scene.onKeyDown({ code: "Escape" });
    expect(scene.versusInput.pointerSessions.size).toBe(0);
    expect(scene.versusInput.getPlayerInput(0).isPressed("shoot")).toBe(false);
    expect(scene.versusInput.getPlayerInput(0).consumePressed("shoot")).toBe(false);
    scene.onExit(game);
  });

  it("gives the pause screen every touch: neither the mute button nor the fighters react", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    scene.onKeyDown({ code: "Escape" });

    const mute = { x: MUTE_LAYOUT.x + MUTE_LAYOUT.size / 2, y: MUTE_LAYOUT.y + MUTE_LAYOUT.size / 2 };
    tap(scene, game, mute, 1);
    expect(scene.muted).toBe(false);
    expect(loadSettings().soundEnabled).toBe(true);
    expect(game.audioManager.setEnabled).toHaveBeenCalledTimes(1); // onEnter only

    expect(scene.handlePointerDown({ x: 100, y: 300, id: 2 }, game)).toBe(true);
    expect(scene.versusInput.pointerSessions.size).toBe(0);
    expect(scene.handlePointerMove({ x: 120, y: 300, id: 2 }, game)).toBe(true);
    expect(scene.handlePointerCancel({ x: 120, y: 300, id: 2 }, game)).toBe(true);
    scene.onExit(game);
  });

  it("writes the SFX and MUSIC toggles to the settings, applies them at once and keeps mute in step", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    const events = [];
    game.eventBus.on("ui_click", (payload) => events.push(payload));
    scene.onEnter(game, {});
    scene.onKeyDown({ code: "Escape" });
    const { sfx, music } = scene.pauseOverlay.layout;

    tap(scene, game, centre(sfx.hit));
    expect(loadSettings()).toMatchObject({ soundEnabled: false, musicEnabled: true });
    expect(game.audioManager.setEnabled).toHaveBeenLastCalledWith(false);
    expect(game.musicManager.setEnabled).toHaveBeenLastCalledWith(true);
    expect(scene.muted).toBe(false);
    expect(clicks(events, "pause_sfx")).toBe(1);

    tap(scene, game, centre(music.hit));
    expect(loadSettings()).toMatchObject({ soundEnabled: false, musicEnabled: false });
    expect(game.musicManager.setEnabled).toHaveBeenLastCalledWith(false);
    expect(scene.muted).toBe(true);
    expect(clicks(events, "pause_music")).toBe(1);

    tap(scene, game, centre(sfx.hit));
    expect(loadSettings()).toMatchObject({ soundEnabled: true, musicEnabled: false });
    expect(scene.muted).toBe(false);
    expect(scene.settings).toMatchObject({ soundEnabled: true, musicEnabled: false });
    expect(scene.paused).toBe(true);
    scene.onExit(game);
  });

  it("RESUME continues play; QUIT TO MENU leaves through the exit path and the exit clears the pause", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    const events = [];
    game.eventBus.on("ui_click", (payload) => events.push(payload));
    scene.onEnter(game, {});
    const { resume, quit } = scene.pauseOverlay.layout;

    scene.onKeyDown({ code: "Escape" });
    tap(scene, game, centre(resume));
    expect(scene.paused).toBe(false);
    expect(clicks(events, "pause_resume")).toBe(1);
    expect(game.musicManager.play).toHaveBeenLastCalledWith("bgm_battle");

    scene.onKeyDown({ code: "Escape" });
    tap(scene, game, centre(quit));
    expect(scene.exitRequested).toBe(true);
    scene.update(1 / 60, game);
    expect(game.switchScene).toHaveBeenCalledTimes(1);
    expect(game.switchScene).toHaveBeenCalledWith("menu", {
      from: "versus",
      playerCharacterKey: scene.playerCharacterKey,
      matchMode: scene.matchModeKey,
    });
    // One click for the quit: the exit path's, not a second one from the button.
    expect(clicks(events, "versus_exit")).toBe(1);
    expect(clicks(events, "pause_quit")).toBe(0);

    scene.onExit(game);
    expect(scene.paused).toBe(false);
    scene.onEnter(game, {});
    expect(scene.paused).toBe(false);
    scene.onExit(game);
  });

  it("recolours the whole frame after the HUD, draws the pause screen and dims the hero rigs", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    scene.update(1 / 60, game);

    const live = createOrderedCtx();
    scene.render(live.ctx, 0, game);
    expect(live.ops.some((op) => op.op === "fillText" && op.args[0] === "PAUSED")).toBe(false);
    expect(scene.renderer.heroEntries.map((entry) => entry.dim)).toEqual([1, 1]);

    scene.onKeyDown({ code: "Escape" });
    scene.update(1, game);
    const { ctx, ops } = createOrderedCtx();
    scene.render(ctx, 0, game);

    const dimAt = ops.findIndex((op) => op.op === "fillRect" && op.fillStyle === DIM);
    const goalAt = ops.findIndex((op) => op.op === "fillText" && op.args[0] === "FIRST TO 5");
    const muteAt = ops.findIndex((op) => op.op === "fillText" && op.args[0] === "♫");
    expect(dimAt).toBeGreaterThan(goalAt);
    expect(dimAt).toBeGreaterThan(muteAt);
    const texts = ops.slice(dimAt).filter((op) => op.op === "fillText").map((op) => op.args[0]);
    expect(texts).toEqual(["PAUSED", "RESUME", "QUIT TO MENU", "SFX ON", "MUSIC ON"]);
    expect(scene.renderer.heroEntries.map((entry) => entry.dim)).toEqual([PAUSE_HERO_DIM, PAUSE_HERO_DIM]);

    scene.onKeyDown({ code: "Escape" });
    scene.render(createOrderedCtx().ctx, 0, game);
    expect(scene.renderer.heroEntries.map((entry) => entry.dim)).toEqual([1, 1]);
    scene.onExit(game);
  });
});
