import { PLAYER_HEALTH } from "./versusConfig.js";

// Shot limit (owner rule 2026-11-02): every fighter, bot included, holds three shots. All three
// come back VERSUS_SHOT_REFILL_MS after the fighter's last shot, so a burst of three is followed by
// a pause, and a fighter that stops firing goes dark. Tries while empty do not delay the refill.
// The 220 ms gap between two shots (Player.shootCooldownMs) still applies inside a burst.
export const VERSUS_SHOTS_PER_CLIP = 3;
export const VERSUS_SHOT_REFILL_MS = 3000;
export const VERSUS_HITS_TO_KILL = 3;
export const VERSUS_BULLET_DAMAGE = Math.ceil(PLAYER_HEALTH / VERSUS_HITS_TO_KILL);

export function createShotClip() {
  return { shotsLeft: VERSUS_SHOTS_PER_CLIP, lastShotAtMs: Number.NEGATIVE_INFINITY };
}

// The fighter's clip, created on first use (respawn and test fighters start full).
export function shotClipOf(player) {
  if (!player.shotClip) {
    player.shotClip = createShotClip();
  }
  return player.shotClip;
}

export function refillShotClip(clip, nowMs) {
  if (clip.shotsLeft < VERSUS_SHOTS_PER_CLIP && nowMs - clip.lastShotAtMs >= VERSUS_SHOT_REFILL_MS) {
    clip.shotsLeft = VERSUS_SHOTS_PER_CLIP;
  }
  return clip.shotsLeft;
}

export function hasShot(clip, nowMs) {
  return refillShotClip(clip, nowMs) > 0;
}

// Takes one shot. Returns false (and changes nothing) when the clip is empty.
export function spendShot(clip, nowMs) {
  if (!hasShot(clip, nowMs)) {
    return false;
  }
  clip.shotsLeft -= 1;
  clip.lastShotAtMs = nowMs;
  return true;
}

// 0..1 towards the next refill; 1 when the clip is full. For the shots-left HUD.
export function shotRefillProgress(clip, nowMs) {
  if (refillShotClip(clip, nowMs) >= VERSUS_SHOTS_PER_CLIP) {
    return 1;
  }
  return Math.min(1, Math.max(0, (nowMs - clip.lastShotAtMs) / VERSUS_SHOT_REFILL_MS));
}

export function resetShotClip(player) {
  player.shotClip = createShotClip();
}

// Pause: move the last shot forward so time spent paused does not refill the clip.
export function shiftShotClip(player, deltaMs) {
  if (player?.shotClip && Number.isFinite(player.shotClip.lastShotAtMs)) {
    player.shotClip.lastShotAtMs += deltaMs;
  }
}
