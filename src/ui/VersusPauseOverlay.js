// Pause screen of the versus match, direction A "Blackout Arena": the paused frame is recoloured,
// not covered, and PAUSED, RESUME, QUIT TO MENU and the two audio toggles sit over it. Geometry
// lives in the 891 x 411 design box (tokens.js DESIGN_BOX) and is scaled uniformly to the
// viewport; the approved mockup is harness/evidence/T-13/mockups/a-pause.html (+ .jpg).
// The overlay owns layout, per-pointer presses and drawing; what a tap means is the scene's job.
import {
  COLORS,
  DESIGN_BOX,
  HIT,
  MOTION,
  RADII,
  SPACE,
  TYPE,
  designBoxTransform,
  displayFont,
  textFont,
  trackingPx,
  withAlpha,
} from "../theme/tokens.js";
import { normalizePointerInput, roundedRectPath } from "./uiUtils.js";

const TAU = Math.PI * 2;

// Tap zone: the safe insets plus 16 px -> x 44..847, y 30..373.
export const PAUSE_TAP = Object.freeze({
  x0: SPACE.insetX + SPACE.s4,
  x1: DESIGN_BOX.width - SPACE.insetX - SPACE.s4,
  y0: SPACE.insetTop + SPACE.s4,
  y1: DESIGN_BOX.height - SPACE.insetBottom - SPACE.s4,
});
const CENTER_X = 445;
const TITLE_Y = 118;
// The button stack: 320 wide at x 286 (mockup: (891 - 320) / 2 rounded up).
const BUTTON_X = 286;
const BUTTON_W = 320;
const RESUME_Y = 176;
const QUIT_Y = 256;
const TOGGLE_W = 150;
const TOGGLE_Y = 320;
const DOT_R = 5;
const RESUME_TRACK_EM = 0.22;
// Recolour of the paused frame, arena and HUD alike: 55 percent black plus a 6 percent accent tint.
const DIM = withAlpha(COLORS.bg, 0.55);
const TINT = withAlpha(COLORS.accent, 0.06);
const RESUME_BASE_SHADE = withAlpha(COLORS.accentInk, 0.3);
// The WebGL rigs darken to this (hero entry.dim) so they sit in the recoloured frame.
export const PAUSE_HERO_DIM = 0.35;
// Blur radii of the static glows (mockup text-shadow / box-shadow); see drawGlow.
const GLOW = Object.freeze({ title: 18, resume: 32, dot: 8 });

const rect = (x, y, width, height) => ({ x, y, width, height });
const centerOf = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const contains = (r, p) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

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

// Design-box geometry of the pause screen. Pure, so the touch rules can be checked in a unit test.
// Each toggle is a 40 px chip whose hit area reaches 4 px above and below it (48 px tall).
export function buildPauseLayout() {
  const resume = rect(BUTTON_X, RESUME_Y, BUTTON_W, HIT.primary); // 286..606 x 176..240
  const quit = rect(BUTTON_X, QUIT_Y, BUTTON_W, HIT.secondary); // 286..606 x 256..304
  const pad = (HIT.min - HIT.compact) / 2;
  const toggle = (x) => ({
    rect: rect(x, TOGGLE_Y, TOGGLE_W, HIT.compact), // y 320..360
    hit: rect(x, TOGGLE_Y - pad, TOGGLE_W, HIT.min), // y 316..364
  });
  const sfxX = CENTER_X - (TOGGLE_W * 2 + HIT.gap) / 2; // 291
  return {
    title: { x: CENTER_X, y: TITLE_Y },
    resume,
    quit,
    sfx: toggle(sfxX), // 291..441
    music: toggle(sfxX + TOGGLE_W + HIT.gap), // 449..599
  };
}

export class VersusPauseOverlay {
  constructor() {
    this.layout = buildPauseLayout();
    const { resume, quit, sfx, music } = this.layout;
    // `rect` is what is drawn, `hit` what takes the tap.
    this.controls = [
      { id: "resume", rect: resume, hit: resume },
      { id: "quit", rect: quit, hit: quit },
      { id: "sfx", rect: sfx.rect, hit: sfx.hit },
      { id: "music", rect: music.rect, hit: music.hit },
    ];
    this.pressAnim = new Map(); // control id -> { pressed, holdMs, pressT }
    this.presses = new Map(); // pointer id -> control being held
    this.glows = new Map(); // content key -> glow sprite (see drawGlow)
    this.fadeMs = MOTION.fadeMs; // elapsed fade-in; MOTION.fadeMs = fully shown
  }

