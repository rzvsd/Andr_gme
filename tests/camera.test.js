import { describe, expect, it } from "vitest";
import { Camera } from "../src/core/Camera.js";

describe("Camera pixel snapping", () => {
  it("keeps raw camera scroll while snapping rendered scroll to whole pixels", () => {
    const camera = new Camera(100, 80);
    camera.follow({ x: 10.4, y: 20.6, width: 20, height: 20 }, 1);

    camera.update();

    expect(camera.rawX).toBeCloseTo(-29.6, 5);
    expect(camera.rawY).toBeCloseTo(-9.4, 5);
    expect(camera.x).toBe(-30);
    expect(camera.y).toBe(-9);
  });

  it("rounds world-to-screen coordinates and syncs setPosition", () => {
    const camera = new Camera(200, 120);
    camera.setPosition(14.6, 27.2);

    const point = camera.worldToScreen(50.2, 70.8);

    expect(camera.rawX).toBeCloseTo(14.6, 5);
    expect(camera.x).toBe(15);
    expect(camera.rawY).toBeCloseTo(27.2, 5);
    expect(camera.y).toBe(27);
    expect(point).toEqual({ x: 35, y: 44 });
  });
});
