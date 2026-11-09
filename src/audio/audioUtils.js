export const UNLOCK_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

export function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

export function canUseHtmlAudio() {
  return typeof Audio !== "undefined";
}

// Plays a muted, silent clip. It only resolves after the browser has seen a
// user gesture, so a success here means WebAudio may start too.
export function unlockAudioProbe(onFinish) {
  if (!canUseHtmlAudio()) {
    onFinish?.(true);
    return;
  }

  const probe = new Audio(UNLOCK_AUDIO_DATA_URI);
  probe.muted = true;
  probe.volume = 0;
  let finished = false;

  const finish = (success) => {
    if (finished) return;
    finished = true;
    try {
      probe.pause();
      probe.src = "";
    } catch {
      // Ignore probe cleanup errors.
    }
    onFinish?.(Boolean(success));
  };

  try {
    const promise = probe.play();
    if (promise && typeof promise.then === "function") {
      promise.then(() => finish(true)).catch(() => finish(false));
    } else {
      finish(true);
    }
  } catch {
    finish(false);
  }
}

// One AudioContext for SFX and music. Created on first call, which must happen
// after the unlock probe succeeded (the autoplay rule). Returns null when
// WebAudio is missing (unit tests, old WebViews).
let sharedContext = null;

export function getSharedAudioContext() {
  if (sharedContext) {
    return sharedContext;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (typeof Ctor !== "function") {
    return null;
  }
  try {
    sharedContext = new Ctor();
  } catch {
    return null;
  }
  return sharedContext;
}

export function resumeAudioContext(ctx) {
  if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
    try {
      const result = ctx.resume();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch {
      // Ignore resume errors; the next gesture retries.
    }
  }
}