  // Fade-in progress, 0..1.
  fadeAlpha() {
    return Math.min(1, this.fadeMs / MOTION.fadeMs);
  }

  // Press amount of a control, 0..1 (1 while held and for pressMs after the touch).
  pressAmount(id) {
    return this.pressAnim.get(id)?.pressT ?? 0;
  }

  show() {
    this.fadeMs = 0;
    this.presses.clear();
    this.pressAnim.clear();
  }

  hide() {
    for (const id of [...this.presses.keys()]) {
      this.releasePointer(id);
    }
  }

  update(dt) {
    const ms = Math.max(0, Number(dt) || 0) * 1000;
    this.fadeMs = Math.min(MOTION.fadeMs, this.fadeMs + ms);
    // Press feedback: full pressScale while held and for pressMs after the touch, then ease back.
    for (const state of this.pressAnim.values()) {
      state.holdMs = Math.max(0, state.holdMs - ms);
      state.pressT = state.pressed || state.holdMs > 0 ? 1 : Math.max(0, state.pressT - ms / MOTION.releaseMs);
    }
  }

  // toggles: { soundEnabled, musicEnabled }. Draws over the finished match frame.
  render(ctx, viewWidth, viewHeight, toggles) {
    const { scale, offsetX, offsetY } = designBoxTransform(viewWidth, viewHeight);
    ctx.save();
    ctx.globalAlpha = this.fadeAlpha();
    ctx.fillStyle = DIM;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.fillStyle = TINT;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    this.drawTitle(ctx, this.layout.title);
    this.drawPrimary(ctx, this.controls[0], "RESUME");
    this.drawSecondary(ctx, this.controls[1], "QUIT TO MENU");
    this.drawToggle(ctx, this.controls[2], "SFX", toggles?.soundEnabled !== false);
    this.drawToggle(ctx, this.controls[3], "MUSIC", toggles?.musicEnabled !== false);
    ctx.restore();
  }

  drawTitle(ctx, title) {
    const font = displayFont(TYPE.d1);
    const track = trackingPx(TYPE.d1);
    const w = BUTTON_W;
    const h = TYPE.d1 * 1.5;
    this.drawGlow(ctx, "title", title.x - w / 2, title.y - h / 2, w, h, GLOW.title, COLORS.accentGlow, (s) => {
      s.font = font;
      s.textAlign = "center";
      s.textBaseline = "middle";
      fillCaps(s, "PAUSED", w / 2, h / 2, track);
    });
    ctx.font = font;
    ctx.fillStyle = COLORS.text;
    fillCaps(ctx, "PAUSED", title.x, title.y, track);
  }

