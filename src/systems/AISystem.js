import { ENEMY_TYPES } from '../entities/Enemy.js';
import {
  asArray,
  toNumber,
  isActiveEntity,
  emitEvent,
  resolveNowMs,
} from './systemUtils.js';

const DEFAULT_SHOOT_RANGE_X = 260;
const SHOOT_RANGE_X_BY_TYPE = Object.freeze({
  [ENEMY_TYPES.GRUNT]: 240,
  [ENEMY_TYPES.RUSHER]: 200,
  [ENEMY_TYPES.TANK]: 280,
  [ENEMY_TYPES.BOSS]: 360,
  [ENEMY_TYPES.SNIPER]: 520,
});

const EPSILON = 0.001;

const centerX = (entity) => toNumber(entity?.x, 0) + toNumber(entity?.width, 0) * 0.5;

const resolveShootRangeX = (enemy) => {
  const range = SHOOT_RANGE_X_BY_TYPE[enemy?.type];
  return Number.isFinite(range) ? range : DEFAULT_SHOOT_RANGE_X;
};

const findNearestActivePlayerOnX = (enemy, players) => {
  if (!enemy || players.length === 0) {
    return null;
  }

  const enemyMidX = centerX(enemy);
  let nearest = null;

  for (const player of players) {
    if (!isActiveEntity(player)) {
      continue;
    }

    const dx = centerX(player) - enemyMidX;
    const distanceX = Math.abs(dx);

    if (!nearest || distanceX < nearest.distanceX) {
      nearest = { player, dx, distanceX };
    }
  }

  return nearest;
};

export class AISystem {
  update(_deltaSeconds, context = {}) {
    const enemies = asArray(context.enemies);
    const players = asArray(context.players).filter(isActiveEntity);
    const eventBus = context.eventBus;
    const nowMs = resolveNowMs(context.nowMs);

    for (const enemy of enemies) {
      if (!isActiveEntity(enemy)) {
        continue;
      }

      const nearest = findNearestActivePlayerOnX(enemy, players);
      const targetPlayer = nearest?.player ?? null;

      let moveIntent = 0;
      if (nearest && enemy.type !== ENEMY_TYPES.SNIPER) {
        if (nearest.dx > EPSILON) {
          moveIntent = 1;
        } else if (nearest.dx < -EPSILON) {
          moveIntent = -1;
        }
      }

      enemy.moveIntent = moveIntent;
      emitEvent(eventBus, 'enemy_move_intent', {
        enemy,
        moveIntent,
        target: targetPlayer,
      });

      if (!nearest) {
        continue;
      }

      if (
        typeof enemy.canShoot !== 'function' ||
        typeof enemy.markShot !== 'function' ||
        !enemy.canShoot(nowMs)
      ) {
        continue;
      }

      if (nearest.distanceX > resolveShootRangeX(enemy)) {
        continue;
      }

      enemy.markShot(nowMs);
      emitEvent(eventBus, 'enemy_shoot', { enemy });
    }
  }
}
