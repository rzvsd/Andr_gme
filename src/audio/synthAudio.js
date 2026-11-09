// WebAudio synth: music loops and SFX, ported from dev/audio-lab.html.
// Every generator takes (audioContext, destination) and nothing else.
// No DOM access at import time; nothing here creates an AudioContext.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (buf) return buf;
  buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

function noise(ctx, dest, { t, dur, gain = 0.3, type = "highpass", from = 1000, to = from, q = 1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function tone(ctx, dest, { t, dur, type = "sine", from, to = from, gain = 0.2, attack = 0.002, curve = "exp" }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, from), t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0005, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  if (curve === "exp") g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  else g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function crusher(ctx, amount = 30) {
  // soft-clip waveshaper for grit
  const ws = ctx.createWaveShaper();
  const n = 256;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  ws.curve = c;
  ws.oversample = "2x";
  return ws;
}

// Lookahead scheduler: calls onStep(stepIndex, time) for each step, 100 ms ahead.
function makeScheduler(ctx, stepSeconds, onStep) {
  let timer = null;
  let step = 0;
  let next = 0;
  return {
    start() {
      step = 0;
      next = ctx.currentTime + 0.05;
      timer = setInterval(() => {
        while (next < ctx.currentTime + 0.1) {
          onStep(step, next);
          step += 1;
          next += stepSeconds;
        }
      }, 25);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

function stopAll(nodes) {
  for (const n of nodes) {
    try {
      n.stop();
    } catch {
      // Already stopped.
    }
  }
}

// ---------------------------------------------------------------------------
// MUSIC LOOP A — Dark Pulse. Drone + sub pulse at 90 bpm. 4-bar cycle.
// ---------------------------------------------------------------------------
export function createLoopA(ctx, destination) {
  const beat = 60 / 90;
  let nodes = [];
  const out = ctx.createGain();
  out.connect(destination);

  function startDrone() {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    lp.Q.value = 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.11;
    for (const [n, det] of [[33, -6], [33, 6], [40, 0], [45, 3]]) {
      // A1 A1 E2 A2
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = NOTE(n);
      o.detune.value = det;
      o.connect(lp);
      o.start();
      nodes.push(o);
    }
    lp.connect(g).connect(out);
    lfo.start();
    nodes.push(lfo);
  }

  const sched = makeScheduler(ctx, beat, (i, t) => {
    tone(ctx, out, { t, dur: 0.35, from: 60, to: 38, gain: 0.55 }); // sub thump every beat
    if (i % 2 === 1) tone(ctx, out, { t, dur: 0.12, from: 110, to: 55, gain: 0.12, type: "triangle" });
    if (i % 16 === 12) noise(ctx, out, { t, dur: beat * 4, gain: 0.08, type: "bandpass", from: 300, to: 1800, q: 2 });
    if (i % 8 === 0) {
      tone(ctx, out, { t, dur: beat * 2, from: NOTE(i % 16 === 0 ? 57 : 56), gain: 0.03, attack: 0.4, type: "triangle" });
    }
  });

  return {
    start() {
      startDrone();
      sched.start();
    },
    stop() {
      sched.stop();
      stopAll(nodes);
      nodes = [];
      out.disconnect();
    },
  };
}

// ---------------------------------------------------------------------------
// MUSIC LOOP C — Heartbeat Stalker. Lub-dub every 1.2 s, filtered pad, rare ping.
// { heartbeat: false } keeps only the pad (game-over variant).
// ---------------------------------------------------------------------------
export function createLoopC(ctx, destination, { heartbeat = true } = {}) {
  const beat = 1.2;
  let nodes = [];
  const out = ctx.createGain();
  out.connect(destination);

  function startPad() {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    lp.Q.value = 1.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.07;
    for (const [n, det] of [[38, -4], [45, 4], [53, 0], [57, -3]]) {
      // D2 A2 F3 A3 (D minor)
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = NOTE(n);
      o.detune.value = det;
      o.connect(lp);
      o.start();
      nodes.push(o);
    }
    lp.connect(g).connect(out);
    lfo.start();
    nodes.push(lfo);
  }

  const sched = makeScheduler(ctx, beat, (i, t) => {
    tone(ctx, out, { t, dur: 0.22, from: 70, to: 38, gain: 0.6 }); // lub
    tone(ctx, out, { t: t + 0.2, dur: 0.18, from: 58, to: 34, gain: 0.4 }); // dub
    if (i % 4 === 3) {
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      let dest = out;
      if (pan) {
        pan.pan.value = Math.random() * 1.6 - 0.8;
        pan.connect(out);
        dest = pan;
      }
      tone(ctx, dest, { t: t + 0.6, dur: 1.4, from: NOTE(i % 8 === 7 ? 86 : 89), gain: 0.05, attack: 0.01 });
    }
    if (i % 8 === 6) noise(ctx, out, { t, dur: beat * 2, gain: 0.05, type: "bandpass", from: 200, to: 900, q: 3 });
  });

  return {
    start() {
      startPad();
      if (heartbeat) sched.start();
    },
    stop() {
      sched.stop();
      stopAll(nodes);
      nodes = [];
      out.disconnect();
    },
  };
}

// ---------------------------------------------------------------------------
// SFX bus: dry + short feedback-delay "room" for a bit of space in the dark.
// Returns the node to play SFX into.
// ---------------------------------------------------------------------------
export function createSfxBus(ctx, destination) {
  const bus = ctx.createGain();
  bus.connect(destination);
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.11;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2500;
  bus.connect(delay);
  delay.connect(damp).connect(fb).connect(delay);
  damp.connect(wet).connect(destination);
  return bus;
}

// ---------------------------------------------------------------------------
// SFX SET. Layered: tone + noise + pitch envelope.
// ---------------------------------------------------------------------------
export function playSfxShoot(ctx, dest) {
  const t = ctx.currentTime;
  tone(ctx, dest, { t, dur: 0.09, type: "square", from: 1400, to: 320, gain: 0.16 });
  tone(ctx, dest, { t, dur: 0.06, type: "sine", from: 2600, to: 900, gain: 0.08 });
  noise(ctx, dest, { t, dur: 0.05, gain: 0.25, from: 2500 });
}

export function playSfxHit(ctx, dest) {
  const t = ctx.currentTime;
  const crush = crusher(ctx, 40);
  crush.connect(dest);
  tone(ctx, crush, { t, dur: 0.16, type: "sawtooth", from: 240, to: 48, gain: 0.3 });
  tone(ctx, dest, { t, dur: 0.1, type: "sine", from: 120, to: 40, gain: 0.4 });
  noise(ctx, dest, { t, dur: 0.14, gain: 0.3, type: "lowpass", from: 2200, to: 200 });
}

export function playSfxKill(ctx, dest) {
  const t = ctx.currentTime;
  tone(ctx, dest, { t, dur: 0.55, type: "sine", from: 95, to: 28, gain: 0.7 });
  noise(ctx, dest, { t, dur: 0.6, gain: 0.45, type: "lowpass", from: 5000, to: 120 });
  const crush = crusher(ctx, 60);
  crush.connect(dest);
  tone(ctx, crush, { t: t + 0.02, dur: 0.3, type: "sawtooth", from: 300, to: 40, gain: 0.2 });
  for (let k = 0; k < 3; k++) {
    tone(ctx, dest, { t: t + 0.08 + k * 0.07, dur: 0.12, type: "square", from: 660 - k * 180, to: 220 - k * 50, gain: 0.07 });
  }
}

export function playSfxDodge(ctx, dest) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 6;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
  bp.frequency.exponentialRampToValueAtTime(600, t + 0.28);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0005, t);
  g.gain.linearRampToValueAtTime(0.45, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
  src.stop(t + 0.35);
  tone(ctx, dest, { t, dur: 0.22, type: "sine", from: 320, to: 1100, gain: 0.06, attack: 0.05 });
}

export function playSfxJump(ctx, dest) {
  const t = ctx.currentTime;
  tone(ctx, dest, { t, dur: 0.16, type: "sine", from: 240, to: 640, gain: 0.18, attack: 0.01 });
  tone(ctx, dest, { t, dur: 0.14, type: "triangle", from: 480, to: 1280, gain: 0.06, attack: 0.01 });
  noise(ctx, dest, { t, dur: 0.03, gain: 0.12, from: 3000 });
}

export function playSfxClick(ctx, dest) {
  const t = ctx.currentTime;
  tone(ctx, dest, { t, dur: 0.035, type: "sine", from: 1900, to: 1500, gain: 0.18 });
  noise(ctx, dest, { t, dur: 0.012, gain: 0.2, from: 5000 });
}

// Menu family (A-17): one sine voice, same room. Confirm rises and is brighter (PLAY, RESUME,
// REMATCH); back falls and is duller (QUIT, MENU). Both under 200 ms.
export function playSfxConfirm(ctx, dest) {
  const t = ctx.currentTime;
  tone(ctx, dest, { t, dur: 0.07, type: "sine", from: 880, to: 900, gain: 0.16 });
  tone(ctx, dest, { t: t + 0.06, dur: 0.12, type: "sine", from: 1320, to: 1360, gain: 0.16 });
  tone(ctx, dest, { t: t + 0.06, dur: 0.1, type: "triangle", from: 2640, to: 2700, gain: 0.04 });
  noise(ctx, dest, { t, dur: 0.012, gain: 0.16, from: 5000 });
}

export function playSfxBack(ctx, dest) {
  const t = ctx.currentTime;
  tone(ctx, dest, { t, dur: 0.07, type: "sine", from: 990, to: 960, gain: 0.14 });
  tone(ctx, dest, { t: t + 0.06, dur: 0.12, type: "sine", from: 660, to: 600, gain: 0.14 });
}

export const SFX = Object.freeze({
  shoot: playSfxShoot,
  hit: playSfxHit,
  kill: playSfxKill,
  dodge: playSfxDodge,
  jump: playSfxJump,
  click: playSfxClick,
  confirm: playSfxConfirm,
  back: playSfxBack,
});
