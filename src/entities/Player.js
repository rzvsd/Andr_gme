import { Entity } from './Entity.js';
import { clamp } from '../utils/math.js';

const EPSILON = 0.0001;

const toNumberOr = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export class Player extends Entity {
  constructor({
    x = 0,
    y = 0,
    vx = 0,
    vy = 0,
    width = 28,
    height = 40,
    active = true,
    maxHealth = 100,
    health = maxHealth,
    onGround = false,
    facing = 1,
    animationState = 'idle',
    shootCooldownMs = 220,
    lastShotAtMs = Number.NEGATIVE_INFINITY,
  } = {}) {
    super({ x, y, vx, vy, width, height, active });

    this.maxHealth = Math.max(1, toNumberOr(maxHealth, 100));
    this.health = clamp(toNumberOr(health, this.maxHealth), 0, this.maxHealth);
    this.onGround = Boolean(onGround);
    this.facing = toNumberOr(facing, 1) < 0 ? -1 : 1;
    this.animationState = typeof animationState === 'string' ? animationState : 'idle';
    this.shootCooldownMs = Math.max(0, toNumberOr(shootCooldownMs, 220));
    this.lastShotAtMs = toNumberOr(lastShotAtMs, Number.NEGATIVE_INFINITY);
    this.moveIntent = 0;
    this.jumpRequested = false;
  }

  applyInput(input, _deltaSeconds) {
    const hasInput = input && typeof input === 'object';
    const isPressed = hasInput && typeof input.isPressed === 'function'
      ? input.isPressed.bind(input)
      : () => false;
    const consumePressed = hasInput && typeof input.consumePressed === 'function'
      ? input.consumePressed.bind(input)
      : () => false;

    const left = Boolean(isPressed('left'));
    const right = Boolean(isPressed('right'));
    const intent = (right ? 1 : 0) - (left ? 1 : 0);
    this.moveIntent = clamp(intent, -1, 1);

    if (this.moveIntent !== 0 && this.active) {
      this.facing = this.moveIntent < 0 ? -1 : 1;
    }

    this.jumpRequested = Boolean(consumePressed('jump')) || this.jumpRequested;
  }

  canShoot(nowMs = performance.now()) {
    const now = toNumberOr(nowMs, 0);
    return now - this.lastShotAtMs >= this.shootCooldownMs;
  }

  markShot(nowMs = performance.now()) {
    this.lastShotAtMs = toNumberOr(nowMs, 0);
  }

  takeDamage(amount) {
    const damage = Math.max(0, toNumberOr(amount, 0));
    if (damage <= 0 || this.health <= 0) {
      return this.health;
    }

    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      this.active = false;
    }

    return this.health;
  }

  heal(amount) {
    const healing = Math.max(0, toNumberOr(amount, 0));
    if (healing <= 0 || this.health >= this.maxHealth) {
      return this.health;
    }

    this.health = Math.min(this.maxHealth, this.health + healing);
    return this.health;
  }

  update(_deltaSeconds, _context) {
    if (!this.active) {
      return;
    }

    if (Math.abs(this.vy) > EPSILON) {
      this.onGround = false;
    }

    if (!this.onGround) {
      this.animationState = this.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(this.vx) > EPSILON) {
      this.animationState = 'run';
    } else {
      this.animationState = 'idle';
    }
  }

  render(ctx, camera) {
    if (!this.active || !ctx) {
      return;
    }

    let renderX = this.x;
    let renderY = this.y;

    if (camera && typeof camera.worldToScreen === 'function') {
      const screenPosition = camera.worldToScreen(this.x, this.y);
      renderX = toNumberOr(screenPosition?.x, NaN);
      renderY = toNumberOr(screenPosition?.y, NaN);
    } else if (camera) {
      renderX = this.x - toNumberOr(camera.x, 0);
      renderY = this.y - toNumberOr(camera.y, 0);
    }

    if (!Number.isFinite(renderX) || !Number.isFinite(renderY)) {
      return;
    }

    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(renderX, renderY, this.width, this.height);

    const markerWidth = Math.max(3, this.width * 0.28);
    const markerHeight = Math.max(2, this.height * 0.12);
    const markerX = this.facing >= 0 ? renderX + this.width - markerWidth : renderX;
    const markerY = renderY + (this.height - markerHeight) * 0.5;

    ctx.fillStyle = '#0c2b3a';
    ctx.fillRect(markerX, markerY, markerWidth, markerHeight);
  }
}
