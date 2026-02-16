const STORAGE_KEY = 'bullet-dodge-arena:settings';

export const DEFAULT_SETTINGS = Object.freeze({
  soundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  controlScheme: 'touch',
});

let currentSettings = { ...DEFAULT_SETTINGS };

function hasLocalStorage() {
  return typeof localStorage !== 'undefined' && localStorage !== null;
}

function asSettingsObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return {};
}

function persistSettings(settings) {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write failures (quota, privacy mode, etc).
  }
}

export function loadSettings() {
  let loaded = {};

  if (hasLocalStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      loaded = raw ? asSettingsObject(JSON.parse(raw)) : {};
    } catch {
      loaded = {};
    }
  }

  currentSettings = { ...DEFAULT_SETTINGS, ...loaded };
  return { ...currentSettings };
}

export function saveSettings(partialOrFull = {}) {
  const next = { ...currentSettings, ...asSettingsObject(partialOrFull) };
  currentSettings = { ...DEFAULT_SETTINGS, ...next };
  persistSettings(currentSettings);
  return { ...currentSettings };
}

export function resetSettings() {
  currentSettings = { ...DEFAULT_SETTINGS };
  persistSettings(currentSettings);
  return { ...currentSettings };
}
