import { Animator } from "../../rendering/Animator.js";
import { clamp } from "../../utils/math.js";
import { PLAYER_CHARACTER_FRAME_SIZE } from "../../theme/playerRoster.js";
import { COLORS, DESIGN_BOX, designBoxTransform, withAlpha } from "../../theme/tokens.js";

export const BULLET_SPEED = 760;
export const BULLET_LIFETIME_MS = 1500;
export const BULLET_OFFSCREEN_MARGIN = 90;
// Body box = hit area = collision box (BUG-038): the drawn rig's body, 21.6 x 45 design px.
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 84;
export const PLAYER_HEALTH = 100;
// Rig height in world px. 89.6 world px is 48 design px at the arena scale (0.54), the rig size
// of the arena v3 mockup, so four levels fit under the HUD band.
export const PLAYER_DRAW_SCALE = 1.4;
export const PLAYER_DRAW_WIDTH = PLAYER_CHARACTER_FRAME_SIZE * PLAYER_DRAW_SCALE;
export const PLAYER_DRAW_HEIGHT = PLAYER_CHARACTER_FRAME_SIZE * PLAYER_DRAW_SCALE;
// Shot line: the bullet centre sits at blaster height, 35 percent of the rig above the feet
// (31 world px, 16.8 design px). It is under a block's top (44), so a block stops a standing
// shot, and a shot fired from on top of a block (75 above the floor) passes over other blocks.
export const PLAYER_SHOT_ABOVE_FEET = 31;
// World y of the line of fire (bullet centre, muzzle flash, kill path) for a fighter.
export const shotLineY = (player) => player.y + player.height - PLAYER_SHOT_ABOVE_FEET;
export const VERSUS_GRAVITY = 1850;
// Apex 142 world px: clears the next level (115) and, from the top level, the head stays under
// the HUD band. One jump height only, so the boost window is off.
export const VERSUS_JUMP_SPEED = 725;
export const VERSUS_JUMP_BOOST_SPEED = VERSUS_JUMP_SPEED;
export const VERSUS_JUMP_BOOST_WINDOW_MS = 0;
export const VERSUS_PLAYER_MAX_SPEED = 330;
export const VERSUS_PLAYER_ACCELERATION = 2650;
export const VERSUS_PLAYER_FRICTION = 2900;
export const VERSUS_KILLS_TO_WIN = 5;
export const VERSUS_RESPAWN_DELAY_MS = 1350;
export const VERSUS_SPAWN_PROTECTION_MS = 1000;
// Dark arena: the screen is black; fighters show only briefly after firing or being hit.
// Every colour below is a token role (src/theme/tokens.js); nothing here is a literal.
export const ARENA_BLACK = COLORS.bg;
export const PLATFORM_OUTLINE_COLOR = withAlpha(COLORS.structure, 0.4);
export const PLATFORM_OUTLINE_TOP_COLOR = withAlpha(COLORS.structure, 0.7);
export const PLATFORM_FILL_COLOR = withAlpha(COLORS.structure, 0.12);
export const REVEAL_ON_FIRE_SECONDS = 0.3;
export const REVEAL_ON_HIT_SECONDS = 0.5;
export const REVEAL_FADE_SECONDS = 0.1;
export const HIT_FLASH_DURATION = 0.14;

// Bridges as slabs (design px unless noted). `lit` is the outline alpha while a slab flashes.
export const SLAB = Object.freeze({
  radius: 2,
  outlineWidth: 1.5,
  outlineAlpha: 0.4,
  litAlpha: 0.7,
  flashMs: 150,
  glowAlpha: 0.12,
  glowOffsetY: 10,
  glowBlur: 24,
});

// Blocks (arena v3): solid crates, a little brighter than a ledge, with an inner square so they
// read as solid. Alphas are of the structure colour; px are design px.
export const BLOCK = Object.freeze({
  radius: 3,
  outlineAlpha: 0.6,
  fillAlpha: 0.22,
  topAlpha: 0.8,
  innerAlpha: 0.35,
  innerInset: 5,
});

// Atmosphere on the black: stage light, two light shafts over the bridges, vignette, grain.
// Fractions are of the 891 x 411 design box; px values are design px.
export const ATMOSPHERE = Object.freeze({
  stageAlpha: 0.08,
  stageRadiusX: 0.6,
  stageRadiusY: 0.7,
  stageCenterY: 0.4,
  stageFalloff: 0.7,
  shaftWidth: 120,
  shaftTop: -20,
  shaftHeight: 400,
  shaftAlpha: 0.06,
  shaftAlphaLow: 0.04,
  shaftLowAt: 0.7,
  vignetteAlpha: 0.55,
  vignetteStart: 0.45,
  grainAlpha: 0.025,
  grainTilePx: 64,
  grainDots: 56,
});

