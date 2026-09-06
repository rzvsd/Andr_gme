import { beforeEach, describe, expect, it } from "vitest";
import {
  cycleVersusMatchModeKey,
  getVersusMatchMode,
  loadSelectedVersusMatchModeKey,
  saveSelectedVersusMatchModeKey,
  VERSUS_MATCH_MODE_ROSTER,
} from "../src/config/versusMatchMode.js";

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

describe("versus match mode", () => {
  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
  });

  it("exposes the supported local versus modes", () => {
    expect(VERSUS_MATCH_MODE_ROSTER.map((mode) => mode.key)).toEqual([
      "human-vs-human",
      "human-vs-bot",
    ]);
    expect(getVersusMatchMode("human-vs-bot").p2Label).toBe("BOT");
  });

  it("persists and restores the selected mode", () => {
    expect(loadSelectedVersusMatchModeKey()).toBe("human-vs-human");
    expect(saveSelectedVersusMatchModeKey("human-vs-bot")).toBe("human-vs-bot");
    expect(loadSelectedVersusMatchModeKey()).toBe("human-vs-bot");
  });

  it("cycles cleanly through the roster", () => {
    expect(cycleVersusMatchModeKey("human-vs-human", 1)).toBe("human-vs-bot");
    expect(cycleVersusMatchModeKey("human-vs-bot", 1)).toBe("human-vs-human");
    expect(cycleVersusMatchModeKey("human-vs-human", -1)).toBe("human-vs-bot");
  });
});
