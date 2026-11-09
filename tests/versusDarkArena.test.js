import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { VersusGameScene } from "../src/scenes/VersusGameScene.js";
import { VersusPlayers } from "../src/scenes/versus/versusPlayers.js";
import {
  VersusProjectiles,
  createTrail,
  pushTrail,
  resetTrail,
  trailPoint,
} from "../src/scenes/versus/versusProjectiles.js";
import {
  BULLET_FX,
  FEEDBACK,
  PLAYER_DRAW_HEIGHT,
  REVEAL_ON_FIRE_SECONDS,
  REVEAL_ON_HIT_SECONDS,
  getDesignWorldRect,
  shotLineY,
} from "../src/scenes/versus/versusConfig.js";
import { killPathEndWorld } from "../src/scenes/versus/versusRenderer.js";
import { VersusHUD, HUD_LAYOUT, MUTE_LAYOUT, SHOOT_BUTTON_LAYOUT, SHOT_PIPS_LAYOUT } from "../src/ui/VersusHUD.js";
import { calculateVersusArenaLayout } from "../src/scenes/versusArena.js";
import { COLORS, DESIGN_BOX, HIT, SPACE, TYPE, designBoxTransform, displayFont, withAlpha } from "../src/theme/tokens.js";

function createScene() {
  const scene = {
    hitFlashTimers: [0, 0],
    spawnProtectionMs: [0, 0],
    cachedNowMs: 1000,
    bullets: [],
    p1Bullets: [],
    p2Bullets: [],
    worldWidth: 1440,
    deathY: 832,
  };
  scene.playersCtl = new VersusPlayers(scene);
  return scene;
}

function createShooter() {
  return {
    x: 100,
    y: 100,
    width: 28,
    height: 40,
    facing: 1,
    active: true,
    characterKey: "pear",
    canShoot: () => true,
    markShot() {},
  };
}

function createPool() {
  return {
    acquire: () => ({ fire() {} }),
  };
}

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
    viewWidth: 891,
    viewHeight: 411,
    dpr: 1,
    sceneData: {},
    eventBus: new EventBus(),
    audioManager: { setEnabled: () => {} },
    musicManager: { setEnabled: () => {} },
    input: { attached: false, setTouchControlsEnabled: () => {} },
  };
}

// Records text draws (with the style in force) and rounded-rect panels so layout can be checked
// without a DOM.
function createRecordingCtx() {
  const calls = [];
  const rects = [];
  const state = { font: "", fillStyle: "", textAlign: "left", letterSpacing: "0px" };
  const noop = () => {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return (text) => ({ width: text.length * 7 });
      if (prop === "fillText") {
        return (text, x, y) => calls.push({ text, x, y, font: target.font, fillStyle: target.fillStyle, textAlign: target.textAlign });
      }
      if (prop === "roundRect") return (x, y, width, height) => rects.push({ x, y, width, height });
      if (prop === "canvas") return undefined;
      return noop;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, calls, rects };
}

