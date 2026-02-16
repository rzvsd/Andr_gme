import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "bullet-dodge-arena:settings";

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

describe("settings hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = createStorageMock();
  });

  it("coerces loaded settings to expected types and ranges", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        soundEnabled: "false",
        musicEnabled: 1,
        musicVolume: "1.5",
        sfxVolume: -3,
        controlScheme: "KEYBOARD",
        ignored: "value",
      })
    );

    const { loadSettings } = await import("../src/config/settings.js");
    const loaded = loadSettings();

    expect(loaded).toEqual({
      soundEnabled: false,
      musicEnabled: true,
      musicVolume: 1,
      sfxVolume: 0,
      controlScheme: "keyboard",
    });
    expect(loaded).not.toHaveProperty("ignored");
  });

  it("sanitizes partial saves and preserves previous valid values", async () => {
    const { loadSettings, saveSettings } = await import("../src/config/settings.js");

    const initial = loadSettings();
    expect(initial.musicVolume).toBe(0.7);

    const updated = saveSettings({
      soundEnabled: "0",
      musicVolume: "not-a-number",
      controlScheme: "unknown",
    });

    expect(updated).toEqual({
      soundEnabled: false,
      musicEnabled: true,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      controlScheme: "touch",
    });

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(persisted).toEqual(updated);
  });
});
