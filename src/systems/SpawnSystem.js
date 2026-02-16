import { Enemy, ENEMY_TYPES } from '../entities/Enemy.js';
import { emitEvent } from './systemUtils.js';

const DEFAULT_SPAWN_POINTS = Object.freeze([
  { x: -64, y: 0 },
  { x: 140, y: -32 },
  { x: 620, y: -32 },
  { x: 940, y: 0 },
]);

const VALID_ENEMY_TYPES = new Set(Object.values(ENEMY_TYPES));

const TYPE_DELAY_MULTIPLIER = Object.freeze({
  [ENEMY_TYPES.GRUNT]: 1.0,
  [ENEMY_TYPES.RUSHER]: 0.85,
  [ENEMY_TYPES.SNIPER]: 1.25,
  [ENEMY_TYPES.TANK]: 1.6,
  [ENEMY_TYPES.BOSS]: 2.25,
});

const toPositiveInteger = (value, fallback = 1) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return Math.floor(numericValue);
};

const toNonNegativeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, numericValue);
};

const resolveEnemyType = (value) => (
  VALID_ENEMY_TYPES.has(value) ? value : ENEMY_TYPES.GRUNT
);

const asSpawnArray = (value, fallback = []) => (
  Array.isArray(value) && value.length > 0 ? value : fallback
);

const resolveSpawnPosition = (spawnPoints, spawnIndex) => {
  const resolvedSpawnPoints = asSpawnArray(spawnPoints, DEFAULT_SPAWN_POINTS);
  const fallbackPoint = DEFAULT_SPAWN_POINTS[spawnIndex % DEFAULT_SPAWN_POINTS.length];
  const rawPoint = resolvedSpawnPoints[spawnIndex % resolvedSpawnPoints.length] ?? fallbackPoint;

  const maybeX = Array.isArray(rawPoint) ? Number(rawPoint[0]) : Number(rawPoint?.x);
  const maybeY = Array.isArray(rawPoint) ? Number(rawPoint[1]) : Number(rawPoint?.y);

  return {
    x: Number.isFinite(maybeX) ? maybeX : fallbackPoint.x,
    y: Number.isFinite(maybeY) ? maybeY : fallbackPoint.y,
  };
};

const countActiveEnemies = (enemies) => {
  if (!Array.isArray(enemies)) {
    return 0;
  }

  let count = 0;
  for (const enemy of enemies) {
    if (enemy && enemy.active !== false) {
      count += 1;
    }
  }

  return count;
};

const buildWaveDefinition = (waveNumber) => {
  const wave = toPositiveInteger(waveNumber, 1);
  const spawnIntervalMs = Math.max(260, 920 - wave * 45);
  const entries = [];

  const pushMany = (type, amount) => {
    const count = Math.max(0, Math.floor(amount));
    for (let index = 0; index < count; index += 1) {
      const delayMultiplier = TYPE_DELAY_MULTIPLIER[type] ?? 1;
      entries.push({
        type,
        delayMs: Math.max(140, Math.round(spawnIntervalMs * delayMultiplier)),
      });
    }
  };

  pushMany(ENEMY_TYPES.GRUNT, 3 + wave * 2);

  if (wave >= 2) {
    pushMany(ENEMY_TYPES.RUSHER, 1 + Math.floor(wave / 2));
  }

  if (wave >= 3) {
    pushMany(ENEMY_TYPES.SNIPER, 1 + Math.floor((wave - 1) / 2));
  }

  if (wave >= 4) {
    pushMany(ENEMY_TYPES.TANK, Math.floor((wave - 2) / 2));
  }

  if (wave % 5 === 0) {
    pushMany(ENEMY_TYPES.BOSS, 1);
  }

  return {
    wave,
    spawnIntervalMs,
    entries,
  };
};

export class SpawnSystem {
  constructor(options = {}) {
    this.currentWave = 0;
    this.waveActive = false;
    this.pendingSpawns = [];
    this.spawnTimerMs = 0;
    this.spawnedThisWave = 0;

    this._waveSpawnIntervalMs = 750;
    this._waveStartEventPending = false;
    this.enemyPool = options.enemyPool ?? null;
    this.enemyFactory = typeof options.enemyFactory === 'function' ? options.enemyFactory : null;
  }

