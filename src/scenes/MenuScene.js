// Main menu, direction A "Blackout Arena": one screen with mode, fighter select and PLAY.
// Geometry lives in the 891 x 411 design box (tokens.js DESIGN_BOX) and is scaled uniformly to
// the viewport; the approved mockup is harness/evidence/T-13/mockups/a-menu.html (+ .jpg states).
import { loadSettings, saveSettings } from "../config/settings.js";
import {
  cycleVersusMatchModeKey,
  getVersusMatchMode,
  isVersusBotMatchMode,
  loadSelectedVersusMatchModeKey,
  saveSelectedVersusMatchModeKey,
} from "../config/versusMatchMode.js";
import { HERO_RIG_HEIGHT_UNITS, heroLayer } from "./versus/versusHeroLayer.js";
import {
  cyclePlayerCharacterKey,
  getPlayerCharacterByIndex,
  getPlayerCharacterByKey,
  getPlayerCharacterIndexByKey,
  loadSelectedPlayer2CharacterKey,
  loadSelectedPlayerCharacterKey,
  PLAYER_CHARACTER_ROSTER,
  saveSelectedPlayer2CharacterKey,
  saveSelectedPlayerCharacterKey,
} from "../theme/playerRoster.js";
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
import { asNumber, asPointer, rectContains } from "./scenePointerUtils.js";

const TAU = Math.PI * 2;

// Tap zone: the safe insets plus 16 px -> x 44..847, y 30..373.
const TAP = Object.freeze({
  x0: SPACE.insetX + SPACE.s4,
  x1: DESIGN_BOX.width - SPACE.insetX - SPACE.s4,
  y0: SPACE.insetTop + SPACE.s4,
  y1: DESIGN_BOX.height - SPACE.insetBottom - SPACE.s4,
});
const CENTER_X = (TAP.x0 + TAP.x1) / 2;
// Segmented control cells, left to right: VS BOT, VS FRIEND (mockup order).
const MODE_ORDER = Object.freeze(["human-vs-bot", "human-vs-human"]);
const CHIP_W = 102;
const CHIP_H = 118;
const CHIP_DISC = 46;
const MINI_CHIP = 56;
const MINI_DISC = 30;
const COLUMN_W = PLAYER_CHARACTER_ROSTER.length * CHIP_W + (PLAYER_CHARACTER_ROSTER.length - 1) * SPACE.s3; // 444
const SOLO_STAGE_W = 360;
const FRIEND_STAGE_W = 248;
const DOT_R = 3;
const SWIPE_PX = 40;
const RING_W = 180;
const RING_H = 36;
const WORDMARK_TRACK_EM = 0.32;
const PLAY_TRACK_EM = 0.22;
// Blur radii of the static glows (mockup box-shadow / text-shadow); see drawGlow.
const GLOW = Object.freeze({ play: 32, chip: 24, name: 18, dot: 8 });
// Static dust motes as design-box fractions: [x, y, radius, alpha] (mockup a-tokens.css .dust).
const DUST = Object.freeze([
  [0.12, 0.22, 1, 0.35], [0.24, 0.41, 1, 0.25], [0.19, 0.63, 1.5, 0.3], [0.31, 0.15, 1, 0.2],
  [0.09, 0.52, 1, 0.22], [0.36, 0.55, 1.5, 0.18], [0.62, 0.33, 1, 0.2], [0.78, 0.58, 1, 0.22],
  [0.86, 0.24, 1.5, 0.18],
]);

const rect = (x, y, width, height) => ({ x, y, width, height });
const centerOf = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// Offscreen canvas at 1 design px per pixel; null without a DOM (unit tests), where glows are skipped.
function createSprite(width, height) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext?.("2d");
  return ctx ? { canvas, ctx, width: canvas.width, height: canvas.height } : null;
}

