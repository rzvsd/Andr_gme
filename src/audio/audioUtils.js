export const UNLOCK_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

const AUDIO_NAME_ALIASES = Object.freeze({
  pew: ["sfx_shoot"],
  sfx_shoot: ["pew"],
  hit: ["sfx_hit"],
  sfx_hit: ["hit"],
  explosion: ["sfx_explosion"],
  sfx_explosion: ["explosion"],
  whoosh: ["sfx_whoosh"],
  sfx_whoosh: ["whoosh"],
  fanfare: ["sfx_fanfare"],
  sfx_fanfare: ["fanfare"],
  ui_click: ["sfx_click"],
  sfx_click: ["ui_click"],
  jump: ["sfx_jump"],
  sfx_jump: ["jump"],
  death: ["sfx_death"],
  sfx_death: ["death"],
  menu_bgm: ["bgm_menu"],
  bgm_menu: ["menu_bgm"],
  battle_bgm: ["bgm_battle"],
  bgm_battle: ["battle_bgm"],
  pause_bgm: ["bgm_pause"],
  bgm_pause: ["pause_bgm"],
  game_over_bgm: ["bgm_gameover", "bgm_game_over"],
  bgm_gameover: ["game_over_bgm", "bgm_game_over"],
  bgm_game_over: ["game_over_bgm", "bgm_gameover"],
});

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

export function getAliasedAudioNames(name) {
  const queue = [name];
  const resolved = [];
  const seen = new Set();

  while (queue.length > 0) {
    const value = queue.shift();
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    seen.add(trimmed);
    resolved.push(trimmed);

    const aliases = AUDIO_NAME_ALIASES[trimmed];
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        queue.push(alias);
      }
    }
  }

  return resolved;
}

export function resolveAliasedDefinition(name, definitions) {
  if (!definitions || typeof definitions !== "object") {
    return undefined;
  }

  const aliases = getAliasedAudioNames(name);
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(definitions, alias)) {
      return definitions[alias];
    }
  }

  return undefined;
}

export function getAudioCandidates(name, definition, basePath = "/audio") {
  const candidates = [];
  const aliases = getAliasedAudioNames(name);

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

  for (const alias of aliases) {
    candidates.push(`${basePath}/${alias}.wav`);
    candidates.push(`${basePath}/${alias}.webm`);
    candidates.push(`${basePath}/${alias}.mp3`);
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
