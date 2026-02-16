import { Physics } from '../core/Physics.js';
import { emitEvent, isFiniteNumber } from './systemUtils.js';

const hasValidBounds = (entity) => (
  entity &&
  typeof entity === 'object' &&
  isFiniteNumber(entity.x) &&
  isFiniteNumber(entity.y) &&
  isFiniteNumber(entity.width) &&
  isFiniteNumber(entity.height) &&
  Number(entity.width) >= 0 &&
  Number(entity.height) >= 0
);

const isActiveEntity = (entity) => hasValidBounds(entity) && entity.active !== false;

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

const isPlayerOwnedBullet = (bullet, players) => {
  const owner = bullet?.owner;

  if (typeof owner === 'string') {
    return owner.toLowerCase() === 'player';
  }

  if (!owner || typeof owner !== 'object') {
    return false;
  }

  if (owner.isPlayer === true) {
    return true;
  }

  if (typeof owner.type === 'string' && owner.type.toLowerCase() === 'player') {
    return true;
  }

  return players.includes(owner);
};

export class CollisionSystem {
  constructor() {
    this._activePlayers = [];
    this._activeEnemies = [];
    this._activePlatforms = [];
    this._activeBullets = [];
  }

  update(_deltaSeconds, context = {}) {
    const players = this.#collectActiveEntities(context?.players, this._activePlayers);
    const enemies = this.#collectActiveEntities(context?.enemies, this._activeEnemies);
    const bullets = this.#collectActiveEntities(context?.bullets, this._activeBullets);
    const platforms = this.#collectActiveEntities(context?.platforms, this._activePlatforms);
    const eventBus = context?.eventBus;

    this.#resolveEntitiesAgainstPlatforms(players, platforms);
    this.#resolveEntitiesAgainstPlatforms(enemies, platforms);
    this.#handleBulletCollisions(bullets, players, enemies, eventBus);
  }

  #resolveEntitiesAgainstPlatforms(entities, platforms) {
    for (const entity of entities) {
      if (!isActiveEntity(entity)) {
        continue;
      }

      let grounded = false;

      for (const platform of platforms) {
        if (!Physics.aabbOverlap(entity, platform)) {
          continue;
        }

        const { deltaX, deltaY, overlapX, overlapY } = getOverlap(entity, platform);
        if (!(overlapX > 0) || !(overlapY > 0)) {
          continue;
        }

        if (overlapX < overlapY) {
          entity.x += deltaX < 0 ? -overlapX : overlapX;
          if (isFiniteNumber(entity.vx)) {
            entity.vx = 0;
          }
          continue;
        }

        entity.y += deltaY < 0 ? -overlapY : overlapY;

        if (isFiniteNumber(entity.vy)) {
          entity.vy = 0;
        }

        if (deltaY < 0) {
          grounded = true;
        }
      }

      entity.onGround = grounded;
    }
  }

  #handleBulletCollisions(bullets, players, enemies, eventBus) {
    for (const bullet of bullets) {
      if (!isActiveEntity(bullet)) {
        continue;
      }

      const playerOwned = isPlayerOwnedBullet(bullet, players);
      const targets = playerOwned ? enemies : players;
      let didHitTarget = false;

      for (const target of targets) {
        if (!isActiveEntity(target)) {
          continue;
        }

        if (!Physics.aabbOverlap(bullet, target)) {
          continue;
        }

        const damage = isFiniteNumber(bullet.damage) ? Math.max(0, Number(bullet.damage)) : 0;
        const targetHealthBefore = isFiniteNumber(target.health) ? Number(target.health) : null;
        const targetWasActive = target.active !== false;

        if (typeof target.takeDamage === 'function') {
          target.takeDamage(damage);
        }

        deactivateEntity(bullet);

        emitEvent(eventBus, 'bullet_hit', {
          bullet,
          target,
          damage,
        });

        if (playerOwned) {
          const targetHealthAfter = isFiniteNumber(target.health) ? Number(target.health) : null;
          const isKilled = (
            target.active === false ||
            (targetHealthBefore !== null && targetHealthAfter !== null && targetHealthBefore > 0 && targetHealthAfter <= 0)
          );

          if (targetWasActive && isKilled) {
            emitEvent(eventBus, 'enemy_killed', {
              enemy: target,
              bullet,
            });
          }
        } else {
          const targetHealthAfter = isFiniteNumber(target.health) ? Number(target.health) : null;
          const isFatal = (
            target.active === false ||
            (targetHealthBefore !== null && targetHealthAfter !== null && targetHealthBefore > 0 && targetHealthAfter <= 0)
          );

          emitEvent(eventBus, 'player_hit', {
            player: target,
            bullet,
            damage,
            isFatal,
            death: isFatal,
            dead: isFatal,
          });
        }

        didHitTarget = true;
        break;
      }

      if (!playerOwned && !didHitTarget) {
        this.#emitBulletDodged(bullet, players, eventBus);
      }
    }
  }

  #collectActiveEntities(source, out) {
    out.length = 0;
    if (!Array.isArray(source)) {
      return out;
    }

    for (const entity of source) {
      if (isActiveEntity(entity)) {
        out.push(entity);
      }
    }
    return out;
  }

  #emitBulletDodged(bullet, players, eventBus) {
    if (!isActiveEntity(bullet) || bullet.dodgeCounted === true || players.length === 0) {
      return;
    }

    const player = players[0];
    if (!isActiveEntity(player)) {
      return;
    }

    const bulletPreviousX = isFiniteNumber(bullet.previousX) ? Number(bullet.previousX) : Number(bullet.x);
    const bulletCurrentX = Number(bullet.x);
    const playerCenter = centerOf(player);
    const bulletCenter = centerOf(bullet);

    const crossedPlayerX = (
      (bulletPreviousX <= playerCenter.x && bulletCurrentX >= playerCenter.x) ||
      (bulletPreviousX >= playerCenter.x && bulletCurrentX <= playerCenter.x)
    );

    if (!crossedPlayerX) {
      return;
    }

    const verticalWindow = Number(player.height) * 0.65 + Number(bullet.height) * 1.5;
    const verticalDistance = Math.abs(bulletCenter.y - playerCenter.y);
    if (verticalDistance > verticalWindow) {
      return;
    }

    bullet.dodgeCounted = true;
    emitEvent(eventBus, 'bullet_dodged', {
      bullet,
      player,
    });
  }
}
