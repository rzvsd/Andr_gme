import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPlayerCharacterSheetDataUrl,
  getPlayerCharacterByKey,
  loadSelectedPlayer2CharacterKey,
  loadSelectedPlayerCharacterKey,
  pickRandomPlayerCharacterKey,
  PLAYER_CHARACTER_ROSTER,
  saveSelectedPlayer2CharacterKey,
  saveSelectedPlayerCharacterKey,
} from "../src/theme/playerRoster.js";

function createStorageMock() {
  const store = new Map();
  return {
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
  };
}

describe("player roster", () => {
  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
  });

  it("exposes the four hero-lab fighters", () => {
    expect(PLAYER_CHARACTER_ROSTER.map((character) => character.key)).toEqual(["pudd", "chonk", "ninja", "vector"]);
    expect(new Set(PLAYER_CHARACTER_ROSTER.map((character) => character.label)).size).toBe(4);
  });

  it("persists and restores the selected character key", () => {
    expect(loadSelectedPlayerCharacterKey()).toBe("pudd");
    expect(saveSelectedPlayerCharacterKey("chonk")).toBe("chonk");
    expect(loadSelectedPlayerCharacterKey()).toBe("chonk");
    expect(getPlayerCharacterByKey("chonk").name).toBe("Chonk");
  });

  it("gives P2 a different default fighter than P1 and persists P2's own pick separately", () => {
    expect(loadSelectedPlayer2CharacterKey("pudd")).toBe("chonk");
    expect(loadSelectedPlayer2CharacterKey("vector")).toBe("pudd");
    expect(saveSelectedPlayer2CharacterKey("ninja")).toBe("ninja");
    expect(loadSelectedPlayer2CharacterKey("ninja")).toBe("ninja");
    expect(loadSelectedPlayerCharacterKey()).toBe("pudd");
    expect(saveSelectedPlayer2CharacterKey("pear")).toBe("pudd");
  });

  it("falls back to Pudd for a key from the retired fruit roster", () => {
    expect(getPlayerCharacterByKey("pear").key).toBe("pudd");
  });

  it("builds a data URL sprite sheet for any roster entry", () => {
    const dataUrl = buildPlayerCharacterSheetDataUrl("chonk");
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(dataUrl)).toContain("#c9b6f5");
  });

  it("can pick a random roster entry that excludes the selected character", () => {
    expect(pickRandomPlayerCharacterKey("pudd", 0)).toBe("chonk");
    expect(pickRandomPlayerCharacterKey("pudd", 0.999)).toBe("vector");
    expect(pickRandomPlayerCharacterKey("chonk", 0.6)).not.toBe("chonk");
  });
});
