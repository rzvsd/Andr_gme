import { beforeEach, describe, expect, it, vi } from "vitest";
import { Background } from "../src/rendering/Background.js";

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.width = 0;
    this.height = 0;
    this.decoding = "";
    this._src = "";
  }

  set src(value) {
    this._src = String(value);
    this.complete = true;
    this.naturalWidth = 64;
    this.naturalHeight = 32;
    this.width = 64;
    this.height = 32;
  }

  get src() {
    return this._src;
  }
}

describe("Background image cache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = FakeImage;
  });

  it("evicts least-recently-used images when cache exceeds max entries", () => {
    const background = new Background([], "#000", 2);

    background.setLayers([{ imageSrc: "/a.png" }, { imageSrc: "/b.png" }]);
    background.setLayers([{ imageSrc: "/a.png" }]);
    background.setLayers([{ imageSrc: "/c.png" }]);

    expect(background._imageCache.size).toBe(2);
    expect(background._imageCache.has("/a.png")).toBe(true);
    expect(background._imageCache.has("/b.png")).toBe(false);
    expect(background._imageCache.has("/c.png")).toBe(true);
  });
});
