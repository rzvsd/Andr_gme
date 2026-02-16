import {
  canUseHtmlAudio,
  clampVolume,
  resolveAudioSource,
  unlockAudioProbe,
} from "./audioUtils.js";

const DEFAULT_EVENT_SOUND_MAP = Object.freeze({
  bullet_fired: "pew",
  player_hit: "hit",
  enemy_killed: "explosion",
  bullet_dodged: "whoosh",
  wave_cleared: "fanfare",
  ui_click: "ui_click",
});

export class AudioManager {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus ?? null;
    this.enabled = options.enabled !== false;
    this.volume = clampVolume(options.volume ?? 1);
    this.basePath = typeof options.basePath === "string" ? options.basePath : "/audio";
    this.maxPoolSize = Number.isFinite(options.maxPoolSize) ? Math.max(1, Math.floor(options.maxPoolSize)) : 6;
    this.sounds = options.sounds && typeof options.sounds === "object" ? options.sounds : {};
    this.eventSoundMap = {
      ...DEFAULT_EVENT_SOUND_MAP,
      ...(options.eventSoundMap && typeof options.eventSoundMap === "object" ? options.eventSoundMap : {}),
    };

    this.subscriptions = [];
    this.audioPools = new Map();
    this.failedSounds = new Set();
    this.failedSourceIndexes = new Map();
    this.missingAssetWarnings = new Set();
    this.pendingPlays = [];
    this.unlocked = options.unlocked === true;
    this.disposed = false;
  }

  subscribe() {
    if (this.disposed) return this;
    this.unsubscribe();

    if (!this.eventBus || typeof this.eventBus.on !== "function") {
      return this;
    }

    const handlers = [
      ["bullet_fired", () => this.play(this.eventSoundMap.bullet_fired)],
      ["player_hit", () => this.play(this.eventSoundMap.player_hit)],
      ["enemy_killed", () => this.play(this.eventSoundMap.enemy_killed)],
      ["bullet_dodged", () => this.play(this.eventSoundMap.bullet_dodged)],
      ["wave_cleared", () => this.play(this.eventSoundMap.wave_cleared)],
      [
        "ui_click",
        () => {
          this.unlock();
          this.play(this.eventSoundMap.ui_click);
        },
      ],
      ["scene:switch", () => this.unlock()],
    ];

    for (const [eventName, handler] of handlers) {
      const off = this.eventBus.on(eventName, handler);
      if (typeof off === "function") {
        this.subscriptions.push(off);
      }
    }

    return this;
  }

  unsubscribe() {
    for (const off of this.subscriptions) {
      try {
        off();
      } catch {
        // Ignore listener cleanup errors.
      }
    }
    this.subscriptions = [];
    return this;
  }

  unlock() {
    if (this.disposed || this.unlocked || !canUseHtmlAudio()) {
      if (!canUseHtmlAudio()) {
        this.unlocked = true;
      }
      return;
    }

    unlockAudioProbe(() => {
      this.unlocked = true;
      this.#flushPendingPlays();
    });
  }

  play(name) {
    if (this.disposed || !this.enabled || !name || !canUseHtmlAudio()) {
      return false;
    }

    if (this.failedSounds.has(name)) {
      return false;
    }

    if (!this.unlocked) {
      this.#queuePendingPlay(name);
      return false;
    }

    const pool = this.#getPool(name);
    let audio = pool.find((item) => item.paused || item.ended);

    if (!audio && pool.length < this.maxPoolSize) {
      audio = this.#createAudio(name);
      if (audio) {
        pool.push(audio);
      }
    }

    if (!audio) {
      return false;
    }

    audio.volume = this.volume;
    try {
      audio.currentTime = 0;
    } catch {
      // Ignore seek errors for not-yet-ready media.
    }

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => this.#handlePlayError(name, audio, error));
      }
      return true;
    } catch (error) {
      this.#handlePlayError(name, audio, error);
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.#stopAllPooledAudio();
    } else if (this.unlocked) {
      this.#flushPendingPlays();
    }
    return this.enabled;
  }

  setVolume(volume) {
    this.volume = clampVolume(volume);
    for (const pool of this.audioPools.values()) {
      for (const audio of pool) {
        audio.volume = this.volume;
      }
    }
    return this.volume;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.#stopAllPooledAudio();
    this.audioPools.clear();
    this.failedSounds.clear();
    this.failedSourceIndexes.clear();
    this.pendingPlays = [];
  }

  #queuePendingPlay(name) {
    if (this.pendingPlays.length >= 24) {
      this.pendingPlays.shift();
    }
    this.pendingPlays.push(name);
  }

  #flushPendingPlays() {
    if (!this.enabled || !this.unlocked || this.pendingPlays.length === 0) {
      return;
    }

    const queued = this.pendingPlays.splice(0, this.pendingPlays.length);
    for (const name of queued) {
      this.play(name);
    }
  }

  #getPool(name) {
    if (!this.audioPools.has(name)) {
      this.audioPools.set(name, []);
    }
    return this.audioPools.get(name);
  }

  #createAudio(name) {
    const source = this.#resolveSource(name);
    if (!source) {
      this.failedSounds.add(name);
      return null;
    }

    const audio = new Audio(source.src);
    audio.preload = "auto";
    audio.volume = this.volume;
    audio.__soundName = name;
    audio.__sourceIndex = source.index;

    audio.addEventListener("error", () => {
      this.#markSourceFailed(name, audio.__sourceIndex);
    });

    return audio;
  }

  #resolveSource(name) {
    const failed = this.failedSourceIndexes.get(name);
    return resolveAudioSource(name, this.sounds[name], this.basePath, failed);
  }

  #markSourceFailed(name, sourceIndex) {
    if (this.failedSounds.has(name) || !Number.isInteger(sourceIndex)) {
      return;
    }

    const failed = this.failedSourceIndexes.get(name) ?? new Set();
    failed.add(sourceIndex);
    this.failedSourceIndexes.set(name, failed);

    const next = this.#resolveSource(name);
    if (!next) {
      this.failedSounds.add(name);
      if (!this.missingAssetWarnings.has(name)) {
        this.missingAssetWarnings.add(name);
        console.warn(`[AudioManager] No playable sources resolved for sound "${name}".`);
      }
      this.#clearPool(name);
      return;
    }

    this.#clearPool(name);
  }

  #clearPool(name) {
    const pool = this.audioPools.get(name);
    if (!pool) return;
    for (const audio of pool) {
      try {
        audio.pause();
      } catch {
        // Ignore.
      }
      audio.src = "";
    }
    this.audioPools.delete(name);
  }

  #handlePlayError(name, audio, error) {
    if (error && error.name === "NotAllowedError") {
      this.#queuePendingPlay(name);
      return;
    }

    const sourceIndex = audio && Number.isInteger(audio.__sourceIndex) ? audio.__sourceIndex : null;
    this.#markSourceFailed(name, sourceIndex);
  }

  #stopAllPooledAudio() {
    for (const pool of this.audioPools.values()) {
      for (const audio of pool) {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Ignore.
        }
      }
    }
  }
}
