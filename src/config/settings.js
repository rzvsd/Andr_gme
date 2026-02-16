import { load as loadStorage, save as saveStorage } from '../utils/storage.js';

const STORAGE_KEY = 'settings';

export const DEFAULT_SETTINGS = Object.freeze({
  soundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  controlScheme: 'touch',
});

let currentSettings = { ...DEFAULT_SETTINGS };

function asSettingsObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return {};
}

function persistSettings(settings) {
  saveStorage(STORAGE_KEY, settings);
}

export function loadSettings() {
  const loaded = asSettingsObject(loadStorage(STORAGE_KEY, {}));

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
