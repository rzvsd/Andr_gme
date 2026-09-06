import { Physics } from '../core/Physics.js';
import {
  VERSUS_LEFT_PLATFORM_CATEGORY,
  VERSUS_LEFT_PLATFORM_ID,
  VERSUS_LEFT_PLATFORM_NAME,
  VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
  VERSUS_PLAYER_A_PLATFORM_MASK,
  VERSUS_PLAYER_B_PLATFORM_MASK,
  VERSUS_RIGHT_PLATFORM_CATEGORY,
  VERSUS_RIGHT_PLATFORM_ID,
  VERSUS_RIGHT_PLATFORM_NAME,
} from '../scenes/versusArena.js';
import { emitEvent, isActiveEntity, isFiniteNumber } from './systemUtils.js';
import { parseVersusPlayerIndex, VERSUS_INVALID_PLAYER_INDEX } from './versusPlayerIndex.js';

const PLATFORM_CONTACT_EPSILON = 0.0001;
// M9: hit knockback — shove + small hop so trades reposition fighters instead of
// stalling into point-blank bullet spam. X below max run speed (330), hop is small.
const KNOCKBACK_X = 260;
const KNOCKBACK_Y = -140;
// M9: dodge window widened (0.65->0.85 height, 1.5->2.0 bullet) — old window
// under-counted jump-apex grazes where the bullet visibly cleared the fighter.
const DODGE_HEIGHT_FACTOR = 0.85;
const DODGE_BULLET_FACTOR = 2;
const PLATFORM_DEFAULTS = [
  {
    id: VERSUS_LEFT_PLATFORM_ID,
    name: VERSUS_LEFT_PLATFORM_NAME,
    collisionCategory: VERSUS_LEFT_PLATFORM_CATEGORY,
  },
  {
    id: VERSUS_RIGHT_PLATFORM_ID,
    name: VERSUS_RIGHT_PLATFORM_NAME,
    collisionCategory: VERSUS_RIGHT_PLATFORM_CATEGORY,
  },
];
const PLAYER_PLATFORM_MASKS = [
  VERSUS_PLAYER_A_PLATFORM_MASK,
  VERSUS_PLAYER_B_PLATFORM_MASK,
];

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

const toNonNegativeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, numeric);
};

const toBitmask = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return fallback;
  }
  return numeric;
};

const getBodyBounds = (platform) => {
  if (platform && typeof platform.getBodyBounds === 'function') {
    return platform.getBodyBounds();
  }
  return platform;
};

const getPlayerCollisionBounds = (platform) => {
  if (platform && typeof platform.getPlayerCollisionBounds === 'function') {
    return platform.getPlayerCollisionBounds();
  }

  const offsetY = toNonNegativeNumber(platform?.playerCollisionOffsetY, 0);
  const bodyHeight = toNonNegativeNumber(platform?.height, 0);
  const maxCollisionHeight = Math.max(0, bodyHeight - offsetY);
  const collisionHeight = Math.min(
    maxCollisionHeight,
    toNonNegativeNumber(platform?.playerCollisionHeight, maxCollisionHeight)
  );

  return {
    x: Number(platform?.x) || 0,
    y: (Number(platform?.y) || 0) + offsetY,
    width: Number(platform?.width) || 0,
    height: collisionHeight,
  };
};