// Records every draw call in order, with the fill style in force, so the layering of a whole scene
// frame can be checked without a DOM.
function createOrderedCtx() {
  const ops = [];
  const recorded = new Set(["fillRect", "fillText", "moveTo", "lineTo", "roundRect"]);
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

describe("dark arena reveal timers", () => {
  it("keeps both fighters hidden by default", () => {
    const scene = createScene();
    expect(scene.playersCtl.getRevealAlpha(0)).toBe(0);
    expect(scene.playersCtl.getRevealAlpha(1)).toBe(0);
  });

  it("reveals the shooter for 0.3 s after firing", () => {
    const scene = createScene();
    scene.p1BulletPool = createPool();
    scene.p2BulletPool = createPool();
    const projectiles = new VersusProjectiles(scene);

    expect(projectiles.fireBullet(createShooter(), 0, null)).toBe(true);
    expect(scene.playersCtl.revealTimers[0]).toBeCloseTo(REVEAL_ON_FIRE_SECONDS, 5);
    expect(scene.playersCtl.getRevealAlpha(0)).toBe(1);
    expect(scene.playersCtl.getRevealAlpha(1)).toBe(0);

    scene.playersCtl.updateHitFlashTimers(0.15);
    expect(scene.playersCtl.getRevealAlpha(0)).toBe(1);
    scene.playersCtl.updateHitFlashTimers(0.2);
    expect(scene.playersCtl.getRevealAlpha(0)).toBe(0);
  });

  it("reveals the victim for 0.5 s after a hit", () => {
    const scene = createScene();
    // The match sets the hit flash timer when a bullet lands.
    scene.hitFlashTimers[1] = 0.14;

    scene.playersCtl.updateHitFlashTimers(1 / 60);
    expect(scene.playersCtl.revealTimers[1]).toBeCloseTo(REVEAL_ON_HIT_SECONDS - 1 / 60, 5);
    expect(scene.playersCtl.getRevealAlpha(1)).toBe(1);
    expect(scene.playersCtl.getRevealAlpha(0)).toBe(0);

    // The same hit does not re-trigger while the flash decays.
    scene.playersCtl.updateHitFlashTimers(1 / 60);
    expect(scene.playersCtl.revealTimers[1]).toBeCloseTo(REVEAL_ON_HIT_SECONDS - 2 / 60, 5);

    scene.playersCtl.updateHitFlashTimers(0.5);
    expect(scene.playersCtl.getRevealAlpha(1)).toBe(0);
  });

  it("fades out over the last 0.1 s and never extends a longer reveal with a shorter one", () => {
    const scene = createScene();
    scene.playersCtl.revealPlayer(0, REVEAL_ON_HIT_SECONDS);
    scene.playersCtl.revealPlayer(0, REVEAL_ON_FIRE_SECONDS);
    expect(scene.playersCtl.revealTimers[0]).toBe(REVEAL_ON_HIT_SECONDS);

    scene.playersCtl.updateHitFlashTimers(REVEAL_ON_HIT_SECONDS - 0.05);
    expect(scene.playersCtl.getRevealAlpha(0)).toBeCloseTo(0.5, 5);
  });
});

describe("shot line", () => {
  it("centres the bullet on the shot line, inside the body, 16.8 design px above the feet", () => {
    const scene = createScene();
    let fired = null;
    scene.p1BulletPool = { acquire: () => ({ height: 8, fire(options) { fired = options; } }) };
    scene.p2BulletPool = createPool();
    const shooter = createShooter();

    expect(new VersusProjectiles(scene).fireBullet(shooter, 0, null)).toBe(true);
    const centreY = fired.y + 4;
    expect(centreY).toBe(shotLineY(shooter));
    expect(fired.y).toBeGreaterThanOrEqual(shooter.y);
    expect(fired.y + 8).toBeLessThanOrEqual(shooter.y + shooter.height);
    const rect = getDesignWorldRect(891, 411, 1440, 760);
    expect((shooter.y + shooter.height - centreY) * rect.scale).toBeCloseTo(16.8, 1);
  });
});

describe("bullet trails", () => {
  it("keeps the last ten positions in a ring buffer, newest first", () => {
    const trail = createTrail();
    expect(trail.x.length).toBe(BULLET_FX.trailLength);
    for (let i = 1; i <= 12; i += 1) {
      pushTrail(trail, i * 10, i);
    }
    const point = { x: 0, y: 0 };
    expect(trail.count).toBe(10);
    expect(trailPoint(trail, 1, point)).toBe(true);
    expect(point).toEqual({ x: 120, y: 12 });
    expect(trailPoint(trail, 10, point)).toBe(true);
    expect(point).toEqual({ x: 30, y: 3 });
    expect(trailPoint(trail, 11, point)).toBe(false);
    resetTrail(trail);
    expect(trailPoint(trail, 1, point)).toBe(false);
  });

  it("gives every fired bullet a fresh trail and records its centre each step", () => {
    const scene = createScene();
    const bullet = {
      x: 0,
      y: 0,
      width: 22,
      height: 8,
      active: true,
      fire(options) {
        this.x = options.x;
        this.y = options.y;
      },
      update() {
        this.x += 10;
      },
      deactivate() {
        this.active = false;
      },
    };
    scene.p1BulletPool = { acquire: () => bullet };
    scene.p2BulletPool = createPool();
    const projectiles = new VersusProjectiles(scene);

    expect(projectiles.fireBullet(createShooter(), 0, null)).toBe(true);
    expect(bullet.trail.count).toBe(0);
    pushTrail(bullet.trail, 1, 1);
    projectiles.stepBullets(1 / 60, {});
    const point = { x: 0, y: 0 };
    expect(trailPoint(bullet.trail, 1, point)).toBe(true);
    expect(point.x).toBeCloseTo(bullet.x + 11, 5);
    expect(point.y).toBeCloseTo(bullet.y + 4, 5);

    // Re-firing the same pooled bullet starts a new trail.
    expect(projectiles.fireBullet(createShooter(), 0, null)).toBe(true);
    expect(bullet.trail.count).toBe(0);
  });
});

describe("design-box arena geometry", () => {
  it("fits the world into the 891 x 411 box like the mockup (scale 0.54, x offset 56)", () => {
    const rect = getDesignWorldRect(891, 411, 1440, 760);
    expect(rect.drawX).toBe(56);
    expect(rect.drawY).toBe(0);
    expect(rect.scale).toBeCloseTo(411 / 760, 5);
    // Grounds (arena v3 mockup): left x 100..372, right x 518..790, top y 372.
    expect(rect.drawX + 80 * rect.scale).toBeCloseTo(99.3, 0);
    expect(rect.drawX + 856 * rect.scale).toBeCloseTo(518.9, 0);
    expect(688 * rect.scale).toBeCloseTo(372.1, 0);
    // Rig height 48 px, as mocked.
    expect(PLAYER_DRAW_HEIGHT * rect.scale).toBeCloseTo(48.5, 0);
  });

  it("scales uniformly to 844 x 390 and centres the box on wider screens", () => {
    const phone = getDesignWorldRect(844, 390, 1440, 760);
    const box = designBoxTransform(844, 390);
    expect(box.scale).toBeCloseTo(0.947, 2);
    expect(phone.scale).toBeCloseTo((411 / 760) * box.scale, 5);
    expect(phone.drawX).toBeCloseTo(box.offsetX + 56 * box.scale, 5);

    const wide = getDesignWorldRect(1280, 411, 1440, 760);
    expect(wide.scale).toBeCloseTo(411 / 760, 5);
    expect(wide.drawX).toBeCloseTo((1280 - 891) / 2 + 56, 5);
  });
});

describe("match HUD layout", () => {
  it("puts the mute button in the top band right of the goal label, with a 48 px hit area clear of the pills", () => {
    expect(MUTE_LAYOUT.size).toBe(HIT.min);
    expect(MUTE_LAYOUT.drawSize).toBe(HUD_LAYOUT.height);
    // Centred on the band, like the pills.
    expect(MUTE_LAYOUT.y + MUTE_LAYOUT.size / 2).toBe(HUD_LAYOUT.top + HUD_LAYOUT.height / 2);

    const hud = new VersusHUD();
    expect(hud.getMuteRect(891, 411)).toEqual({ x: 489, y: 6, width: 48, height: 48 });
    expect(hud.muteContains({ clientX: 513, clientY: 30 }, 891, 411)).toBe(true);
    expect(hud.muteContains({ clientX: 823, clientY: 349 }, 891, 411)).toBe(false);

    // Clear of both pills, even with wide numbers.
    hud.setState(0, { kills: 12, deaths: 10, bulletsDodged: 44 });
    hud.setState(1, { kills: 12, deaths: 10, dodges: 44 });
    const { ctx, rects } = createRecordingCtx();
    hud.render(ctx, 891, 411);
    const [left, right] = rects;
    expect(MUTE_LAYOUT.x).toBeGreaterThan(left.x + left.width);
    expect(MUTE_LAYOUT.x + MUTE_LAYOUT.size).toBeLessThan(right.x);

    const phone = hud.getMuteRect(844, 390);
    const box = designBoxTransform(844, 390);
    expect(phone.width).toBeCloseTo(48 * box.scale, 5);
    expect(hud.muteContains({ x: phone.x + 1, y: phone.y + 1 }, 844, 390)).toBe(true);
  });

  it("places the 60 px SHOOT button bottom right inside the insets, clear of every ledge and ground", () => {
    const L = SHOOT_BUTTON_LAYOUT;
    expect(L.size).toBeGreaterThanOrEqual(HIT.min);
    expect(L.x + L.size).toBe(DESIGN_BOX.width - SPACE.insetX - SPACE.s4);
    expect(L.y + L.size).toBe(DESIGN_BOX.height - SPACE.insetBottom - SPACE.s4);
    expect(DESIGN_BOX.width - (L.x + L.size)).toBeGreaterThanOrEqual(SPACE.noTapX);

    const rect = getDesignWorldRect(891, 411, 1440, 760);
    const cx = L.x + L.size / 2;
    const cy = L.y + L.size / 2;
    for (const platform of calculateVersusArenaLayout().platforms) {
      const x0 = rect.drawX + platform.x * rect.scale;
      const y0 = rect.drawY + platform.y * rect.scale;
      const x1 = x0 + platform.width * rect.scale;
      const y1 = y0 + platform.height * rect.scale;
      const dx = Math.max(x0 - cx, 0, cx - x1);
      const dy = Math.max(y0 - cy, 0, cy - y1);
      expect(Math.hypot(dx, dy)).toBeGreaterThan(L.size / 2);
    }
  });

  it("draws the SHOOT ring: a lit team arc per shot left, spent arcs outlined and refilling, the label dim when empty", () => {
    const strokes = [];
    const labels = [];
    const state = { strokeStyle: "", fillStyle: "", globalAlpha: 1, lineWidth: 1 };
    let path = null;
    const ctx = new Proxy(state, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === "arc") return (x, y, r, a0, a1) => { path = { r, sweep: a1 - a0 }; };
        if (prop === "stroke") return () => strokes.push({ ...path, style: target.strokeStyle, alpha: target.globalAlpha, width: target.lineWidth });
        if (prop === "fillText") return (text) => labels.push({ text, style: target.fillStyle });
        if (prop === "canvas") return undefined;
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    const hud = new VersusHUD();
    const L = SHOOT_BUTTON_LAYOUT;
    const ring = (list) => list.filter((s) => s.r === L.ringRadius && s.width === L.ringWidth);

    hud.renderShootButton(ctx, 891, 411, { left: 2, total: 3, progress: 0 }, true);
    expect(ring(strokes).filter((s) => s.style === COLORS.p1 && s.alpha === 1)).toHaveLength(2);
    expect(ring(strokes).filter((s) => s.style !== COLORS.p1)).toHaveLength(1);
    expect(labels).toEqual([{ text: "SHOOT", style: COLORS.text }]);

    strokes.length = 0;
    labels.length = 0;
    hud.renderShootButton(ctx, 891, 411, { left: 0, total: 3, progress: 0.5 }, false);
    const lit = ring(strokes).filter((s) => s.style === COLORS.p1 && s.alpha === 1);
    const refill = ring(strokes).filter((s) => s.style === COLORS.p1 && s.alpha < 1);
    expect(lit).toHaveLength(0);
    // Half of three spent shots refilled: one whole arc and half of the next.
    expect(refill).toHaveLength(2);
    expect(refill[1].sweep).toBeCloseTo(refill[0].sweep / 2, 5);
    expect(labels).toEqual([{ text: "SHOOT", style: COLORS.dim }]);
  });

  it("draws kills as the big display number, the muted goal label centred, all inside the top band", () => {
    const hud = new VersusHUD();
    hud.setState(0, { kills: 2, deaths: 1, bulletsDodged: 4 });
    hud.setState(1, { kills: 1, deaths: 2, dodges: 3 });
    hud.setKillsToWin(5);
    const { ctx, calls } = createRecordingCtx();
    hud.render(ctx, 891, 411);

    const goal = calls.find((call) => call.text === "FIRST TO 5");
    expect(goal).toBeDefined();
    expect(goal.fillStyle).toBe(COLORS.muted);
    expect(goal.textAlign).toBe("center");
    expect(goal.x).toBeCloseTo(DESIGN_BOX.width / 2, 5);

    const numbers = calls.filter((call) => call.font === displayFont(TYPE.d2));
    expect(numbers.map((call) => call.text)).toEqual(["2", "1"]);
    expect(numbers[0].textAlign).toBe("left");
    expect(numbers[1].textAlign).toBe("right");
    expect(numbers[1].x).toBeLessThanOrEqual(DESIGN_BOX.width - SPACE.insetX);

    for (const call of calls) {
      expect(call.y).toBeGreaterThanOrEqual(SPACE.insetTop);
      expect(call.y).toBeLessThanOrEqual(SPACE.insetTop + HUD_LAYOUT.height);
    }
    const labels = calls.filter((call) => call.text !== "FIRST TO 5" && call.font !== displayFont(TYPE.d2));
    expect(labels.map((call) => call.text)).toEqual(["KILLS", "DEATHS 1", "DODGED 4", "KILLS", "DODGED 3", "DEATHS 2"]);
    expect(labels.every((call) => call.fillStyle === COLORS.muted)).toBe(true);
  });

  it("keeps both pills under 8 percent of the height, inside the side insets and clear of the bridges", () => {
    expect(HUD_LAYOUT.height).toBeLessThan(DESIGN_BOX.height * 0.08);
    const hud = new VersusHUD();
    hud.setState(0, { kills: 12, deaths: 10, bulletsDodged: 44 });
    hud.setState(1, { kills: 0, deaths: 0, dodges: 0 });
    const { ctx, rects } = createRecordingCtx();
    hud.render(ctx, 891, 411);

    expect(rects).toHaveLength(2);
    const [left, right] = rects;
    expect(left.x).toBe(SPACE.insetX);
    expect(right.x + right.width).toBe(DESIGN_BOX.width - SPACE.insetX);
    for (const pill of rects) {
      expect(pill.y).toBe(SPACE.insetTop);
      expect(pill.height).toBe(HUD_LAYOUT.height);
      expect(pill.width).toBeGreaterThanOrEqual(HUD_LAYOUT.minWidth);
      // Bridge tops sit at design y 335; the band ends far above.
      expect(pill.y + pill.height).toBeLessThan(335);
    }
    // The two pills never meet in the middle, even with wide numbers.
    expect(left.x + left.width).toBeLessThan(right.x);
  });
});

describe("shots-left pips", () => {
  // Records each rounded rect with what was done to it next (fill or stroke) and the style then.
  function createPipCtx() {
    const shapes = [];
    const state = { fillStyle: "", strokeStyle: "", globalAlpha: 1 };
    let last = null;
    const ctx = new Proxy(state, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === "roundRect") return (x, y, width, height) => { last = { x, y, width, height }; };
        if (prop === "fill") return () => shapes.push({ ...last, op: "fill", style: target.fillStyle, alpha: target.globalAlpha });
        if (prop === "stroke") return () => shapes.push({ ...last, op: "stroke", style: target.strokeStyle, alpha: target.globalAlpha });
        if (prop === "canvas") return undefined;
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    return { ctx, shapes };
  }

  it("draws one pip per shot under each pill: full in team colour, spent outlined, refilling partly filled", () => {
    const hud = new VersusHUD();
    const { ctx, shapes } = createPipCtx();
    hud.renderShotPips(ctx, 891, 411, [
      { left: 3, total: 3, progress: 1 },
      { left: 1, total: 3, progress: 0.25 },
    ]);
    const L = SHOT_PIPS_LAYOUT;
    expect(L.top).toBe(HUD_LAYOUT.top + HUD_LAYOUT.height + 6);
    const solid = (style) => shapes.filter((s) => s.op === "fill" && s.style === style && s.alpha === 1);
    // P1: three full red pips from x 36, left to right.
    expect(solid(COLORS.p1).map((s) => s.x)).toEqual([L.inset, L.inset + 18, L.inset + 36]);
    // P2: one full blue pip at the outer (right) edge, two outlined spent pips inward.
    expect(solid(COLORS.p2).map((s) => s.x + s.width)).toEqual([DESIGN_BOX.width - L.inset]);
    expect(shapes.filter((s) => s.op === "stroke")).toHaveLength(2);
    // A refill of 0.25 over two spent pips is half of the first spent pip, filled from the outer side.
    const refill = shapes.filter((s) => s.op === "fill" && s.style === COLORS.p2 && s.alpha < 1);
    expect(refill).toHaveLength(1);
    expect(refill[0].width).toBeCloseTo(L.width * 0.5, 5);
    expect(refill[0].x + refill[0].width).toBeCloseTo(DESIGN_BOX.width - L.inset - 18, 5);
    // Every pip sits in the HUD band, under the pills.
    for (const shape of shapes) {
      expect(shape.y).toBeGreaterThanOrEqual(HUD_LAYOUT.top + HUD_LAYOUT.height);
      expect(shape.y + shape.height).toBeLessThanOrEqual(L.top + L.height + 2);
    }
  });
});

describe("scene feedback wiring", () => {
  let nowSpy;

  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
    nowSpy = vi.spyOn(performance, "now").mockReturnValue(5000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("gives a non-fatal hit a hit stop, a slab flash under the victim and a three-dot dust puff", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    scene.update(1 / 60, game);
    const now = scene.cachedNowMs;
    scene.p2.supportingPlatform = scene.platforms[1];
    const particlesBefore = scene.particles.getActiveCount();

    game.eventBus.emit("versus:player_hit", {
      target: scene.p2,
      targetIndex: 1,
      bullet: { directionX: 1 },
      isFatal: false,
    });

    expect(scene.hitFlashTimers[1]).toBeGreaterThan(0);
    expect(scene.effects.getTimeScale(now + FEEDBACK.hitStopMs - 1)).toBe(0);
    expect(scene.effects.getTimeScale(now + FEEDBACK.hitStopMs)).toBe(1);
    expect(scene.effects.getSlabFlash(1, now)).toBe(1);
    expect(scene.effects.getSlabFlash(0, now)).toBe(0);
    expect(scene.particles.getActiveCount() - particlesBefore).toBe(3);
    const shake = scene.effects.getArenaTransform(now, { x: 0, y: 0, zoom: 1 });
    expect(Math.abs(shake.x)).toBeCloseTo(FEEDBACK.hitShakePx, 5);
    expect(shake.zoom).toBe(1);
    scene.onExit(game);
  });

  it("lights the slab a bullet hits and keeps the simulation running", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    scene.update(1 / 60, game);
    const now = scene.cachedNowMs;

    game.eventBus.emit("versus:bullet_blocked", { platform: scene.platforms[0], bullet: {} });

    expect(scene.effects.getSlabFlash(0, now)).toBe(1);
    expect(scene.effects.getSlabFlash(1, now)).toBe(0);
    expect(scene.effects.getTimeScale(now)).toBe(1);
    scene.onExit(game);
  });
});

