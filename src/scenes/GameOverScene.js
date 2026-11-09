// Result screen, direction A "Blackout Arena": halves in team colours, winner spotlit, loser
// dimmed, three stat tiles, REMATCH primary. Geometry lives in the 891 x 411 design box
// (tokens.js DESIGN_BOX) and is scaled uniformly to the viewport; the approved mockup is
// harness/evidence/T-13/mockups/a-result.html (+ .jpg states).
import { getVersusMatchMode } from "../config/versusMatchMode.js";
import { getPlayerCharacterByKey } from "../theme/playerRoster.js";
import {
  COLORS,
  DESIGN_BOX,
  HIT,
  MOTION,
  RADII,
  SPACE,
  TEAM_COLORS,
  TYPE,
  designBoxTransform,
  displayFont,
  textFont,
  trackingPx,
  withAlpha,
} from "../theme/tokens.js";
import { roundedRectPath } from "../ui/uiUtils.js";
import { asNumber, asPointer, isObject, rectContains } from "./scenePointerUtils.js";
import { HERO_RIG_HEIGHT_UNITS, heroLayer } from "./versus/versusHeroLayer.js";

const MODE_VERSUS = "versus";
const TAU = Math.PI * 2;

// Tap zone: the safe insets plus 16 px -> x 44..847, y 30..373.
const TAP = Object.freeze({
  x0: SPACE.insetX + SPACE.s4,
  x1: DESIGN_BOX.width - SPACE.insetX - SPACE.s4,
  y0: SPACE.insetTop + SPACE.s4,
  y1: DESIGN_BOX.height - SPACE.insetBottom - SPACE.s4,
});
const CENTER_X = 445;
// Floor line: both fighters' feet and the top of the two slabs.
const FEET_Y = 301;
// 1.5 rig units in design px: 120 px per unit, so Chonk stands 202 px tall as in the mockup.
// The hero layer has one unitPx per frame, so the loser is drawn at the same size and dimmed.
const RIG_HEIGHT = 180;
const LOSER_DIM = 0.3;
const HERO_X = Object.freeze([156, 735]);
const TITLE_MAX_W = 420;
const TITLE_Y = 24;
const TILE_W = 130;
const TILE_H = 64;
const TILES_Y = 128;
const REMATCH_W = 320;
const MENU_W = 140;
const REMATCH_TRACK_EM = 0.22;
const MENU_TRACK_EM = 0.08;
// The two match slabs on this screen's floor, centred under HERO_X (113.5 px each side): x 42..269
// and 621..848, so neither runs behind REMATCH (from 285) or MENU (from 613), as in the mockup.
const SLAB_X = Object.freeze([42, 621]);
const SLAB_W = 227;
const SLAB_H = 14;
const SLAB_ALPHA = 0.3;
const SLAB = Object.freeze({
  radius: 2,
  outlineWidth: 1.5,
  fill: withAlpha(COLORS.structure, 0.12),
  outline: withAlpha(COLORS.structure, 0.4),
  top: withAlpha(COLORS.structure, 0.7),
  glow: withAlpha(COLORS.structure, 0.12),
  glowBlur: 24,
  glowOffsetY: 10,
});
// Static dust motes as design-box fractions: [x, y, radius, alpha] (mockup a-tokens.css .dust).
const DUST = Object.freeze([
  [0.12, 0.22, 1, 0.35], [0.24, 0.41, 1, 0.25], [0.19, 0.63, 1.5, 0.3], [0.31, 0.15, 1, 0.2],
  [0.09, 0.52, 1, 0.22], [0.36, 0.55, 1.5, 0.18], [0.62, 0.33, 1, 0.2], [0.78, 0.58, 1, 0.22],
  [0.86, 0.24, 1.5, 0.18],
]);

// The result is a beat: the title slides in 10 px and the halves fade up over one reveal, the
// screen holds for two reveals in all, then the tiles and buttons fade in over one fade. All
// durations come from MOTION.
export const RESULT_BEAT = Object.freeze({
  introMs: MOTION.revealMs,
  holdMs: 2 * MOTION.revealMs,
  fadeMs: MOTION.fadeMs,
  titleSlidePx: 10,
});

const rect = (x, y, width, height) => ({ x, y, width, height });
const centerOf = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const easeOut = (p) => 1 - (1 - p) ** 3;

