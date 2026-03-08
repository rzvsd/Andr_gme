import { load, save } from "../utils/storage.js";

export const PLAYER_CHARACTER_STORAGE_KEY = "selected_character";
export const DEFAULT_PLAYER_CHARACTER_KEY = "pear";
export const PLAYER_CHARACTER_FRAME_SIZE = 64;
export const PLAYER_CHARACTER_FEET_Y = 46.8;
export const PLAYER_CHARACTER_FEET_RATIO = PLAYER_CHARACTER_FEET_Y / PLAYER_CHARACTER_FRAME_SIZE;

export const PLAYER_CHARACTER_ROSTER = Object.freeze([
  Object.freeze({
    key: "pear",
    name: "Pear Commando",
    bodyVariant: "pear",
    goggles: "round",
    bodyTop: "#d8ea73",
    bodyBottom: "#86b53d",
    highlight: "#f2f7ad",
    shadow: "#597a28",
    leaf: "#4d8a40",
    packTop: "#4d7244",
    packBottom: "#274329",
    strap: "#4f5b2c",
    launcherTop: "#f6bd64",
    launcherBottom: "#cf7e2b",
    bulletCore: "#d8ea73",
    bulletAccent: "#90be45",
    bulletGlow: "rgba(220, 243, 133, 0.85)",
    juiceColors: ["#eef7a3", "#b5d957", "#7ea63a"],
  }),
  Object.freeze({
    key: "strawberry",
    name: "Strawberry Striker",
    bodyVariant: "strawberry",
    goggles: "heart",
    bodyTop: "#ff8ca0",
    bodyBottom: "#d93c57",
    highlight: "#ffd7de",
    shadow: "#a83046",
    leaf: "#5b9d41",
    packTop: "#5f6547",
    packBottom: "#313b29",
    strap: "#5e3b3f",
    launcherTop: "#ffb0ba",
    launcherBottom: "#da5a6d",
    bulletCore: "#ff5f73",
    bulletAccent: "#ffd2db",
    bulletGlow: "rgba(255, 124, 151, 0.72)",
    juiceColors: ["#ffccd4", "#ff6f84", "#cb334d"],
  }),
  Object.freeze({
    key: "orange",
    name: "Orange Ranger",
    bodyVariant: "orange",
    goggles: "visor",
    bodyTop: "#ffc564",
    bodyBottom: "#ef882b",
    highlight: "#ffe3ae",
    shadow: "#d7731e",
    leaf: "#67a447",
    packTop: "#6f6243",
    packBottom: "#3f3220",
    strap: "#805229",
    launcherTop: "#ffd08d",
    launcherBottom: "#d28025",
    bulletCore: "#ffaf48",
    bulletAccent: "#ffe0af",
    bulletGlow: "rgba(255, 182, 98, 0.72)",
    juiceColors: ["#ffe2b1", "#ffb151", "#dd7c22"],
  }),
  Object.freeze({
    key: "pineapple",
    name: "Pineapple Sapper",
    bodyVariant: "pineapple",
    goggles: "heavy",
    bodyTop: "#f5d76d",
    bodyBottom: "#b88433",
    highlight: "#f9e4ae",
    shadow: "#8c6825",
    leaf: "#5e9645",
    packTop: "#59683e",
    packBottom: "#334021",
    strap: "#6f5326",
    launcherTop: "#f1d08b",
    launcherBottom: "#ad6d2f",
    bulletCore: "#cc9d42",
    bulletAccent: "#fff0c8",
    bulletGlow: "rgba(213, 173, 93, 0.74)",
    juiceColors: ["#ffe8a7", "#d4a74f", "#8d6122"],
  }),
  Object.freeze({
    key: "banana",
    name: "Banana Runner",
    bodyVariant: "banana",
    goggles: "speed",
    bodyTop: "#fff07d",
    bodyBottom: "#d7b833",
    highlight: "#fff8bd",
    shadow: "#b99724",
    leaf: "#6d9440",
    packTop: "#726949",
    packBottom: "#40351f",
    strap: "#8b7224",
    launcherTop: "#fff1a7",
    launcherBottom: "#d2ab31",
    bulletCore: "#f4df68",
    bulletAccent: "#fff4bc",
    bulletGlow: "rgba(246, 226, 120, 0.74)",
    juiceColors: ["#fff5b8", "#f1d953", "#d0b62e"],
  }),
  Object.freeze({
    key: "apple",
    name: "Apple Ace",
    bodyVariant: "apple",
    goggles: "aviator",
    bodyTop: "#ff8a76",
    bodyBottom: "#cb4436",
    highlight: "#ffd5cf",
    shadow: "#9f3025",
    leaf: "#5fa14a",
    packTop: "#6d5444",
    packBottom: "#37241f",
    strap: "#733835",
    launcherTop: "#f6bc87",
    launcherBottom: "#c66946",
    bulletCore: "#ff8a76",
    bulletAccent: "#ffd3ca",
    bulletGlow: "rgba(255, 151, 131, 0.74)",
    juiceColors: ["#ffd5cf", "#ff8a76", "#c74433"],
  }),
]);

const PLAYER_CHARACTER_MAP = new Map(
  PLAYER_CHARACTER_ROSTER.map((character, index) => [character.key, { ...character, index }])
);

