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

export function unlockAudioProbe(onFinish) {
  if (!canUseHtmlAudio()) {
    onFinish?.();
    return;
  }

  const probe = new Audio(UNLOCK_AUDIO_DATA_URI);
  probe.muted = true;
  probe.volume = 0;

  const finish = () => {
    try {
      probe.pause();
      probe.src = "";
    } catch {
      // Ignore probe cleanup errors.
    }
    onFinish?.();
  };

  try {
    const promise = probe.play();
    if (promise && typeof promise.then === "function") {
      promise.then(finish).catch(finish);
    } else {
      finish();
    }
  } catch {
    finish();
  }
}

export function getAudioCandidates(name, definition, basePath = "/audio") {
  const candidates = [];

  if (typeof definition === "string") {
    candidates.push(definition);
  } else if (definition && typeof definition === "object") {
    if (typeof definition.src === "string") candidates.push(definition.src);
    if (typeof definition.webm === "string") candidates.push(definition.webm);
    if (typeof definition.mp3 === "string") candidates.push(definition.mp3);
    if (Array.isArray(definition.sources)) {
      for (const source of definition.sources) {
        if (typeof source === "string") {
          candidates.push(source);
        }
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push(`${basePath}/${name}.webm`);
    candidates.push(`${basePath}/${name}.mp3`);
  }

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

export function resolveAudioSource(name, definition, basePath, failedIndexes) {
  const candidates = getAudioCandidates(name, definition, basePath);
  if (candidates.length === 0) {
    return null;
  }

  for (let i = 0; i < candidates.length; i += 1) {
    if (!failedIndexes || !failedIndexes.has(i)) {
      return { index: i, src: candidates[i] };
    }
  }
  return null;
}
