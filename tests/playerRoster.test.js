import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPlayerCharacterSheetDataUrl,
  getPlayerCharacterByKey,
  loadSelectedPlayerCharacterKey,
  PLAYER_CHARACTER_ROSTER,
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

  it("exposes six selectable fruit soldiers", () => {
    expect(PLAYER_CHARACTER_ROSTER).toHaveLength(6);
    expect(new Set(PLAYER_CHARACTER_ROSTER.map((character) => character.goggles)).size).toBe(6);
  });

  it("persists and restores the selected character key", () => {
    expect(loadSelectedPlayerCharacterKey()).toBe("pear");
    expect(saveSelectedPlayerCharacterKey("banana")).toBe("banana");
    expect(loadSelectedPlayerCharacterKey()).toBe("banana");
    expect(getPlayerCharacterByKey("banana").name).toBe("Banana Runner");
  });

  it("builds a data URL sprite sheet for any roster entry", () => {
    const dataUrl = buildPlayerCharacterSheetDataUrl("apple");
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(dataUrl)).toContain("#ff8a76");
  });
});
