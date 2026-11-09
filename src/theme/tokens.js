// Direction A "Blackout Arena" design tokens: the single source for colours, type, spacing,
// hit sizes and motion across scenes and UI. Scenes must not hard-code colours or font strings.
// Approved by the owner on 2026-10-31 from the mockups in harness/evidence/T-13/mockups/.

export const COLORS = Object.freeze({
  bg: "#05060a", // arena black
  surface: "rgba(255, 255, 255, 0.03)",
  surface2: "rgba(255, 255, 255, 0.06)",
  line: "rgba(255, 255, 255, 0.12)",
  lineStrong: "rgba(255, 255, 255, 0.22)",
  text: "#e8ecf4",
  muted: "#8e97a8",
  dim: "#5d6577",
  structure: "#8fa3bf", // platform outlines, keylines
  accent: "#5ef0b8", // the one neon: primary button, selection, focus
  accentInk: "#06110d", // text on accent
  accentGlow: "rgba(94, 240, 184, 0.45)",
  p1: "#ff5e57", // player 1, always left
  p1Glow: "rgba(255, 94, 87, 0.55)",
  p2: "#4ea3ff", // player 2, always right
  p2Glow: "rgba(78, 163, 255, 0.55)",
  impact: "#ffffff",
});

// Index 0 = P1, index 1 = P2.
export const TEAM_COLORS = Object.freeze([
  Object.freeze({ main: COLORS.p1, glow: COLORS.p1Glow }),
  Object.freeze({ main: COLORS.p2, glow: COLORS.p2Glow }),
]);

export const FONTS = Object.freeze({
  display: '"Chakra Petch", "Trebuchet MS", Arial, sans-serif',
  text: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
});

// Type scale at the 411 px reference height. d0 is for the result title only.
export const TYPE = Object.freeze({
  d0: 56,
  d1: 32,
  d2: 24,
  t1: 16,
  t2: 12,
  min: 11,
  trackCaps: 0.1, // em, for all-caps labels
});

// 8 px spacing scale plus the phone safe insets.
export const SPACE = Object.freeze({
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  insetX: 28, // visual side inset (punch hole)
  noTapX: 40, // no tap target starts within 40 px of the left or right edge (back gesture)
  insetTop: 14,
  insetBottom: 22, // gesture bar
});

export const RADII = Object.freeze({ panel: 14, control: 12 });

export const HIT = Object.freeze({
  min: 48, // every tap target, including padding
  gap: 8,
  primary: 64,
  secondary: 48,
  compact: 40,
});

export const MOTION = Object.freeze({
  pressMs: 90,
  releaseMs: 180,
  revealMs: 300,
  fadeMs: 150,
  pressScale: 0.96,
});

// Screens are laid out in a fixed 891 x 411 design box (Galaxy S24 Ultra landscape) and scaled
// uniformly to the viewport, centred. The bars are invisible on the black background.
export const DESIGN_BOX = Object.freeze({ width: 891, height: 411 });

export function designBoxTransform(viewWidth, viewHeight) {
  const w = Math.max(1, Number(viewWidth) || 1);
  const h = Math.max(1, Number(viewHeight) || 1);
  const scale = Math.min(w / DESIGN_BOX.width, h / DESIGN_BOX.height);
  return {
    scale,
    offsetX: (w - DESIGN_BOX.width * scale) / 2,
    offsetY: (h - DESIGN_BOX.height * scale) / 2,
  };
}

// Scale factor for type and controls on other viewport heights (phones are 390 to 430 px tall
// in landscape; tablets and desktop windows are taller). Clamped so nothing shrinks below legibility.
export function typeScale(viewHeight) {
  const h = Number(viewHeight);
  if (!Number.isFinite(h) || h <= 0) {
    return 1;
  }
  return Math.min(1.3, Math.max(0.85, h / 411));
}

export function font(weight, px, family = "text") {
  const size = Math.max(TYPE.min, Math.round(Number(px) || TYPE.t1));
  return `${weight} ${size}px ${FONTS[family] ?? FONTS.text}`;
}

export function displayFont(px, weight = 700) {
  return font(weight, px, "display");
}

export function textFont(px, weight = 600) {
  return font(weight, px, "text");
}

// Canvas letter spacing for an all-caps label at the given size (ctx.letterSpacing = `${n}px`).
export function trackingPx(px) {
  return Math.round((Number(px) || TYPE.t1) * TYPE.trackCaps);
}

// "#rrggbb" -> "rgba(r, g, b, a)". Non-hex input is returned unchanged.
export function withAlpha(hex, alpha) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) {
    return String(hex);
  }
  const value = parseInt(match[1], 16);
  const a = Math.min(1, Math.max(0, Number(alpha)));
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${a})`;
}
