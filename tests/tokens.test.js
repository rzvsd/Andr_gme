import { describe, expect, it } from "vitest";
import {
  COLORS,
  HIT,
  SPACE,
  TEAM_COLORS,
  TYPE,
  displayFont,
  font,
  textFont,
  trackingPx,
  typeScale,
  withAlpha,
} from "../src/theme/tokens.js";

const HEX = /^#[0-9a-f]{6}$/i;
const RGBA = /^rgba\(\d+, \d+, \d+, (0|1|0?\.\d+)\)$/;

describe("design tokens", () => {
  it("defines every colour as hex or rgba", () => {
    for (const [name, value] of Object.entries(COLORS)) {
      expect(HEX.test(value) || RGBA.test(value), `${name}=${value}`).toBe(true);
    }
    expect(TEAM_COLORS[0].main).toBe(COLORS.p1);
    expect(TEAM_COLORS[1].main).toBe(COLORS.p2);
  });

  it("keeps the type scale descending and never below the 11 px floor", () => {
    expect(TYPE.d0).toBeGreaterThan(TYPE.d1);
    expect(TYPE.d1).toBeGreaterThan(TYPE.d2);
    expect(TYPE.d2).toBeGreaterThan(TYPE.t1);
    expect(TYPE.t1).toBeGreaterThan(TYPE.t2);
    expect(TYPE.t2).toBeGreaterThanOrEqual(TYPE.min);
    expect(font(600, 4).startsWith(`600 ${TYPE.min}px`)).toBe(true);
  });

  it("builds canvas font strings from the two families", () => {
    expect(displayFont(32)).toBe('700 32px "Chakra Petch", "Trebuchet MS", Arial, sans-serif');
    expect(textFont(16)).toBe('600 16px Inter, "Segoe UI", Roboto, Arial, sans-serif');
    expect(trackingPx(32)).toBe(3);
  });

  it("meets the touch rules: 48 px targets, 8 px gaps, 40 px edge strips", () => {
    expect(HIT.min).toBeGreaterThanOrEqual(48);
    expect(HIT.gap).toBeGreaterThanOrEqual(8);
    expect(HIT.primary).toBeGreaterThanOrEqual(56);
    expect(SPACE.noTapX).toBeGreaterThanOrEqual(40);
  });

  it("scales type with the viewport height inside a legible band", () => {
    expect(typeScale(411)).toBe(1);
    expect(typeScale(390)).toBeCloseTo(0.949, 2);
    expect(typeScale(200)).toBe(0.85);
    expect(typeScale(2000)).toBe(1.3);
    expect(typeScale("x")).toBe(1);
  });

  it("converts hex to rgba and leaves other strings alone", () => {
    expect(withAlpha("#5ef0b8", 0.5)).toBe("rgba(94, 240, 184, 0.5)");
    expect(withAlpha("rgba(1, 2, 3, 0.4)", 0.9)).toBe("rgba(1, 2, 3, 0.4)");
  });
});
