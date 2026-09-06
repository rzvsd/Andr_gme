import { load, save } from "../utils/storage.js";

export const VERSUS_MATCH_MODE_STORAGE_KEY = "versus_match_mode";
export const DEFAULT_VERSUS_MATCH_MODE_KEY = "human-vs-human";

export const VERSUS_MATCH_MODE_ROSTER = Object.freeze([
  Object.freeze({
    key: "human-vs-human",
    name: "Human vs Human",
    shortLabel: "PVP",
    description: "Two local players share the arena.",
    p1Label: "P1",
    p2Label: "P2",
    botEnabled: false,
  }),
  Object.freeze({
    key: "human-vs-bot",
    name: "Human vs Bot",
    shortLabel: "BOT DUEL",
    description: "You fight an AI-controlled fruit rival.",
    p1Label: "YOU",
    p2Label: "BOT",
    botEnabled: true,
  }),
]);

const VERSUS_MATCH_MODE_MAP = new Map(
  VERSUS_MATCH_MODE_ROSTER.map((mode, index) => [mode.key, Object.freeze({ ...mode, index })])
);

export function getVersusMatchMode(key = DEFAULT_VERSUS_MATCH_MODE_KEY) {
  return VERSUS_MATCH_MODE_MAP.get(key) ?? VERSUS_MATCH_MODE_MAP.get(DEFAULT_VERSUS_MATCH_MODE_KEY);
}

export function cycleVersusMatchModeKey(currentKey, direction = 1) {
  const currentMode = getVersusMatchMode(currentKey);
  const step = direction < 0 ? -1 : 1;
  const nextIndex =
    (currentMode.index + step + VERSUS_MATCH_MODE_ROSTER.length) % VERSUS_MATCH_MODE_ROSTER.length;
  return VERSUS_MATCH_MODE_ROSTER[nextIndex].key;
}

export function isVersusBotMatchMode(key) {
  return getVersusMatchMode(key).botEnabled === true;
}

export function loadSelectedVersusMatchModeKey() {
  const stored = load(VERSUS_MATCH_MODE_STORAGE_KEY, DEFAULT_VERSUS_MATCH_MODE_KEY);
  return getVersusMatchMode(typeof stored === "string" ? stored : DEFAULT_VERSUS_MATCH_MODE_KEY).key;
}

export function saveSelectedVersusMatchModeKey(key) {
  const selectedKey = getVersusMatchMode(key).key;
  save(VERSUS_MATCH_MODE_STORAGE_KEY, selectedKey);
  return selectedKey;
}