// Design-box geometry for one view: "solo" (VS BOT, one stage) or "friend" (VS FRIEND, two stages).
// Pure, so the touch rules can be checked in a unit test.
export function buildMenuLayout(view) {
  const friend = view === "friend";
  const sound = rect(TAP.x1 - HIT.min, TAP.y0, HIT.min, HIT.min); // 799..847 x 30..78
  const wordmark = { x: TAP.x0, y: TAP.y0 + HIT.min / 2 }; // centred on the sound button row
  const playY = TAP.y1 - HIT.primary; // 309..373
  const cells = (seg) => MODE_ORDER.map((key, index) => ({
    key,
    rect: rect(seg.x + (index * seg.width) / MODE_ORDER.length, seg.y, seg.width / MODE_ORDER.length, seg.height),
  }));
  const chipRow = (x, y, width, height, gap, mini) => PLAYER_CHARACTER_ROSTER.map((character, index) => ({
    key: character.key,
    rect: rect(x + index * (width + gap), y, width, height),
    mini,
  }));

  if (!friend) {
    const play = rect(TAP.x1 - COLUMN_W, playY, COLUMN_W, HIT.primary); // 403..847
    const chipsY = play.y - SPACE.s5 - CHIP_H; // 167..285
    const seg = rect(play.x, chipsY - SPACE.s5 - HIT.secondary, COLUMN_W, HIT.secondary); // 95..143
    const feetY = 322;
    const nameY = feetY + 26; // name row 324..372, chevrons centred on it
    const stage = {
      slot: "p1",
      team: null,
      facing: 1,
      centerX: SOLO_STAGE_W / 2,
      feetY,
      rigHeight: 202,
      cone: { width: 300, top: -40, bottom: 400, open: 0.38 },
      glow: { width: 230, height: 44 },
      tagY: null,
      nameY,
      chevrons: {
        prev: rect(TAP.x0, nameY - HIT.min / 2, HIT.min, HIT.min), // 44..92
        next: rect(SOLO_STAGE_W - SPACE.s2 - HIT.min, nameY - HIT.min / 2, HIT.min, HIT.min), // 304..352
      },
      dotsY: nameY + 27,
      chips: chipRow(play.x, chipsY, CHIP_W, CHIP_H, SPACE.s3, false),
      swipe: rect(0, 0, SOLO_STAGE_W, DESIGN_BOX.height),
    };
    return { view, sound, wordmark, play, seg: { rect: seg, stacked: false, cells: cells(seg) }, stages: [stage], rigHeight: stage.rigHeight };
  }

  const play = rect(Math.round(CENTER_X - 120), playY, 240, HIT.primary); // 326..566
  const seg = rect(Math.round(CENTER_X - 150), TAP.y0, 300, HIT.secondary); // 296..596 x 30..78
  const feetY = 246;
  const rigHeight = 158;
  const chipsY = play.y + (HIT.primary - MINI_CHIP) / 2; // 313..369, centred on PLAY
  const stages = [
    { slot: "p1", team: 0, facing: 1, x: TAP.x0 }, // column 44..292, centre 168
    { slot: "p2", team: 1, facing: -1, x: TAP.x1 - FRIEND_STAGE_W }, // column 599..847, centre 723
  ].map((side) => ({
    ...side,
    centerX: side.x + FRIEND_STAGE_W / 2,
    feetY,
    rigHeight,
    cone: { width: 220, top: -40, bottom: 260, open: 0.4 },
    glow: { width: 200, height: 40 },
    tagY: feetY + 13,
    nameY: feetY + 39,
    chevrons: null,
    dotsY: null,
    chips: chipRow(side.x, chipsY, MINI_CHIP, MINI_CHIP, SPACE.s2, true),
    swipe: side.slot === "p1"
      ? rect(0, 0, side.x + FRIEND_STAGE_W + SPACE.s2, DESIGN_BOX.height)
      : rect(side.x - SPACE.s2, 0, DESIGN_BOX.width - side.x + SPACE.s2, DESIGN_BOX.height),
  }));
  // No wordmark in VS FRIEND: the P1 rig stands right under it and the headband ribbons of Ninja
  // and Vector reach up through the text (the WebGL canvas draws over the 2D canvas).
  return { view, sound, wordmark: null, play, seg: { rect: seg, stacked: true, cells: cells(seg) }, stages, rigHeight };
}

// One frame of the MOTION.revealMs switch flicker: hero dips to 0.45, name to 0.6, an accent
// ring grows from the feet and fades. elapsedMs >= totalMs (or anything invalid) is idle.
export function revealFrame(elapsedMs, totalMs = MOTION.revealMs) {
  const t = Number(elapsedMs);
  if (!(t >= 0) || t >= totalMs) {
    return { active: false, heroAlpha: 1, nameAlpha: 1, ringScale: 1, ringAlpha: 0 };
  }
  const p = t / totalMs;
  const dip = Math.sin(Math.PI * p);
  return {
    active: true,
    heroAlpha: 1 - 0.55 * dip,
    nameAlpha: 1 - 0.4 * dip,
    ringScale: 1 - (1 - p) ** 2,
    ringAlpha: 0.6 * (1 - p),
  };
}

// Caps labels: ctx.letterSpacing also trails the last glyph, so centred text shifts half a step.
function fillCaps(ctx, text, x, y, spacingPx) {
  const supported = "letterSpacing" in ctx;
  if (supported) {
    ctx.letterSpacing = `${spacingPx}px`;
  }
  ctx.fillText(text, ctx.textAlign === "center" ? x + spacingPx / 2 : x, y);
  if (supported) {
    ctx.letterSpacing = "0px";
  }
}

