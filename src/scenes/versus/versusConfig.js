import { Animator } from "../../rendering/Animator.js";
import { clamp } from "../../utils/math.js";
import { PLAYER_CHARACTER_FRAME_SIZE } from "../../theme/playerRoster.js";

export const BULLET_SPEED = 760;
export const BULLET_LIFETIME_MS = 1500;
export const BULLET_OFFSCREEN_MARGIN = 90;
export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 40;
export const PLAYER_HEALTH = 100;
export const PLAYER_DRAW_SCALE = 2;
export const PLAYER_DRAW_WIDTH = PLAYER_CHARACTER_FRAME_SIZE * PLAYER_DRAW_SCALE;
export const PLAYER_DRAW_HEIGHT = PLAYER_CHARACTER_FRAME_SIZE * PLAYER_DRAW_SCALE;
export const PLAYER_SHOOT_Y_OFFSET = 5;
export const VERSUS_GRAVITY = 1850;
export const VERSUS_JUMP_SPEED = 600;
export const VERSUS_JUMP_BOOST_SPEED = 720;
export const VERSUS_JUMP_BOOST_WINDOW_MS = 220;
export const VERSUS_PLAYER_MAX_SPEED = 330;
export const VERSUS_PLAYER_ACCELERATION = 2650;
export const VERSUS_PLAYER_FRICTION = 2900;
export const VERSUS_KILLS_TO_WIN = 5;
export const VERSUS_RESPAWN_DELAY_MS = 1350;
export const VERSUS_SPAWN_PROTECTION_MS = 1000;
export const SKY_TOP = "#b6c6e5";
export const SKY_BOTTOM = "#bccbe8";
export const HAZE_COLOR = "rgba(255, 255, 255, 0.10)";
export const DECOR_STRIP_COLOR = "#c9bfae";
export const DECOR_STRIP_TOP = "#ddd3c0";
export const PLATFORM_FACE_COLOR = "#245e10";
export const PLATFORM_TOP_COLOR = "#2f7015";
export const PLATFORM_EDGE_COLOR = "rgba(15, 41, 6, 0.7)";
export const DIVIDER_CORE = "rgba(150, 131, 191, 0.60)";
export const DIVIDER_GLOW = "rgba(181, 156, 214, 0.30)";
export const SCARF_SWAY_AMPLITUDE = 8;
export const HIT_FLASH_DURATION = 0.14;

export const TEAM_STYLES = [
  {
    // P1 — expectation.png left: small red dots with soft red trail.
    bulletCore: "#e5322b",
    bulletGlow: "rgba(255, 96, 80, 0.65)",
    bulletAccent: "#ffd9d2",
    accent: "#dc8f4b",
    scarf: "#e8a13c",
    panelTint: "rgba(176, 159, 162, 0.88)",
    fallbackBody: "#2e3a24",
    headband: "#e8a13c",
    hitColors: ["#ffffff", "#ffc9bd", "#e5322b", "#7a1f1a"],
  },
  {
    // P2 — expectation.png middle/right: blue slug with yellow glow.
    bulletCore: "#2e4de6",
    bulletGlow: "rgba(255, 236, 120, 0.85)",
    bulletAccent: "#fff6b0",
    accent: "#4a61db",
    scarf: "#2f44be",
    panelTint: "rgba(138, 142, 197, 0.88)",
    fallbackBody: "#232d22",
    headband: "#3a55d8",
    hitColors: ["#ffffff", "#fff6b0", "#2e4de6", "#4a5a8a"],
  },
];

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