const normalizeMode = (value) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

function copyObject(target, value) {
  if (!isObject(value)) {
    return target;
  }

  for (const [key, val] of Object.entries(value)) {
    target[key] = val;
  }
  return target;
}

function normalizeStats(raw) {
  const score = asNumber(raw.score, asNumber(raw.finalScore, asNumber(raw.points, 0)));
  const kills = asNumber(raw.kills, asNumber(raw.enemiesKilled, 0));
  const dodges = asNumber(raw.dodges, asNumber(raw.bulletsDodged, 0));
  const wave = asNumber(
    raw.wave,
    asNumber(
      raw.currentWave,
      asNumber(raw.waves, asNumber(raw.waveNumber, asNumber(raw.lastWave, 0))),
    ),
  );
  const deaths = asNumber(raw.deaths, asNumber(raw.playerDeaths, 0));
  const highScore = asNumber(raw.highScore, asNumber(raw.bestScore, 0));
  const timeSeconds = asNumber(raw.timeSeconds, asNumber(raw.durationSeconds, asNumber(raw.time, 0)));

  return {
    score: Math.max(0, Math.round(score)),
    kills: Math.max(0, Math.round(kills)),
    dodges: Math.max(0, Math.round(dodges)),
    wave: Math.max(0, Math.round(wave)),
    deaths: Math.max(0, Math.round(deaths)),
    highScore: Math.max(0, Math.round(highScore)),
    timeSeconds: Math.max(0, Math.round(timeSeconds)),
  };
}

function payloadOf(transition) {
  const payload = isObject(transition?.payload) ? transition.payload : transition;
  return isObject(payload) ? payload : {};
}

function collectMergedData(game, transition) {
  const merged = {};
  copyObject(merged, game?.sceneData);
  copyObject(merged, game?.sceneData?.stats);

  const payload = payloadOf(transition);
  copyObject(merged, payload);
  copyObject(merged, payload?.stats);
  copyObject(merged, payload?.data);
  copyObject(merged, payload?.event);

  return merged;
}

function collectStats(game, transition) {
  return normalizeStats(collectMergedData(game, transition));
}

function collectResultMeta(game, transition) {
  const payload = payloadOf(transition);
  const payloadStats = isObject(payload?.stats) ? payload.stats : null;
  const payloadData = isObject(payload?.data) ? payload.data : null;
  const payloadEvent = isObject(payload?.event) ? payload.event : null;
  const merged = collectMergedData(game, transition);

  const versusCandidates = [
    payload?.versus,
    payload?.versusResult,
    payloadStats?.versus,
    payloadStats?.versusResult,
    payloadData?.versus,
    payloadData?.versusResult,
    payloadEvent?.versus,
    payloadEvent?.versusResult,
  ];
  let versus = null;
  for (const candidate of versusCandidates) {
    if (isObject(candidate)) {
      versus = candidate;
      break;
    }
  }

  const modeCandidates = [
    normalizeMode(payload?.mode),
    normalizeMode(payload?.sourceMode),
    normalizeMode(payload?.sourceScene),
    normalizeMode(payload?.from),
    normalizeMode(payloadStats?.mode),
    normalizeMode(payloadStats?.sourceMode),
    normalizeMode(payloadStats?.sourceScene),
    normalizeMode(payloadData?.mode),
    normalizeMode(payloadEvent?.mode),
    normalizeMode(transition?.from),
  ];
  const isVersus = modeCandidates.includes(MODE_VERSUS) || isObject(versus);

  const winnerIndex = Math.round(asNumber(versus?.winnerIndex, asNumber(merged.winnerIndex, -1)));
  const loserIndex = Math.round(asNumber(versus?.loserIndex, asNumber(merged.loserIndex, -1)));
  const rawKillsToWin = asNumber(versus?.killsToWin, asNumber(merged.killsToWin, -1));
  const matchMode = getVersusMatchMode(payload?.matchMode ?? merged.matchMode);

  return {
    isVersus,
    mode: isVersus ? MODE_VERSUS : "game",
    matchModeKey: matchMode.key,
    isBot: matchMode.botEnabled === true,
    p1Label: matchMode.p1Label,
    p2Label: matchMode.p2Label,
    winnerIndex: winnerIndex >= 0 ? winnerIndex : -1,
    loserIndex: loserIndex >= 0 ? loserIndex : -1,
    killsToWin: rawKillsToWin >= 1 ? Math.round(rawKillsToWin) : null,
    p1Kills: Math.max(0, Math.round(asNumber(versus?.p1Kills, asNumber(merged.p1Kills, 0)))),
    p2Kills: Math.max(0, Math.round(asNumber(versus?.p2Kills, asNumber(merged.p2Kills, 0)))),
    p1Deaths: Math.max(0, Math.round(asNumber(versus?.p1Deaths, asNumber(merged.p1Deaths, 0)))),
    p2Deaths: Math.max(0, Math.round(asNumber(versus?.p2Deaths, asNumber(merged.p2Deaths, 0)))),
    p1Dodges: Math.max(0, Math.round(asNumber(versus?.p1Dodges, asNumber(merged.p1Dodges, 0)))),
    p2Dodges: Math.max(0, Math.round(asNumber(versus?.p2Dodges, asNumber(merged.p2Dodges, 0)))),
  };
}

