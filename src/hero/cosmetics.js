// Cosmetic layers that sit on top of a body (CharacterDef). Equipping is a
// data merge, never new geometry code: body × hat × palette → one def.
// Nothing here may touch physics: hats change the look, not the hitbox.

export const HATS = Object.freeze({
  bucket: {
    name: "Bucket hat",
    shape: { crownRadius: 0.3, crownBase: 0.36, crownHeight: 0.3, brimRadius: 0.56, brimHeight: 0.06 },
  },
  beanie: {
    name: "Beanie",
    shape: { crownRadius: 0.22, crownBase: 0.5, crownHeight: 0.34, brimRadius: 0.53, brimHeight: 0.12 },
  },
  headband: {
    name: "Headband",
    shape: {
      crownRadius: 0,
      crownBase: 0,
      crownHeight: 0,
      brimRadius: 0.44,
      brimHeight: 0.09,
      offsetY: -0.3,
      tail: [
        { length: 0.3, at: [-0.56, -0.04, -0.1], angle: 0.5 },
        { length: 0.3, at: [-0.82, -0.16, -0.1], angle: -0.7 },
      ],
    },
  },
  tophat: {
    name: "Top hat",
    shape: { crownRadius: 0.27, crownBase: 0.27, crownHeight: 0.5, brimRadius: 0.46, brimHeight: 0.05 },
  },
  fez: {
    name: "Fez",
    shape: { crownRadius: 0.2, crownBase: 0.27, crownHeight: 0.3, brimRadius: 0.27, brimHeight: 0.02, offsetY: -0.02 },
  },
  none: {
    name: "No hat",
    // a brim too small to see keeps the shared hat code (spring, KO fly-off) happy
    shape: { crownRadius: 0, crownBase: 0, crownHeight: 0, brimRadius: 0.001, brimHeight: 0.001 },
  },
});

// Body colors. Every `body` stays bright enough to read as a tell on black
// (relative luminance ≥ 0.25); accent is the hat.
export const PALETTES = Object.freeze({
  mint: { name: "Mint", body: "#9fe1cb", bodyShade: "#5dcaa5", accent: "#f0997b", accentShade: "#d85a30", glow: "#eafff6" },
  lavender: { name: "Lavender", body: "#c9b6f5", bodyShade: "#9c82e0", accent: "#f5c242", accentShade: "#d99a1a", glow: "#f3ecff" },
  lemon: { name: "Lemon", body: "#f5e663", bodyShade: "#d9c21f", accent: "#3b8bea", accentShade: "#1f5fb3", glow: "#fffbd6" },
  coral: { name: "Coral", body: "#ff8a7a", bodyShade: "#e0523f", accent: "#2ec4b6", accentShade: "#1a8f85", glow: "#ffe9e5" },
  sky: { name: "Sky", body: "#7fd3ff", bodyShade: "#3fa9e8", accent: "#ff6fae", accentShade: "#d6397f", glow: "#e8f7ff" },
  bone: { name: "Bone", body: "#efe7d6", bodyShade: "#c9bda3", accent: "#2c2c2a", accentShade: "#111111", glow: "#ffffff" },
});

// Which layers a body can wear. Flat art (sprite, vector) draws its own clothes.
export function wearableLayers(def) {
  const flat = Boolean(def.sprite) || def.art === "vectorFighter";
  return { hat: !flat, palette: !flat };
}

export function composeDef(base, { hat, palette } = {}) {
  const layers = wearableLayers(base);
  const hatDef = layers.hat && hat ? HATS[hat] : null;
  const pal = layers.palette && palette ? PALETTES[palette] : null;
  if (!hatDef && !pal) return base;
  const nextPalette = pal
    ? { ...base.palette, body: pal.body, bodyShade: pal.bodyShade, accent: pal.accent, accentShade: pal.accentShade, glow: pal.glow }
    : base.palette;
  return Object.freeze({
    ...base,
    palette: nextPalette,
    shape: hatDef ? { ...base.shape, hat: hatDef.shape } : base.shape,
    // the bullet is the identity in the dark, so it follows the body color
    bullet: pal ? { ...base.bullet, color: pal.body } : base.bullet,
    cosmetics: { hat: hat ?? null, palette: palette ?? null },
  });
}
