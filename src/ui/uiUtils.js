export function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function clamp(value, min, max) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(Math.max(value, lower), upper);
}

export function normalizePointerInput(pointerOrX, y, pointerId) {
  if (pointerOrX && typeof pointerOrX === "object") {
    const xValue = toNumber(pointerOrX.x, toNumber(pointerOrX.clientX, toNumber(pointerOrX.pageX, NaN)));
    const yValue = toNumber(pointerOrX.y, toNumber(pointerOrX.clientY, toNumber(pointerOrX.pageY, NaN)));
    const idValue = toNumber(
      pointerOrX.pointerId,
      toNumber(pointerOrX.identifier, toNumber(pointerOrX.id, 0)),
    );

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      return null;
    }

    return {
      x: xValue,
      y: yValue,
      id: idValue,
    };
  }

  const xValue = toNumber(pointerOrX, NaN);
  const yValue = toNumber(y, NaN);
  const idValue = toNumber(pointerId, 0);
  if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
    return null;
  }

  return {
    x: xValue,
    y: yValue,
    id: idValue,
  };
}

export function roundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = clamp(radius, 0, Math.min(width, height) * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

export function resolveViewportSize(ctx) {
  const canvas = ctx?.canvas ?? null;
  if (!canvas) {
    return { width: 0, height: 0 };
  }

  const directWidth = toNumber(canvas.clientWidth, 0);
  const directHeight = toNumber(canvas.clientHeight, 0);
  if (directWidth > 0 && directHeight > 0) {
    return { width: directWidth, height: directHeight };
  }

  const transform = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const scaleX = transform && Number.isFinite(transform.a) && Math.abs(transform.a) > 0 ? Math.abs(transform.a) : 1;
  const scaleY = transform && Number.isFinite(transform.d) && Math.abs(transform.d) > 0 ? Math.abs(transform.d) : 1;
  return {
    width: toNumber(canvas.width, 0) / scaleX,
    height: toNumber(canvas.height, 0) / scaleY,
  };
}

export function pickNumber(source, keys, fallback = 0) {
  if (!source || typeof source !== "object") {
    return fallback;
  }

  for (const key of keys) {
    const numericValue = Number(source[key]);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return fallback;
}

export function formatNumber(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (typeof safeValue.toLocaleString === "function") {
    return safeValue.toLocaleString("en-US");
  }
  return String(safeValue);
}