// Hero ids of P1 and P2. The match writes playerCharacterKey and player2CharacterKey to
// sceneData; a bot's random pick is read from botCharacterKey when the match provides it.
function collectHeroKeys(game, transition, meta) {
  const payload = payloadOf(transition);
  const data = isObject(game?.sceneData) ? game.sceneData : {};
  const p1 = getPlayerCharacterByKey(payload.playerCharacterKey ?? data.playerCharacterKey).key;
  const friend = payload.player2CharacterKey ?? data.player2CharacterKey;
  const p2 = meta.isBot ? payload.botCharacterKey ?? data.botCharacterKey ?? friend : friend;
  return [p1, getPlayerCharacterByKey(typeof p2 === "string" ? p2 : p1).key];
}

// Design-box geometry for a result. winnerIndex 0 = P1 (left, red), 1 = P2 (right, blue),
// anything else = no duel (the old wave game's "GAME OVER"). Pure, so a unit test can check it.
export function buildResultLayout(winnerIndex) {
  const winner = winnerIndex === 0 || winnerIndex === 1 ? winnerIndex : -1;
  const duel = winner >= 0;
  const tilesX = CENTER_X - (3 * TILE_W + 2 * SPACE.s3) / 2; // 238
  const rematch = rect(CENTER_X - REMATCH_W / 2, TAP.y1 - HIT.primary, REMATCH_W, HIT.primary); // 285..605 x 309..373
  const menu = rect(
    rematch.x + rematch.width + HIT.gap,
    rematch.y + (HIT.primary - HIT.secondary) / 2,
    MENU_W,
    HIT.secondary,
  ); // 613..753 x 317..365
  return {
    winner,
    duel,
    banner: winner === 1
      ? { x: TAP.x1, align: "right", titleY: TITLE_Y }
      : { x: TAP.x0, align: "left", titleY: TITLE_Y },
    tiles: [0, 1, 2].map((index) => rect(tilesX + index * (TILE_W + SPACE.s3), TILES_Y, TILE_W, TILE_H)),
    rematch,
    menu,
    seam: { cx: DESIGN_BOX.width / 2, cy: DESIGN_BOX.height / 2, width: 25, height: 471, angleDeg: 6, fade: 0.22 },
    slabs: SLAB_X.map((x) => rect(x, FEET_Y, SLAB_W, SLAB_H)),
    heroes: duel
      ? [0, 1].map((team) => ({
        slot: team === 0 ? "p1" : "p2",
        team,
        centerX: HERO_X[team],
        feetY: FEET_Y,
        facing: team === 0 ? 1 : -1,
        winner: team === winner,
      }))
      : [],
    rigHeight: RIG_HEIGHT,
    cone: duel ? { centerX: HERO_X[winner], width: 300, top: -40, bottom: FEET_Y, open: 0.38 } : null,
    floor: duel ? { centerX: HERO_X[winner], y: FEET_Y, width: 220, height: 44 } : null,
  };
}

