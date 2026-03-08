import {
  GRAVITY,
  PLAYER_ACCELERATION,
  PLAYER_FRICTION,
  PLAYER_JUMP_SPEED,
  PLAYER_MAX_SPEED,
} from '../config/constants.js';
import { Physics } from '../core/Physics.js';
import { clamp } from '../utils/math.js';
import { asArray, toNumber } from './systemUtils.js';

const clampIntent = (value) => clamp(toNumber(value, 0), -1, 1);
const getCurrentTimeMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

export class PhysicsSystem {
  constructor(options = {}) {
    this.gravity = toNumber(options.gravity, GRAVITY);
    this.playerAcceleration = toNumber(options.playerAcceleration, PLAYER_ACCELERATION);
    this.playerFriction = toNumber(options.playerFriction, PLAYER_FRICTION);
    this.playerJumpSpeed = toNumber(options.playerJumpSpeed, PLAYER_JUMP_SPEED);
    this.playerMaxSpeed = toNumber(options.playerMaxSpeed, PLAYER_MAX_SPEED);
  }

  update(deltaSeconds, context = {}) {
    const dt = toNumber(deltaSeconds, 0);
    if (dt <= 0) {
      return;
    }

    const nowMs = toNumber(context.nowMs, getCurrentTimeMs());
    const players = asArray(context.players);
    const enemies = asArray(context.enemies);

    void context.platforms;
    void context.bullets;

    for (const player of players) {
      if (!player || player.active === false) {
        continue;
      }

      const moveIntent = clampIntent(player.moveIntent);
      if (Math.abs(moveIntent) > 0) {
        const acceleratedVx = toNumber(player.vx, 0) + moveIntent * this.playerAcceleration * dt;
        player.vx = clamp(acceleratedVx, -this.playerMaxSpeed, this.playerMaxSpeed);
      } else {
        player.vx = Physics.applyFriction(toNumber(player.vx, 0), this.playerFriction, dt);
      }
      player.moveIntent = 0;

      if (player.onGround) {
        player.jumpBoostConsumed = false;
      }

      if (player.jumpRequested) {
        if (player.onGround) {
          player.vy = -this.playerJumpSpeed;
          player.onGround = false;
          player.lastGroundJumpAtMs = nowMs;
          player.jumpBoostConsumed = false;
        } else {
          const jumpBoostWindowMs = Math.max(0, toNumber(player.jumpBoostWindowMs, 0));
          const jumpBoostSpeed = Math.max(this.playerJumpSpeed, toNumber(player.jumpBoostSpeed, this.playerJumpSpeed));
          const lastGroundJumpAtMs = toNumber(player.lastGroundJumpAtMs, Number.NEGATIVE_INFINITY);
          const withinBoostWindow = nowMs - lastGroundJumpAtMs <= jumpBoostWindowMs;

          if (!player.jumpBoostConsumed && withinBoostWindow) {
            player.vy = Math.min(toNumber(player.vy, 0), -jumpBoostSpeed);
            player.jumpBoostConsumed = true;
          }
        }
      }
      player.jumpRequested = false;

      if (!player.onGround) {
        player.vy = Physics.applyGravity(toNumber(player.vy, 0), this.gravity, dt);
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

      enemy.vy = Physics.applyGravity(toNumber(enemy.vy, 0), this.gravity, dt);
      enemy.x = Physics.integrate(toNumber(enemy.x, 0), toNumber(enemy.vx, 0), dt);
      enemy.y = Physics.integrate(toNumber(enemy.y, 0), toNumber(enemy.vy, 0), dt);
    }
  }
}
