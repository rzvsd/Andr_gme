import { Entity } from './Entity.js';
import { ENEMY_COLOR_BY_TYPE } from '../config/constants.js';

export const ENEMY_TYPES = Object.freeze({
  GRUNT: 'GRUNT',
  SNIPER: 'SNIPER',
  RUSHER: 'RUSHER',
  TANK: 'TANK',
  BOSS: 'BOSS',
});

const ENEMY_DEFAULTS = Object.freeze({
  [ENEMY_TYPES.GRUNT]: {
    hp: 40,
    speed: 120,
    damage: 8,
    fireCooldownMs: 900,
    color: ENEMY_COLOR_BY_TYPE.GRUNT,
    width: 24,
    height: 24,
  },
  [ENEMY_TYPES.SNIPER]: {
    hp: 30,
    speed: 80,
    damage: 14,
    fireCooldownMs: 1500,
    color: ENEMY_COLOR_BY_TYPE.SNIPER,
    width: 24,
    height: 24,
  },
  [ENEMY_TYPES.RUSHER]: {
    hp: 28,
    speed: 180,
    damage: 6,
    fireCooldownMs: 700,
    color: ENEMY_COLOR_BY_TYPE.RUSHER,
    width: 22,
    height: 22,
  },
  [ENEMY_TYPES.TANK]: {
    hp: 90,
    speed: 60,
    damage: 16,
    fireCooldownMs: 1400,
    color: ENEMY_COLOR_BY_TYPE.TANK,
    width: 30,
    height: 30,
  },
  [ENEMY_TYPES.BOSS]: {
    hp: 300,
    speed: 75,
    damage: 24,
    fireCooldownMs: 1000,
    color: ENEMY_COLOR_BY_TYPE.BOSS,
    width: 44,
    height: 44,
  },
});

const resolveTypeAndDefaults = (type) => {
  const resolvedType = Object.prototype.hasOwnProperty.call(ENEMY_DEFAULTS, type)
    ? type
    : ENEMY_TYPES.GRUNT;
  return {
    resolvedType,
    defaults: ENEMY_DEFAULTS[resolvedType],
  };
};

const resolvePosition = (position = {}) => {
  const numericX = Number(position?.x);
  const numericY = Number(position?.y);
  return {
    x: Number.isFinite(numericX) ? numericX : 0,
    y: Number.isFinite(numericY) ? numericY : 0,
  };
};

export class Enemy extends Entity {
  constructor(type = ENEMY_TYPES.GRUNT, position = {}) {
    const { defaults } = resolveTypeAndDefaults(type);
    const { x, y } = resolvePosition(position);

    super({
      x,
      y,
      width: defaults.width,
      height: defaults.height,
      vx: 0,
      vy: 0,
      active: false,
    });

    this.type = ENEMY_TYPES.GRUNT;
    this.maxHealth = 1;
    this.health = 1;
    this.speed = 0;
    this.damage = 0;
    this.fireCooldownMs = 1000;
    this.lastShotAtMs = -Infinity;
    this.state = 'idle';
    this.color = '#ffffff';
    this.moveIntent = 0;

    this.configure(type, position);
  }

  configure(type = this.type, position = {}) {
    const { resolvedType, defaults } = resolveTypeAndDefaults(type);
    const { x, y } = resolvePosition(position);

    this.type = resolvedType;
    this.maxHealth = defaults.hp;
    this.health = defaults.hp;
    this.speed = defaults.speed;
    this.damage = defaults.damage;
    this.fireCooldownMs = defaults.fireCooldownMs;
    this.lastShotAtMs = -Infinity;
    this.state = 'idle';
    this.color = defaults.color;
    this.width = defaults.width;
    this.height = defaults.height;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.moveIntent = 0;
    this.active = true;

    return this;
  }

  decideAction(_context) {
    return { moveX: 0 };
  }

  canShoot(nowMs) {
    const numericNowMs = Number(nowMs);
    if (!Number.isFinite(numericNowMs)) {
      return false;
    }

    return numericNowMs - this.lastShotAtMs >= this.fireCooldownMs;
  }

  markShot(nowMs) {
    const numericNowMs = Number(nowMs);
    if (!Number.isFinite(numericNowMs)) {
      return;
    }

    this.lastShotAtMs = numericNowMs;
  }

  takeDamage(amount) {
    if (!this.active) {
      return this.health;
    }

    const numericAmount = Number(amount);
    const damageAmount = Number.isFinite(numericAmount) ? Math.max(0, numericAmount) : 0;

    this.health = Math.max(0, this.health - damageAmount);
    if (this.health <= 0) {
      this.deactivate();
      this.state = 'dead';
      this.vx = 0;
      this.vy = 0;
    }

    return this.health;
  }

  update(deltaSeconds, _context) {
    if (!this.active) {
      return;
    }

    void deltaSeconds;

    if (Math.abs(this.vy) > Number.EPSILON) {
      this.state = this.vy < 0 ? 'jumping' : 'falling';
      return;
    }

    const movingHorizontally = Math.abs(this.vx) > Number.EPSILON;
    this.state = movingHorizontally ? 'moving' : 'idle';
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
    ctx.fillRect(renderX, renderY, this.width, this.height);

    const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    const clampedHealthRatio = Math.max(0, Math.min(1, healthRatio));
    const barHeight = 3;
    const barY = renderY - (barHeight + 2);

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(renderX, barY, this.width, barHeight);
    ctx.fillStyle = '#58d45d';
    ctx.fillRect(renderX, barY, this.width * clampedHealthRatio, barHeight);
  }
}
