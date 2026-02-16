import {
  canUseHtmlAudio,
  clampVolume,
  resolveAudioSource,
  unlockAudioProbe,
} from "./audioUtils.js";

const DEFAULT_SCENE_TRACK_MAP = Object.freeze({
  menu: "menu_bgm",
  game: "battle_bgm",
  pause: "pause_bgm",
  game_over: "game_over_bgm",
});

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export class MusicManager {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus ?? null;
    this.enabled = options.enabled !== false;
    this.volume = clampVolume(options.volume ?? 1);
    this.basePath = typeof options.basePath === "string" ? options.basePath : "/audio";
    this.tracks = options.tracks && typeof options.tracks === "object" ? options.tracks : {};
    this.sceneTrackMap = {
      ...DEFAULT_SCENE_TRACK_MAP,
      ...(options.sceneTrackMap && typeof options.sceneTrackMap === "object" ? options.sceneTrackMap : {}),
    };

    this.subscriptions = [];
    this.failedTracks = new Set();
    this.failedSourceIndexes = new Map();
    this.missingAssetWarnings = new Set();

    this.currentTrack = null;
    this.currentAudio = null;
    this.pendingTrack = null;
    this.unlocked = options.unlocked === true;
    this.fadeTimer = null;
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
    if (this.disposed || this.unlocked || !canUseHtmlAudio()) {
      if (!canUseHtmlAudio()) {
        this.unlocked = true;
      }
      return;
    }

    unlockAudioProbe(() => {
      this.unlocked = true;
      if (this.pendingTrack) {
        const track = this.pendingTrack;
        this.pendingTrack = null;
        this.play(track);
      }
    });
  }

  play(track) {
    if (this.disposed || !this.enabled || !track || !canUseHtmlAudio()) {
      return false;
    }

    if (this.failedTracks.has(track)) {
      return false;
    }

    if (!this.unlocked) {
      this.pendingTrack = track;
      return false;
    }

    if (this.currentTrack === track && this.currentAudio) {
      this.currentAudio.volume = this.volume;
      if (this.currentAudio.paused) {
        try {
          const resumePromise = this.currentAudio.play();
          if (resumePromise && typeof resumePromise.catch === "function") {
            resumePromise.catch((error) => this.#handleTrackError(track, this.currentAudio.__sourceIndex, error));
          }
        } catch (error) {
          this.#handleTrackError(track, this.currentAudio.__sourceIndex, error);
        }
      }
      return true;
    }

    return this.#startTrack(track);
  }

  stop() {
    this.#clearFadeTimer();
    if (!this.currentAudio) {
      this.currentTrack = null;
      return;
    }

    try {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = "";
    } catch {
      // Ignore.
    }

    this.currentAudio = null;
    this.currentTrack = null;
  }

  fadeTo(volume, durationMs = 300) {
    const target = clampVolume(volume);
    if (!this.currentAudio) {
      this.volume = target;
      return;
    }

    this.#clearFadeTimer();

    const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    if (duration === 0) {
      this.currentAudio.volume = target;
      this.volume = target;
      return;
    }

    const startVolume = this.currentAudio.volume;
    const startTime = nowMs();

    if (typeof globalThis.requestAnimationFrame === "function") {
      const step = () => {
        if (!this.currentAudio) {
          this.#clearFadeTimer();
          return;
        }

        const elapsed = nowMs() - startTime;
        const progress = Math.min(1, elapsed / duration);
        const nextVolume = startVolume + (target - startVolume) * progress;
        this.currentAudio.volume = clampVolume(nextVolume);

        if (progress >= 1) {
          this.volume = target;
          this.#clearFadeTimer();
          return;
        }

        this.fadeTimer = {
          type: "raf",
          id: globalThis.requestAnimationFrame(step),
        };
      };

      this.fadeTimer = {
        type: "raf",
        id: globalThis.requestAnimationFrame(step),
      };
      return;
    }

    if (typeof globalThis.setInterval !== "function") {
      this.currentAudio.volume = target;
      this.volume = target;
      return;
    }

    this.fadeTimer = {
      type: "interval",
      id: globalThis.setInterval(() => {
        if (!this.currentAudio) {
          this.#clearFadeTimer();
          return;
        }

        const elapsed = nowMs() - startTime;
        const progress = Math.min(1, elapsed / duration);
        const nextVolume = startVolume + (target - startVolume) * progress;
        this.currentAudio.volume = clampVolume(nextVolume);

        if (progress >= 1) {
          this.volume = target;
          this.#clearFadeTimer();
        }
      }, 50),
    };
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.stop();
      return this.enabled;
    }

    if (this.pendingTrack && this.unlocked) {
      const track = this.pendingTrack;
      this.pendingTrack = null;
      this.play(track);
    }

    return this.enabled;
  }

  setVolume(volume) {
    this.volume = clampVolume(volume);
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
    return this.volume;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.stop();
    this.failedTracks.clear();
    this.failedSourceIndexes.clear();
    this.pendingTrack = null;
  }

  #handleSceneSwitch(payload) {
    const sceneName = this.#extractSceneName(payload);
    if (!sceneName) return;

    const normalized = sceneName.toLowerCase();
    if (normalized !== "menu" && normalized !== "game" && normalized !== "pause" && normalized !== "game_over") {
      return;
    }

    const track = this.sceneTrackMap[normalized];
    if (!track) {
      if (normalized === "pause") {
        this.fadeTo(Math.min(this.volume, 0.35), 200);
      }
      return;
    }

    this.play(track);
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

  #startTrack(track) {
    const source = this.#resolveSource(track);
    if (!source) {
      this.failedTracks.add(track);
      return false;
    }

    this.#clearFadeTimer();
    this.stop();

    const audio = new Audio(source.src);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = this.volume;
    audio.__trackName = track;
    audio.__sourceIndex = source.index;

    audio.addEventListener("error", () => {
      this.#handleTrackError(track, source.index, null);
    });

    this.currentTrack = track;
    this.currentAudio = audio;

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => this.#handleTrackError(track, source.index, error));
      }
      return true;
    } catch (error) {
      this.#handleTrackError(track, source.index, error);
      return false;
    }
  }

  #handleTrackError(track, sourceIndex, error) {
    if (error && error.name === "NotAllowedError") {
      this.pendingTrack = track;
      return;
    }

    if (!Number.isInteger(sourceIndex)) {
      return;
    }

    const failed = this.failedSourceIndexes.get(track) ?? new Set();
    if (failed.has(sourceIndex)) {
      return;
    }

    failed.add(sourceIndex);
    this.failedSourceIndexes.set(track, failed);

    const fallback = this.#resolveSource(track);
    if (!fallback) {
      this.failedTracks.add(track);
      if (!this.missingAssetWarnings.has(track)) {
        this.missingAssetWarnings.add(track);
        console.warn(`[MusicManager] No playable sources resolved for track "${track}".`);
      }
      if (this.currentTrack === track) {
        this.stop();
      }
      return;
    }

    if (this.currentTrack === track) {
      this.#startTrack(track);
    }
  }

  #resolveSource(track) {
    const failed = this.failedSourceIndexes.get(track);
    return resolveAudioSource(track, this.tracks[track], this.basePath, failed);
  }

  #clearFadeTimer() {
    if (this.fadeTimer === null) {
      return;
    }

    if (typeof this.fadeTimer === "number") {
      if (typeof globalThis.clearInterval === "function") {
        globalThis.clearInterval(this.fadeTimer);
      }
      if (typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(this.fadeTimer);
      }
      this.fadeTimer = null;
      return;
    }

    if (this.fadeTimer.type === "raf" && typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(this.fadeTimer.id);
    } else if (this.fadeTimer.type === "interval" && typeof globalThis.clearInterval === "function") {
      globalThis.clearInterval(this.fadeTimer.id);
    }

    this.fadeTimer = null;
  }
}
