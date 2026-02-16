export function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

export function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

export function isActiveEntity(entity) {
  return Boolean(entity) && entity.active !== false;
}

export function emitEvent(eventBus, eventName, payload) {
  if (!eventBus || typeof eventBus.emit !== "function") {
    return;
  }
  eventBus.emit(eventName, payload);
}

export function resolveNowMs(nowValue) {
  const numericNowMs = Number(nowValue);
  if (Number.isFinite(numericNowMs)) {
    return numericNowMs;
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
