import { Physics } from '../core/Physics.js';
import { emitEvent, isActiveEntity, isFiniteNumber } from './systemUtils.js';
import { parseVersusPlayerIndex, VERSUS_INVALID_PLAYER_INDEX } from './versusPlayerIndex.js';

const hasBounds = (entity) => (
  entity &&
  typeof entity === 'object' &&
  isFiniteNumber(entity.x) &&
  isFiniteNumber(entity.y) &&
  isFiniteNumber(entity.width) &&
  isFiniteNumber(entity.height) &&
  Number(entity.width) >= 0 &&
  Number(entity.height) >= 0
);

const deactivateEntity = (entity) => {
  if (!entity || typeof entity !== 'object') {
    return;
  }

  if (typeof entity.deactivate === 'function') {
    entity.deactivate();
  } else {
    entity.active = false;
  }

  if (isFiniteNumber(entity.vx)) {
    entity.vx = 0;
  }
  if (isFiniteNumber(entity.vy)) {
    entity.vy = 0;
  }
};

const centerOf = (entity) => ({
  x: Number(entity.x) + Number(entity.width) * 0.5,
  y: Number(entity.y) + Number(entity.height) * 0.5,
});

const getOverlap = (entity, platform) => {
  const entityCenterX = Number(entity.x) + Number(entity.width) / 2;
  const entityCenterY = Number(entity.y) + Number(entity.height) / 2;
  const platformCenterX = Number(platform.x) + Number(platform.width) / 2;
  const platformCenterY = Number(platform.y) + Number(platform.height) / 2;

  const halfCombinedWidth = Number(entity.width) / 2 + Number(platform.width) / 2;
  const halfCombinedHeight = Number(entity.height) / 2 + Number(platform.height) / 2;

  const deltaX = entityCenterX - platformCenterX;
  const deltaY = entityCenterY - platformCenterY;

  return {
    deltaX,
    deltaY,
    overlapX: halfCombinedWidth - Math.abs(deltaX),
    overlapY: halfCombinedHeight - Math.abs(deltaY),
  };
};

export class VersusCollisionSystem {
  constructor() {
    this._players = [null, null];
  }

  update(_deltaSeconds, context = {}) {
    const players = this.#resolvePlayers(context);
    const bullets = Array.isArray(context?.bullets) ? context.bullets : [];
    const platforms = Array.isArray(context?.platforms) ? context.platforms : [];
    const eventBus = context?.eventBus;

    this.#resolvePlayersAgainstPlatforms(players, platforms);
    this.#resolvePvpBulletCollisions(players, bullets, eventBus);
  }

  #resolvePlayers(context) {
    const maybePlayers = Array.isArray(context?.players) ? context.players : [];

    this._players[0] = context?.p1 ?? maybePlayers[0] ?? null;
    this._players[1] = context?.p2 ?? maybePlayers[1] ?? null;

    return this._players;
  }

  #resolvePlayersAgainstPlatforms(players, platforms) {
    for (const player of players) {
      if (!isActiveEntity(player) || !hasBounds(player)) {
        continue;
      }

      let grounded = false;

      for (const platform of platforms) {
        if (!isActiveEntity(platform) || !hasBounds(platform)) {
          continue;
        }

        if (!Physics.aabbOverlap(player, platform)) {
          continue;
        }

        const { deltaX, deltaY, overlapX, overlapY } = getOverlap(player, platform);
        if (!(overlapX > 0) || !(overlapY > 0)) {
          continue;
        }

        if (overlapX < overlapY) {
          player.x += deltaX < 0 ? -overlapX : overlapX;
          if (isFiniteNumber(player.vx)) {
            player.vx = 0;
          }
          continue;
        }

        player.y += deltaY < 0 ? -overlapY : overlapY;
        if (isFiniteNumber(player.vy)) {
          player.vy = 0;
        }

        if (deltaY < 0) {
          grounded = true;
        }
      }

      player.onGround = grounded;
    }
  }

  #resolvePvpBulletCollisions(players, bullets, eventBus) {
    for (const bullet of bullets) {
      if (!isActiveEntity(bullet) || !hasBounds(bullet)) {
        continue;
      }

      const shooterIndex = parseVersusPlayerIndex(bullet?.owner, players);
      if (shooterIndex === VERSUS_INVALID_PLAYER_INDEX) {
        continue;
      }

      const targetIndex = shooterIndex === 0 ? 1 : 0;
      const shooter = players[shooterIndex];
      const target = players[targetIndex];

      if (!isActiveEntity(target) || !hasBounds(target)) {
        continue;
      }

      if (Physics.aabbOverlap(bullet, target)) {
        const damage = isFiniteNumber(bullet.damage) ? Math.max(0, Number(bullet.damage)) : 0;
        const targetHealthBefore = isFiniteNumber(target.health) ? Number(target.health) : null;
        const targetWasActive = target.active !== false;

        if (typeof target.takeDamage === 'function') {
          target.takeDamage(damage);
        } else if (isFiniteNumber(target.health)) {
          target.health = Math.max(0, Number(target.health) - damage);
          if (target.health <= 0) {
            target.active = false;
          }
        }

        const targetHealthAfter = isFiniteNumber(target.health) ? Number(target.health) : null;
        const isFatal = (
          target.active === false ||
          (targetHealthBefore !== null && targetHealthAfter !== null && targetHealthBefore > 0 && targetHealthAfter <= 0)
        );

        deactivateEntity(bullet);

        emitEvent(eventBus, 'bullet_hit', {
          bullet,
          target,
          shooter,
          shooterIndex,
          targetIndex,
          damage,
        });

        emitEvent(eventBus, 'versus:player_hit', {
          bullet,
          shooter,
          shooterIndex,
          target,
          targetIndex,
          damage,
          isFatal,
          death: isFatal,
          dead: isFatal,
        });

        if (targetWasActive && isFatal) {
          emitEvent(eventBus, 'versus:kill', {
            bullet,
            killer: shooter,
            killerIndex: shooterIndex,
            victim: target,
            victimIndex: targetIndex,
            damage,
          });
        }

        continue;
      }

      this.#emitDodgeIfNeeded(bullet, shooter, shooterIndex, target, targetIndex, eventBus);
    }
  }

  #emitDodgeIfNeeded(bullet, shooter, shooterIndex, target, targetIndex, eventBus) {
    if (!isActiveEntity(bullet) || bullet.dodgeCounted === true || !isActiveEntity(target)) {
      return;
    }

    const targetCenter = centerOf(target);
    const bulletCenter = centerOf(bullet);
    const previousX = isFiniteNumber(bullet.previousX) ? Number(bullet.previousX) : Number(bullet.x);
    const currentX = Number(bullet.x);

    const crossedTargetX = (
      (previousX <= targetCenter.x && currentX >= targetCenter.x) ||
      (previousX >= targetCenter.x && currentX <= targetCenter.x)
    );
    if (!crossedTargetX) {
      return;
    }

    const verticalWindow = Number(target.height) * 0.65 + Number(bullet.height) * 1.5;
    const verticalDistance = Math.abs(bulletCenter.y - targetCenter.y);
    if (verticalDistance > verticalWindow) {
      return;
    }

    bullet.dodgeCounted = true;
    emitEvent(eventBus, 'versus:dodge', {
      bullet,
      shooter,
      shooterIndex,
      dodger: target,
      dodgerIndex: targetIndex,
    });
  }
}
