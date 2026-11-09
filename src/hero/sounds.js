// WebAudio one-shots. Each is under 300 ms and language-free on purpose:
// short single-emotion sounds are the ones that get lifted into clips.

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    ctx = Ctor ? new Ctor() : null;
  }
  if (ctx?.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

function tone({ type = "sine", from, to, ms, gain = 0.25, filterHz = null }) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + ms / 1000);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + ms / 1000);
  let node = osc;
  if (filterHz) {
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterHz;
    osc.connect(filter);
    node = filter;
  }
  node.connect(amp).connect(ac.destination);
  osc.start(now);
  osc.stop(now + ms / 1000 + 0.02);
}

function noise({ ms, gain = 0.2, filterHz = 900 }) {
  const ac = audio();
  if (!ac) return;
  const length = Math.floor((ac.sampleRate * ms) / 1000);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterHz;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start();
}

export const SOUND_BANK = {
  pip: () => tone({ type: "square", from: 880, to: 1300, ms: 60, gain: 0.12 }),
  blub: () => tone({ type: "sine", from: 230, to: 110, ms: 130, gain: 0.3, filterHz: 600 }),
  boing: () => {
    tone({ type: "triangle", from: 420, to: 240, ms: 220, gain: 0.25 });
    tone({ type: "sine", from: 840, to: 300, ms: 120, gain: 0.08 });
  },
  splat: () => {
    noise({ ms: 160, gain: 0.25, filterHz: 700 });
    tone({ type: "sine", from: 300, to: 60, ms: 260, gain: 0.3 });
  },
  pop: () => tone({ type: "sine", from: 600, to: 950, ms: 55, gain: 0.2 }),
};

export function playSound(name) {
  SOUND_BANK[name]?.();
}