// Width of a tracked caps label including the trailing step.
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
  return supported ? width : width + spacingPx * text.length;
}

// Hero disc: body colour, hairline border, darker crescent along the bottom (mockup inset shadow).
function drawDisc(ctx, cx, cy, radius, color, shade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.moveTo(cx + radius, cy - shade);
  ctx.arc(cx, cy - shade, radius, 0, TAU);
  ctx.fillStyle = withAlpha(COLORS.bg, 0.25);
  ctx.fill("evenodd");
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.line;
  ctx.stroke();
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

export class MenuScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.transform = designBoxTransform(this.width, this.height);
    this.layoutBox = null;
    this.controls = [];
    this.pressAnim = new Map();
    // Per pointer id, so two fingers (P1 and P2 picking at once) never drop each other's tap.
    this.presses = new Map(); // id -> control being held
    this.swipes = new Map(); // id -> { slot, startX, fired }
    this.glows = new Map(); // content key -> glow sprite (see drawGlow)
    this.settings = loadSettings();
    this.selectedCharacterKey = loadSelectedPlayerCharacterKey();
    this.selectedPlayer2CharacterKey = loadSelectedPlayer2CharacterKey(this.selectedCharacterKey);
    this.selectedMatchModeKey = loadSelectedVersusMatchModeKey();
    // Elapsed ms of each stage's switch flicker; MOTION.revealMs means idle.
    this.revealMs = { p1: MOTION.revealMs, p2: MOTION.revealMs };
    this.keyBound = false;
    this.activeGame = null;
    this.onKeyDown = (event) => {
      const code = event?.code;
      if (code === "KeyQ") {
        this.shiftMatchMode(-1);
      } else if (code === "KeyE") {
        this.shiftMatchMode(1);
      } else if (code === "ArrowLeft" || code === "KeyA") {
        this.shiftSelection(-1);
      } else if (code === "ArrowRight" || code === "KeyD") {
        this.shiftSelection(1);
      } else if (code === "Enter" || code === "Space") {
        this.startSelectedCharacter(this.activeGame);
      } else if (/^Digit[1-6]$/.test(code || "")) {
        const index = Number(code.slice(-1)) - 1;
        this.setSelectedCharacter(getPlayerCharacterByIndex(index)?.key);
      } else {
        return;
      }

      if (event?.cancelable) {
        event.preventDefault();
      }
    };
  }

  onEnter(game, transition) {
    this.activeGame = game;
    this.settings = loadSettings();
    const payload = transition?.payload ?? transition ?? {};
    this.selectedCharacterKey = getPlayerCharacterByKey(
      payload?.playerCharacterKey ?? game?.sceneData?.playerCharacterKey ?? loadSelectedPlayerCharacterKey()
    ).key;
    // The match writes player2CharacterKey to sceneData for bot matches too (it falls back to
    // P1's key there), so only a human-vs-human hand-back is trusted over the saved P2 pick.
    const incomingMode = payload?.matchMode ?? game?.sceneData?.matchMode;
    const sceneP2Key = incomingMode && !isVersusBotMatchMode(incomingMode) ? game?.sceneData?.player2CharacterKey : undefined;
    this.selectedPlayer2CharacterKey = getPlayerCharacterByKey(
      payload?.player2CharacterKey ?? sceneP2Key ?? loadSelectedPlayer2CharacterKey(this.selectedCharacterKey)
    ).key;
    this.selectedMatchModeKey = getVersusMatchMode(
      payload?.matchMode ?? game?.sceneData?.matchMode ?? loadSelectedVersusMatchModeKey()
    ).key;
    this.revealMs = { p1: MOTION.revealMs, p2: MOTION.revealMs };
    this.pressAnim.clear();
    this.presses.clear();
    this.swipes.clear();
    this.layout();
    heroLayer.setLightPreset("menu");
    this.onResize(asNumber(game?.viewWidth, this.width), asNumber(game?.viewHeight, this.height), game);

    if (!this.keyBound && typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKeyDown);
      this.keyBound = true;
    }
  }

  onExit() {
    heroLayer.clear();
    heroLayer.setLightPreset("match");
    this.presses.clear();
    this.swipes.clear();
    this.activeGame = null;
    for (const state of this.pressAnim.values()) {
      state.pressed = false;
    }
    if (this.keyBound && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDown);
      this.keyBound = false;
    }
  }

  onResize(width, height) {
    this.width = Math.max(1, asNumber(width, 1));
    this.height = Math.max(1, asNumber(height, 1));
    this.transform = designBoxTransform(this.width, this.height);
  }

  // Rebuilds the design-box geometry and the tap targets for the current mode.
  layout() {
    const box = buildMenuLayout(isVersusBotMatchMode(this.selectedMatchModeKey) ? "solo" : "friend");
    const controls = [
      { id: "sound", rect: box.sound, onPress: () => this.toggleSound() },
      ...box.seg.cells.map((cell) => ({
        id: `mode:${cell.key}`,
        rect: cell.rect,
        onPress: () => this.setSelectedMatchMode(cell.key),
      })),
      { id: "play", rect: box.play, onPress: () => this.startSelectedCharacter(this.activeGame) },
    ];
    for (const stage of box.stages) {
      for (const chip of stage.chips) {
        controls.push({
          id: `chip:${stage.slot}:${chip.key}`,
          rect: chip.rect,
          onPress: () => this.setSelectedFighter(stage.slot, chip.key),
        });
      }
      if (stage.chevrons) {
        controls.push(
          { id: "prev", rect: stage.chevrons.prev, onPress: () => this.shiftSelection(-1, stage.slot) },
          { id: "next", rect: stage.chevrons.next, onPress: () => this.shiftSelection(1, stage.slot) },
        );
      }
    }
    this.layoutBox = box;
    this.controls = controls;
  }

  update(dt) {
    const ms = Math.max(0, Number(dt) || 0) * 1000;
    for (const slot of Object.keys(this.revealMs)) {
      this.revealMs[slot] = Math.min(MOTION.revealMs, this.revealMs[slot] + ms);
    }
    // Press feedback: full pressScale while held and for pressMs after the touch, then ease back.
    for (const state of this.pressAnim.values()) {
      state.holdMs = Math.max(0, state.holdMs - ms);
      state.pressT = state.pressed || state.holdMs > 0 ? 1 : Math.max(0, state.pressT - ms / MOTION.releaseMs);
    }
  }

  render(ctx, _alpha, game) {
    if (!this.layoutBox) {
      this.layout();
    }
    const box = this.layoutBox;
    const { scale, offsetX, offsetY } = this.transform;
    const heroesLive = heroLayer.isAvailable();

    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.textBaseline = "middle";

    this.drawAtmosphere(ctx, box);
    for (const stage of box.stages) {
      this.drawStage(ctx, stage, heroesLive);
    }
    if (box.wordmark) {
      this.drawWordmark(ctx, box.wordmark);
    }
    this.drawRoundButton(ctx, "sound", box.sound, (cx, cy) => this.drawSpeaker(ctx, cx, cy));
    this.drawSegmented(ctx, box.seg);
    this.drawPlay(ctx, box.play);
    this.drawVignette(ctx);
    ctx.restore();

    if (heroesLive) {
      heroLayer.safeRender({
        width: this.width,
        height: this.height,
        dpr: Number(game?.dpr) || 1,
        unitPx: (box.rigHeight * scale) / HERO_RIG_HEIGHT_UNITS,
        nowMs: nowMs(),
        actors: box.stages.map((stage) => this.heroActor(stage)),
      });
    }
  }

  heroActor(stage) {
    const { scale, offsetX, offsetY } = this.transform;
    const team = stage.team === null ? null : TEAM_COLORS[stage.team];
    return {
      slot: `menu-${stage.slot}`,
      heroId: this.fighterFor(stage.slot),
      x: offsetX + stage.centerX * scale,
      y: offsetY + stage.feetY * scale,
      facing: stage.facing,
      vx: 0,
      vy: 0,
      onGround: true,
      visible: true,
      lastShotAtMs: Number.NEGATIVE_INFINITY,
      hitFlash: 0,
      // Friend: team rim light. Solo: a faint accent rim stands in for the mockup's mint side fill.
      rimColor: team ? team.main : COLORS.accent,
      rimIntensity: team ? 6 : 2.5,
      spot: true,
      // The layer has no alpha; dimming the rig on black reads as the mockup's 0.45 opacity dip.
      dim: revealFrame(this.revealMs[stage.slot]).heroAlpha,
    };
  }

  drawAtmosphere(ctx, box) {
    // Faint structure-hue stage light so the black has value (mockup .stage-light).
    fillEllipseGradient(ctx, DESIGN_BOX.width * 0.5, DESIGN_BOX.height * 0.4, DESIGN_BOX.width * 0.6, DESIGN_BOX.height * 0.7, [
      [0, withAlpha(COLORS.structure, 0.08)],
      [0.7, withAlpha(COLORS.structure, 0)],
    ]);
    for (const stage of box.stages) {
      const { cone, glow } = stage;
      const x0 = stage.centerX - cone.width / 2;
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
      light.addColorStop(0.9, withAlpha(COLORS.impact, 0));
      ctx.fillStyle = light;
      ctx.fillRect(x0, cone.top, cone.width, cone.bottom - cone.top);
      ctx.restore();

      const team = stage.team === null ? null : TEAM_COLORS[stage.team];
      fillEllipseGradient(ctx, stage.centerX, stage.feetY, glow.width / 2, glow.height / 2, [
        [0, team ? team.glow : COLORS.accentGlow],
        [0.7, withAlpha(team ? team.main : COLORS.accent, 0)],
      ]);
    }
    for (const [fx, fy, radius, alpha] of DUST) {
      ctx.beginPath();
      ctx.arc(fx * DESIGN_BOX.width, fy * DESIGN_BOX.height, radius, 0, TAU);
      ctx.fillStyle = withAlpha(COLORS.impact, alpha);
      ctx.fill();
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

  drawStage(ctx, stage, heroesLive) {
    const key = this.fighterFor(stage.slot);
    const character = getPlayerCharacterByKey(key);
    const team = stage.team === null ? null : TEAM_COLORS[stage.team];
    const frame = revealFrame(this.revealMs[stage.slot]);

    if (!heroesLive) {
      // No WebGL: a big hero disc stands where the rig would be.
      const radius = stage.rigHeight * 0.3;
      ctx.save();
      ctx.globalAlpha = frame.heroAlpha;
      drawDisc(ctx, stage.centerX, stage.feetY - stage.rigHeight * 0.55, radius, character.bodyTop, radius * 0.35);
      ctx.restore();
    }

    if (frame.active) {
      ctx.save();
      ctx.globalAlpha = frame.ringAlpha;
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.accentGlow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(stage.centerX, stage.feetY, (RING_W / 2) * frame.ringScale, (RING_H / 2) * frame.ringScale, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = "center";
    if (team) {
      ctx.font = textFont(TYPE.t2, 700);
      ctx.fillStyle = team.main;
      fillCaps(ctx, getVersusMatchMode(this.selectedMatchModeKey)[stage.slot === "p1" ? "p1Label" : "p2Label"], stage.centerX, stage.tagY, trackingPx(TYPE.t2));
    }
    ctx.globalAlpha = frame.nameAlpha;
    const name = character.name.toUpperCase();
    const nameFont = displayFont(TYPE.d1);
    const nameTrack = trackingPx(TYPE.d1);
    const nameGlow = team ? team.glow : COLORS.accentGlow;
    const nameW = measureCaps(ctx, nameFont, name, nameTrack);
    const nameH = TYPE.d1 * 1.5;
    this.drawGlow(ctx, `name:${name}:${nameGlow}`, stage.centerX - nameW / 2, stage.nameY - nameH / 2, nameW, nameH, GLOW.name, nameGlow, (s) => {
      s.font = nameFont;
      s.textAlign = "center";
      s.textBaseline = "middle";
      fillCaps(s, name, nameW / 2, nameH / 2, nameTrack);
    });
    ctx.font = nameFont;
    ctx.fillStyle = COLORS.text;
    fillCaps(ctx, name, stage.centerX, stage.nameY, nameTrack);
    ctx.restore();

    if (stage.chevrons) {
      this.drawRoundButton(ctx, "prev", stage.chevrons.prev, (cx, cy) => this.drawChevron(ctx, cx, cy, -1));
      this.drawRoundButton(ctx, "next", stage.chevrons.next, (cx, cy) => this.drawChevron(ctx, cx, cy, 1));
    }
    if (stage.dotsY !== null) {
      const selectedIndex = getPlayerCharacterIndexByKey(key);
      const step = DOT_R * 2 + SPACE.s2;
      const x0 = stage.centerX - ((PLAYER_CHARACTER_ROSTER.length - 1) * step) / 2;
      for (let index = 0; index < PLAYER_CHARACTER_ROSTER.length; index += 1) {
        const selected = index === selectedIndex;
        const x = x0 + index * step;
        if (selected) {
          this.drawGlow(ctx, "dot", x - DOT_R, stage.dotsY - DOT_R, DOT_R * 2, DOT_R * 2, GLOW.dot, COLORS.accent, (s) => {
            s.beginPath();
            s.arc(DOT_R, DOT_R, DOT_R, 0, TAU);
            s.fill();
          });
        }
        ctx.beginPath();
        ctx.arc(x, stage.dotsY, DOT_R, 0, TAU);
        ctx.fillStyle = selected ? COLORS.accent : COLORS.lineStrong;
        ctx.fill();
      }
    }
    for (const chip of stage.chips) {
      this.drawChip(ctx, stage, chip, chip.key === key);
    }
  }

  drawChip(ctx, stage, chip, selected) {
    const r = chip.rect;
    const character = getPlayerCharacterByKey(chip.key);
    const { x: cx } = centerOf(r);
    const radius = chip.mini ? RADII.control : RADII.panel;
    ctx.save();
    const pressed = this.applyPress(ctx, `chip:${stage.slot}:${chip.key}`, r) > 0;
    if (selected) {
      this.drawGlow(ctx, `chip:${r.width}x${r.height}`, r.x, r.y, r.width, r.height, GLOW.chip, withAlpha(COLORS.accent, 0.18), (s) => {
        roundedRectPath(s, 0, 0, r.width, r.height, radius);
        s.fill();
      });
    }
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, radius);
    ctx.fillStyle = selected ? withAlpha(COLORS.accent, 0.08) : COLORS.surface;
    ctx.fill();
    if (selected) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = withAlpha(COLORS.accent, 0.4);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = selected ? COLORS.accent : pressed ? COLORS.lineStrong : COLORS.line;
    ctx.stroke();

    if (chip.mini) {
      drawDisc(ctx, cx, r.y + r.height / 2, MINI_DISC / 2, character.bodyTop, 5);
    } else {
      // Disc + 12 gap + 12 px name = 70 of 118, so the group starts 24 down.
      drawDisc(ctx, cx, r.y + SPACE.s5 + CHIP_DISC / 2, CHIP_DISC / 2, character.bodyTop, 8);
      ctx.font = textFont(TYPE.t2, selected ? 700 : 600);
      ctx.fillStyle = selected ? COLORS.text : COLORS.muted;
      ctx.textAlign = "center";
      fillCaps(ctx, character.name.toUpperCase(), cx, r.y + SPACE.s5 + CHIP_DISC + SPACE.s3 + TYPE.t2 / 2, trackingPx(TYPE.t2));
    }
    ctx.restore();
  }

  drawSegmented(ctx, seg) {
    const r = seg.rect;
    ctx.save();
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.line;
    ctx.stroke();
    ctx.clip();

    const labelTrack = trackingPx(TYPE.t1);
    const subTrack = trackingPx(TYPE.t2);
    for (const cell of seg.cells) {
      const mode = getVersusMatchMode(cell.key);
      const on = cell.key === this.selectedMatchModeKey;
      const c = cell.rect;
      const { x: cx, y: cy } = centerOf(c);
      const label = mode.name.toUpperCase();
      const sub = mode.subLabel.toUpperCase();
      const labelFont = textFont(TYPE.t1, on ? 700 : 600);
      const subFont = textFont(TYPE.t2, 700);

      ctx.save();
      this.applyPress(ctx, `mode:${cell.key}`, c);
      if (on) {
        ctx.fillStyle = withAlpha(COLORS.accent, 0.12);
        ctx.fillRect(c.x, c.y, c.width, c.height);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(c.x, c.y + c.height - 2, c.width, 2);
      }
      if (seg.stacked) {
        // 16 + 4 + 12 = 32 of 48: label centred 16 down, sub-label 34 down.
        ctx.textAlign = "center";
        ctx.font = labelFont;
        ctx.fillStyle = on ? COLORS.text : COLORS.muted;
        fillCaps(ctx, label, cx, c.y + SPACE.s2 + TYPE.t1 / 2, labelTrack);
        ctx.font = subFont;
        ctx.fillStyle = COLORS.muted;
        fillCaps(ctx, sub, cx, c.y + SPACE.s2 + TYPE.t1 + SPACE.s1 + TYPE.t2 / 2, subTrack);
      } else {
        const labelWidth = measureCaps(ctx, labelFont, label, labelTrack) - labelTrack;
        const subWidth = measureCaps(ctx, subFont, sub, subTrack) - subTrack;
        let x = cx - (labelWidth + SPACE.s2 + subWidth) / 2;
        ctx.textAlign = "left";
        ctx.font = labelFont;
        ctx.fillStyle = on ? COLORS.text : COLORS.muted;
        fillCaps(ctx, label, x, cy, labelTrack);
        x += labelWidth + SPACE.s2;
        ctx.font = subFont;
        ctx.fillStyle = COLORS.muted;
        fillCaps(ctx, sub, x, cy, subTrack);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawPlay(ctx, r) {
    const { x: cx } = centerOf(r);
    ctx.save();
    this.applyPress(ctx, "play", r);
    this.drawGlow(ctx, `play:${r.width}x${r.height}`, r.x, r.y, r.width, r.height, GLOW.play, COLORS.accentGlow, (s) => {
      roundedRectPath(s, 0, 0, r.width, r.height, RADII.control);
      s.fill();
    });
    // 6 px darker base under the face (mockup box-shadow 0 6px 0).
    roundedRectPath(ctx, r.x, r.y + 6, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.fillStyle = withAlpha(COLORS.accentInk, 0.3);
    ctx.fill();
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();

    // Two lines: 24 + 4 + 12 = 40 of 64, so the block starts 12 down.
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accentInk;
    ctx.font = displayFont(TYPE.d2);
    fillCaps(ctx, "PLAY", cx, r.y + SPACE.s3 + TYPE.d2 / 2, TYPE.d2 * PLAY_TRACK_EM);
    ctx.globalAlpha = 0.75;
    ctx.font = textFont(TYPE.t2, 700);
    fillCaps(ctx, "FIRST TO 5 KILLS", cx, r.y + SPACE.s3 + TYPE.d2 + SPACE.s1 + TYPE.t2 / 2, trackingPx(TYPE.t2));
    ctx.restore();
  }

  drawWordmark(ctx, wordmark) {
    const spacing = TYPE.t2 * WORDMARK_TRACK_EM;
    ctx.save();
    ctx.textAlign = "left";
    const font = displayFont(TYPE.t2);
    const lead = "BULLET DODGE ";
    const leadWidth = measureCaps(ctx, font, lead, spacing);
    ctx.font = font;
    ctx.fillStyle = COLORS.muted;
    fillCaps(ctx, lead, wordmark.x, wordmark.y, spacing);
    ctx.fillStyle = COLORS.text;
    fillCaps(ctx, "ARENA", wordmark.x + leadWidth, wordmark.y, spacing);
    ctx.restore();
  }

  // 48 px circle button (sound, chevrons); the glyph callback draws in the circle's centre.
  drawRoundButton(ctx, id, r, drawGlyph) {
    const { x: cx, y: cy } = centerOf(r);
    ctx.save();
    const pressed = this.applyPress(ctx, id, r) > 0;
    ctx.beginPath();
    ctx.arc(cx, cy, r.width / 2, 0, TAU);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = pressed ? 2 : 1;
    ctx.strokeStyle = pressed ? COLORS.accent : COLORS.lineStrong;
    ctx.stroke();
    ctx.strokeStyle = COLORS.text;
    ctx.fillStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawGlyph(cx, cy);
    ctx.restore();
  }

  drawChevron(ctx, cx, cy, direction) {
    ctx.beginPath();
    ctx.moveTo(cx - direction * 3.5, cy - 7);
    ctx.lineTo(cx + direction * 3.5, cy);
    ctx.lineTo(cx - direction * 3.5, cy + 7);
    ctx.stroke();
  }

  // Speaker: body + cone, two sound waves when on, a strike-through when off.
  drawSpeaker(ctx, cx, cy) {
    const on = Boolean(this.settings.soundEnabled || this.settings.musicEnabled);
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 4);
    ctx.lineTo(cx - 5, cy - 4);
    ctx.lineTo(cx + 1, cy - 9);
    ctx.lineTo(cx + 1, cy + 9);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.lineTo(cx - 10, cy + 4);
    ctx.closePath();
    ctx.fill();
    if (on) {
      ctx.beginPath();
      ctx.arc(cx + 1, cy, 6, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 1, cy, 10, -0.9, 0.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 10);
      ctx.lineTo(cx + 10, cy + 10);
      ctx.stroke();
    }
  }

  // Soft glow under a shape at (x, y, width, height) in design px. shadowBlur costs an offscreen
  // blur pass, so each glow is rendered once into a sprite keyed by content and blitted after
  // that. The sprite holds only the shadow: `paint` draws the shape (origin at its top left;
  // only its alpha matters) one canvas width to the right, and the shadow is offset back in.
  drawGlow(ctx, key, x, y, width, height, blur, color, paint) {
    const pad = Math.ceil(blur * 1.5); // the blur tail reaches about 1.5 x the radius
    let sprite = this.glows.get(key);
    if (sprite === undefined) {
      sprite = createSprite(width + pad * 2, height + pad * 2);
      if (sprite) {
        const s = sprite.ctx;
        s.shadowColor = color;
        s.shadowBlur = blur;
        s.shadowOffsetX = -sprite.width;
        s.translate(sprite.width + pad, pad);
        paint(s);
      }
      this.glows.set(key, sprite);
    }
    if (sprite) {
      ctx.drawImage(sprite.canvas, x - pad, y - pad, sprite.width, sprite.height);
    }
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
    if (!point || !this.layoutBox) {
      return false;
    }
    const p = this.toDesign(point);
    this.releasePointer(p.id); // a down for an id still held (its up was lost) releases it first
    const control = this.controls.find((candidate) => rectContains(candidate.rect, p));
    if (control) {
      // One finger per control: a second finger on the same button neither re-presses nor re-fires it.
      if (![...this.presses.values()].includes(control)) {
        this.presses.set(p.id, control);
        this.setPressed(control, true);
      }
      return true;
    }
    const stage = this.layoutBox.stages.find((candidate) => rectContains(candidate.swipe, p));
    if (stage) {
      this.swipes.set(p.id, { slot: stage.slot, startX: p.x, fired: false });
      return true;
    }
    return false;
  }

  handlePointerMove(pointer) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }
    const p = this.toDesign(point);
    const swipe = this.swipes.get(p.id);
    if (swipe) {
      const dx = p.x - swipe.startX;
      if (!swipe.fired && Math.abs(dx) > SWIPE_PX) {
        swipe.fired = true;
        this.shiftSelection(dx < 0 ? 1 : -1, swipe.slot);
      }
      return true;
    }
    const control = this.presses.get(p.id);
    if (control) {
      this.setPressed(control, rectContains(control.rect, p));
      return true;
    }
    return false;
  }

  handlePointerUp(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }
    const p = this.toDesign(point);
    const hadSwipe = this.swipes.has(p.id);
    const control = this.releasePointer(p.id);
    if (control && rectContains(control.rect, p)) {
      this.pressControl(control, game ?? this.activeGame);
    }
    return hadSwipe || Boolean(control);
  }

  handlePointerCancel() {
    const hadWork = this.presses.size > 0 || this.swipes.size > 0;
    for (const id of [...this.presses.keys(), ...this.swipes.keys()]) {
      this.releasePointer(id);
    }
    return hadWork;
  }

  // Forgets one pointer's press (un-pressing its control) and swipe; returns the control it held.
  releasePointer(id) {
    const control = this.presses.get(id) ?? null;
    if (control) {
      this.presses.delete(id);
      this.setPressed(control, false);
    }
    this.swipes.delete(id);
    return control;
  }

  pressControl(control, game) {
    // PLAY emits its own start_game click in startSelectedCharacter (keyboard Enter uses it too).
    if (control.id !== "play") {
      game?.eventBus?.emit?.("ui_click", { source: control.id });
    }
    control.onPress();
  }

  toggleSound() {
    // One switch for both: on if either was off, otherwise both off.
    const on = !(this.settings.soundEnabled && this.settings.musicEnabled);
    this.settings = saveSettings({ soundEnabled: on, musicEnabled: on });
    this.activeGame?.audioManager?.setEnabled?.(on);
    this.activeGame?.musicManager?.setEnabled?.(on);
  }

  fighterFor(slot) {
    return slot === "p2" ? this.selectedPlayer2CharacterKey : this.selectedCharacterKey;
  }

  startSelectedCharacter(game) {
    const targetGame = game ?? this.activeGame;
    if (!targetGame) {
      return;
    }

    const selectedKey = saveSelectedPlayerCharacterKey(this.selectedCharacterKey);
    const selectedMatchModeKey = saveSelectedVersusMatchModeKey(this.selectedMatchModeKey);
    const picks = {
      playerCharacterKey: selectedKey,
      matchMode: selectedMatchModeKey,
    };
    if (!isVersusBotMatchMode(selectedMatchModeKey)) {
      picks.player2CharacterKey = saveSelectedPlayer2CharacterKey(this.selectedPlayer2CharacterKey);
    }
    targetGame.sceneData = { ...targetGame.sceneData, ...picks };
    targetGame.eventBus?.emit?.("ui_click", {
      source: "start_game",
      key: selectedKey,
      matchMode: selectedMatchModeKey,
    });
    targetGame.switchScene("versus", { restart: true, ...picks });
  }

  shiftMatchMode(direction) {
    this.setSelectedMatchMode(cycleVersusMatchModeKey(this.selectedMatchModeKey, direction));
  }

  shiftSelection(direction, slot = "p1") {
    this.setSelectedFighter(slot, cyclePlayerCharacterKey(this.fighterFor(slot), direction));
  }

  setSelectedCharacter(key) {
    this.setSelectedFighter("p1", key);
  }

  // A changed pick starts that stage's reveal flicker.
  setSelectedFighter(slot, key) {
    const next = getPlayerCharacterByKey(key).key;
    if (next === this.fighterFor(slot)) {
      return;
    }
    if (slot === "p2") {
      this.selectedPlayer2CharacterKey = next;
    } else {
      this.selectedCharacterKey = next;
    }
    this.revealMs[slot] = 0;
  }

  setSelectedMatchMode(key) {
    const next = getVersusMatchMode(key).key;
    if (next === this.selectedMatchModeKey) {
      return;
    }
    this.selectedMatchModeKey = next;
    this.layout();
  }
}
