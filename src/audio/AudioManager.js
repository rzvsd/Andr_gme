import {
  canUseHtmlAudio,
  clampVolume,
  getSharedAudioContext,
  resumeAudioContext,
  unlockAudioProbe,
} from "./audioUtils.js";
import { SFX, createSfxBus } from "./synthAudio.js";

const DEFAULT_EVENT_SOUND_MAP = Object.freeze({
  bullet_fired: "shoot",
  player_hit: "hit",
  enemy_killed: "kill",
  bullet_dodged: "dodge",
  wave_cleared: "kill",
  ui_click: "click",
  jump: "jump",
  versus_player_hit: "hit",
  versus_dodge: "dodge",
  versus_kill: "kill",
});

// Menu sound family (A-17): which ui_click sources confirm, which go back, the rest tick.
const UI_CONFIRM_SOURCES = new Set(["play", "start_game", "resume", "pause_resume", "rematch"]);
const UI_BACK_SOURCES = new Set(["quit", "pause_quit", "versus_exit", "menu"]);
const UI_CLICK_DEDUPE_MS = 40;

export function uiClickSound(source) {
  if (UI_CONFIRM_SOURCES.has(source)) {
    return "confirm";
  }
  if (UI_BACK_SOURCES.has(source)) {
    return "back";
  }
  return null;
}

// Legacy sound names still accepted by play(name).
const SOUND_ALIASES = Object.freeze({
  sfx_shoot: "shoot",
  pew: "shoot",
  sfx_hit: "hit",
  sfx_explosion: "kill",
  explosion: "kill",
  sfx_death: "kill",
  death: "kill",
  sfx_fanfare: "kill",
  fanfare: "kill",
  sfx_whoosh: "dodge",
  whoosh: "dodge",
  sfx_jump: "jump",
  sfx_click: "click",
  ui_click: "click",
});

export class AudioManager {
  constructor(eventBus, options = {}) {
    this.lastUiClickMs = Number.NEGATIVE_INFINITY;
    this.eventBus = eventBus ?? null;
    this.enabled = options.enabled !== false;
    this.volume = clampVolume(options.volume ?? 1);
    this.eventSoundMap = {
      ...DEFAULT_EVENT_SOUND_MAP,
      ...(options.eventSoundMap && typeof options.eventSoundMap === "object" ? options.eventSoundMap : {}),
    };
    this.audioContextFactory =
      typeof options.audioContextFactory === "function" ? options.audioContextFactory : getSharedAudioContext;

    this.subscriptions = [];
    this.unlocked = options.unlocked === true;
    this.disposed = false;
    this.context = null;
    this.masterGain = null;
    this.sfxBus = null;
    this.readyLogged = false;
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
      ["jump", () => this.play(this.eventSoundMap.jump)],
      ["versus:player_hit", () => this.play(this.eventSoundMap.versus_player_hit)],
      ["versus:dodge", () => this.play(this.eventSoundMap.versus_dodge)],
      ["versus:kill", () => this.play(this.eventSoundMap.versus_kill)],
      [
        "ui_click",
        (payload) => {
          this.unlock();
          // A control press and the action it starts can both emit ui_click in the same frame
          // (PLAY then start_game); only the first one sounds.
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          if (now - this.lastUiClickMs < UI_CLICK_DEDUPE_MS) {
            return;
          }
          this.lastUiClickMs = now;
          this.play(uiClickSound(payload?.source) ?? this.eventSoundMap.ui_click);
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
    if (this.disposed) {
      return;
    }
    if (this.unlocked) {
      resumeAudioContext(this.context);
      return;
    }

    if (!canUseHtmlAudio()) {
      this.unlocked = true;
      return;
    }

    unlockAudioProbe((success) => {
      if (this.disposed || !success) {
        return;
      }
      this.unlocked = true;
    });
  }

  play(name) {
    if (this.disposed || !this.enabled || !name || !this.unlocked) {
      return false;
    }

    const synth = SFX[SOUND_ALIASES[name] ?? name];
    if (!synth) {
      return false;
    }

    const ctx = this.#ensureContext();
    if (!ctx) {
      return false;
    }

    try {
      synth(ctx, this.sfxBus);
    } catch {
      return false;
    }

    if (!this.readyLogged) {
      this.readyLogged = true;
      console.info("[AudioManager] synth SFX ready");
    }
    return true;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.masterGain) {
      // Cut running tails immediately; restore on re-enable.
      this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }
    return this.enabled;
  }

  setVolume(volume) {
    this.volume = clampVolume(volume);
    if (this.masterGain && this.enabled) {
      this.masterGain.gain.value = this.volume;
    }
    return this.volume;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore.
      }
    }
    this.masterGain = null;
    this.sfxBus = null;
    this.context = null;
  }

  #ensureContext() {
    if (this.context) {
      resumeAudioContext(this.context);
      return this.context;
    }
    let ctx = null;
    try {
      ctx = this.audioContextFactory();
    } catch {
      ctx = null;
    }
    if (!ctx || typeof ctx.createGain !== "function") {
      return null;
    }
    this.context = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.enabled ? this.volume : 0;
    this.masterGain.connect(ctx.destination);
    this.sfxBus = createSfxBus(ctx, this.masterGain);
    resumeAudioContext(ctx);
    return ctx;
  }
}
