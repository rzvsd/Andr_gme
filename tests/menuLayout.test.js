import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuScene, buildMenuLayout, revealFrame } from "../src/scenes/MenuScene.js";
import { saveSettings } from "../src/config/settings.js";
import { DESIGN_BOX, HIT, MOTION, SPACE, designBoxTransform } from "../src/theme/tokens.js";

// Tap zone: safe insets plus 16 px.
const TAP = {
  x0: SPACE.insetX + 16,
  x1: DESIGN_BOX.width - SPACE.insetX - 16,
  y0: SPACE.insetTop + 16,
  y1: DESIGN_BOX.height - SPACE.insetBottom - 16,
};

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

function tapTargets(layout) {
  const targets = [
    { id: "sound", rect: layout.sound },
    { id: "play", rect: layout.play },
    ...layout.seg.cells.map((cell) => ({ id: `mode:${cell.key}`, rect: cell.rect })),
  ];
  for (const stage of layout.stages) {
    targets.push(...stage.chips.map((chip) => ({ id: `chip:${stage.slot}:${chip.key}`, rect: chip.rect })));
    if (stage.chevrons) {
      targets.push({ id: "prev", rect: stage.chevrons.prev }, { id: "next", rect: stage.chevrons.next });
    }
  }
  return targets;
}

// Smallest axis separation between two rects (negative when they overlap).
function separation(a, b) {
  return Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), b.y - (a.y + a.height), a.y - (b.y + b.height));
}

const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

describe("menu layout (891 x 411 design box)", () => {
  for (const view of ["solo", "friend"]) {
    it(`${view}: every tap target is 48 px, inside the tap zone, off the edge strips and 8 px apart`, () => {
      const layout = buildMenuLayout(view);
      const targets = tapTargets(layout);
      expect(targets.length).toBeGreaterThan(5);
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
          const bothCells = targets[i].id.startsWith("mode:") && targets[j].id.startsWith("mode:");
          if (bothCells) {
            continue; // one segmented control: adjoining cells by design
          }
          expect(separation(targets[i].rect, targets[j].rect), `${targets[i].id} vs ${targets[j].id}`).toBeGreaterThanOrEqual(HIT.gap);
        }
      }
      // The one primary button is PLAY at the primary height.
      expect(layout.play.height).toBe(HIT.primary);
      expect(targets.filter((t) => t.id === "play")).toHaveLength(1);
    });
  }

  it("matches the approved solo mockup geometry", () => {
    const layout = buildMenuLayout("solo");
    expect(layout.view).toBe("solo");
    expect(layout.sound).toEqual({ x: 799, y: 30, width: 48, height: 48 });
    expect(layout.seg.rect).toEqual({ x: 403, y: 95, width: 444, height: 48 });
    expect(layout.seg.stacked).toBe(false);
    expect(layout.seg.cells.map((cell) => cell.key)).toEqual(["human-vs-bot", "human-vs-human"]);
    expect(layout.play).toEqual({ x: 403, y: 309, width: 444, height: 64 });

    const [stage] = layout.stages;
    expect(layout.stages).toHaveLength(1);
    expect(stage.centerX).toBe(180);
    expect(stage.feetY).toBe(322);
    expect(stage.rigHeight).toBeCloseTo(200, -1);
    expect(stage.chevrons.prev.x).toBeGreaterThanOrEqual(44);
    expect(stage.chevrons.next.x + stage.chevrons.next.width).toBeLessThanOrEqual(352);
    expect(stage.chevrons.prev.y).toBe(324);
    expect(stage.chips.map((chip) => chip.rect.x)).toEqual([403, 517, 631, 745]);
    expect(stage.chips.every((chip) => chip.rect.y === 167 && chip.rect.width === 102 && chip.rect.height === 118)).toBe(true);
  });

  it("matches the approved friend mockup geometry: P1 left in red, P2 right in blue", () => {
    const layout = buildMenuLayout("friend");
    expect(layout.seg.rect).toEqual({ x: 296, y: 30, width: 300, height: 48 });
    expect(layout.seg.stacked).toBe(true);
    expect(layout.play).toEqual({ x: 326, y: 309, width: 240, height: 64 });

    const [p1, p2] = layout.stages;
    expect(p1.slot).toBe("p1");
    expect(p1.team).toBe(0);
    expect(p1.facing).toBe(1);
    expect(p1.centerX).toBe(168);
    expect(p2.slot).toBe("p2");
    expect(p2.team).toBe(1);
    expect(p2.facing).toBe(-1);
    expect(p2.centerX).toBe(723);
    expect(p1.feetY).toBe(246);
    expect(p1.chips.map((chip) => chip.rect.x)).toEqual([44, 108, 172, 236]);
    expect(p2.chips.map((chip) => chip.rect.x)).toEqual([599, 663, 727, 791]);
    expect(p1.chips.every((chip) => chip.rect.y === 313 && chip.rect.width === 56 && chip.rect.height === 56)).toBe(true);
    // Chip rows sit beside PLAY, not under it.
    expect(p1.chips[3].rect.x + 56).toBeLessThan(layout.play.x);
    expect(p2.chips[0].rect.x).toBeGreaterThan(layout.play.x + layout.play.width);
  });

  it("scales uniformly into an 844 x 390 viewport and keeps PLAY inside it", () => {
    const t = designBoxTransform(844, 390);
    expect(t.scale).toBeCloseTo(0.947, 3);
    const play = buildMenuLayout("solo").play;
    const right = t.offsetX + (play.x + play.width) * t.scale;
    const bottom = t.offsetY + (play.y + play.height) * t.scale;
    expect(right).toBeLessThanOrEqual(844);
    expect(bottom).toBeLessThanOrEqual(390);
    expect(play.height * t.scale).toBeGreaterThanOrEqual(60);
  });
});

