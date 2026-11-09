import { describe, expect, it, vi } from "vitest";
import {
  GameOverScene,
  RESULT_BEAT,
  buildResultLayout,
  formatMatchTime,
  resultBeat,
} from "../src/scenes/GameOverScene.js";
import { DESIGN_BOX, HIT, MOTION, SPACE, designBoxTransform } from "../src/theme/tokens.js";

// Tap zone: safe insets plus 16 px.
const TAP = {
  x0: SPACE.insetX + 16,
  x1: DESIGN_BOX.width - SPACE.insetX - 16,
  y0: SPACE.insetTop + 16,
  y1: DESIGN_BOX.height - SPACE.insetBottom - 16,
};

// Smallest axis separation between two rects (negative when they overlap).
function separation(a, b) {
  return Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), b.y - (a.y + a.height), a.y - (b.y + b.height));
}

const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// The payload versusMatch.finishMatch sends to game_over, plus what the match wrote to sceneData.
function versusResult({ winnerIndex, p1Kills, p2Kills, matchMode = "human-vs-human", timeSeconds = 161 }) {
  const versus = {
    winnerIndex,
    loserIndex: winnerIndex === 0 ? 1 : 0,
    killsToWin: 5,
    p1Kills,
    p2Kills,
    p1Deaths: p2Kills,
    p2Deaths: p1Kills,
    p1Dodges: 7,
    p2Dodges: 4,
    timeSeconds,
  };
  const stats = { ...versus, mode: "versus", sourceScene: "versus", matchMode, timeSeconds };
  return {
    game: {
      viewWidth: DESIGN_BOX.width,
      viewHeight: DESIGN_BOX.height,
      dpr: 1,
      sceneData: { playerCharacterKey: "chonk", player2CharacterKey: "ninja", matchMode, stats, versusResult: versus },
      eventBus: { emit: vi.fn() },
      switchScene: vi.fn(),
    },
    transition: {
      from: "versus",
      to: "game_over",
      payload: { mode: "versus", sourceScene: "versus", playerCharacterKey: "chonk", matchMode, stats, versus },
    },
  };
}

function createContextStub() {
  const texts = [];
  const noop = () => {};
  return {
    texts,
    letterSpacing: "0px",
    globalAlpha: 1,
    textAlign: "left",
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, clip: noop, fillRect: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: (text) => ({ width: text.length * 34 }),
    fillText: (text) => texts.push(text),
  };
}

function tap(scene, game, point, id = 1) {
  scene.handlePointerDown({ x: point.x, y: point.y, id }, game);
  scene.handlePointerUp({ x: point.x, y: point.y, id }, game);
}

describe("result layout (891 x 411 design box)", () => {
  for (const winner of [0, 1]) {
    it(`P${winner + 1} wins: both buttons are 48 px, inside the tap zone, off the edge strips and 8 px apart`, () => {
      const layout = buildResultLayout(winner);
      const targets = [{ id: "rematch", rect: layout.rematch }, { id: "menu", rect: layout.menu }];
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
      expect(separation(layout.rematch, layout.menu)).toBeGreaterThanOrEqual(HIT.gap);
      // The one primary button is REMATCH at the primary height.
      expect(layout.rematch.height).toBe(HIT.primary);
      expect(layout.menu.height).toBe(HIT.secondary);
    });
  }

  it("matches the approved mockup geometry: P1 left in red, P2 right in blue", () => {
    const p1 = buildResultLayout(0);
    expect(p1.duel).toBe(true);
    expect(p1.rematch).toEqual({ x: 285, y: 309, width: 320, height: 64 });
    expect(p1.menu).toEqual({ x: 613, y: 317, width: 140, height: 48 });
    expect(p1.tiles.map((tile) => tile.x)).toEqual([238, 380, 522]);
    expect(p1.tiles.every((tile) => tile.y === 128 && tile.width === 130 && tile.height === 64)).toBe(true);
    // Slabs centred under the fighters (156 / 735, 113.5 each side); neither runs behind REMATCH
    // (285..605) or MENU (613..753, which starts lower at y 317).
    expect(p1.slabs).toEqual([
      { x: 42, y: 301, width: 227, height: 14 },
      { x: 621, y: 301, width: 227, height: 14 },
    ]);
    for (const slab of p1.slabs) {
      expect(separation(slab, p1.rematch)).toBeGreaterThan(0);
      expect(separation(slab, p1.menu)).toBeGreaterThan(0);
    }
    expect(p1.seam.angleDeg).toBe(6);
    expect(p1.banner).toEqual({ x: 44, align: "left", titleY: 24 });
    expect(p1.heroes.map((hero) => [hero.slot, hero.team, hero.centerX, hero.feetY, hero.facing, hero.winner])).toEqual([
      ["p1", 0, 156, 301, 1, true],
      ["p2", 1, 735, 301, -1, false],
    ]);
    expect(p1.cone.centerX).toBe(156);
    expect(p1.floor.centerX).toBe(156);

    const p2 = buildResultLayout(1);
    expect(p2.banner).toEqual({ x: 847, align: "right", titleY: 24 });
    expect(p2.heroes.map((hero) => hero.winner)).toEqual([false, true]);
    expect(p2.cone.centerX).toBe(735);
    // Bodies stay clear of the tile row (238..652): Chonk's body half-width is 74, Ninja's head 53
    // (mockup notes); the buttons start under the feet.
    expect(p2.rematch.y).toBeGreaterThan(p2.heroes[0].feetY);
    expect(p2.heroes[0].centerX + 74).toBeLessThan(p2.tiles[0].x);
    expect(p2.heroes[1].centerX - 53).toBeGreaterThan(p2.tiles[2].x + p2.tiles[2].width);
  });

  it("has no duel dressing for the old wave game", () => {
    const solo = buildResultLayout(-1);
    expect(solo.duel).toBe(false);
    expect(solo.heroes).toEqual([]);
    expect(solo.cone).toBeNull();
    expect(solo.rematch).toEqual(buildResultLayout(0).rematch);
  });

  it("keeps REMATCH inside an 844 x 390 viewport at 60 px or taller", () => {
    const t = designBoxTransform(844, 390);
    expect(t.scale).toBeCloseTo(0.947, 3);
    const { rematch, menu } = buildResultLayout(1);
    expect(t.offsetX + (menu.x + menu.width) * t.scale).toBeLessThanOrEqual(844);
    expect(t.offsetY + (rematch.y + rematch.height) * t.scale).toBeLessThanOrEqual(390);
    expect(rematch.height * t.scale).toBeGreaterThanOrEqual(60);
  });
});

