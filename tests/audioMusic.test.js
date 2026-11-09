import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { AudioManager, uiClickSound } from "../src/audio/AudioManager.js";
import { SFX } from "../src/audio/synthAudio.js";
import { MusicManager } from "../src/audio/MusicManager.js";

// Minimal WebAudio stand-in. Counts node creation so tests can see when a
// loop or an SFX really hits the graph.
function createFakeAudioContext() {
  const counts = { oscillators: 0, bufferSources: 0 };
  const param = (value = 0) => ({
    value,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({
    connect(target) {
      return target;
    },
    disconnect() {},
    start() {},
    stop() {},
    ...extra,
  });
  const ctx = {
    counts,
    currentTime: 0,
    sampleRate: 48000,
    state: "running",
    destination: node(),
    resume: () => Promise.resolve(),
    createGain: () => node({ gain: param(1) }),
    createOscillator() {
      counts.oscillators += 1;
      return node({ type: "sine", frequency: param(440), detune: param(0) });
    },
    createBufferSource() {
      counts.bufferSources += 1;
      return node({ buffer: null });
    },
    createBiquadFilter: () => node({ type: "lowpass", frequency: param(350), Q: param(1) }),
    createDelay: () => node({ delayTime: param(0) }),
    createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }),
    createWaveShaper: () => node({ curve: null, oversample: "none" }),
    createStereoPanner: () => node({ pan: param(0) }),
  };
  return ctx;
}

describe("MusicManager synth loops", () => {
  let infoSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  it("starts bgm_menu then bgm_battle on scene switches", () => {
    const bus = new EventBus();
    const ctx = createFakeAudioContext();
    const music = new MusicManager(bus, { audioContextFactory: () => ctx });
    music.subscribe();

    bus.emit("scene:switch", { to: "menu", name: "menu" });
    expect(music.currentTrack).toBe("bgm_menu");
    const afterMenu = ctx.counts.oscillators;
    expect(afterMenu).toBeGreaterThan(0);

    // The lookahead scheduler keeps adding notes while the loop runs.
    vi.advanceTimersByTime(100);
    expect(ctx.counts.oscillators).toBeGreaterThan(afterMenu);

    bus.emit("scene:switch", { to: "versus", name: "versus" });
    expect(music.currentTrack).toBe("bgm_battle");
    expect(infoSpy.mock.calls.map((c) => c[0])).toEqual([
      "[MusicManager] playing bgm_menu",
      "[MusicManager] playing bgm_battle",
    ]);

    music.dispose();
    expect(music.currentTrack).toBe(null);
  });

  it("stops the loop when disabled and restarts it when re-enabled", () => {
    const bus = new EventBus();
    const ctx = createFakeAudioContext();
    const music = new MusicManager(bus, { audioContextFactory: () => ctx });
    music.subscribe();

    bus.emit("scene:switch", { to: "versus", name: "versus" });
    expect(music.currentTrack).toBe("bgm_battle");

    music.setEnabled(false);
    expect(music.currentTrack).toBe(null);
    const idle = ctx.counts.oscillators;
    vi.advanceTimersByTime(500);
    expect(ctx.counts.oscillators).toBe(idle);

    music.setEnabled(true);
    expect(music.currentTrack).toBe("bgm_battle");
    expect(ctx.counts.oscillators).toBeGreaterThan(idle);

    music.dispose();
  });

  it("waits for unlock before starting and scales pause gain to half", () => {
    const bus = new EventBus();
    const ctx = createFakeAudioContext();
    const music = new MusicManager(bus, { audioContextFactory: () => ctx, unlocked: false });
    music.subscribe();

    // Without HTML Audio in this environment, unlock() completes synchronously
    // on the first scene switch, so the pending track starts right away.
    bus.emit("scene:switch", { to: "pause", name: "pause" });
    expect(music.currentTrack).toBe("bgm_pause");
    expect(music.trackGain.gain.value).toBe(0.5);

    music.dispose();
  });
});

describe("AudioManager synth SFX", () => {
  let infoSpy;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it("plays bullet_fired only after unlock and not when disabled", () => {
    const bus = new EventBus();
    const ctx = createFakeAudioContext();
    const audio = new AudioManager(bus, { audioContextFactory: () => ctx, unlocked: false });
    audio.subscribe();

    bus.emit("bullet_fired", {});
    expect(ctx.counts.oscillators).toBe(0);

    audio.unlock();
    expect(audio.unlocked).toBe(true);
    bus.emit("bullet_fired", {});
    expect(ctx.counts.oscillators).toBeGreaterThan(0);
    expect(infoSpy).toHaveBeenCalledWith("[AudioManager] synth SFX ready");

    const played = ctx.counts.oscillators;
    audio.setEnabled(false);
    bus.emit("bullet_fired", {});
    expect(ctx.counts.oscillators).toBe(played);
    expect(audio.masterGain.gain.value).toBe(0);

    audio.setEnabled(true);
    expect(audio.masterGain.gain.value).toBe(1);
    bus.emit("versus:kill", {});
    expect(ctx.counts.oscillators).toBeGreaterThan(played);

    audio.dispose();
  });
});

describe("menu sound family (A-17)", () => {
  it("maps confirm and back sources and leaves the rest to the tick", () => {
    for (const source of ["play", "start_game", "resume", "pause_resume", "rematch"]) {
      expect(uiClickSound(source)).toBe("confirm");
    }
    for (const source of ["quit", "versus_exit", "menu"]) {
      expect(uiClickSound(source)).toBe("back");
    }
    expect(uiClickSound("sound")).toBeNull();
    expect(uiClickSound(undefined)).toBeNull();
    expect(typeof SFX.confirm).toBe("function");
    expect(typeof SFX.back).toBe("function");
  });
});
