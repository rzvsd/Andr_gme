export function clamp(value, min, max) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  return Math.min(Math.max(value, lower), upper);
}

export function lerp(start, end, alpha) {
  const normalizedAlpha = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : 0;

  return start + (end - start) * normalizedAlpha;
}

export function randomRange(min, max) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  return Math.random() * (upper - lower) + lower;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
