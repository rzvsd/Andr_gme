// Data-only character definition. Everything that makes a hero *this* hero
// lives here, so a second character is a second object, not new code.

export const PUDD = Object.freeze({
  id: "pudd",
  name: "Pudd",
  tagline: "A jelly bean in a bucket hat. Deadpan face, chaotic body.",

  palette: {
    body: "#9fe1cb",
    bodyShade: "#5dcaa5",
    accent: "#f0997b",
    accentShade: "#d85a30",
    outline: "#2c2c2a",
    eye: "#2c2c2a",
    glow: "#eafff6",
  },

  // World units. The hero stands ~1.7 units tall; the body is the head.
  shape: {
    bodyRadius: 0.42,
    bodyLength: 0.55,
    legRadius: 0.09,
    legLength: 0.12,
    legSpread: 0.17,
    eyeRadius: 0.055,
    eyeSpread: 0.15,
    eyeHeight: 1.1,
    mouthWidth: 0.14,
    mouthHeight: 0.9,
    hat: { crownRadius: 0.3, crownBase: 0.36, crownHeight: 0.3, brimRadius: 0.56, brimHeight: 0.06 },
    arm: { segments: 6, segmentLength: 0.11, radius: 0.085, handRadius: 0.1 },
    shoulderHeight: 0.95,
  },

  motion: {
    breatheAmplitude: 0.015,
    breatheHz: 0.9,
    squashOnLand: 0.85,
    stretchAtApex: 1.15,
    springStiffness: 180,
    springDamping: 14,
    leanPerVelocity: 0.045,
    hatSpring: { stiffness: 90, damping: 9, lag: 0.06 },
    armGravity: -9,
    armDamping: 0.9,
    blinkEverySeconds: [2, 5],
    anticipationScale: 0.95,
    anticipationMs: 60,
    recoil: 0.03,
  },

  // Which parts light up in the dark, and for how long.
  tells: {
    shoot: { parts: ["eyes", "hatBrim"], ms: 120 },
    land: { parts: ["feetRing"], ms: 100 },
    hit: { parts: ["outline"], ms: 200 },
    ko: { parts: ["all"], ms: 500 },
    taunt: { parts: ["eyes"], ms: 300 },
  },

  bullet: { color: "#9fe1cb", length: 0.26, radius: 0.05, speed: 9, trail: 3 },

  // Short, language-free. Synthesized at runtime, see sounds.js.
  sounds: {
    shoot: "pip",
    land: "blub",
    hit: "boing",
    ko: "splat",
    win: "pop",
  },

  moments: {
    ko: "Jelly flop. The hat flies off and lands beside the body. Stays on screen.",
    win: "Tiny bounce, then one slow deadpan blink. The joke: it does not celebrate.",
  },
});

// Second character, data only: same rig code, wide blob body, slouchy beanie.
export const CHONK = Object.freeze({
  ...PUDD,
  id: "chonk",
  name: "Chonk",
  tagline: "A wide blob in a beanie. Slow blink, heavy landing.",

  palette: {
    body: "#c9b6f5",
    bodyShade: "#9c82e0",
    accent: "#f5c242",
    accentShade: "#d99a1a",
    outline: "#2c2c2a",
    eye: "#2c2c2a",
    glow: "#f3ecff",
  },

  shape: {
    ...PUDD.shape,
    bodyRadius: 0.58,
    bodyLength: 0.1,
    legSpread: 0.24,
    eyeSpread: 0.22,
    eyeHeight: 0.86,
    mouthHeight: 0.66,
    hat: { crownRadius: 0.22, crownBase: 0.5, crownHeight: 0.34, brimRadius: 0.53, brimHeight: 0.12 },
    shoulderHeight: 0.7,
  },

  motion: {
    ...PUDD.motion,
    breatheAmplitude: 0.025,
    breatheHz: 0.6,
    squashOnLand: 0.75,
    stretchAtApex: 1.08,
    leanPerVelocity: 0.03,
    blinkEverySeconds: [3, 7],
  },

  bullet: { ...PUDD.bullet, color: "#c9b6f5" },
});