describe("kill frame", () => {
  let nowSpy;

  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
    nowSpy = vi.spyOn(performance, "now").mockReturnValue(7000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("ends the path on the bullet's line, no deeper than the victim's near edge", () => {
    const shooter = { x: 300, y: 580, width: 28, height: 40 };
    const victim = { x: 1000, y: 580, width: 28, height: 40 };
    expect(killPathEndWorld({ x: 1005, y: 571, dirX: 1 }, victim, shooter)).toEqual({ x: 1000, y: 571 });
    expect(killPathEndWorld({ x: 990, y: 571, dirX: 1 }, victim, shooter)).toEqual({ x: 990, y: 571 });
    expect(killPathEndWorld({ x: 1020, y: 571, dirX: -1 }, victim, shooter)).toEqual({ x: 1028, y: 571 });
    // No positioned bullet: the near edge, on the shooter's shot line.
    expect(killPathEndWorld({ x: NaN, y: NaN, dirX: 1 }, victim, shooter)).toEqual({ x: 1000, y: shotLineY(shooter) });
  });

  it("dims the arena under the HUD and draws a level path from the muzzle to the victim's near edge", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    scene.onEnter(game, {});
    scene.update(1 / 60, game);
    const { p1, p2 } = scene;
    const bullet = { x: p2.x - 8, y: shotLineY(p1) - 4, width: 22, height: 8, directionX: 1 };
    game.eventBus.emit("versus:kill", { killer: p1, killerIndex: 0, victim: p2, victimIndex: 1, bullet });
    expect(scene.effects.getKillFrame(scene.cachedNowMs)).toMatchObject({ x: bullet.x + 11, y: shotLineY(p1), dirX: 1 });

    const { ctx, ops } = createOrderedCtx();
    scene.render(ctx, 0, game);

    const dimAt = ops.findIndex((op) => op.op === "fillRect" && op.fillStyle === withAlpha(COLORS.bg, FEEDBACK.dimAlpha));
    const goalAt = ops.findIndex((op) => op.op === "fillText" && op.args[0] === "FIRST TO 5");
    const muteAt = ops.findIndex((op) => op.op === "fillText" && op.args[0] === "♫");
    expect(dimAt).toBeGreaterThanOrEqual(0);
    expect(goalAt).toBeGreaterThan(dimAt);
    expect(muteAt).toBeGreaterThan(dimAt);
    expect(ops.slice(0, dimAt).some((op) => op.op === "fillText")).toBe(false);

    const moveAt = ops.findIndex((op) => op.op === "moveTo");
    const move = ops[moveAt];
    const line = ops.slice(moveAt).find((op) => op.op === "lineTo");
    const rect = getDesignWorldRect(891, 411, scene.worldWidth, scene.worldHeight);
    const shotY = Math.round(rect.drawY + shotLineY(p1) * rect.scale);
    expect(move.args[1]).toBe(shotY);
    expect(line.args[1]).toBe(shotY);
    expect(line.args[0]).toBe(Math.round(rect.drawX + p2.x * rect.scale));
    expect(move.args[0]).toBeLessThan(line.args[0]);
    scene.onExit(game);
  });
});

describe("scene time gate", () => {
  let nowSpy;

  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
    nowSpy = vi.spyOn(performance, "now").mockReturnValue(10000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("freezes the simulation during a kill, not the match clock, and resumes after the freeze", () => {
    const scene = new VersusGameScene();
    const game = createFakeGame();
    const steps = vi.spyOn(scene, "stepSimulation");

    scene.onEnter(game, {});
    scene.update(1 / 60, game);
    expect(steps).toHaveBeenCalledTimes(1);

    game.eventBus.emit("versus:kill", { killerIndex: 0, victimIndex: 1, bullet: { directionX: 1 } });
    nowSpy.mockReturnValue(10010);
    scene.update(1 / 60, game);
    expect(steps).toHaveBeenCalledTimes(1);
    expect(scene.effects.getKillFrame(10010)).toMatchObject({ shooterIndex: 0, victimIndex: 1 });

    nowSpy.mockReturnValue(10000 + FEEDBACK.killFreezeMs);
    scene.update(1 / 60, game);
    expect(steps).toHaveBeenCalledTimes(2);
    scene.onExit(game);
  });
});
