import { load, save } from "../utils/storage.js";

export const PLAYER_CHARACTER_STORAGE_KEY = "selected_character";
export const PLAYER2_CHARACTER_STORAGE_KEY = "selected_character_p2";
export const DEFAULT_PLAYER_CHARACTER_KEY = "pudd";
export const PLAYER_CHARACTER_FRAME_SIZE = 64;
export const PLAYER_CHARACTER_FEET_Y = 46.8;
export const PLAYER_CHARACTER_FEET_RATIO = PLAYER_CHARACTER_FEET_Y / PLAYER_CHARACTER_FRAME_SIZE;

export const PLAYER_CHARACTER_ROSTER = Object.freeze([
  // Hero-lab roster (src/hero/characterDef.js). `key` is the hero id the WebGL layer builds.
  // The colour fields feed the 2D fallback sprite and the menu emblems.
  Object.freeze({
    key: "pudd",
    name: "Pudd",
    label: "bucket hat",
    bodyVariant: "pear",
    goggles: "round",
    eye: "#2c2c2a",
    bodyTop: "#9fe1cb",
    bodyBottom: "#5dcaa5",
    highlight: "#eafff6",
    shadow: "#2c2c2a",
    leaf: "#f0997b",
    packTop: "#f0997b",
    packBottom: "#d85a30",
    strap: "#2c2c2a",
    launcherTop: "#f0997b",
    launcherBottom: "#d85a30",
    bulletCore: "#9fe1cb",
    bulletAccent: "#eafff6",
    bulletGlow: "rgba(159, 225, 203, 0.85)",
    juiceColors: ["#eafff6", "#9fe1cb", "#5dcaa5"],
  }),
  Object.freeze({
    key: "chonk",
    name: "Chonk",
    label: "beanie",
    bodyVariant: "pear",
    goggles: "round",
    eye: "#2c2c2a",
    bodyTop: "#c9b6f5",
    bodyBottom: "#9c82e0",
    highlight: "#f3ecff",
    shadow: "#2c2c2a",
    leaf: "#f5c242",
    packTop: "#f5c242",
    packBottom: "#d99a1a",
    strap: "#2c2c2a",
    launcherTop: "#f5c242",
    launcherBottom: "#d99a1a",
    bulletCore: "#c9b6f5",
    bulletAccent: "#f3ecff",
    bulletGlow: "rgba(201, 182, 245, 0.85)",
    juiceColors: ["#f3ecff", "#c9b6f5", "#9c82e0"],
  }),
  Object.freeze({
    key: "ninja",
    name: "Ninja",
    label: "headband",
    bodyVariant: "pear",
    goggles: "visor",
    eye: "#f4f4f4",
    bodyTop: "#2f4a2e",
    bodyBottom: "#1f3320",
    highlight: "#fff07a",
    shadow: "#1a1a1a",
    leaf: "#1f3a3a",
    packTop: "#1f3a3a",
    packBottom: "#1a1a1a",
    strap: "#1a1a1a",
    launcherTop: "#b9d84a",
    launcherBottom: "#7f9a2a",
    bulletCore: "#2b35d6",
    bulletAccent: "#fff07a",
    bulletGlow: "rgba(255, 240, 122, 0.85)",
    juiceColors: ["#fff07a", "#2b35d6", "#2f4a2e"],
  }),
  Object.freeze({
    key: "vector",
    name: "Vector",
    label: "flat shapes",
    bodyVariant: "pear",
    goggles: "visor",
    eye: "#f4f4f4",
    bodyTop: "#8fb36b",
    bodyBottom: "#2f4a2e",
    highlight: "#fff07a",
    shadow: "#1a1a1a",
    leaf: "#1f2f2f",
    packTop: "#1f2f2f",
    packBottom: "#1a1a1a",
    strap: "#1a1a1a",
    launcherTop: "#b9d84a",
    launcherBottom: "#7f9a2a",
    bulletCore: "#2b35d6",
    bulletAccent: "#fff07a",
    bulletGlow: "rgba(255, 240, 122, 0.85)",
    juiceColors: ["#fff07a", "#2b35d6", "#8fb36b"],
  }),
]);

const PLAYER_CHARACTER_MAP = new Map(
  PLAYER_CHARACTER_ROSTER.map((character, index) => [character.key, { ...character, index }])
);