// One frame of the result beat at elapsedMs. Buttons take taps only once fully visible.
export function resultBeat(elapsedMs) {
  const t = Math.max(0, Number(elapsedMs) || 0);
  const intro = easeOut(Math.min(1, t / RESULT_BEAT.introMs));
  const ui = easeOut(Math.min(1, Math.max(0, (t - RESULT_BEAT.holdMs) / RESULT_BEAT.fadeMs)));
  return {
    sceneAlpha: intro,
    titleAlpha: intro,
    titleOffset: (1 - intro) * RESULT_BEAT.titleSlidePx,
    uiAlpha: ui,
    interactive: t >= RESULT_BEAT.holdMs + RESULT_BEAT.fadeMs,
  };
}

export function formatMatchTime(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Caps labels: ctx.letterSpacing also trails the last glyph, so centred and right-aligned text
// shift by part of a step.
function fillCaps(ctx, text, x, y, spacingPx) {
  const supported = "letterSpacing" in ctx;
  if (supported) {
    ctx.letterSpacing = `${spacingPx}px`;
  }
  const shift = ctx.textAlign === "center" ? spacingPx / 2 : ctx.textAlign === "right" ? spacingPx : 0;
  ctx.fillText(text, x + shift, y);
  if (supported) {
    ctx.letterSpacing = "0px";
  }
}

// Width of a tracked caps label without the trailing step.
function measureCaps(ctx, font, text, spacingPx) {
  ctx.font = font;
  const supported = "letterSpacing" in ctx;
  if (supported) {
    ctx.letterSpacing = `${spacingPx}px`;
  }
  const width = ctx.measureText(text).width;
  if (supported) {
    ctx.letterSpacing = "0px";
  }
  return (supported ? width : width + spacingPx * text.length) - spacingPx;
}

// Radial gradient stretched to an ellipse; `stops` are [offset, colour] pairs.
function fillEllipseGradient(ctx, cx, cy, rx, ry, stops, box = null) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  if (box) {
    ctx.fillRect((box.x - cx) / rx, (box.y - cy) / ry, box.width / rx, box.height / ry);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export class GameOverScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.transform = designBoxTransform(this.width, this.height);
    this.stats = normalizeStats({});
    this.resultMeta = collectResultMeta({}, {});
    this.heroKeys = collectHeroKeys({}, {}, this.resultMeta);
    this.layoutBox = buildResultLayout(-1);
    this.controls = [];
    this.titleText = "GAME OVER";
    this.titlePx = TYPE.d0;
    this.titleMeasured = false;
    this.elapsedMs = 0;
    this.pressAnim = new Map();
    this.activePress = null;
  }

  onEnter(game, transition) {
    this.stats = collectStats(game, transition);
    this.resultMeta = collectResultMeta(game, transition);
    this.heroKeys = collectHeroKeys(game, transition, this.resultMeta);
    this.layoutBox = buildResultLayout(this.resultMeta.isVersus ? this.resultMeta.winnerIndex : -1);
    this.titleText = this.buildTitle();
    this.titlePx = TYPE.d0;
    this.titleMeasured = false;
    this.elapsedMs = 0;
    this.pressAnim.clear();
    this.activePress = null;

    this.controls = [
      {
        id: "rematch",
        rect: this.layoutBox.rematch,
        onPress: () => {
          if (this.resultMeta.isVersus) {
            game.switchScene("versus", {
              restart: true,
              playerCharacterKey: game?.sceneData?.playerCharacterKey,
              matchMode: this.resultMeta.matchModeKey,
            });
            return;
          }
          game.switchScene("game", { restart: true });
        },
      },
      {
        id: "menu",
        rect: this.layoutBox.menu,
        onPress: () => {
          game.switchScene("menu", {
            playerCharacterKey: game?.sceneData?.playerCharacterKey,
            matchMode: this.resultMeta.matchModeKey,
          });
        },
      },
    ];

    heroLayer.setLightPreset("menu");
    this.onResize(asNumber(game?.viewWidth, this.width), asNumber(game?.viewHeight, this.height), game);
  }

  onExit() {
    heroLayer.clear();
    heroLayer.setLightPreset("match");
    this.activePress = null;
    for (const state of this.pressAnim.values()) {
      state.pressed = false;
    }
  }

  onResize(width, height) {
    this.width = Math.max(1, asNumber(width, 1));
    this.height = Math.max(1, asNumber(height, 1));
    this.transform = designBoxTransform(this.width, this.height);
  }

  update(dt) {
    const ms = Math.max(0, Number(dt) || 0) * 1000;
    this.elapsedMs += ms;
    // Press feedback: full pressScale while held and for pressMs after the touch, then ease back.
    for (const state of this.pressAnim.values()) {
      state.holdMs = Math.max(0, state.holdMs - ms);
      state.pressT = state.pressed || state.holdMs > 0 ? 1 : Math.max(0, state.pressT - ms / MOTION.releaseMs);
    }
  }

  render(ctx, _alpha, game) {
    const box = this.layoutBox;
    const beat = resultBeat(this.elapsedMs);
    const { scale, offsetX, offsetY } = this.transform;
    const heroesLive = box.duel && heroLayer.isAvailable();
    const team = box.duel ? TEAM_COLORS[box.winner] : null;

    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.textBaseline = "middle";

    // Arena behind the beat: fades up with the title.
    ctx.globalAlpha = beat.sceneAlpha;
    if (box.duel) {
      this.drawHalves(ctx);
      this.drawCone(ctx, box.cone);
    }
    this.drawDust(ctx);
    if (box.duel) {
      this.drawSeam(ctx, box.seam);
      this.drawSlabs(ctx, box.slabs);
      fillEllipseGradient(ctx, box.floor.centerX, box.floor.y, box.floor.width / 2, box.floor.height / 2, [
        [0, withAlpha(team.main, 0.38)],
        [0.55, withAlpha(team.main, 0.1)],
        [0.72, withAlpha(team.main, 0)],
      ]);
      if (!heroesLive) {
        this.drawFallbackHeroes(ctx, box);
      }
    }
    ctx.globalAlpha = 1;
    this.drawVignette(ctx);

    this.drawBanner(ctx, box.banner, beat, team);
    ctx.globalAlpha = beat.uiAlpha;
    this.drawTiles(ctx, box.tiles);
    this.drawPrimary(ctx, "rematch", box.rematch, "REMATCH");
    this.drawSecondary(ctx, "menu", box.menu, "MENU");
    ctx.restore();

    if (heroesLive) {
      heroLayer.safeRender({
        width: this.width,
        height: this.height,
        dpr: Number(game?.dpr) || 1,
        unitPx: (box.rigHeight * scale) / HERO_RIG_HEIGHT_UNITS,
        nowMs: nowMs(),
        actors: box.heroes.map((hero) => this.heroActor(hero, beat)),
      });
    }
  }

  // "<NAME> WINS" in the winner's colour; the bot is "BOT"; the old wave game says GAME OVER.
  buildTitle() {
    if (!this.resultMeta.isVersus) {
      return "GAME OVER";
    }
    const winner = this.resultMeta.winnerIndex;
    return winner === 0 || winner === 1 ? `${this.fighterName(winner)} WINS` : "DRAW";
  }

  fighterName(index) {
    if (index === 1 && this.resultMeta.isBot) {
      return this.resultMeta.p2Label.toUpperCase();
    }
    return getPlayerCharacterByKey(this.heroKeys[index]).name.toUpperCase();
  }

  scoreText() {
    const meta = this.resultMeta;
    return meta.isVersus ? `${meta.p1Kills} - ${meta.p2Kills}` : String(this.stats.score);
  }

  // [label, value] per tile; duel values read P1 : P2.
  tileRows() {
    const meta = this.resultMeta;
    const time = formatMatchTime(this.stats.timeSeconds);
    if (meta.isVersus) {
      return [
        ["KILLS", `${meta.p1Kills} : ${meta.p2Kills}`],
        ["DODGED", `${meta.p1Dodges} : ${meta.p2Dodges}`],
        ["TIME", time],
      ];
    }
    return [
      ["KILLS", String(this.stats.kills)],
      ["DODGED", String(this.stats.dodges)],
      ["TIME", time],
    ];
  }

  heroActor(hero, beat) {
    const { scale, offsetX, offsetY } = this.transform;
    const team = TEAM_COLORS[hero.team];
    return {
      slot: `result-${hero.slot}`,
      heroId: this.heroKeys[hero.team],
      x: offsetX + hero.centerX * scale,
      y: offsetY + hero.feetY * scale,
      facing: hero.facing,
      vx: 0,
      vy: 0,
      onGround: true,
      visible: true,
      lastShotAtMs: Number.NEGATIVE_INFINITY,
      hitFlash: 0,
      rimColor: hero.winner ? team.main : undefined,
      rimIntensity: hero.winner ? 6 : 0,
      // Under the "menu" preset the spot is the light that brings a rig to full brightness, so
      // both fighters get it: the loser is then lit like the winner and dimmed to 0.3 overall,
      // which is the mockup's flat light plus brightness(0.3). Without the spot the loser's body
      // would sit near 0.1 (0.3 of the preset's 0.3) while its unlit parts stayed at 0.3.
      spot: true,
      // The layer has no alpha; dimming on black reads as the fade. The loser stays at 0.3.
      dim: (hero.winner ? 1 : LOSER_DIM) * beat.sceneAlpha,
    };
  }

  // P1 red from the left edge, P2 blue from the right: 28 percent at the edge to 0 at 60 percent
  // of the half.
  drawHalves(ctx) {
    const half = DESIGN_BOX.width / 2;
    for (const team of [0, 1]) {
      const edge = team === 0 ? 0 : DESIGN_BOX.width;
      const inner = team === 0 ? half * 0.6 : DESIGN_BOX.width - half * 0.6;
      const gradient = ctx.createLinearGradient(edge, 0, inner, 0);
      gradient.addColorStop(0, withAlpha(TEAM_COLORS[team].main, 0.28));
      gradient.addColorStop(1, withAlpha(TEAM_COLORS[team].main, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(team === 0 ? 0 : half, 0, half, DESIGN_BOX.height);
    }
  }

  // Winner spotlight: 300 wide cone with a 72 px mouth above the frame down to the floor line.
  drawCone(ctx, cone) {
    const x0 = cone.centerX - cone.width / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 + cone.width * cone.open, cone.top);
    ctx.lineTo(x0 + cone.width * (1 - cone.open), cone.top);
    ctx.lineTo(x0 + cone.width, cone.bottom);
    ctx.lineTo(x0, cone.bottom);
    ctx.closePath();
    ctx.clip();
    const light = ctx.createLinearGradient(0, cone.top, 0, cone.bottom);
    light.addColorStop(0, withAlpha(COLORS.impact, 0.14));
    light.addColorStop(0.55, withAlpha(COLORS.impact, 0.04));
    light.addColorStop(0.92, withAlpha(COLORS.impact, 0));
    ctx.fillStyle = light;
    ctx.fillRect(x0, cone.top, cone.width, cone.bottom - cone.top);
    ctx.restore();
  }

  drawDust(ctx) {
    for (const [fx, fy, radius, alpha] of DUST) {
      ctx.beginPath();
      ctx.arc(fx * DESIGN_BOX.width, fy * DESIGN_BOX.height, radius, 0, TAU);
      ctx.fillStyle = withAlpha(COLORS.impact, alpha);
      ctx.fill();
    }
  }

  // 1 px core at 50 percent white inside a 25 px soft glow, tilted 6 degrees about the centre,
  // faded over its top 22 percent so it does not cut into the title band.
  drawSeam(ctx, seam) {
    const x0 = -seam.width / 2;
    const y0 = -seam.height / 2;
    const fadeH = seam.height * seam.fade;
    const bands = 8;
    const baseAlpha = ctx.globalAlpha;
    ctx.save();
    ctx.translate(seam.cx, seam.cy);
    ctx.rotate((seam.angleDeg * Math.PI) / 180);

    const glow = ctx.createLinearGradient(x0, 0, x0 + seam.width, 0);
    glow.addColorStop(0, withAlpha(COLORS.impact, 0));
    glow.addColorStop(0.5, withAlpha(COLORS.impact, 0.14));
    glow.addColorStop(1, withAlpha(COLORS.impact, 0));
    ctx.fillStyle = glow;
    for (let index = 0; index < bands; index += 1) {
      ctx.globalAlpha = baseAlpha * ((index + 0.5) / bands);
      ctx.fillRect(x0, y0 + (fadeH * index) / bands, seam.width, fadeH / bands + 0.5);
    }
    ctx.globalAlpha = baseAlpha;
    ctx.fillRect(x0, y0 + fadeH, seam.width, seam.height - fadeH);

    const core = ctx.createLinearGradient(0, y0, 0, y0 + fadeH);
    core.addColorStop(0, withAlpha(COLORS.impact, 0));
    core.addColorStop(1, withAlpha(COLORS.impact, 0.5));
    ctx.fillStyle = core;
    ctx.fillRect(-0.5, y0, 1, fadeH);
    ctx.fillStyle = withAlpha(COLORS.impact, 0.5);
    ctx.fillRect(-0.5, y0 + fadeH, 1, seam.height - fadeH);
    ctx.restore();
  }

  // The two match slabs at 30 percent: fill, outline, lit top edge and a soft under-glow.
  drawSlabs(ctx, slabs) {
    const line = SLAB.outlineWidth;
    ctx.save();
    ctx.globalAlpha *= SLAB_ALPHA;
    for (const r of slabs) {
      ctx.save();
      ctx.shadowColor = SLAB.glow;
      ctx.shadowBlur = SLAB.glowBlur;
      ctx.shadowOffsetY = SLAB.glowOffsetY;
      ctx.fillStyle = SLAB.fill;
      roundedRectPath(ctx, r.x, r.y, r.width, r.height, SLAB.radius);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = SLAB.fill;
      roundedRectPath(ctx, r.x, r.y, r.width, r.height, SLAB.radius);
      ctx.fill();
      ctx.lineWidth = line;
      ctx.strokeStyle = SLAB.outline;
      roundedRectPath(ctx, r.x + line / 2, r.y + line / 2, r.width - line, r.height - line, SLAB.radius);
      ctx.stroke();
      ctx.fillStyle = SLAB.top;
      ctx.fillRect(r.x + line, r.y + line, r.width - line * 2, 1);
    }
    ctx.restore();
  }

  // No WebGL: a team-colour disc with the fighter's name stands where the rig would be.
  drawFallbackHeroes(ctx, box) {
    const radius = box.rigHeight * 0.3;
    for (const hero of box.heroes) {
      const team = TEAM_COLORS[hero.team];
      ctx.save();
      if (!hero.winner) {
        ctx.globalAlpha *= LOSER_DIM;
      }
      ctx.beginPath();
      ctx.arc(hero.centerX, hero.feetY - box.rigHeight * 0.55, radius, 0, TAU);
      ctx.fillStyle = team.main;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.line;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = textFont(TYPE.t2, 700);
      ctx.fillStyle = COLORS.text;
      fillCaps(ctx, this.fighterName(hero.team), hero.centerX, hero.feetY - SPACE.s4, trackingPx(TYPE.t2));
      ctx.restore();
    }
  }

  drawVignette(ctx) {
    const cx = DESIGN_BOX.width / 2;
    const cy = DESIGN_BOX.height / 2;
    fillEllipseGradient(ctx, cx, cy, cx * Math.SQRT2, cy * Math.SQRT2, [
      [0.45, withAlpha(COLORS.bg, 0)],
      [1, withAlpha(COLORS.bg, 0.55)],
    ], rect(0, 0, DESIGN_BOX.width, DESIGN_BOX.height));
  }

  // Title in the winner's colour with a glow, the score 8 px under it; both slide in 10 px.
  drawBanner(ctx, banner, beat, team) {
    if (!this.titleMeasured) {
      this.titleMeasured = true;
      const wide = measureCaps(ctx, displayFont(TYPE.d0), this.titleText, trackingPx(TYPE.d0)) > TITLE_MAX_W;
      this.titlePx = wide ? TYPE.d1 : TYPE.d0;
    }
    const px = this.titlePx;
    ctx.save();
    ctx.globalAlpha = beat.titleAlpha;
    ctx.textAlign = banner.align;
    ctx.font = displayFont(px);
    ctx.fillStyle = team ? team.main : COLORS.text;
    if (team) {
      ctx.shadowColor = team.glow;
      ctx.shadowBlur = 24;
    }
    fillCaps(ctx, this.titleText, banner.x, banner.titleY + px / 2 + beat.titleOffset, trackingPx(px));
    ctx.shadowBlur = 0;
    ctx.font = displayFont(TYPE.d2);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(this.scoreText(), banner.x, banner.titleY + px + SPACE.s2 + TYPE.d2 / 2 + beat.titleOffset);
    ctx.restore();
  }

  // Three panels: caps label 12 px, 4 px gap, 24 px display value, the block centred in 64.
  drawTiles(ctx, tiles) {
    const rows = this.tileRows();
    ctx.save();
    ctx.textAlign = "center";
    for (let index = 0; index < tiles.length; index += 1) {
      const r = tiles[index];
      const [label, value] = rows[index];
      const { x: cx } = centerOf(r);
      roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.panel);
      ctx.fillStyle = COLORS.surface;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.line;
      ctx.stroke();
      ctx.font = textFont(TYPE.t2, 700);
      ctx.fillStyle = COLORS.muted;
      fillCaps(ctx, label, cx, r.y + SPACE.s3 + TYPE.t2 / 2, trackingPx(TYPE.t2));
      ctx.font = displayFont(TYPE.d2);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(value, cx, r.y + SPACE.s3 + TYPE.t2 + SPACE.s1 + TYPE.d2 / 2);
    }
    ctx.restore();
  }

  // The one primary button: accent fill, glow, 6 px darker base, display caps in accent ink.
  drawPrimary(ctx, id, r, label) {
    const { x: cx, y: cy } = centerOf(r);
    ctx.save();
    this.applyPress(ctx, id, r);
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.shadowColor = COLORS.accentGlow;
    ctx.shadowBlur = 32;
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRectPath(ctx, r.x, r.y + 6, r.width, r.height, RADII.control);
    ctx.fill();
    ctx.fillStyle = withAlpha(COLORS.accentInk, 0.3);
    ctx.fill();
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accentInk;
    ctx.font = displayFont(TYPE.d2);
    fillCaps(ctx, label, cx, cy, TYPE.d2 * REMATCH_TRACK_EM);
    ctx.restore();
  }

  drawSecondary(ctx, id, r, label) {
    const { x: cx, y: cy } = centerOf(r);
    ctx.save();
    const pressed = this.applyPress(ctx, id, r) > 0;
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = pressed ? 2 : 1;
    ctx.strokeStyle = pressed ? COLORS.accent : COLORS.lineStrong;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.text;
    ctx.font = textFont(TYPE.t1, 600);
    fillCaps(ctx, label, cx, cy, TYPE.t1 * MENU_TRACK_EM);
    ctx.restore();
  }

  // Scales the following drawing about the control's centre by its press amount; returns it.
  applyPress(ctx, id, r) {
    const pressT = this.pressAnim.get(id)?.pressT ?? 0;
    if (pressT > 0) {
      const { x: cx, y: cy } = centerOf(r);
      const k = 1 - (1 - MOTION.pressScale) * pressT;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-cx, -cy);
    }
    return pressT;
  }

  pressState(id) {
    let state = this.pressAnim.get(id);
    if (!state) {
      state = { pressed: false, holdMs: 0, pressT: 0 };
      this.pressAnim.set(id, state);
    }
    return state;
  }

  setPressed(control, pressed) {
    const state = this.pressState(control.id);
    state.pressed = pressed;
    if (pressed) {
      state.holdMs = MOTION.pressMs;
    }
  }

  // Viewport CSS px -> design px.
  toDesign(point) {
    const { scale, offsetX, offsetY } = this.transform;
    return { x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale, id: point.id };
  }

  handlePointerDown(pointer) {
    const point = asPointer(pointer);
    if (!point || !resultBeat(this.elapsedMs).interactive) {
      return false;
    }
    const p = this.toDesign(point);
    const control = this.controls.find((candidate) => rectContains(candidate.rect, p));
    if (!control) {
      return false;
    }
    this.activePress = { id: p.id, control };
    this.setPressed(control, true);
    return true;
  }

  handlePointerMove(pointer) {
    const point = asPointer(pointer);
    if (!point || !this.activePress || this.activePress.id !== point.id) {
      return false;
    }
    const p = this.toDesign(point);
    this.setPressed(this.activePress.control, rectContains(this.activePress.control.rect, p));
    return true;
  }

  handlePointerUp(pointer, game) {
    const point = asPointer(pointer);
    if (!point || !this.activePress || this.activePress.id !== point.id) {
      return false;
    }
    const p = this.toDesign(point);
    const { control } = this.activePress;
    this.activePress = null;
    this.setPressed(control, false);
    if (rectContains(control.rect, p)) {
      game?.eventBus?.emit?.("ui_click", { source: control.id });
      control.onPress();
    }
    return true;
  }

  handlePointerCancel() {
    if (!this.activePress) {
      return false;
    }
    this.setPressed(this.activePress.control, false);
    this.activePress = null;
    return true;
  }
}