describe("menu reveal flicker", () => {
  it("dips the hero to 0.45 and the name to 0.6 at the midpoint and restores both at the end", () => {
    const start = revealFrame(0);
    expect(start.active).toBe(true);
    expect(start.heroAlpha).toBeCloseTo(1);
    expect(start.ringScale).toBe(0);
    expect(start.ringAlpha).toBeCloseTo(0.6);

    const mid = revealFrame(MOTION.revealMs / 2);
    expect(mid.heroAlpha).toBeCloseTo(0.45);
    expect(mid.nameAlpha).toBeCloseTo(0.6);
    expect(mid.ringScale).toBeGreaterThan(0.5);

    const end = revealFrame(MOTION.revealMs);
    expect(end).toEqual({ active: false, heroAlpha: 1, nameAlpha: 1, ringScale: 1, ringAlpha: 0 });
    expect(revealFrame(Number.NaN).active).toBe(false);
  });
});

describe("menu scene render (2D fallback, no WebGL)", () => {
  function createContextStub() {
    const texts = [];
    const noop = () => {};
    return {
      texts,
      letterSpacing: "0px",
      save: noop, restore: noop, translate: noop, scale: noop, beginPath: noop, closePath: noop,
      moveTo: noop, lineTo: noop, quadraticCurveTo: noop, arc: noop, ellipse: noop,
      fill: noop, stroke: noop, clip: noop, fillRect: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: (text) => ({ width: text.length * 7 }),
      fillText: (text) => texts.push(text),
    };
  }

  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
  });

  it("draws the approved labels and nothing else in both views", () => {
    const scene = new MenuScene();
    const game = { viewWidth: 844, viewHeight: 390, dpr: 2, sceneData: {}, eventBus: { emit: vi.fn() }, switchScene: vi.fn() };
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot", playerCharacterKey: "chonk" } });

    const solo = createContextStub();
    scene.render(solo, 0, game);
    expect(solo.texts).toEqual(expect.arrayContaining(["BULLET DODGE ", "ARENA", "VS BOT", "SOLO", "VS FRIEND", "SAME PHONE", "CHONK", "PUDD", "NINJA", "VECTOR", "PLAY", "FIRST TO 5 KILLS"]));
    expect(solo.texts.filter((text) => text === "CHONK")).toHaveLength(2); // stage name + chip
    expect(solo.texts.some((text) => /\d \/ \d|hat|beanie|move|jump|shoot/i.test(text))).toBe(false);

    scene.setSelectedMatchMode("human-vs-human");
    const friend = createContextStub();
    scene.render(friend, 0, game);
    expect(friend.texts).toEqual(expect.arrayContaining(["P1", "P2", "CHONK", "NINJA", "PLAY"]));
    expect(friend.texts).not.toContain("PUDD"); // friend chips are discs only
  });

  it("sets no shadowBlur on the scene context on an idle frame: static glows are pre-rendered sprites", () => {
    const scene = new MenuScene();
    const game = { viewWidth: 891, viewHeight: 411, dpr: 3, sceneData: {}, eventBus: { emit: vi.fn() }, switchScene: vi.fn() };
    for (const matchMode of ["human-vs-bot", "human-vs-human"]) {
      scene.onEnter(game, { payload: { matchMode } });
      const ctx = createContextStub();
      scene.render(ctx, 0, game);
      expect("shadowBlur" in ctx, matchMode).toBe(false);
      expect("shadowColor" in ctx, matchMode).toBe(false);
    }
  });
});