describe("result beat", () => {
  it("takes every duration from MOTION: reveal 300, hold 600, fade 150", () => {
    expect(RESULT_BEAT.introMs).toBe(MOTION.revealMs);
    expect(RESULT_BEAT.holdMs).toBe(2 * MOTION.revealMs);
    expect(RESULT_BEAT.fadeMs).toBe(MOTION.fadeMs);
  });

  it("slides the title in over the reveal, holds, then fades the UI in by 750 ms", () => {
    const start = resultBeat(0);
    expect(start.sceneAlpha).toBe(0);
    expect(start.titleOffset).toBe(RESULT_BEAT.titleSlidePx);
    expect(start.uiAlpha).toBe(0);
    expect(start.interactive).toBe(false);

    const settled = resultBeat(RESULT_BEAT.introMs);
    expect(settled.sceneAlpha).toBe(1);
    expect(settled.titleOffset).toBe(0);
    expect(settled.uiAlpha).toBe(0);

    const hold = resultBeat(RESULT_BEAT.holdMs);
    expect(hold.uiAlpha).toBe(0);
    expect(hold.interactive).toBe(false);

    const mid = resultBeat(RESULT_BEAT.holdMs + RESULT_BEAT.fadeMs / 2);
    expect(mid.uiAlpha).toBeGreaterThan(0);
    expect(mid.uiAlpha).toBeLessThan(1);
    expect(mid.interactive).toBe(false);

    const done = resultBeat(RESULT_BEAT.holdMs + RESULT_BEAT.fadeMs);
    expect(done.uiAlpha).toBe(1);
    expect(done.interactive).toBe(true);
    expect(RESULT_BEAT.holdMs + RESULT_BEAT.fadeMs).toBe(750);
    expect(resultBeat(Number.NaN).interactive).toBe(false);
  });

  it("formats the match time as m:ss", () => {
    expect(formatMatchTime(161)).toBe("2:41");
    expect(formatMatchTime(5)).toBe("0:05");
    expect(formatMatchTime(-3)).toBe("0:00");
  });
});

