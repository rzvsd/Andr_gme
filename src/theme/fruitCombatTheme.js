import { ENEMY_TYPES } from "../entities/Enemy.js";
import { DEFAULT_PLAYER_CHARACTER_KEY, getPlayerCharacterByKey } from "./playerRoster.js";

const PLAYER_BULLET_FRAME_BY_KEY = Object.freeze({
  pear: 0,
  strawberry: 1,
  orange: 2,
  banana: 3,
  pineapple: 4,
  apple: 5,
});

export function getPlayerFruitTheme(characterKey = DEFAULT_PLAYER_CHARACTER_KEY) {
  const character = getPlayerCharacterByKey(characterKey);
  return Object.freeze({
    key: character.key,
    name: character.name,
    spriteFrame: 0,
    bulletFrame: PLAYER_BULLET_FRAME_BY_KEY[character.key] ?? 0,
    bulletCore: character.bulletCore,
    bulletAccent: character.bulletAccent,
    bulletGlow: character.bulletGlow,
    juiceColors: character.juiceColors,
  });
}

export const PLAYER_FRUIT_THEME = getPlayerFruitTheme(DEFAULT_PLAYER_CHARACTER_KEY);

export const ENEMY_FRUIT_THEMES = Object.freeze({
  [ENEMY_TYPES.GRUNT]: Object.freeze({
    key: "strawberry",
    name: "Strawberry Scout",
    spriteFrame: 0,
    bulletFrame: 1,
    bulletCore: "#ff5f73",
    bulletAccent: "#ffd2db",
    bulletGlow: "rgba(255, 124, 151, 0.72)",
    juiceColors: ["#ffccd4", "#ff6f84", "#cb334d"],
  }),
  [ENEMY_TYPES.SNIPER]: Object.freeze({
    key: "orange",
    name: "Orange Spotter",
    spriteFrame: 1,
    bulletFrame: 2,
    bulletCore: "#ffaf48",
    bulletAccent: "#ffe0af",
    bulletGlow: "rgba(255, 182, 98, 0.72)",
    juiceColors: ["#ffe2b1", "#ffb151", "#dd7c22"],
  }),
  [ENEMY_TYPES.RUSHER]: Object.freeze({
    key: "banana",
    name: "Banana Dash",
    spriteFrame: 2,
    bulletFrame: 3,
    bulletCore: "#f4df68",
    bulletAccent: "#fff4bc",
    bulletGlow: "rgba(246, 226, 120, 0.74)",
    juiceColors: ["#fff5b8", "#f1d953", "#d0b62e"],
  }),
  [ENEMY_TYPES.TANK]: Object.freeze({
    key: "pineapple",
    name: "Pineapple Brute",
    spriteFrame: 3,
    bulletFrame: 4,
    bulletCore: "#cc9d42",
    bulletAccent: "#fff0c8",
    bulletGlow: "rgba(213, 173, 93, 0.74)",
    juiceColors: ["#ffe8a7", "#d4a74f", "#8d6122"],
  }),
  [ENEMY_TYPES.BOSS]: Object.freeze({
    key: "pineapple",
    name: "Pineapple Brute",
    spriteFrame: 3,
    bulletFrame: 4,
    bulletCore: "#cc9d42",
    bulletAccent: "#fff0c8",
    bulletGlow: "rgba(213, 173, 93, 0.74)",
    juiceColors: ["#ffe8a7", "#d4a74f", "#8d6122"],
  }),
});

const DEFAULT_ENEMY_THEME = ENEMY_FRUIT_THEMES[ENEMY_TYPES.GRUNT];

export function getEnemyFruitTheme(type) {
  return ENEMY_FRUIT_THEMES[type] ?? DEFAULT_ENEMY_THEME;
}

export function getActorFruitTheme(actor) {
  if (actor?.isPlayer === true || Number.isInteger(actor?.playerIndex)) {
    return getPlayerFruitTheme(actor?.characterKey);
  }

  if (typeof actor?.type === "string") {
    return getEnemyFruitTheme(actor.type);
  }

  return getPlayerFruitTheme();
}

export function getBulletFruitTheme(bullet) {
  const owner = bullet?.owner;

  if (typeof owner === "string" && owner.toLowerCase() === "player") {
    return getPlayerFruitTheme(bullet?.characterKey);
  }

  if (owner?.isPlayer === true || Number.isInteger(owner?.playerIndex)) {
    return getPlayerFruitTheme(owner?.characterKey ?? bullet?.characterKey);
  }

  if (typeof owner?.type === "string") {
    return getEnemyFruitTheme(owner.type);
  }

  return getPlayerFruitTheme();
}