describe("menu scene input", () => {
  function createGame() {
    return {
      viewWidth: DESIGN_BOX.width,
      viewHeight: DESIGN_BOX.height,
      dpr: 1,
      sceneData: {},
      eventBus: { emit: vi.fn() },
      switchScene: vi.fn(),
      audioManager: { setEnabled: vi.fn() },
      musicManager: { setEnabled: vi.fn() },
    };
  }

  function tap(scene, game, point, id = 1) {
    scene.handlePointerDown({ x: point.x, y: point.y, id }, game);
    scene.handlePointerUp({ x: point.x, y: point.y, id }, game);
  }

  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
  });

  it("switches mode from the segmented control, lets P2 pick, and sends both picks to versus", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot", playerCharacterKey: "chonk" } });
    expect(scene.layoutBox.view).toBe("solo");

    const friendCell = scene.layoutBox.seg.cells.find((cell) => cell.key === "human-vs-human");
    tap(scene, game, centre(friendCell.rect));
    expect(scene.selectedMatchModeKey).toBe("human-vs-human");
    expect(scene.layoutBox.view).toBe("friend");
    expect(game.eventBus.emit).toHaveBeenCalledWith("ui_click", { source: "mode:human-vs-human" });

    const p2 = scene.layoutBox.stages[1];
    tap(scene, game, centre(p2.chips[3].rect));
    expect(scene.selectedPlayer2CharacterKey).toBe("vector");
    expect(scene.selectedCharacterKey).toBe("chonk");
    expect(revealFrame(scene.revealMs.p2).active).toBe(true);
    expect(revealFrame(scene.revealMs.p1).active).toBe(false);

    tap(scene, game, centre(scene.layoutBox.play));
    expect(game.switchScene).toHaveBeenCalledWith("versus", {
      restart: true,
      playerCharacterKey: "chonk",
      matchMode: "human-vs-human",
      player2CharacterKey: "vector",
    });
    expect(game.sceneData.player2CharacterKey).toBe("vector");
    scene.onExit(game);
  });

  it("sends no player2CharacterKey for VS BOT", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot", playerCharacterKey: "pudd" } });
    tap(scene, game, centre(scene.layoutBox.play));
    expect(game.switchScene).toHaveBeenCalledWith("versus", {
      restart: true,
      playerCharacterKey: "pudd",
      matchMode: "human-vs-bot",
    });
  });

  it("changes the fighter once per horizontal swipe of more than 40 px on the stage", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot", playerCharacterKey: "pudd" } });

    expect(scene.handlePointerDown({ x: 180, y: 200, id: 7 }, game)).toBe(true);
    scene.handlePointerMove({ x: 150, y: 200, id: 7 }, game);
    expect(scene.selectedCharacterKey).toBe("pudd");
    scene.handlePointerMove({ x: 130, y: 200, id: 7 }, game);
    expect(scene.selectedCharacterKey).toBe("chonk");
    scene.handlePointerMove({ x: 40, y: 200, id: 7 }, game);
    expect(scene.selectedCharacterKey).toBe("chonk");
    scene.handlePointerUp({ x: 40, y: 200, id: 7 }, game);

    expect(revealFrame(scene.revealMs.p1).active).toBe(true);
    scene.update(MOTION.revealMs / 1000 + 0.01, game);
    expect(revealFrame(scene.revealMs.p1).active).toBe(false);

    // Swipe right goes back.
    scene.handlePointerDown({ x: 100, y: 200, id: 8 }, game);
    scene.handlePointerMove({ x: 160, y: 200, id: 8 }, game);
    scene.handlePointerUp({ x: 160, y: 200, id: 8 }, game);
    expect(scene.selectedCharacterKey).toBe("pudd");
  });

  it("scales pointer input with the design box on an 844 x 390 viewport", () => {
    const scene = new MenuScene();
    const game = { ...createGame(), viewWidth: 844, viewHeight: 390 };
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot", playerCharacterKey: "pudd" } });
    const t = designBoxTransform(844, 390);
    const next = scene.layoutBox.stages[0].chevrons.next;
    const c = centre(next);
    tap(scene, game, { x: t.offsetX + c.x * t.scale, y: t.offsetY + c.y * t.scale });
    expect(scene.selectedCharacterKey).toBe("chonk");
  });

  it("toggles sound and music together from the one sound button", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot" } });
    const sound = centre(scene.layoutBox.sound);

    tap(scene, game, sound);
    expect(scene.settings.soundEnabled).toBe(false);
    expect(scene.settings.musicEnabled).toBe(false);
    expect(game.audioManager.setEnabled).toHaveBeenLastCalledWith(false);
    expect(game.musicManager.setEnabled).toHaveBeenLastCalledWith(false);

    saveSettings({ musicEnabled: true });
    scene.settings = { ...scene.settings, musicEnabled: true };
    tap(scene, game, sound);
    expect(scene.settings.soundEnabled).toBe(true);
    expect(scene.settings.musicEnabled).toBe(true);
    expect(game.audioManager.setEnabled).toHaveBeenLastCalledWith(true);
  });

  it("holds the press scale for pressMs after a tap, then eases back", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-bot" } });
    tap(scene, game, centre(scene.layoutBox.sound));
    scene.update(0.001, game);
    expect(scene.pressState("sound").pressT).toBe(1);
    // The hold runs out in this step and the release (releaseMs) starts: 90 of 180 ms eased.
    scene.update(MOTION.pressMs / 1000, game);
    expect(scene.pressState("sound").pressT).toBeCloseTo(0.5, 5);
    scene.update(MOTION.releaseMs / 1000 / 2, game);
    expect(scene.pressState("sound").pressT).toBe(0);
  });

  it("lets P1 and P2 tap chips at the same time: both picks fire and both chips release", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-human", playerCharacterKey: "pudd", player2CharacterKey: "chonk" } });
    const [p1, p2] = scene.layoutBox.stages;
    const a = centre(p1.chips[2].rect); // ninja
    const b = centre(p2.chips[3].rect); // vector

    scene.handlePointerDown({ ...a, id: 1 }, game);
    scene.handlePointerDown({ ...b, id: 2 }, game);
    scene.update(0.001, game);
    expect(scene.pressState("chip:p1:ninja").pressT).toBe(1);
    expect(scene.pressState("chip:p2:vector").pressT).toBe(1);

    expect(scene.handlePointerUp({ ...a, id: 1 }, game)).toBe(true);
    expect(scene.selectedCharacterKey).toBe("ninja");
    expect(scene.selectedPlayer2CharacterKey).toBe("chonk");
    expect(scene.handlePointerUp({ ...b, id: 2 }, game)).toBe(true);
    expect(scene.selectedPlayer2CharacterKey).toBe("vector");

    // Nothing stays pressed once both fingers are up.
    scene.update(1, game);
    expect(scene.pressState("chip:p1:ninja").pressT).toBe(0);
    expect(scene.pressState("chip:p2:vector").pressT).toBe(0);
  });

  it("starts one match when both players tap PLAY together", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-human" } });
    const play = centre(scene.layoutBox.play);
    scene.handlePointerDown({ ...play, id: 1 }, game);
    scene.handlePointerDown({ ...play, id: 2 }, game);
    scene.handlePointerUp({ ...play, id: 1 }, game);
    scene.handlePointerUp({ ...play, id: 2 }, game);
    expect(game.switchScene).toHaveBeenCalledTimes(1);
    expect(scene.pressState("play").pressed).toBe(false);
  });

  it("tracks two simultaneous stage swipes separately", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-human", playerCharacterKey: "pudd", player2CharacterKey: "chonk" } });
    scene.handlePointerDown({ x: 168, y: 150, id: 1 }, game);
    scene.handlePointerDown({ x: 723, y: 150, id: 2 }, game);
    scene.handlePointerMove({ x: 118, y: 150, id: 1 }, game); // P1 swipes left: next fighter
    scene.handlePointerMove({ x: 773, y: 150, id: 2 }, game); // P2 swipes right: previous fighter
    expect(scene.selectedCharacterKey).toBe("chonk");
    expect(scene.selectedPlayer2CharacterKey).toBe("pudd");
    scene.handlePointerUp({ x: 118, y: 150, id: 1 }, game);
    scene.handlePointerUp({ x: 773, y: 150, id: 2 }, game);
    expect(scene.swipes.size).toBe(0);
  });

  it("releases every finger on a pointer cancel", () => {
    const scene = new MenuScene();
    const game = createGame();
    scene.onEnter(game, { payload: { matchMode: "human-vs-human", playerCharacterKey: "pudd", player2CharacterKey: "chonk" } });
    const chip = centre(scene.layoutBox.stages[0].chips[3].rect);
    scene.handlePointerDown({ ...chip, id: 1 }, game);
    scene.handlePointerDown({ x: 723, y: 150, id: 2 }, game);
    expect(scene.handlePointerCancel()).toBe(true);
    expect(scene.pressState("chip:p1:vector").pressed).toBe(false);
    expect(scene.presses.size).toBe(0);
    expect(scene.swipes.size).toBe(0);
    expect(scene.handlePointerUp({ ...chip, id: 1 }, game)).toBe(false);
    expect(scene.selectedCharacterKey).toBe("pudd");
  });
});
