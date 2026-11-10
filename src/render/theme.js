// One night-sky palette, used by the canvas and mirrored in styles.css.
export const INK = "#efe6cf";
export const GOLD = "#e8b84a";
export const RED = "#ec6f52";
export const TEAL = "#7fd1c7";
export const PAPER = ["#1c2b57", "#121c3c", "#0a1126"]; // centre, middle, edge of a sheet
export const BODY = "#17244b";

export const serif = (px, style = "") => `${style} ${px}px "EB Garamond", Georgia, "Times New Roman", serif`;
export const display = (px, style = "") => `${style} ${px}px "Cormorant Garamond", "EB Garamond", Georgia, serif`;

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const ROMAN = [
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];
export function roman(n) {
  let out = "";
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