function buildVariantSprig(character) {
  // M8: tiny per-variant accent so the 6 bodies aren't identical — silhouette stays ninja.
  const { bodyVariant, leaf, highlight } = character;
  const stroke = `stroke="${leaf}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (bodyVariant) {
    case "strawberry":
      return `<path d="M-9 -13C-4 -17 4 -17 9 -13" ${stroke}/>`;
    case "orange":
      return `<path d="M-4 -14C0 -16.5 4 -15.3 5.4 -11.6" ${stroke}/>`;
    case "pineapple":
      return `<path d="M-9 -12L-5 -18L0 -13L5 -19L9 -12" ${stroke}/>`;
    case "banana":
      return `<path d="M-8.5 -12.5C-6.7 -15 -1.8 -16.5 6.1 -15.5" stroke="${highlight}" stroke-width="1.5" stroke-linecap="round"/>`;
    case "apple":
      return `<path d="M-6 -13C-8 -17 -2 -20 2 -18" ${stroke}/>`;
    case "pear":
    default:
      return `<path d="M1.8 -19.4C7.4 -20.8 10.3 -18.7 10.9 -14.9C6.6 -13.2 3.5 -14.2 1.8 -19.4Z" fill="${leaf}" stroke="#1b2a16" stroke-width="1"/>`;
  }
}

function buildBodyDefinition(character) {
  // M8: one ninja silhouette for every roster entry — hood + eye slit + headband
  // tails in leaf color + tunic in character gradient. Sheets now match the
  // in-game procedural ninja and expectation.png instead of round fruit blobs.
  // Keys/names/goggles/variants/colors are untouched, so roster tests stay green.
  const { bodyTop, bodyBottom, highlight, shadow, strap } = character;
  const fill = `fill="url(#bodyGrad)" stroke="#1b2a16" stroke-width="1.5" stroke-linejoin="round"`;
  const sprig = buildVariantSprig(character);

  return `
    <g id="fruitBody">
      <path d="M-11 -8H11L13 6V16L8 22H-9L-13 16V6L-11 -8Z" ${fill}/>
      <path d="M-8 -4H8" stroke="${highlight}" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
      <path d="M-9 12.5H9V17.5H-9Z" fill="${strap}" stroke="#1b2a16" stroke-width="1"/>
      <circle cx="0" cy="-8" r="12.5" fill="${bodyBottom}" stroke="#1b2a16" stroke-width="1.5"/>
      <path d="M-9 -14C-4 -18 4 -18 9 -14L9 -10H-9Z" fill="${bodyTop}" stroke="#1b2a16" stroke-width="1.2"/>
      <rect x="-8.5" y="-9.5" width="17" height="6.4" rx="2" fill="#202826" stroke="#1b2a16" stroke-width="1"/>
      <rect x="1" y="-8.3" width="8" height="4" rx="1" fill="#ffffff"/>
      <rect x="5.5" y="-8.3" width="2.6" height="4" fill="#111111"/>
      <rect x="-12.5" y="-13.5" width="25" height="4.4" rx="1.5" fill="${character.leaf}" stroke="#1b2a16" stroke-width="1"/>
      <path d="M-11 -12.5L-23 -9.5L-28 -1" stroke="${character.leaf}" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M-11 -11L-21 -9" stroke="${character.leaf}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/>
      ${sprig}
      <circle cx="-5" cy="-4.5" r="0.9" fill="${highlight}"/>
      <circle cx="-6.5" cy="2.5" r="0.9" fill="${shadow}" opacity="0.6"/>
    </g>`;
}

function buildGoggleDefinition(character) {
  switch (character.goggles) {
    case "heart":
      return `
        <g id="goggles">
          <path d="M-10.4 -6H9.8" stroke="#202c25" stroke-width="3" stroke-linecap="round"/>
          <path d="M-8.4 -10C-10.6 -10 -11.5 -7.4 -10.1 -5.9L-6.4 -2.4L-2.5 -5.8C-0.9 -7.4 -2 -10 -4.3 -10C-5.7 -10 -6.5 -8.8 -6.4 -8.6C-6.6 -8.9 -7.2 -10 -8.4 -10Z" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M3.1 -10C0.9 -10 0 -7.4 1.4 -5.9L5.1 -2.4L9 -5.8C10.6 -7.4 9.5 -10 7.3 -10C5.8 -10 5 -8.8 5.1 -8.6C5 -8.9 4.4 -10 3.1 -10Z" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        </g>`;
    case "visor":
      return `
        <g id="goggles">
          <path d="M-11 -5.6H9.8" stroke="#202c25" stroke-width="3" stroke-linecap="round"/>
          <rect x="-8.8" y="-10.2" width="16.2" height="7.8" rx="2.2" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2"/>
          <path d="M-2.8 -6.4H0.6" stroke="#16211b" stroke-width="1" stroke-linecap="round"/>
        </g>`;
    case "heavy":
      return `
        <g id="goggles">
          <path d="M-11.8 -5.8H10.8" stroke="#202c25" stroke-width="3.2" stroke-linecap="round"/>
          <rect x="-9.7" y="-10.6" width="18.8" height="8.8" rx="1.8" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2"/>
          <circle cx="-6.4" cy="-6.2" r="1.1" fill="#ffffff" fill-opacity="0.78"/>
        </g>`;
    case "speed":
      return `
        <g id="goggles">
          <path d="M-10.6 -5.6H8.8" stroke="#202c25" stroke-width="3" stroke-linecap="round"/>
          <path d="M-8.8 -9.2H6.9L9.4 -5.8L6.2 -2.1H-7.2L-10.2 -5.8Z" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M-1.6 -5.7H1.5" stroke="#16211b" stroke-width="1" stroke-linecap="round"/>
        </g>`;
    case "aviator":
      return `
        <g id="goggles">
          <path d="M-10.5 -6H9.4" stroke="#202c25" stroke-width="3" stroke-linecap="round"/>
          <path d="M-9 -10.2H-1.2L0 -6.1L-1.6 -2.4H-8.2L-10.1 -6.1Z" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M1.1 -10.2H8.7L10.2 -6.1L8.4 -2.4H1.2L-0.4 -6.1Z" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        </g>`;
    case "round":
    default:
      return `
        <g id="goggles">
          <path d="M-10.5 -6H9.6" stroke="#202c25" stroke-width="3.2" stroke-linecap="round"/>
          <rect x="-9.8" y="-10.6" width="9.2" height="8.4" rx="2.6" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.3"/>
          <rect x="0.8" y="-10.3" width="9.2" height="8.4" rx="2.6" fill="url(#lensGrad)" stroke="#16211b" stroke-width="1.3"/>
          <path d="M-0.4 -6.6H1.5" stroke="#16211b" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="-6.2" cy="-7.6" r="1.2" fill="#ffffff" fill-opacity="0.78"/>
          <circle cx="4.4" cy="-7.2" r="1.2" fill="#ffffff" fill-opacity="0.78"/>
        </g>`;
  }
}

