const STORAGE_PREFIX = 'bullet-dodge-arena:';

function getStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

export function save(key, data) {
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function load(key, fallbackValue = null) {
  try {
    const rawValue = localStorage.getItem(getStorageKey(key));
    if (rawValue === null) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(getStorageKey(key));
    return true;
  } catch {
    return false;
  }
}
