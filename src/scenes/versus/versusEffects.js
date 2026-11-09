import { DUST_PUFF, FEEDBACK, SLAB } from "./versusConfig.js";

// Match feedback: hit stop, screen shake, slab flashes and the kill frame. The pure functions
// below carry the timing so they can be unit tested; the class holds the per-match state.

// Pure: true when `recentMs` (trigger timestamps) already holds `maxPerSecond` triggers in the
// second before `nowMs`.
export function isFeedbackRateLimited(recentMs, nowMs, maxPerSecond = FEEDBACK.maxPerSecond) {
  let count = 0;
  for (const stamp of recentMs) {
    if (nowMs - stamp < 1000) {
      count += 1;
    }
  }
  return count >= maxPerSecond;
}

// Pure: simulation time scale. 0 while a hit stop or kill freeze runs, 1 otherwise.
export function timeScaleAt(freezeUntilMs, nowMs) {
  return nowMs < freezeUntilMs ? 0 : 1;
}

// Pure: arena offset in design px for a shake of `ampPx` that started at `startMs` and lasts
// `durationMs`. The kick is along the shot axis (`dirX`, the bullet's direction, so the view is
// pushed away from the shooter) and decays linearly to zero.
export function shakeOffset(startMs, durationMs, ampPx, dirX, nowMs, out = { x: 0, y: 0 }) {
  const t = durationMs > 0 ? (nowMs - startMs) / durationMs : 1;
  if (!(t >= 0 && t < 1) || !(ampPx > 0)) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const decay = 1 - t;
  const phase = ((nowMs - startMs) / 1000) * Math.PI * 2 * FEEDBACK.shakeHz;
  const dir = dirX < 0 ? -1 : 1;
  out.x = dir * ampPx * decay * Math.cos(phase);
  out.y = ampPx * 0.35 * decay * Math.sin(phase * 1.5);
  return out;
}

// Pure: 1 when a slab flash just started, falling to 0 at `SLAB.flashMs`.
export function slabFlashAt(flashStartMs, nowMs) {
  const t = (nowMs - flashStartMs) / SLAB.flashMs;
  return t >= 0 && t < 1 ? 1 - t : 0;
}

export class VersusEffects {
  constructor(scene) {
    this.s = scene;
    this.freezeUntilMs = 0;
    this.shake = { startMs: 0, durationMs: 0, ampPx: 0, dirX: 1 };
    this.zoom = { startMs: 0, durationMs: 0, amount: 0 };
    this.recentMs = [];
    // Flash start per platform index (grounds, ledges and blocks).
    this.slabFlashStartMs = [];
    this.wasOnGround = [true, true];
    // x, y: world centre of the killing bullet (NaN when the kill carried no positioned bullet);
    // dirX: the bullet's direction, so the path ends on the victim's near side.
    this.killFrame = { shooterIndex: -1, victimIndex: -1, untilMs: 0, x: Number.NaN, y: Number.NaN, dirX: 1 };
    this._shakeOut = { x: 0, y: 0 };
  }

  // Moves every absolute timestamp forward by `deltaMs` (the length of a pause).
  shiftTime(deltaMs) {
    const d = Number(deltaMs);
    if (!(d > 0)) {
      return;
    }
    this.freezeUntilMs += d;
    this.shake.startMs += d;
    this.zoom.startMs += d;
    this.killFrame.untilMs += d;
    for (let i = 0; i < this.slabFlashStartMs.length; i += 1) {
      this.slabFlashStartMs[i] += d;
    }
    for (let i = 0; i < this.recentMs.length; i += 1) {
      this.recentMs[i] += d;
    }
  }

  reset() {
    this.freezeUntilMs = 0;
    this.shake.ampPx = 0;
    this.zoom.amount = 0;
    this.recentMs.length = 0;
    this.slabFlashStartMs.fill(Number.NEGATIVE_INFINITY);
    this.wasOnGround[0] = true;
    this.wasOnGround[1] = true;
    this.killFrame.untilMs = 0;
  }