function buildSheetSvg(character) {
  const bodyDef = buildBodyDefinition(character);
  const gogglesDef = buildGoggleDefinition(character);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="64" viewBox="0 0 256 64" fill="none">
      <defs>
        <filter id="softShadow" x="-18%" y="-18%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#17231b" flood-opacity="0.24"/>
        </filter>
        <linearGradient id="bodyGrad" x1="0" y1="-16" x2="0" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${character.bodyTop}"/>
          <stop offset="1" stop-color="${character.bodyBottom}"/>
        </linearGradient>
        <linearGradient id="lensGrad" x1="0" y1="0" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#dff8ff"/>
          <stop offset="1" stop-color="#75c8f2"/>
        </linearGradient>
        <linearGradient id="packGrad" x1="0" y1="0" x2="0" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${character.packTop}"/>
          <stop offset="1" stop-color="${character.packBottom}"/>
        </linearGradient>
        <linearGradient id="launcherGrad" x1="0" y1="0" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${character.launcherTop}"/>
          <stop offset="1" stop-color="${character.launcherBottom}"/>
        </linearGradient>
        <linearGradient id="bootGrad" x1="0" y1="0" x2="0" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#a74239"/>
          <stop offset="1" stop-color="#65241d"/>
        </linearGradient>
        ${bodyDef}
        ${gogglesDef}
        <g id="leafPack">
          <path d="M0 0H8.6C10.5 2.8 10.7 12.8 8.9 17.8H0.6C-1.3 13 -1.2 2.7 0 0Z" fill="url(#packGrad)" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M1.8 3.5H7.2" stroke="${character.highlight}" stroke-width="1.1" stroke-linecap="round"/>
          <path d="M8.7 5.2L10.7 6.4" stroke="#16211b" stroke-width="1" stroke-linecap="round"/>
          <path d="M2.8 -1.2C6.8 -5 10.2 -3.9 11 -0.5C7.6 1.3 4.7 1 2.8 -1.2Z" fill="${character.leaf}" stroke="#16211b" stroke-width="1" stroke-linejoin="round"/>
        </g>
        <g id="launcher">
          <path d="M0 0H12.8V5.2H0Z" fill="url(#launcherGrad)" stroke="#1b2a16" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M2 -1.1H8.1V0.8H2Z" fill="${character.highlight}" stroke="#1b2a16" stroke-width="0.9"/>
          <path d="M12 1.8H17V3.2H12Z" fill="#6c4824"/>
          <path d="M-4 1.5L0 0V5.2L-4.4 5.4Z" fill="#9a693f" stroke="#1b2a16" stroke-width="1" stroke-linejoin="round"/>
          <circle cx="6.7" cy="2.6" r="1.3" fill="#f7efcb" stroke="#1b2a16" stroke-width="0.8"/>
          <circle cx="6.7" cy="2.6" r="0.4" fill="${character.bodyBottom}"/>
        </g>
        <g id="glove">
          <path d="M-2.1 -1H2.2C3.1 0 3.1 2.3 1.7 3.4H-1.3C-2.5 2.4 -2.8 0.4 -2.1 -1Z" fill="#f5f4ed" stroke="#16211b" stroke-width="1" stroke-linejoin="round"/>
        </g>
        <g id="boot">
          <path d="M0 0H5.7L7.2 3H-0.5Z" fill="url(#bootGrad)" stroke="#16211b" stroke-width="1" stroke-linejoin="round"/>
        </g>
      </defs>
      <g transform="translate(0 0)" filter="url(#softShadow)">
        <use href="#leafPack" transform="translate(16.5 25.3)"/>
        <path d="M25.1 31.4L23.2 43.4L26.8 43.4L28.6 31.9Z" fill="${character.bodyBottom}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(22.4 43.2)"/>
        <path d="M32.8 31.8L35.1 43.3H38.7L36.5 31.7Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(34 43.1)"/>
        <path d="M21.6 20.8L19 26.8L21.9 29.1L24.7 24.2L29.6 25L29 28.7L32.4 29.4L33.4 22.2L27.8 20.4Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M34.3 21.6L38.8 23.1L42.4 27.3L40 29.6L35.9 26.7L32.4 25.8Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#glove" transform="translate(30.8 27.9)"/>
        <use href="#glove" transform="translate(41 26.8)"/>
        <use href="#fruitBody" transform="translate(29.6 26.2)"/>
        <use href="#goggles" transform="translate(29.7 26.3)"/>
        <use href="#launcher" transform="translate(41.8 25.6)"/>
      </g>
      <g transform="translate(64 0)" filter="url(#softShadow)">
        <use href="#leafPack" transform="translate(16.3 25.1)"/>
        <path d="M26.8 31.2L20.4 40.8L23.7 43L30.3 34Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(19.8 41.1)"/>
        <path d="M33.8 31.2L39.2 42.2H42.9L37.6 31.2Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(38.8 42.1)"/>
        <path d="M22.5 20.7L17.2 24.8L19.6 28L24.7 24.8L29.2 26.1L28.8 29.4L32.2 29.8L33 23.4L27.9 20.4Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M34.2 21L39.8 22.3L44.4 27.6L42.1 29.8L37.4 26.6L32.9 25.6Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#glove" transform="translate(30.8 28.6)"/>
        <use href="#glove" transform="translate(43 27.4)"/>
        <g transform="translate(30.6 26.2) rotate(-6)">
          <use href="#fruitBody"/>
          <use href="#goggles"/>
        </g>
        <use href="#launcher" transform="translate(43.4 25.3) rotate(-4 0 0)"/>
      </g>
      <g transform="translate(128 0)" filter="url(#softShadow)">
        <use href="#leafPack" transform="translate(17.1 20.4)"/>
        <path d="M27.4 26.2L22.2 34.8L25.8 36.8L31.7 28.7Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(22.2 35.5)"/>
        <path d="M34.3 25.8L41.2 33L44.2 29.8L37.6 23.8Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(40.9 31.6)"/>
        <path d="M24.1 15.8L20 10.4L22.8 8.1L27 12.3L30.4 13.5L29.3 16.6L26.1 16.1Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M34.1 16L39 17.5L43.1 22L40.8 24.2L36.7 21.5L32.6 20.3Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#glove" transform="translate(26.1 9.4)"/>
        <use href="#glove" transform="translate(41 22.1)"/>
        <g transform="translate(31.1 21.7) rotate(-12)">
          <use href="#fruitBody"/>
          <use href="#goggles"/>
        </g>
        <use href="#launcher" transform="translate(41.8 18.3) rotate(-16 0 0)"/>
      </g>
      <g transform="translate(192 0)" filter="url(#softShadow)">
        <use href="#leafPack" transform="translate(16.8 24.4)"/>
        <path d="M27.2 31.5L25.8 43.8L29.5 43.8L30.8 31.7Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(25 43.6)"/>
        <path d="M34.4 31.4L37.1 44H40.8L38.1 31.5Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#boot" transform="translate(36 43.8)"/>
        <path d="M22.8 21.4L19.3 28.1L22.2 29.9L25.6 25L30.1 26.7L29 30.1L32 31.4L34 24.4L28.4 21Z" fill="${character.shadow}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M34.8 22L39.4 24.4L43.7 29.4L41.2 31.4L37 28L33 26.2Z" fill="${character.bodyTop}" stroke="#16211b" stroke-width="1.2" stroke-linejoin="round"/>
        <use href="#glove" transform="translate(30.8 30.4)"/>
        <use href="#glove" transform="translate(42.2 29.5)"/>
        <g transform="translate(30.7 26.4) rotate(8)">
          <use href="#fruitBody"/>
          <use href="#goggles"/>
        </g>
        <use href="#launcher" transform="translate(41.4 26.7) rotate(10 0 0)"/>
      </g>
    </svg>
  `.trim();
}

function encodeSvgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getPlayerCharacterByKey(key = DEFAULT_PLAYER_CHARACTER_KEY) {
  return PLAYER_CHARACTER_MAP.get(key) ?? PLAYER_CHARACTER_MAP.get(DEFAULT_PLAYER_CHARACTER_KEY);
}

export function getPlayerCharacterIndexByKey(key = DEFAULT_PLAYER_CHARACTER_KEY) {
  return getPlayerCharacterByKey(key).index ?? 0;
}

export function getPlayerCharacterByIndex(index = 0) {
  if (!Number.isFinite(Number(index))) {
    return getPlayerCharacterByKey();
  }
  const normalizedIndex = Math.max(0, Math.min(PLAYER_CHARACTER_ROSTER.length - 1, Math.floor(Number(index))));
  return PLAYER_CHARACTER_ROSTER[normalizedIndex];
}

export function cyclePlayerCharacterKey(currentKey, direction = 1) {
  const currentIndex = getPlayerCharacterIndexByKey(currentKey);
  const step = direction < 0 ? -1 : 1;
  const nextIndex = (currentIndex + step + PLAYER_CHARACTER_ROSTER.length) % PLAYER_CHARACTER_ROSTER.length;
  return PLAYER_CHARACTER_ROSTER[nextIndex].key;
}

export function pickRandomPlayerCharacterKey(excludedKey = null, randomValue = Math.random()) {
  const normalizedExcludedKey =
    typeof excludedKey === "string" && excludedKey.length > 0
      ? getPlayerCharacterByKey(excludedKey).key
      : null;
  const pool = PLAYER_CHARACTER_ROSTER.filter((character) => character.key !== normalizedExcludedKey);
  if (pool.length <= 0) {
    return getPlayerCharacterByKey(excludedKey).key;
  }

  const numericRandom = Number(randomValue);
  const normalizedRandom = Number.isFinite(numericRandom)
    ? Math.min(0.999999, Math.max(0, numericRandom))
    : Math.random();
  const index = Math.min(pool.length - 1, Math.floor(normalizedRandom * pool.length));
  return pool[index].key;
}

export function buildPlayerCharacterSheetSvg(characterOrKey) {
  const character = typeof characterOrKey === "string" ? getPlayerCharacterByKey(characterOrKey) : getPlayerCharacterByKey(characterOrKey?.key);
  return buildSheetSvg(character);
}

export function buildPlayerCharacterSheetDataUrl(characterOrKey) {
  return encodeSvgDataUrl(buildPlayerCharacterSheetSvg(characterOrKey));
}

export function loadSelectedPlayerCharacterKey() {
  const stored = load(PLAYER_CHARACTER_STORAGE_KEY, DEFAULT_PLAYER_CHARACTER_KEY);
  return getPlayerCharacterByKey(typeof stored === "string" ? stored : DEFAULT_PLAYER_CHARACTER_KEY).key;
}

export function saveSelectedPlayerCharacterKey(key) {
  const selectedKey = getPlayerCharacterByKey(key).key;
  save(PLAYER_CHARACTER_STORAGE_KEY, selectedKey);
  return selectedKey;
}

// P2's own pick (VS FRIEND). Without a saved pick, the fighter after P1 so the two differ.
export function loadSelectedPlayer2CharacterKey(player1Key = loadSelectedPlayerCharacterKey()) {
  const stored = load(PLAYER2_CHARACTER_STORAGE_KEY, null);
  if (typeof stored === "string" && PLAYER_CHARACTER_MAP.has(stored)) {
    return stored;
  }
  return cyclePlayerCharacterKey(player1Key, 1);
}

export function saveSelectedPlayer2CharacterKey(key) {
  const selectedKey = getPlayerCharacterByKey(key).key;
  save(PLAYER2_CHARACTER_STORAGE_KEY, selectedKey);
  return selectedKey;
}
