import { Entity } from './Entity.js';

const DEFAULT_COLOR = '#ffd54a';
const DEFAULT_LIFETIME_MS = 1000;

export class Bullet extends Entity {
  constructor({ width = 6, height = 6 } = {}) {
    super({ width, height, active: false });

    this.speed = 0;
    this.directionX = 1;
    this.directionY = 0;
    this.damage = 0;
    this.owner = null;
    this.previousX = 0;
    this.previousY = 0;
    this.dodgeCounted = false;
    this.lifetimeMs = DEFAULT_LIFETIME_MS;
    this.ageMs = 0;
    this.color = DEFAULT_COLOR;
  }

  fire({
    x = this.x,
    y = this.y,
    directionX = 1,
    directionY = 0,
    speed = 0,
    damage = 0,
    owner = null,
    lifetimeMs = DEFAULT_LIFETIME_MS,
    color = DEFAULT_COLOR,
    shape = "rect",
  } = {}) {
    const normalizedX = Number(directionX);
    const normalizedY = Number(directionY);

    let dx = Number.isFinite(normalizedX) ? normalizedX : 0;
    let dy = Number.isFinite(normalizedY) ? normalizedY : 0;

    const length = Math.hypot(dx, dy);
    if (length <= Number.EPSILON) {
      dx = 1;
      dy = 0;
    } else {
      dx /= length;
      dy /= length;
    }

    this.x = Number.isFinite(Number(x)) ? Number(x) : 0;
    this.y = Number.isFinite(Number(y)) ? Number(y) : 0;
    this.previousX = this.x;
    this.previousY = this.y;
    this.directionX = dx;
    this.directionY = dy;

    const numericSpeed = Number(speed);
    this.speed = Number.isFinite(numericSpeed) ? Math.max(0, numericSpeed) : 0;

    const numericDamage = Number(damage);
    this.damage = Number.isFinite(numericDamage) ? numericDamage : 0;

    this.owner = owner ?? null;

    const numericLifetimeMs = Number(lifetimeMs);
    this.lifetimeMs = Number.isFinite(numericLifetimeMs) && numericLifetimeMs > 0
      ? numericLifetimeMs
      : DEFAULT_LIFETIME_MS;

    this.ageMs = 0;
    this.dodgeCounted = false;
    this.color = typeof color === 'string' && color.length > 0 ? color : DEFAULT_COLOR;
    this.shape = shape === "circle" ? "circle" : "rect";

    this.setVelocity(this.directionX * this.speed, this.directionY * this.speed);
    this.active = true;
  }

  update(deltaSeconds, _context) {
    if (!this.active) {
      return;
    }

    const numericDeltaSeconds = Number(deltaSeconds);
    const dt = Number.isFinite(numericDeltaSeconds) && numericDeltaSeconds > 0 ? numericDeltaSeconds : 0;

    this.previousX = this.x;
    this.previousY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.ageMs += dt * 1000;
    if (this.ageMs >= this.lifetimeMs) {
      this.deactivate();
      this.vx = 0;
      this.vy = 0;
    }
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.directionX = 1;
    this.directionY = 0;
    this.damage = 0;
    this.owner = null;
    this.previousX = 0;
    this.previousY = 0;
    this.dodgeCounted = false;
    this.lifetimeMs = DEFAULT_LIFETIME_MS;
    this.ageMs = 0;
    this.color = DEFAULT_COLOR;
    this.shape = "rect";
    this.deactivate();
  }

  render(ctx, camera) {
    if (!this.active || !ctx) {
      return;
    }

    const projected = this.projectToScreen(camera);
    if (!projected) {
      return;
    }
    const renderX = projected.x;
    const renderY = projected.y;

    ctx.fillStyle = this.color;
    if (this.shape === "circle" && typeof ctx.beginPath === "function" && typeof ctx.arc === "function") {
      const radius = Math.max(1, Math.min(this.width, this.height) / 2);
      const centerX = renderX + this.width / 2;
      const centerY = renderY + this.height / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.fillRect(renderX, renderY, this.width, this.height);
  }
}
