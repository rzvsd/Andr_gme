import {
  GRAVITY,
  PLAYER_ACCELERATION,
  PLAYER_FRICTION,
  PLAYER_JUMP_SPEED,
  PLAYER_MAX_SPEED,
} from '../config/constants.js';
import { Physics } from '../core/Physics.js';

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clampIntent = (value) => Physics.clamp(toNumber(value, 0), -1, 1);

const asArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
};

export class PhysicsSystem {
  update(deltaSeconds, context = {}) {
    const dt = toNumber(deltaSeconds, 0);
    if (dt <= 0) {
      return;
    }

    const players = asArray(context.players);
    const enemies = asArray(context.enemies);

    // Platforms are resolved by collision systems; bullets own their own movement.
    void context.platforms;
    void context.bullets;

    for (const player of players) {
      if (!player || player.active === false) {
        continue;
      }

      const moveIntent = clampIntent(player.moveIntent);
      if (Math.abs(moveIntent) > 0) {
        const acceleratedVx = toNumber(player.vx, 0) + moveIntent * PLAYER_ACCELERATION * dt;
        player.vx = Physics.clamp(acceleratedVx, -PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);
      } else {
        player.vx = Physics.applyFriction(toNumber(player.vx, 0), PLAYER_FRICTION, dt);
      }
      player.moveIntent = 0;

      if (player.jumpRequested && player.onGround) {
        player.vy = -PLAYER_JUMP_SPEED;
        player.onGround = false;
      }
      player.jumpRequested = false;

      if (!player.onGround) {
        player.vy = Physics.applyGravity(toNumber(player.vy, 0), GRAVITY, dt);
      }

      player.x = Physics.integrate(toNumber(player.x, 0), toNumber(player.vx, 0), dt);
      player.y = Physics.integrate(toNumber(player.y, 0), toNumber(player.vy, 0), dt);
    }

    for (const enemy of enemies) {
      if (!enemy || enemy.active === false) {
        continue;
      }

      if (enemy.moveIntent !== undefined) {
        const moveIntent = clampIntent(enemy.moveIntent);
        const speed = Math.max(0, toNumber(enemy.speed, 0));
        enemy.vx = moveIntent * speed;
        enemy.moveIntent = 0;
      }

      enemy.vy = Physics.applyGravity(toNumber(enemy.vy, 0), GRAVITY, dt);
      enemy.x = Physics.integrate(toNumber(enemy.x, 0), toNumber(enemy.vx, 0), dt);
      enemy.y = Physics.integrate(toNumber(enemy.y, 0), toNumber(enemy.vy, 0), dt);
    }
  }
}
