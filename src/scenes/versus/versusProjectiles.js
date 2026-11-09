import { VERSUS_BULLET_DAMAGE, hasShot, shotClipOf, spendShot } from "./versusShots.js";
import { TEAM_COLORS } from "../../theme/tokens.js";
import {
  BULLET_FX,
  BULLET_LIFETIME_MS,
  BULLET_OFFSCREEN_MARGIN,
  BULLET_SPEED,
  REVEAL_ON_FIRE_SECONDS,
  center,
  emit,
  nowMs,
  shotLineY,
} from "./versusConfig.js";

// Trail ring buffer: the last `length` bullet centres (world px). Allocated once per pooled
// bullet and reused, so firing and stepping never allocate.
export function createTrail(length = BULLET_FX.trailLength) {
  const size = Math.max(1, Math.floor(length));
  return { x: new Float32Array(size), y: new Float32Array(size), head: 0, count: 0 };
}

export function resetTrail(trail) {
  trail.head = 0;
  trail.count = 0;
}

export function pushTrail(trail, x, y) {
  const size = trail.x.length;
  trail.x[trail.head] = x;
  trail.y[trail.head] = y;
  trail.head = (trail.head + 1) % size;
  trail.count = Math.min(size, trail.count + 1);
}

// Position `stepsBack` steps behind the newest entry (1 = newest). Returns false past the end.
export function trailPoint(trail, stepsBack, out) {
  if (stepsBack < 1 || stepsBack > trail.count) {
    return false;
  }
  const size = trail.x.length;
  const index = (trail.head - stepsBack + size) % size;
  out.x = trail.x[index];
  out.y = trail.y[index];
  return true;
}

export class VersusProjectiles {
  constructor(scene) {
    this.s = scene;
  }

  fireBullet(player, ownerIndex, eventBus) {
    if (!player || player.active === false) {
      return false;
    }

    const now = this.s.cachedNowMs || nowMs();
    const clip = shotClipOf(player);
    if (!player.canShoot(now) || !hasShot(clip, now)) {
      return false;
    }

    const pool = ownerIndex === 0 ? this.s.p1BulletPool : this.s.p2BulletPool;
    const ownerList = ownerIndex === 0 ? this.s.p1Bullets : this.s.p2Bullets;
    const fallbackDirection = ownerIndex === 0 ? 1 : -1;
    const directionX = player.facing < 0 ? -1 : player.facing > 0 ? 1 : fallbackDirection;
    const team = TEAM_COLORS[ownerIndex === 1 ? 1 : 0];
    const from = center(player);
    const bullet = pool.acquire();

    // The bullet is centred on the shot line (its x and y are the top-left corner).
    bullet.fire({
      x: from.x + directionX * 16,
      y: shotLineY(player) - (Number(bullet.height) || 0) * 0.5,
      directionX,
      directionY: 0,
      speed: BULLET_SPEED,
      damage: VERSUS_BULLET_DAMAGE,
      owner: player,
      lifetimeMs: BULLET_LIFETIME_MS,
      color: team.main,
      shape: "rect",
      characterKey: player.characterKey,
    });
    if (bullet.trail) {
      resetTrail(bullet.trail);
    } else {
      bullet.trail = createTrail();
    }

    player.markShot(now);
    spendShot(clip, now);
    // Dark arena: firing gives away the shooter position.
    this.s.playersCtl?.revealPlayer?.(ownerIndex, REVEAL_ON_FIRE_SECONDS);
    ownerList.push(bullet);
    this.s.bullets.push(bullet);
    emit(eventBus, "bullet_fired", { owner: ownerIndex, bullet });
    return true;
  }

  resetBullets() {
    const released = new Set();
    const release = (bullet, pool) => {
      if (!bullet || released.has(bullet)) {
        return;
      }
      pool?.release?.(bullet);
      released.add(bullet);
    };

    for (const bullet of this.s.p1Bullets) {
      release(bullet, this.s.p1BulletPool);
    }
    for (const bullet of this.s.p2Bullets) {
      release(bullet, this.s.p2BulletPool);
    }
    for (const bullet of this.s.bullets) {
      if (released.has(bullet)) {
        continue;
      }
      const pool = bullet?.owner === this.s.p1 ? this.s.p1BulletPool : this.s.p2BulletPool;
      release(bullet, pool);
    }

    this.s.bullets.length = 0;
    this.s.p1Bullets.length = 0;
    this.s.p2Bullets.length = 0;
  }

  recycleBullets() {
    const compactOwned = (list, pool) => {
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < list.length; readIndex += 1) {
        const bullet = list[readIndex];
        if (bullet?.active !== false) {
          list[writeIndex] = bullet;
          writeIndex += 1;
          continue;
        }
        pool.release(bullet);
      }
      list.length = writeIndex;
    };

    compactOwned(this.s.p1Bullets, this.s.p1BulletPool);
    compactOwned(this.s.p2Bullets, this.s.p2BulletPool);

    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.s.bullets.length; readIndex += 1) {
      const bullet = this.s.bullets[readIndex];
      if (bullet?.active !== false) {
        this.s.bullets[writeIndex] = bullet;
        writeIndex += 1;
      }
    }
    this.s.bullets.length = writeIndex;
  }

  stepBullets(dt, physicsContext) {
    for (const bullet of this.s.bullets) {
      if (bullet?.active !== false) {
        bullet.update(dt, physicsContext);
      }

      if (!bullet || bullet.active === false) {
        continue;
      }

      if (
        bullet.x < -BULLET_OFFSCREEN_MARGIN ||
        bullet.x > this.s.worldWidth + BULLET_OFFSCREEN_MARGIN ||
        bullet.y < -BULLET_OFFSCREEN_MARGIN ||
        bullet.y > this.s.deathY + BULLET_OFFSCREEN_MARGIN
      ) {
        bullet.deactivate();
        continue;
      }

      if (bullet.trail) {
        pushTrail(bullet.trail, bullet.x + bullet.width * 0.5, bullet.y + bullet.height * 0.5);
      }
    }
  }
}
