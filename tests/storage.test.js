import { beforeEach, describe, expect, it, vi } from "vitest";
import { load, remove, save } from "../src/utils/storage.js";

function createStorageMock(overrides = {}) {
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
    ...overrides,
  };
}

describe("storage utility", () => {
  beforeEach(() => {
    globalThis.localStorage = createStorageMock();
    vi.restoreAllMocks();
  });

  it("saves, loads, and removes values", () => {
    expect(save("profile", { level: 3 })).toBe(true);
    expect(load("profile")).toEqual({ level: 3 });
    expect(remove("profile")).toBe(true);
    expect(load("profile", "fallback")).toBe("fallback");
  });

  it("warns and returns fallback when load parsing fails", () => {
    globalThis.localStorage = createStorageMock({
      getItem() {
        return "{";
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const value = load("broken", { ok: false });

    expect(value).toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("warns and returns false when save/remove fail", () => {
    globalThis.localStorage = createStorageMock({
      setItem() {
        throw new Error("quota exceeded");
      },
      removeItem() {
        throw new Error("remove failed");
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(save("x", { a: 1 })).toBe(false);
    expect(remove("x")).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