  // kind: "hit" (short stop, small shake) or "kill" (freeze, big shake, zoom).
  // Returns false when the 5-per-second cap drops the feedback.
  trigger(kind, nowMs, dirX = 1) {
    if (isFeedbackRateLimited(this.recentMs, nowMs)) {
      return false;
    }
    if (this.recentMs.length >= FEEDBACK.maxPerSecond) {
      this.recentMs.shift();
    }
    this.recentMs.push(nowMs);

    const kill = kind === "kill";
    this.freezeUntilMs = Math.max(this.freezeUntilMs, nowMs + (kill ? FEEDBACK.killFreezeMs : FEEDBACK.hitStopMs));
    this.shake.startMs = nowMs;
    this.shake.durationMs = kill ? FEEDBACK.killShakeMs : FEEDBACK.hitShakeMs;
    this.shake.ampPx = kill ? FEEDBACK.killShakePx : FEEDBACK.hitShakePx;
    this.shake.dirX = dirX < 0 ? -1 : 1;
    if (kill) {
      this.zoom.startMs = nowMs;
      this.zoom.durationMs = FEEDBACK.killShakeMs;
      this.zoom.amount = FEEDBACK.killZoom;
    }
    return true;
  }

  getTimeScale(nowMs) {
    return timeScaleAt(this.freezeUntilMs, nowMs);
  }

  // { x, y } in design px plus a zoom factor about the viewport centre.
  getArenaTransform(nowMs, out) {
    const offset = shakeOffset(this.shake.startMs, this.shake.durationMs, this.shake.ampPx, this.shake.dirX, nowMs, this._shakeOut);
    out.x = offset.x;
    out.y = offset.y;
    const zt = this.zoom.durationMs > 0 ? (nowMs - this.zoom.startMs) / this.zoom.durationMs : 1;
    out.zoom = zt >= 0 && zt < 1 ? 1 + this.zoom.amount * (1 - zt) : 1;
    return out;
  }

  flashSlab(platformIndex, nowMs) {
    if (Number.isInteger(platformIndex) && platformIndex >= 0) {
      while (this.slabFlashStartMs.length <= platformIndex) {
        this.slabFlashStartMs.push(Number.NEGATIVE_INFINITY);
      }
      this.slabFlashStartMs[platformIndex] = nowMs;
    }
  }

  getSlabFlash(platformIndex, nowMs) {
    return slabFlashAt(this.slabFlashStartMs[platformIndex] ?? Number.NEGATIVE_INFINITY, nowMs);
  }

  // A fighter landing on its bridge lights the slab. Called once per simulation step.
  trackLandings(nowMs) {
    const players = this.s.players ?? [];
    for (let index = 0; index < players.length && index < 2; index += 1) {
      const player = players[index];
      const onGround = Boolean(player?.onGround) && player?.active !== false;
      if (onGround && !this.wasOnGround[index]) {
        const slab = this.s.platforms?.indexOf?.(player.supportingPlatform) ?? -1;
        this.flashSlab(slab >= 0 ? slab : index, nowMs);
      }
      this.wasOnGround[index] = onGround;
    }
  }

  // Three grey dots at the feet (world px), drifting up and out.
  spawnDustPuff(x, y) {
    for (let index = 0; index < DUST_PUFF.length; index += 1) {
      const dot = DUST_PUFF[index];
      const side = index === 1 ? -1 : 1;
      this.s.particles?.emit?.({
        x: x + side * (index + 1) * 6,
        y: y - 4,
        vx: side * (18 + index * 10),
        vy: -28,
        life: 0.25,
        size: dot.size,
        color: dot.color,
        shape: "circle",
      });
    }
  }

  // impact: { x, y } world centre of the killing bullet, or null.
  startKillFrame(shooterIndex, victimIndex, nowMs, impact = null, dirX = 1) {
    this.killFrame.shooterIndex = shooterIndex;
    this.killFrame.victimIndex = victimIndex;
    this.killFrame.untilMs = nowMs + FEEDBACK.killFreezeMs;
    this.killFrame.x = Number(impact?.x);
    this.killFrame.y = Number(impact?.y);
    this.killFrame.dirX = dirX < 0 ? -1 : 1;
  }

  // The kill frame object while it runs, else null.
  getKillFrame(nowMs) {
    return nowMs < this.killFrame.untilMs ? this.killFrame : null;
  }
}