function buildBodyDefinition(character) {
  const { bodyVariant, bodyTop, bodyBottom, highlight, shadow, leaf, strap } = character;
  const fill = `fill="url(#bodyGrad)" stroke="#1b2a16" stroke-width="1.5" stroke-linejoin="round"`;

  switch (bodyVariant) {
    case "strawberry":
      return `
        <g id="fruitBody">
          <path d="M0 -12C8 -12 13 -6 13 1C13 10 7 19 0 19C-7 19 -13 10 -13 1C-13 -6 -8 -12 0 -12Z" ${fill}/>
          <path d="M-9 -11C-4 -15 4 -15 9 -11" stroke="${leaf}" stroke-width="2" stroke-linecap="round"/>
          <path d="M-4 7H6" stroke="${shadow}" stroke-width="1.4" stroke-linecap="round" opacity="0.45"/>
          <circle cx="-4.5" cy="-1" r="0.8" fill="${highlight}"/>
          <circle cx="2.2" cy="-2.5" r="0.8" fill="${highlight}"/>
          <circle cx="5.5" cy="4.4" r="0.8" fill="${highlight}"/>
          <path d="M-8 8.5H8V13H-8Z" fill="${strap}" stroke="#1b2a16" stroke-width="1"/>
        </g>`;
    case "orange":
      return `
        <g id="fruitBody">
          <circle cx="0" cy="4" r="13" ${fill}/>
          <path d="M0 -9L1.7 4L0 15L-1.7 4Z" fill="${highlight}" opacity="0.95"/>
          <path d="M-12 4L0 2.3L12 4L0 5.8Z" fill="${highlight}" opacity="0.95"/>
          <path d="M-4 -13C0 -15.5 4 -14.3 5.4 -10.6" stroke="${leaf}" stroke-width="1.9" stroke-linecap="round"/>
          <path d="M-8 10.2H8V14.6H-8Z" fill="${strap}" stroke="#1b2a16" stroke-width="1"/>
        </g>`;
    case "pineapple":
      return `
        <g id="fruitBody">
          <path d="M-10 -7H9L13 -2V13L8 19H-9L-13 13V-2L-10 -7Z" ${fill}/>
          <path d="M-9 -7L-5 -14L0 -9L5 -15L9 -7" stroke="${leaf}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M-8 -1H8" stroke="${highlight}" stroke-width="1.1" stroke-linecap="round"/>
          <path d="M-8 6H8" stroke="${highlight}" stroke-width="1.1" stroke-linecap="round"/>
          <path d="M-8 12H8" stroke="${highlight}" stroke-width="1.1" stroke-linecap="round"/>
          <path d="M0 -3V16" stroke="${shadow}" stroke-width="1" stroke-linecap="round"/>
          <path d="M-5 -1L5 15" stroke="${shadow}" stroke-width="1" stroke-linecap="round"/>
          <path d="M5 -1L-5 15" stroke="${shadow}" stroke-width="1" stroke-linecap="round"/>
          <path d="M-9 8.4H9V13.2H-9Z" fill="${strap}" stroke="#1b2a16" stroke-width="1"/>
        </g>`;
    case "banana":
      return `
        <g id="fruitBody">
          <path d="M-12 2C-10 -9 -1 -14 10 -11C6 -4 3 2 1 8C-1 13 -4 17 -10 18C-11.4 16.8 -12 15 -12 12.8C-12 9.6 -12 6 -12 2Z" ${fill}/>
          <path d="M-8.5 5.8C-6.7 -1.4 -1.8 -6.8 6.1 -8.8" stroke="${highlight}" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M-2 10H8" stroke="${shadow}" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/>
          <path d="M-4 9.2H8V13.1H-4Z" fill="${strap}" stroke="#1b2a16" stroke-width="1"/>
        </g>`;
    case "apple":
      return `
        <g id="fruitBody">
          <path d="M0 -13C6 -13 10 -9 10 -4C13 -4 15 -1 15 5C15 14 8 21 0 21C-8 21 -15 14 -15 5C-15 -1 -13 -4 -10 -4C-10 -9 -6 -13 0 -13Z" ${fill}/>
          <path d="M-4 -12C-1 -15 3 -15 5 -12" stroke="#7d2e25" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M-6 -11C-8 -15 -2 -18 2 -16" stroke="${leaf}" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M-6 9.8H7V14.1H-6Z" fill="${strap}" stroke="#1b2a16" stroke-width="1"/>
          <path d="M-7 -7C-10 -1 -10 10 -5 17" stroke="${highlight}" stroke-width="1.8" stroke-linecap="round" opacity="0.82"/>
        </g>`;
    case "pear":
    default:
      return `
        <g id="fruitBody">
          <path d="M0 -16C7 -16 12 -11 12 -4C12 1 14 6 14 11C14 19 8 25 0 26C-9 26 -15 19 -15 10C-15 5 -13 1 -12 -5C-11 -11 -6 -16 0 -16Z" ${fill}/>
          <path d="M-5 -12C-9 -7 -10 2 -10 9C-10 16 -7 21 -3 24" stroke="${highlight}" stroke-width="2.4" stroke-linecap="round" opacity="0.82"/>
          <path d="M6 -12C11 -7 12 4 12 11C12 18 8 23 2 25" stroke="${shadow}" stroke-width="1.7" stroke-linecap="round" opacity="0.55"/>
          <path d="M-6 10H8" stroke="${shadow}" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
          <path d="M-8 8.5H7.5V13.4H-8Z" fill="${strap}" stroke="#1b2a16" stroke-width="1.1"/>
          <rect x="-1.3" y="-20.5" width="2.6" height="6.2" rx="1.2" fill="#6a4327" stroke="#1b2a16" stroke-width="1"/>
          <path d="M1.8 -18.4C7.4 -19.8 10.3 -17.7 10.9 -13.9C6.6 -12.2 3.5 -13.2 1.8 -18.4Z" fill="${leaf}" stroke="#1b2a16" stroke-width="1"/>
        </g>`;
  }
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
