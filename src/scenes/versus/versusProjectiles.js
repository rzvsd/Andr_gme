import { PLAYER_BULLET_DAMAGE } from "../../config/constants.js";
import {
  BULLET_LIFETIME_MS,
  BULLET_OFFSCREEN_MARGIN,
  BULLET_SPEED,
  PLAYER_SHOOT_Y_OFFSET,
  TEAM_STYLES,
  center,
  emit,
  nowMs,
} from "./versusConfig.js";

export class VersusProjectiles {
  constructor(scene) {
    this.s = scene;
  }

  fireBullet(player, ownerIndex, eventBus) {
    if (!player || player.active === false) {
      return false;
    }

    const now = this.s.cachedNowMs || nowMs();
    if (!player.canShoot(now)) {
      return false;
    }

    const pool = ownerIndex === 0 ? this.s.p1BulletPool : this.s.p2BulletPool;
    const ownerList = ownerIndex === 0 ? this.s.p1Bullets : this.s.p2Bullets;
    const fallbackDirection = ownerIndex === 0 ? 1 : -1;
    const directionX = player.facing < 0 ? -1 : player.facing > 0 ? 1 : fallbackDirection;
    // M2: versus bullets follow TEAM_STYLES (picture: red vs blue/yellow), not fruit roster.
    const style = TEAM_STYLES[ownerIndex === 1 ? 1 : 0];
    const from = center(player);
    const bullet = pool.acquire();

    bullet.fire({
      x: from.x + directionX * 16,
      y: from.y - PLAYER_SHOOT_Y_OFFSET,
      directionX,
      directionY: 0,
      speed: BULLET_SPEED,
      damage: PLAYER_BULLET_DAMAGE,
      owner: player,
      lifetimeMs: BULLET_LIFETIME_MS,
      color: style.bulletCore,
      shape: "rect",
      characterKey: player.characterKey,
    });

    player.markShot(now);
    ownerList.push(bullet);
    this.s.bullets.push(bullet);
    // Small muzzle puff in team glow color — reads like expectation.png muzzle flash.
    this.s.effects.spawnFruitBurst(from.x + directionX * 20, from.y - PLAYER_SHOOT_Y_OFFSET, 3, [style.bulletAccent, style.bulletGlow], {
      lifeMin: 0.08,
      lifeMax: 0.16,
      speedMin: 20,
      speedMax: 60,
      sizeMin: 1,
      sizeMax: 2,
    });
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
      }
    }
  }
}
