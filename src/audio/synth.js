// Every sound is made here from oscillators and noise; there are no audio files.
// `rig` builds the instrument on any audio context, so the same code can be rendered offline
// and measured (see `measure`).
const SCALE = [0, 2, 4, 7, 9]; // major pentatonic: any two notes agree
const ROOT = 146.83; // D3
const LEVEL = 2.2;
const hz = (deg) => ROOT * 2 ** ((SCALE[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);

function rig(ac) {
  // `master` is the on/off switch. `level` sets the loudness in front of a limiter.
  const master = ac.createGain();
  const level = ac.createGain();
  level.gain.value = LEVEL;
  const limit = ac.createDynamicsCompressor();
  limit.threshold.value = -10;
  limit.knee.value = 8;
  limit.ratio.value = 12;
  limit.attack.value = 0.002;
  master.connect(level).connect(limit).connect(ac.destination);

  // A room made of decaying noise.
  const len = Math.floor(ac.sampleRate * 2.4);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  let seed = 7;
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 1073741823.5 - 1) * (1 - i / len) ** 3;
    }
  }
  const room = ac.createConvolver();
  room.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.38;
  room.connect(wet).connect(master);
  const bus = ac.createGain();
  bus.connect(master);
  bus.connect(room);

  const env = (gain, at, attack, dur) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(bus);
    return g;
  };
  const osc = (type, f, at, dur, to) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    o.connect(to);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  };

  return {
    ac,
    master,
    pluck(deg, delay = 0, gain = 0.16, dur = 1.5) {
      const at = ac.currentTime + delay;
      const f = hz(deg);
      osc("triangle", f, at, dur, env(gain, at, 0.006, dur));
      osc("sine", f * 2, at, dur * 0.5, env(gain * 0.3, at, 0.004, dur * 0.5));
    },
    thud() {
      const at = ac.currentTime;
      const o = osc("sine", 120, at, 0.3, env(0.4, at, 0.004, 0.3));
      o.frequency.exponentialRampToValueAtTime(42, at + 0.24);
      const n = ac.createBufferSource();
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.15), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      n.connect(lp).connect(env(0.14, at, 0.003, 0.15));
      n.start(at);
    },
    glide(from, to, dur = 0.16, gain = 0.1) {
      const at = ac.currentTime;
      const o = osc("sine", from, at, dur, env(gain, at, 0.01, dur));
      o.frequency.exponentialRampToValueAtTime(to, at + dur);
    },
    // One long voice that sings the speed of the line.
    voice() {
      const o = ac.createOscillator();
      o.type = "sine";
      const g = ac.createGain();
      g.gain.value = 0;
      o.connect(g).connect(bus);
      o.start();
      return (speed) => {
        const t = ac.currentTime;
        g.gain.setTargetAtTime(speed > 0 ? 0.014 : 0, t, 0.08);
        if (speed > 0) o.frequency.setTargetAtTime(110 * 2 ** Math.min(2.4, speed / 380), t, 0.05);
      };
    },
    // A slow fifth under everything.
    pad() {
      const g = ac.createGain();
      g.gain.value = 0;
      g.connect(bus);
      for (const [f, d] of [
        [ROOT / 2, 0],
        [(ROOT / 2) * 1.5, 0.4],
        [ROOT, -0.3],
      ]) {
        const o = ac.createOscillator();
        o.type = "sine";
        o.frequency.value = f + d;
        o.connect(g);
        o.start();
      }
      g.gain.setTargetAtTime(0.008, ac.currentTime, 2.5);
    },
  };
}

let r = null;
let sing = null;
let on = true;

/** The game calls these; each is silent until `unlock` has run inside a tap. */
export const audio = {
  unlock() {
    if (r) {
      if (r.ac.state === "suspended") r.ac.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      r = rig(new AC());
      r.master.gain.value = on ? 1 : 0;
      sing = r.voice();
      r.pad();
    } catch {
      r = null;
    }
  },
  setOn(value) {
    on = value;
    if (r) r.master.gain.setTargetAtTime(on ? 1 : 0, r.ac.currentTime, 0.05);
  },
  launch(power) {
    r?.pluck(0, 0, 0.14);
    r?.pluck(5, 0.03, 0.04 + 0.08 * power, 1);
  },
  pass(i, closeness) {
    r?.pluck(2 + ((i * 2) % 6), 0, 0.05 + 0.1 * closeness, 1.2);
  },
  dust(n) {
    r?.pluck([7, 9, 12][n - 1] ?? 12, 0, 0.17, 1.4);
    r?.pluck(([7, 9, 12][n - 1] ?? 12) + 5, 0.07, 0.07, 0.9);
  },
  win(dust) {
    [5, 7, 9, 10, 12].forEach((deg, i) => r?.pluck(deg, i * 0.075, 0.15, 2.4));
    if (dust === 3) [14, 15, 17].forEach((deg, i) => r?.pluck(deg, 0.42 + i * 0.09, 0.1, 2.2));
  },
  crash() {
    r?.thud();
  },
  lost() {
    r?.pluck(4, 0, 0.07, 0.9);
    r?.pluck(2, 0.12, 0.06, 1.1);
  },
  dry() {
    r?.pluck(-2, 0, 0.08, 1.2);
  },
  jump() {
    r?.glide(392, 880, 0.18, 0.2);
  },
  found() {
    r?.pluck(1, 0, 0.1, 2);
    r?.pluck(6, 0.16, 0.08, 2);
  },
  tick() {
    r?.glide(1320, 1180, 0.04, 0.08);
  },
  tone(speed) {
    sing?.(speed);
  },
};

/**
 * Render one sound offline and report its level. Used from the browser console during checks:
 * a sound must be audible (rms well above 0) and must not clip (peak below 1).
 */
export async function measure(play, seconds = 2.5) {
  const ac = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
  play(rig(ac));
  const buf = await ac.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    peak = Math.max(peak, Math.abs(d[i]));
    sum += d[i] * d[i];
  }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4) };
}
