import { beforeEach, describe, expect, it } from "vitest";
import { VersusInput } from "../src/core/VersusInput.js";

const VIEW_WIDTH = 800;

describe("VersusInput", () => {
  let input;

  beforeEach(() => {
    input = new VersusInput();
  });

  it("maps keyboards to separate players without overlap", () => {
    input.onKeyDown({ code: "KeyA", cancelable: false });
    input.onKeyDown({ code: "ArrowRight", cancelable: false });

    expect(input.isPressed(0, "left")).toBe(true);
    expect(input.isPressed(0, "right")).toBe(false);
    expect(input.isPressed(1, "left")).toBe(false);
    expect(input.isPressed(1, "right")).toBe(true);

    input.onKeyUp({ code: "KeyA", cancelable: false });
    expect(input.isPressed(0, "left")).toBe(false);
    expect(input.consumePressed(0, "left")).toBe(true);
    expect(input.consumePressed(0, "left")).toBe(false);
  });

  it("accepts two fingers per player and rejects a third", () => {
    expect(input.handlePointerDown({ id: "a", x: 100, y: 400 }, VIEW_WIDTH)).toBe(true);
    expect(input.handlePointerDown({ id: "b", x: 150, y: 400 }, VIEW_WIDTH)).toBe(true);
    expect(input.handlePointerDown({ id: "c", x: 120, y: 400 }, VIEW_WIDTH)).toBe(false);
    expect(input.handlePointerDown({ id: "d", x: 700, y: 400 }, VIEW_WIDTH)).toBe(true);
  });

  it("steers with the first finger and promotes the second on release", () => {
    input.handlePointerDown({ id: "a", x: 100, y: 400 }, VIEW_WIDTH);
    input.handlePointerDown({ id: "b", x: 150, y: 400 }, VIEW_WIDTH);
    input.handlePointerMove({ id: "a", x: 60, y: 400 }, VIEW_WIDTH);
    expect(input.isPressed(0, "left")).toBe(true);

    input.handlePointerUp({ id: "a", x: 60, y: 400 });
    // Finger b (x=150, left of zone center 168) takes over steering.
    expect(input.isPressed(0, "left")).toBe(true);

    input.handlePointerUp({ id: "b", x: 150, y: 400 });
    expect(input.isPressed(0, "left")).toBe(false);
    expect(input.isPressed(0, "shoot")).toBe(false);
  });

  it("fires on tap and jumps on swipe up", () => {
    input.handlePointerDown({ id: "a", x: 100, y: 400 }, VIEW_WIDTH);
    input.handlePointerUp({ id: "a", x: 102, y: 402 });
    expect(input.consumePressed(0, "shoot")).toBe(true);

    input.handlePointerDown({ id: "b", x: 700, y: 400 }, VIEW_WIDTH);
    input.handlePointerMove({ id: "b", x: 700, y: 360 }, VIEW_WIDTH);
    expect(input.consumePressed(1, "jump")).toBe(true);
    input.handlePointerUp({ id: "b", x: 700, y: 360 });
  });

  it("ignores the center dead zone", () => {
    expect(input.handlePointerDown({ id: "z", x: 400, y: 400 }, VIEW_WIDTH)).toBe(false);
  });
});