const assignPlayerSupportMetadata = (player, platform) => {
  if (!player || typeof player !== 'object') {
    return;
  }

  if (!platform) {
    player.supportingPlatform = null;
    player.supportingPlatformId = null;
    player.supportingPlatformName = null;
    player.supportingPlatformCategory = 0;
    return;
  }

  player.supportingPlatform = platform;
  player.supportingPlatformId = typeof platform.id === 'string' && platform.id.length > 0 ? platform.id : null;
  player.supportingPlatformName = typeof platform.name === 'string' && platform.name.length > 0
    ? platform.name
    : player.supportingPlatformId;
  player.supportingPlatformCategory = toBitmask(platform.collisionCategory, 0);
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

    this.#preparePlatforms(platforms);
    this.#preparePlayers(players);
    this.#resolvePlayersAgainstPlatforms(players, platforms);
    this.#resolvePvpBulletCollisions(players, bullets, platforms, eventBus);
  }

  #resolvePlayers(context) {
    const maybePlayers = Array.isArray(context?.players) ? context.players : [];

    this._players[0] = context?.p1 ?? maybePlayers[0] ?? null;
    this._players[1] = context?.p2 ?? maybePlayers[1] ?? null;

    return this._players;
  }

  #preparePlatforms(platforms) {
    const sortedPlatforms = platforms
      .filter((platform) => platform && typeof platform === 'object')
      .slice()
      .sort((a, b) => toNonNegativeNumber(a?.x, 0) - toNonNegativeNumber(b?.x, 0));

    for (let index = 0; index < sortedPlatforms.length; index += 1) {
      const platform = sortedPlatforms[index];
      const defaults = PLATFORM_DEFAULTS[index];
      if (!defaults) {
        continue;
      }

      const hadPlatformId = typeof platform.id === 'string' && platform.id.length > 0;
      const hadPlatformName = typeof platform.name === 'string' && platform.name.length > 0;
      const existingCategory = toBitmask(platform.collisionCategory, 0);
      const hadVersusMetadata = hadPlatformId || hadPlatformName || existingCategory > 0;

      if (!hadPlatformId) {
        platform.id = defaults.id;
      }
      if (!hadPlatformName) {
        platform.name = defaults.name;
      }

      platform.collisionCategory = existingCategory > 0 ? existingCategory : defaults.collisionCategory;
      platform.playerCollisionOffsetY = toNonNegativeNumber(platform.playerCollisionOffsetY, 0);

      const bodyHeight = toNonNegativeNumber(platform.height, 0);
      const maxCollisionHeight = Math.max(0, bodyHeight - platform.playerCollisionOffsetY);
      const defaultCollisionHeight = Math.min(VERSUS_PLATFORM_TOP_COLLISION_HEIGHT, maxCollisionHeight);
      const explicitCollisionHeight = toNonNegativeNumber(platform.playerCollisionHeight, maxCollisionHeight);
      platform.playerCollisionHeight = Math.min(
        maxCollisionHeight,
        hadVersusMetadata ? explicitCollisionHeight : defaultCollisionHeight
      );
    }
  }

  #preparePlayers(players) {
    for (let index = 0; index < players.length; index += 1) {
      const player = players[index];
      if (!player || typeof player !== 'object') {
        continue;
      }

      const fallbackMask = PLAYER_PLATFORM_MASKS[index] ?? 0;
      player.platformCollisionMask = toBitmask(player.platformCollisionMask, fallbackMask);
    }
  }

  #resolvePlayersAgainstPlatforms(players, platforms) {
    for (const player of players) {
      if (!player || typeof player !== 'object') {
        continue;
      }

      if (!isActiveEntity(player) || !hasBounds(player)) {
        assignPlayerSupportMetadata(player, null);
        continue;
      }

      let grounded = false;
      let supportingPlatform = null;

      for (const platform of platforms) {
        if (!isActiveEntity(platform) || !hasBounds(platform)) {
          continue;
        }
        if (platform.isSolid === false) {
          continue;
        }
        if (!this.#canPlayerCollideWithPlatform(player, platform)) {
          continue;
        }

        const collisionBounds = getPlayerCollisionBounds(platform);
        if (!hasBounds(collisionBounds)) {
          continue;
        }

        if (!this.#resolvePlayerOnSupportStrip(player, collisionBounds)) {
          continue;
        }

        grounded = true;
        supportingPlatform = platform;
        break;
      }

      player.onGround = grounded;
      assignPlayerSupportMetadata(player, supportingPlatform);
    }
  }

  #resolvePvpBulletCollisions(players, bullets, platforms, eventBus) {
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

      if (isActiveEntity(target) && hasBounds(target) && Physics.aabbOverlap(bullet, target)) {
        // M3: spawn protection — protected targets don't take hits and don't grant dodges.
        if (target.invulnerable === true) {
          if (this.#deactivateBulletOnPlatformHit(bullet, platforms, eventBus, shooter, shooterIndex)) {
            continue;
          }
          continue;
        }
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

        if (!isFatal) {
          this.#applyKnockback(target, shooter, bullet);
        }

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

      if (this.#deactivateBulletOnPlatformHit(bullet, platforms, eventBus, shooter, shooterIndex)) {
        continue;
      }

      this.#emitDodgeIfNeeded(bullet, shooter, shooterIndex, target, targetIndex, eventBus);
    }
  }

  #applyKnockback(target, shooter, bullet) {
    if (!target || typeof target !== "object") {
      return;
    }
    let direction = 0;
    const bulletDir = Number(bullet?.directionX);
    if (Number.isFinite(bulletDir) && bulletDir !== 0) {
      direction = bulletDir > 0 ? 1 : -1;
    } else if (isFiniteNumber(target.x) && isFiniteNumber(shooter?.x)) {
      const gap = Number(target.x) - Number(shooter.x);
      direction = gap >= 0 ? 1 : -1;
    } else {
      direction = 1;
    }

    if (isFiniteNumber(target.vx)) {
      target.vx = direction * KNOCKBACK_X;
    }
    // Small hop only when grounded — airborne targets keep their arc so juggles stay fair.
    if (target.onGround === true && isFiniteNumber(target.vy)) {
      target.vy = KNOCKBACK_Y;
      target.onGround = false;
    }
    // Face the attacker so retaliation reads instantly.
    if (target.facing === 1 || target.facing === -1) {
      if (isFiniteNumber(shooter?.x) && isFiniteNumber(target.x)) {
        target.facing = Number(shooter.x) >= Number(target.x) ? 1 : -1;
      } else {
        target.facing = direction >= 0 ? -1 : 1;
      }
    }
  }

  #deactivateBulletOnPlatformHit(bullet, platforms, eventBus, shooter, shooterIndex) {
    for (const platform of platforms) {
      if (!isActiveEntity(platform)) {
        continue;
      }

      const bodyBounds = getBodyBounds(platform);
      if (!hasBounds(bodyBounds)) {
        continue;
      }

      if (!Physics.aabbOverlap(bullet, bodyBounds)) {
        continue;
      }

      deactivateEntity(bullet);
      emitEvent(eventBus, 'versus:bullet_blocked', {
        bullet,
        shooter,
        shooterIndex,
        platform,
      });
      return true;
    }

    return false;
  }

  #emitDodgeIfNeeded(bullet, shooter, shooterIndex, target, targetIndex, eventBus) {
    if (!isActiveEntity(bullet) || bullet.dodgeCounted === true || !isActiveEntity(target)) {
      return;
    }
    if (target.invulnerable === true) {
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

    const verticalWindow = Number(target.height) * DODGE_HEIGHT_FACTOR + Number(bullet.height) * DODGE_BULLET_FACTOR;
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

  #canPlayerCollideWithPlatform(player, platform) {
    const platformCategory = toBitmask(platform?.collisionCategory, 0);
    if (platformCategory === 0) {
      return true;
    }

    const playerMask = toBitmask(player?.platformCollisionMask, 0);
    return (playerMask & platformCategory) !== 0;
  }

  #resolvePlayerOnSupportStrip(player, platformBounds) {
    const playerLeft = Number(player.x);
    const playerTop = Number(player.y);
    const playerRight = playerLeft + Number(player.width);
    const playerBottom = playerTop + Number(player.height);

    const platformLeft = Number(platformBounds.x);
    const platformTop = Number(platformBounds.y);
    const platformRight = platformLeft + Number(platformBounds.width);
    const platformBottom = platformTop + Number(platformBounds.height);

    const hasHorizontalOverlap = playerRight > platformLeft && playerLeft < platformRight;
    if (!hasHorizontalOverlap) {
      return false;
    }

    const verticalVelocity = isFiniteNumber(player.vy) ? Number(player.vy) : 0;
    if (verticalVelocity < 0) {
      return false;
    }

    const isTouchingTop = Math.abs(playerBottom - platformTop) <= PLATFORM_CONTACT_EPSILON;
    const overlapsSupportStrip = playerBottom > platformTop && playerTop < platformBottom;
    if (!isTouchingTop && !overlapsSupportStrip) {
      return false;
    }

    player.y = platformTop - Number(player.height);
    if (isFiniteNumber(player.vy) && Number(player.vy) > 0) {
      player.vy = 0;
    }
    return true;
  }
}
