const isDev = () => Boolean(import.meta?.env?.DEV);

export function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function isObject(value) {
  return Boolean(value) && typeof value === "object";
}

export function asPointer(pointer) {
  if (!isObject(pointer)) {
    return null;
  }

  const x = asNumber(pointer.x, asNumber(pointer.clientX, NaN));
  const y = asNumber(pointer.y, asNumber(pointer.clientY, NaN));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x,
    y,
    id: pointer.id ?? pointer.pointerId ?? pointer.identifier ?? "primary",
  };
}

export function rectContains(rect, pointer) {
  return (
    pointer.x >= rect.x &&
    pointer.x <= rect.x + rect.width &&
    pointer.y >= rect.y &&
    pointer.y <= rect.y + rect.height
  );
}

export function callAny(target, names, argsVariants, debugLabel = "scene-call") {
  if (!isObject(target)) {
    return { called: false, value: undefined };
  }

  for (const name of names) {
    if (typeof target[name] !== "function") {
      continue;
    }

    let lastError = null;
    for (const args of argsVariants) {
      try {
        const value = target[name](...args);
        return { called: true, value };
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && isDev()) {
      console.error(`[${debugLabel}] ${name} failed for all signatures`, lastError);
    }
  }

  return { called: false, value: undefined };
}

export function pointerAliases(methodName) {
  if (methodName === "handlePointerDown") {
    return ["handlePointerDown", "pointerDown", "onPointerDown"];
  }
  if (methodName === "handlePointerMove") {
    return ["handlePointerMove", "pointerMove", "onPointerMove"];
  }
  if (methodName === "handlePointerUp") {
    return ["handlePointerUp", "pointerUp", "onPointerUp"];
  }
  if (methodName === "handlePointerCancel") {
    return ["handlePointerCancel", "pointerCancel", "onPointerCancel"];
  }
  return [methodName];
}
