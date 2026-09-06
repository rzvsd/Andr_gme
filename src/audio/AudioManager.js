import {
  canUseHtmlAudio,
  clampVolume,
  resolveAliasedDefinition,
  resolveAudioSource,
  unlockAudioProbe,
} from "./audioUtils.js";

const DEFAULT_EVENT_SOUND_MAP = Object.freeze({
  bullet_fired: "sfx_shoot",
  player_hit: "sfx_hit",
  enemy_killed: "sfx_explosion",
  bullet_dodged: "sfx_whoosh",
  wave_cleared: "sfx_fanfare",
  ui_click: "sfx_click",
  versus_player_hit: "sfx_hit",
  versus_dodge: "sfx_whoosh",
  versus_kill: "sfx_explosion",
});

const SYNTH_PRESETS = Object.freeze({
  sfx_shoot: { type: "square", from: 880, to: 220, duration: 0.09, gain: 0.18 },
  pew: { type: "square", from: 880, to: 220, duration: 0.09, gain: 0.18 },
  sfx_hit: { type: "sawtooth", from: 220, to: 60, duration: 0.14, gain: 0.25 },
  hit: { type: "sawtooth", from: 220, to: 60, duration: 0.14, gain: 0.25 },
  sfx_explosion: { type: "sawtooth", from: 130, to: 30, duration: 0.38, gain: 0.32 },
  explosion: { type: "sawtooth", from: 130, to: 30, duration: 0.38, gain: 0.32 },
  sfx_whoosh: { type: "sine", from: 320, to: 920, duration: 0.12, gain: 0.12 },
  whoosh: { type: "sine", from: 320, to: 920, duration: 0.12, gain: 0.12 },
  sfx_click: { type: "square", from: 1250, to: 1250, duration: 0.035, gain: 0.12 },
  ui_click: { type: "square", from: 1250, to: 1250, duration: 0.035, gain: 0.12 },
  sfx_jump: { type: "sine", from: 300, to: 620, duration: 0.12, gain: 0.14 },
  jump: { type: "sine", from: 300, to: 620, duration: 0.12, gain: 0.14 },
  sfx_fanfare: { type: "square", from: 520, to: 1040, duration: 0.22, gain: 0.16 },
  fanfare: { type: "square", from: 520, to: 1040, duration: 0.22, gain: 0.16 },
  sfx_death: { type: "sawtooth", from: 300, to: 40, duration: 0.3, gain: 0.28 },
  death: { type: "sawtooth", from: 300, to: 40, duration: 0.3, gain: 0.28 },
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
    this.synthContext = null;
    this.synthWanted = true;
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
      ["versus:player_hit", () => this.play(this.eventSoundMap.versus_player_hit)],
      ["versus:dodge", () => this.play(this.eventSoundMap.versus_dodge)],
      ["versus:kill", () => this.play(this.eventSoundMap.versus_kill)],
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
    if (this.disposed || this.unlocked) {
      this.#ensureSynthContext();
      return;
    }

    if (!canUseHtmlAudio()) {
      this.unlocked = true;
      this.#ensureSynthContext();
      return;
    }

    unlockAudioProbe((success) => {
      if (this.disposed || !success) {
        return;
      }
      this.unlocked = true;
      this.#ensureSynthContext();
      this.#flushPendingPlays();
    });
  }

  play(name) {
    if (this.disposed || !this.enabled || !name) {
      return false;
    }

    // M4: WebAudio synth first — placeholder wavs are silent, synth gives real feel.
    // Mute/settings still gate via `enabled` + `volume`. Unlock queues until user gesture.
    if (!this.unlocked) {
      this.#queuePendingPlay(name);
      return false;
    }
    if (this.#playSynth(name)) {
      return true;
    }

    if (!canUseHtmlAudio()) {
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
    if (this.synthContext && typeof this.synthContext.close === "function") {
      try {
        const result = this.synthContext.close();
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch {
        // Ignore close errors.
      }
    }
    this.synthContext = null;
  }

  #ensureSynthContext() {
    if (this.disposed || !this.synthWanted || typeof window === "undefined") {
      return null;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (typeof Ctor !== "function") {
      return null;
    }
    try {
      if (!this.synthContext) {
        this.synthContext = new Ctor();
      }
      if (this.synthContext.state === "suspended" && typeof this.synthContext.resume === "function") {
        this.synthContext.resume().catch(() => {});
      }
      return this.synthContext;
    } catch {
      return null;
    }
  }

  #playSynth(name) {
    const preset = SYNTH_PRESETS[name];
    if (!preset) {
      return false;
    }
    const ctx = this.#ensureSynthContext();
    if (!ctx || typeof ctx.createOscillator !== "function") {
      return false;
    }
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = preset.type;
      osc.frequency.setValueAtTime(Math.max(20, preset.from), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, preset.to), now + preset.duration);
      const peak = Math.max(0.001, preset.gain * this.volume);
      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + preset.duration + 0.02);
      return true;
    } catch {
      return false;
    }
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
    const definition = resolveAliasedDefinition(name, this.sounds);
    return resolveAudioSource(name, definition, this.basePath, failed);
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