  startWave(waveNumber = this.currentWave + 1) {
    const definition = buildWaveDefinition(waveNumber);

    this.currentWave = definition.wave;
    this.waveActive = true;
    this.pendingSpawns = definition.entries.slice();
    this.spawnTimerMs = 0;
    this.spawnedThisWave = 0;
    this._waveSpawnIntervalMs = definition.spawnIntervalMs;
    this._waveStartEventPending = true;

    return this.getWaveInfo();
  }

  getWaveInfo() {
    return {
      currentWave: this.currentWave,
      waveActive: this.waveActive,
      pendingSpawns: this.pendingSpawns.length,
      spawnTimerMs: this.spawnTimerMs,
      spawnedThisWave: this.spawnedThisWave,
    };
  }

  isWaveCleared(context = {}) {
    if (!this.waveActive) {
      return false;
    }

    const activeEnemies = countActiveEnemies(context.enemies);
    return this.pendingSpawns.length === 0 && activeEnemies === 0;
  }

  update(deltaSeconds, context = {}) {
    const eventBus = context?.eventBus;
    const autoStartRequested = context?.autoStart === true;
    const dtMs = toNonNegativeNumber(deltaSeconds, 0) * 1000;
    const enemyPool = context?.enemyPool ?? this.enemyPool;

    if (!this.waveActive && autoStartRequested) {
      this.startWave(this.currentWave + 1);
    }

    if (!this.waveActive) {
      return;
    }

    if (!Array.isArray(context.enemies)) {
      context.enemies = [];
    }
    this.#recycleInactiveEnemies(context.enemies, enemyPool);

    if (this._waveStartEventPending) {
      emitEvent(eventBus, 'wave_start', {
        wave: this.currentWave,
        totalEnemies: this.pendingSpawns.length,
      });
      this._waveStartEventPending = false;
    }

    this.spawnTimerMs -= dtMs;

    let loopGuard = 0;
    while (this.pendingSpawns.length > 0 && this.spawnTimerMs <= 0 && loopGuard < 200) {
      const spawnEntry = this.pendingSpawns.shift();
      const spawnType = resolveEnemyType(spawnEntry?.type ?? spawnEntry);
      const spawnPosition = resolveSpawnPosition(context.spawnPoints, this.spawnedThisWave);
      const enemy = this.#acquireEnemy(spawnType, spawnPosition, enemyPool);

      context.enemies.push(enemy);
      this.spawnedThisWave += 1;

      emitEvent(eventBus, 'enemy_spawned', {
        wave: this.currentWave,
        enemy,
        type: spawnType,
        x: spawnPosition.x,
        y: spawnPosition.y,
      });

      const spawnDelayMs = toNonNegativeNumber(
        spawnEntry?.delayMs,
        this._waveSpawnIntervalMs
      );
      this.spawnTimerMs += Math.max(80, spawnDelayMs);
      loopGuard += 1;
    }

    if (this.isWaveCleared(context)) {
      this.waveActive = false;
      this.spawnTimerMs = 0;

      emitEvent(eventBus, 'wave_cleared', {
        wave: this.currentWave,
        spawned: this.spawnedThisWave,
      });
    }
  }

  #acquireEnemy(spawnType, spawnPosition, enemyPool) {
    let enemy = null;

    if (enemyPool && typeof enemyPool.acquire === 'function') {
      enemy = enemyPool.acquire();
    }

    if (!enemy && this.enemyFactory) {
      enemy = this.enemyFactory(spawnType, spawnPosition);
    }

    if (!enemy) {
      enemy = new Enemy(spawnType, spawnPosition);
    } else if (typeof enemy.configure === 'function') {
      enemy.configure(spawnType, spawnPosition);
    }

    return enemy;
  }

  #recycleInactiveEnemies(enemies, enemyPool) {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < enemies.length; readIndex += 1) {
      const enemy = enemies[readIndex];
      if (enemy && enemy.active !== false) {
        enemies[writeIndex] = enemy;
        writeIndex += 1;
        continue;
      }

      if (enemyPool && typeof enemyPool.release === 'function' && enemy) {
        enemyPool.release(enemy);
      }
    }

    enemies.length = writeIndex;
  }
}
