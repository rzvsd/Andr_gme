import { load as loadStorage, save as saveStorage } from '../utils/storage.js';

const STORAGE_KEY = 'settings';
const VALID_CONTROL_SCHEMES = new Set(['touch', 'keyboard']);

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function coerceBoolean(value, fallbackValue) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  return fallbackValue;
}

function coerceVolume(value, fallbackValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallbackValue;
  }

  return clamp(numeric, 0, 1);
}

function coerceControlScheme(value, fallbackValue) {
  if (typeof value !== 'string') {
    return fallbackValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!VALID_CONTROL_SCHEMES.has(normalized)) {
    return fallbackValue;
  }

  return normalized;
}

function normalizeSettings(rawSettings, fallbackSettings = DEFAULT_SETTINGS) {
  const source = asSettingsObject(rawSettings);
  const fallback = asSettingsObject(fallbackSettings);

  return {
    soundEnabled: coerceBoolean(source.soundEnabled, fallback.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled),
    musicEnabled: coerceBoolean(source.musicEnabled, fallback.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled),
    musicVolume: coerceVolume(source.musicVolume, fallback.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
    sfxVolume: coerceVolume(source.sfxVolume, fallback.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
    controlScheme: coerceControlScheme(
      source.controlScheme,
      fallback.controlScheme ?? DEFAULT_SETTINGS.controlScheme
    ),
  };
}

function persistSettings(settings) {
  saveStorage(STORAGE_KEY, settings);
}

export function loadSettings() {
  const loaded = loadStorage(STORAGE_KEY, {});
  currentSettings = normalizeSettings(loaded, DEFAULT_SETTINGS);
  return { ...currentSettings };
}

export function saveSettings(partialOrFull = {}) {
  currentSettings = normalizeSettings(partialOrFull, currentSettings);
  persistSettings(currentSettings);
  return { ...currentSettings };
}

export function resetSettings() {
  currentSettings = { ...DEFAULT_SETTINGS };
  persistSettings(currentSettings);
  return { ...currentSettings };
}