// Static dust field: [x fraction, y fraction, alpha, radius px] in the design box.
export const DUST_MOTES = Object.freeze([
  [0.12, 0.22, 0.35, 1],
  [0.24, 0.41, 0.25, 1],
  [0.19, 0.63, 0.3, 1.5],
  [0.31, 0.15, 0.2, 1],
  [0.09, 0.52, 0.22, 1],
  [0.36, 0.55, 0.18, 1.5],
  [0.62, 0.33, 0.2, 1],
  [0.78, 0.58, 0.22, 1],
  [0.86, 0.24, 0.18, 1.5],
]);

// Bullets: a 6 px disc plus additive halos [scale of the disc radius, alpha], and a trail of the
// last `trailLength` sim positions drawn as dots that shrink from `trailSizeMax` to `trailSizeMin`.
export const BULLET_FX = Object.freeze({
  radius: 3,
  halos: Object.freeze([
    [1, 1],
    [1.5, 0.6],
    [3.5, 0.18],
  ]),
  trailLength: 10,
  trailSizeMax: 4.7,
  trailSizeMin: 2,
  trailAlpha: 0.7,
});

// Reveal dressing (design px, sized to the 48 px rig): floor spill under the feet, hit flash over
// the body, muzzle flash.
export const REVEAL_FX = Object.freeze({
  spillWidth: 50,
  spillHeight: 10,
  spillAlpha: 0.22,
  hitFlashWidth: 45,
  hitFlashHeight: 56,
  hitFlashAlpha: 0.35,
  muzzleSize: 22,
  muzzleMs: 70,
  // World px ahead of the bullet spawn point; the flash sits on the bullet's line of fire.
  muzzleForwardWorld: 16,
});

// Grey dust puff at the victim's feet: three dots, [alpha, world radius].
export const DUST_PUFF = Object.freeze([
  Object.freeze({ color: withAlpha(COLORS.muted, 0.6), size: 5.5 }),
  Object.freeze({ color: withAlpha(COLORS.muted, 0.45), size: 4.6 }),
  Object.freeze({ color: withAlpha(COLORS.muted, 0.35), size: 3.7 }),
]);

// Hit stop and shake. Shake amplitudes are design px; the time scale freezes the simulation only.
export const FEEDBACK = Object.freeze({
  hitStopMs: 30,
  hitShakePx: 3,
  hitShakeMs: 120,
  killFreezeMs: 140,
  killShakePx: 9,
  killShakeMs: 240,
  killZoom: 0.03,
  shakeHz: 14,
  maxPerSecond: 5,
  dimAlpha: 0.6,
  pathWidth: 2,
  pathGlowWidth: 12,
  pathGlowAlpha: 0.35,
});

export const isDev = () => Boolean(import.meta?.env?.DEV);
export const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
export const center = (entity) => ({
  x: entity.x + entity.width * 0.5,
  y: entity.y + entity.height * 0.5,
});
export const emit = (eventBus, eventName, payload) => {
  eventBus?.emit?.(eventName, payload);
};
export const clampAlpha = (value) => clamp(Number(value) || 0, 0, 1);

export function createPlayerAnimator() {
  return new Animator(
    {
      idle: { frames: [0], fps: 2, loop: true },
      run: { frames: [1, 0], fps: 7, loop: true },
      jump: { frames: [2], fps: 1, loop: true },
      fall: { frames: [3], fps: 1, loop: true },
    },
    "idle"
  );
}

export function getWorldRect(fullWidth, fullHeight, worldWidth, worldHeight) {
  const scale = Math.min(
    fullWidth / Math.max(1, worldWidth),
    fullHeight / Math.max(1, worldHeight)
  );
  const drawWidth = worldWidth * scale;
  const drawHeight = worldHeight * scale;

  return {
    drawX: Math.round((fullWidth - drawWidth) * 0.5),
    drawY: Math.round((fullHeight - drawHeight) * 0.5),
    drawWidth,
    drawHeight,
    scale,
  };
}

// The world (1440 x 760) is fitted into the 891 x 411 design box (scale 0.54, x offset 56) and
// the box is scaled uniformly to the viewport, so the arena has the mockup geometry on any screen.
// `box` is the design-box transform for HUD layout in the same frame.
export function getDesignWorldRect(fullWidth, fullHeight, worldWidth, worldHeight) {
  const box = designBoxTransform(fullWidth, fullHeight);
  const inner = getWorldRect(DESIGN_BOX.width, DESIGN_BOX.height, worldWidth, worldHeight);
  return {
    drawX: box.offsetX + inner.drawX * box.scale,
    drawY: box.offsetY + inner.drawY * box.scale,
    drawWidth: inner.drawWidth * box.scale,
    drawHeight: inner.drawHeight * box.scale,
    scale: inner.scale * box.scale,
    box,
  };
}
