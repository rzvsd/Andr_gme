const STORAGE_PREFIX = 'bullet-dodge-arena:';

function getStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

function safeWarn(message, error) {
  const warn =
    typeof globalThis === 'object' && typeof globalThis.console?.warn === 'function'
      ? globalThis.console.warn.bind(globalThis.console)
      : null;

  if (!warn) {
    return;
  }

  if (error instanceof Error) {
    warn(`${message} (${error.name}: ${error.message})`);
    return;
  }

  warn(message);
}

export function save(key, data) {
  const storageKey = getStorageKey(key);
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  } catch (error) {
    safeWarn(`[storage] Failed to save key "${storageKey}".`, error);
    return false;
  }
}

export function load(key, fallbackValue = null) {
  const storageKey = getStorageKey(key);
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (rawValue === null) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    safeWarn(`[storage] Failed to load key "${storageKey}".`, error);
    return fallbackValue;
  }
}

export function remove(key) {
  const storageKey = getStorageKey(key);
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    safeWarn(`[storage] Failed to remove key "${storageKey}".`, error);
    return false;
  }
}