// Third variant, built to sit close to the reference screenshot
// (project overview/game pictures/expectation.png): big round head, dark hood,
// green mask, angry white eyes, headband with a tail, wrapped arms, red shoes,
// yellow-green blaster, blue bullets.
export const NINJA = Object.freeze({
  ...PUDD,
  id: "ninja",
  name: "Ninja",
  tagline: "The screenshot fighter. Big head, hard stare, headband in the wind.",

  palette: {
    body: "#2f4a2e",
    bodyShade: "#1f3320",
    head: "#4a2e2a",
    face: "#5f8f5a",
    legs: "#6b1a1a",
    arms: "#d9cfb8",
    accent: "#1f3a3a",
    accentShade: "#162a2a",
    blaster: "#b9d84a",
    outline: "#1a1a1a",
    eye: "#f4f4f4",
    pupil: "#1a1a1a",
    glow: "#fff07a",
  },

  shape: {
    bodyRadius: 0.24,
    bodyLength: 0.3,
    legRadius: 0.08,
    legLength: 0.1,
    legSpread: 0.12,
    head: { radius: 0.42, overlap: 0.12 },
    eyeRadius: 0.06,
    eyeSpread: 0.17,
    eyeHeight: 1.24,
    eyeScale: [1.3, 0.75],
    brows: true,
    mouthWidth: 0,
    mouthHeight: 1.0,
    hat: {
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
    arm: { segments: 5, segmentLength: 0.09, radius: 0.06, handRadius: 0.07 },
    blaster: { w: 0.3, h: 0.14 },
    shoulderHeight: 0.78,
  },

  motion: {
    ...PUDD.motion,
    breatheAmplitude: 0.01,
    squashOnLand: 0.9,
    stretchAtApex: 1.1,
    leanPerVelocity: 0.06,
    blinkEverySeconds: [4, 8],
  },

  bullet: { color: "#2b35d6", length: 0.3, radius: 0.045, speed: 11, trail: 2 },
});

// Fourth variant: the screenshot fighter itself. The pixels are cut straight
// out of expectation.png (sky and UI icons keyed out), drawn as a flat sprite
// on the shared rig so it still runs, jumps, squashes and flashes in the dark.
export const ORIGINAL = Object.freeze({
  ...PUDD,
  id: "original",
  name: "Original",
  tagline: "The fighter from the reference screenshot, pixel for pixel.",

  sprite: {
    src: new URL("./assets/ref_fighter.png", import.meta.url).href,
    width: 80,
    height: 100,
    heightUnits: 1.9,
  },

  palette: {
    body: "#8fb36b",
    bodyShade: "#2f4a2e",
    accent: "#4a2e2a",
    accentShade: "#1f2f2f",
    outline: "#1a1a1a",
    eye: "#f4f4f4",
    glow: "#fff07a",
  },

  shape: {
    ...PUDD.shape,
    bodyRadius: 0.45,
    arm: { segments: 1, segmentLength: 0.1, radius: 0.05, handRadius: 0.05 },
    shoulderHeight: 0.95,
  },

  motion: {
    ...PUDD.motion,
    breatheAmplitude: 0.01,
    squashOnLand: 0.9,
    stretchAtApex: 1.08,
    leanPerVelocity: 0.05,
  },

  // no separate parts: the whole cutout is the tell
  tells: {
    shoot: { parts: ["all"], ms: 120 },
    land: { parts: ["feetRing"], ms: 100 },
    hit: { parts: ["all"], ms: 200 },
    ko: { parts: ["all"], ms: 500 },
    taunt: { parts: ["all"], ms: 300 },
  },

  bullet: { color: "#2b35d6", length: 0.3, radius: 0.045, speed: 11, trail: 2 },

  moments: {
    ko: "Tips over and lies flat on the platform.",
    win: "Small hop. Nothing else, it is a screenshot.",
  },
});

// Fifth variant: the screenshot fighter redrawn as flat vector shapes
// (src/hero/vectorFighter.js). Sharp at any size, every part animates.
export const VECTOR = Object.freeze({
  ...NINJA,
  id: "vector",
  name: "Vector",
  tagline: "The screenshot fighter redrawn as clean flat shapes. Sharp at any size.",
  art: "vectorFighter",

  palette: {
    body: "#8fb36b",
    bodyShade: "#2f4a2e",
    hood: "#4a2e2a",
    hoodShade: "#35201d",
    face: "#6b9a60",
    mask: "#1c2a1c",
    band: "#1f2f2f",
    torso: "#2f4a2e",
    belt: "#d9cfb8",
    arms: "#d9cfb8",
    skin: "#e3cdae",
    shoes: "#6b1a1a",
    gun: "#b9d84a",
    accent: "#1f2f2f",
    accentShade: "#162a2a",
    outline: "#1a1a1a",
    eye: "#f4f4f4",
    pupil: "#1a1a1a",
    glow: "#fff07a",
  },

  shape: {
    ...NINJA.shape,
    bodyRadius: 0.44,
    hat: { crownRadius: 0, crownBase: 0, crownHeight: 0, brimRadius: 0.45, brimHeight: 0.11, tail: NINJA.shape.hat.tail },
    arm: { segments: 6, segmentLength: 0.085, radius: 0.055, handRadius: 0.065 },
    shoulderHeight: 0.92,
  },
});

export const ROSTER = [PUDD, CHONK, NINJA, ORIGINAL, VECTOR];