  // The one primary button: accent fill, pre-rendered glow, 6 px darker base, display caps in ink.
  drawPrimary(ctx, control, label) {
    const r = control.rect;
    const { x: cx, y: cy } = centerOf(r);
    ctx.save();
    this.applyPress(ctx, control.id, r);
    this.drawGlow(ctx, "resume", r.x, r.y, r.width, r.height, GLOW.resume, COLORS.accentGlow, (s) => {
      roundedRectPath(s, 0, 0, r.width, r.height, RADII.control);
      s.fill();
    });
    // 6 px darker base under the face (mockup box-shadow 0 6px 0).
    roundedRectPath(ctx, r.x, r.y + 6, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.fillStyle = RESUME_BASE_SHADE;
    ctx.fill();
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.font = displayFont(TYPE.d2);
    ctx.fillStyle = COLORS.accentInk;
    fillCaps(ctx, label, cx, cy, TYPE.d2 * RESUME_TRACK_EM);
    ctx.restore();
  }

  drawSecondary(ctx, control, label) {
    const r = control.rect;
    const { x: cx, y: cy } = centerOf(r);
    ctx.save();
    this.drawChip(ctx, control);
    ctx.font = textFont(TYPE.t1);
    ctx.fillStyle = COLORS.text;
    fillCaps(ctx, label, cx, cy, trackingPx(TYPE.t1));
    ctx.restore();
  }

  // Secondary chip with a 10 px dot: lit accent when on, dim when off; "SFX ON" / "SFX OFF".
  drawToggle(ctx, control, name, on) {
    const r = control.rect;
    const { x: cx, y: cy } = centerOf(r);
    const label = `${name} ${on ? "ON" : "OFF"}`;
    const font = textFont(TYPE.t1);
    const track = trackingPx(TYPE.t1);
    ctx.save();
    this.drawChip(ctx, control);
    // Dot, 8 px gap, label: centred as one group.
    const labelW = measureCaps(ctx, font, label, track);
    const x0 = cx - (DOT_R * 2 + SPACE.s2 + labelW) / 2;
    const dotX = x0 + DOT_R;
    if (on) {
      this.drawGlow(ctx, "dot", dotX - DOT_R, cy - DOT_R, DOT_R * 2, DOT_R * 2, GLOW.dot, COLORS.accentGlow, (s) => {
        s.beginPath();
        s.arc(DOT_R, DOT_R, DOT_R, 0, TAU);
        s.fill();
      });
    }
    ctx.beginPath();
    ctx.arc(dotX, cy, DOT_R, 0, TAU);
    ctx.fillStyle = on ? COLORS.accent : COLORS.dim;
    ctx.fill();
    ctx.font = font;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "left";
    fillCaps(ctx, label, x0 + DOT_R * 2 + SPACE.s2, cy, track);
    ctx.restore();
  }

  // Secondary body: surface fill, 1 px strong line; the accent line while pressed. Applies the press.
  drawChip(ctx, control) {
    const r = control.rect;
    const pressed = this.applyPress(ctx, control.id, r) > 0;
    roundedRectPath(ctx, r.x, r.y, r.width, r.height, RADII.control);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = pressed ? 2 : 1;
    ctx.strokeStyle = pressed ? COLORS.accent : COLORS.lineStrong;
    ctx.stroke();
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
    const pressT = this.pressAmount(id);
    if (pressT > 0) {
      const { x: cx, y: cy } = centerOf(r);
      const k = 1 - (1 - MOTION.pressScale) * pressT;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-cx, -cy);
    }
    return pressT;
  }

  setPressed(control, pressed) {
    let state = this.pressAnim.get(control.id);
    if (!state) {
      state = { pressed: false, holdMs: 0, pressT: 0 };
      this.pressAnim.set(control.id, state);
    }
    state.pressed = pressed;
    if (pressed) {
      state.holdMs = MOTION.pressMs;
    }
  }

  // Viewport CSS px -> design px, with the same transform the drawing uses.
  toDesign(pointer, viewWidth, viewHeight) {
    const point = normalizePointerInput(pointer);
    if (!point) {
      return null;
    }
    const { scale, offsetX, offsetY } = designBoxTransform(viewWidth, viewHeight);
    return { x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale, id: point.id };
  }

  handlePointerDown(pointer, viewWidth, viewHeight) {
    const p = this.toDesign(pointer, viewWidth, viewHeight);
    if (!p) {
      return false;
    }
    this.releasePointer(p.id); // a down for an id still held (its up was lost) releases it first
    const control = this.controls.find((candidate) => contains(candidate.hit, p));
    if (!control) {
      return false;
    }
    // One finger per control: a second finger on the same button neither re-presses nor re-fires it.
    if (![...this.presses.values()].includes(control)) {
      this.presses.set(p.id, control);
      this.setPressed(control, true);
    }
    return true;
  }

  handlePointerMove(pointer, viewWidth, viewHeight) {
    const p = this.toDesign(pointer, viewWidth, viewHeight);
    const control = p ? this.presses.get(p.id) : null;
    if (!control) {
      return false;
    }
    this.setPressed(control, contains(control.hit, p));
    return true;
  }

  // A tap fires on pointer-up inside the control the finger pressed: returns its id, else null.
  handlePointerUp(pointer, viewWidth, viewHeight) {
    const p = this.toDesign(pointer, viewWidth, viewHeight);
    const control = p ? this.releasePointer(p.id) : null;
    return control && contains(control.hit, p) ? control.id : null;
  }

  // Forgets that pointer's press without firing it; without an id, every press.
  handlePointerCancel(pointer) {
    const point = normalizePointerInput(pointer);
    const ids = point ? [point.id] : [...this.presses.keys()];
    return ids.map((id) => this.releasePointer(id)).some(Boolean);
  }

  // Forgets one pointer's press (un-pressing its control); returns the control it held.
  releasePointer(id) {
    const control = this.presses.get(id) ?? null;
    if (control) {
      this.presses.delete(id);
      this.setPressed(control, false);
    }
    return control;
  }
}