describe("result scene", () => {
  it("names the winning hero in P1's colour and draws only the approved text", () => {
    const scene = new GameOverScene();
    const { game, transition } = versusResult({ winnerIndex: 0, p1Kills: 5, p2Kills: 3 });
    scene.onEnter(game, transition);
    expect(scene.titleText).toBe("CHONK WINS");
    expect(scene.layoutBox.winner).toBe(0);
    expect(scene.heroKeys).toEqual(["chonk", "ninja"]);

    const ctx = createContextStub();
    scene.update(1, game);
    scene.render(ctx, 0, game);
    expect(ctx.texts).toEqual(expect.arrayContaining([
      "CHONK WINS", "5 - 3", "KILLS", "5 : 3", "DODGED", "7 : 4", "TIME", "2:41", "REMATCH", "MENU",
    ]));
    expect(ctx.texts.some((text) => /first to|wins \(|final|score|wave|deaths|target/i.test(text))).toBe(false);
    scene.onExit(game);
  });

  it("says BOT WINS when the bot takes a VS BOT match and shows the bot's hero when given", () => {
    const scene = new GameOverScene();
    const { game, transition } = versusResult({ winnerIndex: 1, p1Kills: 3, p2Kills: 5, matchMode: "human-vs-bot" });
    game.sceneData.botCharacterKey = "vector";
    scene.onEnter(game, transition);
    expect(scene.titleText).toBe("BOT WINS");
    expect(scene.scoreText()).toBe("3 - 5");
    expect(scene.layoutBox.banner.align).toBe("right");
    expect(scene.heroKeys).toEqual(["chonk", "vector"]);
    const winner = scene.heroActor(scene.layoutBox.heroes[1], resultBeat(1000));
    const loser = scene.heroActor(scene.layoutBox.heroes[0], resultBeat(1000));
    expect(winner.spot).toBe(true);
    expect(winner.dim).toBe(1);
    expect(winner.rimIntensity).toBe(6);
    // The loser is lit the same way (the spot is what lights a rig under the menu preset) and
    // then dimmed to 0.3 overall, with no team rim.
    expect(loser.spot).toBe(true);
    expect(loser.dim).toBeCloseTo(0.3);
    expect(loser.rimIntensity).toBe(0);
    // Both fade up with the scene.
    expect(scene.heroActor(scene.layoutBox.heroes[0], resultBeat(0)).dim).toBe(0);
  });

  it("drops the title to d1 when it measures wider than 420 px", () => {
    const scene = new GameOverScene();
    const { game, transition } = versusResult({ winnerIndex: 0, p1Kills: 5, p2Kills: 0 });
    game.sceneData.playerCharacterKey = "vector";
    transition.payload.playerCharacterKey = "vector";
    scene.onEnter(game, transition);
    const ctx = createContextStub();
    ctx.measureText = (text) => ({ width: text.length * 40 }); // "VECTOR WINS" -> 440
    scene.render(ctx, 0, game);
    expect(scene.titlePx).toBe(32);
  });

  it("ignores taps during the beat and then runs REMATCH and MENU with the same scene switches", () => {
    const scene = new GameOverScene();
    const { game, transition } = versusResult({ winnerIndex: 1, p1Kills: 2, p2Kills: 5 });
    scene.onEnter(game, transition);
    const rematch = centre(scene.layoutBox.rematch);
    const menu = centre(scene.layoutBox.menu);

    scene.update(0.5, game);
    expect(scene.handlePointerDown({ x: rematch.x, y: rematch.y, id: 1 }, game)).toBe(false);
    expect(game.switchScene).not.toHaveBeenCalled();

    scene.update(0.4, game);
    tap(scene, game, rematch);
    expect(game.switchScene).toHaveBeenCalledWith("versus", {
      restart: true,
      playerCharacterKey: "chonk",
      matchMode: "human-vs-human",
    });
    expect(game.eventBus.emit).toHaveBeenCalledWith("ui_click", { source: "rematch" });

    tap(scene, game, menu);
    expect(game.switchScene).toHaveBeenLastCalledWith("menu", {
      playerCharacterKey: "chonk",
      matchMode: "human-vs-human",
    });
  });

  it("holds the press scale for pressMs after a tap, then eases back", () => {
    const scene = new GameOverScene();
    const { game, transition } = versusResult({ winnerIndex: 0, p1Kills: 5, p2Kills: 1 });
    scene.onEnter(game, transition);
    scene.update(1, game);
    tap(scene, game, centre(scene.layoutBox.menu));
    scene.update(0.001, game);
    expect(scene.pressState("menu").pressT).toBe(1);
    scene.update(0.09, game);
    expect(scene.pressState("menu").pressT).toBeCloseTo(0.5, 5);
    scene.update(0.09, game);
    expect(scene.pressState("menu").pressT).toBe(0);
  });

  it("scales pointer input with the design box on an 844 x 390 viewport", () => {
    const scene = new GameOverScene();
    const { game, transition } = versusResult({ winnerIndex: 0, p1Kills: 5, p2Kills: 1 });
    game.viewWidth = 844;
    game.viewHeight = 390;
    scene.onEnter(game, transition);
    scene.update(1, game);
    const t = designBoxTransform(844, 390);
    const c = centre(scene.layoutBox.menu);
    tap(scene, game, { x: t.offsetX + c.x * t.scale, y: t.offsetY + c.y * t.scale });
    expect(game.switchScene).toHaveBeenCalledWith("menu", expect.objectContaining({ playerCharacterKey: "chonk" }));
  });

  it("falls back to GAME OVER with single values for the old wave game", () => {
    const scene = new GameOverScene();
    const game = { viewWidth: 891, viewHeight: 411, sceneData: {}, eventBus: { emit: vi.fn() }, switchScene: vi.fn() };
    scene.onEnter(game, { from: "game", to: "game_over", payload: { stats: { score: 1200, kills: 9, dodges: 31, timeSeconds: 75 } } });
    expect(scene.titleText).toBe("GAME OVER");
    expect(scene.layoutBox.duel).toBe(false);
    expect(scene.tileRows()).toEqual([["KILLS", "9"], ["DODGED", "31"], ["TIME", "1:15"]]);
    scene.update(1, game);
    tap(scene, game, centre(scene.layoutBox.rematch));
    expect(game.switchScene).toHaveBeenCalledWith("game", { restart: true });
  });
});
