import {
  canUseHtmlAudio,
  clampVolume,
  getSharedAudioContext,
  resumeAudioContext,
  unlockAudioProbe,
} from "./audioUtils.js";
import { createLoopA, createLoopC } from "./synthAudio.js";

const DEFAULT_SCENE_TRACK_MAP = Object.freeze({
  menu: "bgm_menu",
  game: "bgm_battle",
  versus: "bgm_battle",
  pause: "bgm_pause",
  game_over: "bgm_gameover",
});

// Owner's pick (harness/PRD.md): A "Dark Pulse" for menu, C "Heartbeat Stalker"
// for battle, pause = A quieter, game over = C pad only.
const TRACKS = Object.freeze({
  bgm_menu: { create: createLoopA, gain: 1 },
  bgm_battle: { create: createLoopC, gain: 1 },
  bgm_pause: { create: createLoopA, gain: 0.5 },
  bgm_gameover: { create: (ctx, dest) => createLoopC(ctx, dest, { heartbeat: false }), gain: 1 },
});

const TRACK_ALIASES = Object.freeze({
  menu_bgm: "bgm_menu",
  battle_bgm: "bgm_battle",
  pause_bgm: "bgm_pause",
  game_over_bgm: "bgm_gameover",
  bgm_game_over: "bgm_gameover",
});

export class MusicManager {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus ?? null;
    this.enabled = options.enabled !== false;
    this.volume = clampVolume(options.volume ?? 1);
    this.sceneTrackMap = {
      ...DEFAULT_SCENE_TRACK_MAP,
      ...(options.sceneTrackMap && typeof options.sceneTrackMap === "object" ? options.sceneTrackMap : {}),
    };
    this.audioContextFactory =
      typeof options.audioContextFactory === "function" ? options.audioContextFactory : getSharedAudioContext;

    this.subscriptions = [];
    this.currentTrack = null;
    this.currentLoop = null;
    this.trackGain = null;
    this.pendingTrack = null;
    this.unlocked = options.unlocked === true;
    this.context = null;
    this.masterGain = null;
    this.disposed = false;
  }

  subscribe() {
    if (this.disposed) return this;
    this.unsubscribe();

    if (!this.eventBus || typeof this.eventBus.on !== "function") {
      return this;
    }

    const sceneHandler = (payload) => {
      this.unlock();
      this.#handleSceneSwitch(payload);
    };

    const subscriptions = [
      ["ui_click", () => this.unlock()],
      ["scene:switch", sceneHandler],
      ["scene_enter", sceneHandler],
      ["game:stop", () => this.stop()],
    ];

    for (const [eventName, handler] of subscriptions) {
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
      this.#playPending();
      return;
    }

    unlockAudioProbe((success) => {
      if (this.disposed || !success) {
        return;
      }
      this.unlocked = true;
      this.#playPending();
    });
  }

  play(trackName) {
    if (this.disposed || !trackName) {
      return false;
    }
    const track = TRACK_ALIASES[trackName] ?? trackName;
    const definition = TRACKS[track];
    if (!definition) {
      return false;
    }

    if (!this.enabled || !this.unlocked) {
      this.pendingTrack = track;
      return false;
    }

    if (this.currentTrack === track && this.currentLoop) {
      return true;
    }

    const ctx = this.#ensureContext();
    if (!ctx) {
      return false;
    }

    this.stop();

    try {
      this.trackGain = ctx.createGain();
      this.trackGain.gain.value = definition.gain;
      this.trackGain.connect(this.masterGain);
      this.currentLoop = definition.create(ctx, this.trackGain);
      this.currentLoop.start();
    } catch {
      this.stop();
      return false;
    }

    this.currentTrack = track;
    this.pendingTrack = null;
    console.info(`[MusicManager] playing ${track}`);
    return true;
  }

  stop() {
    if (this.currentLoop) {
      try {
        this.currentLoop.stop();
      } catch {
        // Ignore.
      }
    }
    if (this.trackGain) {
      try {
        // Detach so one-shots already scheduled by the loop go silent now.
        this.trackGain.disconnect();
      } catch {
        // Ignore.
      }
    }
    this.currentLoop = null;
    this.trackGain = null;
    this.currentTrack = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      if (this.currentTrack) {
        this.pendingTrack = this.currentTrack;
      }
      this.stop();
      return this.enabled;
    }

    this.#playPending();
    return this.enabled;
  }

  setVolume(volume) {
    this.volume = clampVolume(volume);
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
    return this.volume;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.stop();
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore.
      }
    }
    this.masterGain = null;
    this.context = null;
    this.pendingTrack = null;
  }

  #playPending() {
    if (this.pendingTrack && this.enabled && this.unlocked) {
      const track = this.pendingTrack;
      this.pendingTrack = null;
      this.play(track);
    }
  }

  #handleSceneSwitch(payload) {
    const sceneName = this.#extractSceneName(payload);
    if (!sceneName) return;

    const track = this.sceneTrackMap[sceneName.toLowerCase()];
    if (track) {
      this.play(track);
    }
  }

  #extractSceneName(payload) {
    if (typeof payload === "string") {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (typeof payload.name === "string") return payload.name;
    if (typeof payload.scene === "string") return payload.scene;
    if (typeof payload.to === "string") return payload.to;
    if (payload.to && typeof payload.to === "object" && typeof payload.to.name === "string") return payload.to.name;

    return null;
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
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(ctx.destination);
    resumeAudioContext(ctx);
    return ctx;
  }
}
