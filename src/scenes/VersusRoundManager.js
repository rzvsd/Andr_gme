import {
  parseVersusPlayerIndex,
  resolveVersusPlayerIndexFromPayload,
  VERSUS_INVALID_PLAYER_INDEX,
  VERSUS_PLAYER_COUNT,
} from "../systems/versusPlayerIndex.js";
const DEFAULT_RESPAWN_DELAY_MS = 1500;

const createEmptyStats = () => ({
  kills: 0,
  deaths: 0,
  dodges: 0,
});

const toRespawnDelayMs = (value, fallback = DEFAULT_RESPAWN_DELAY_MS) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, numeric);
};

const isFatalHitPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return payload.isFatal === true || payload.death === true || payload.dead === true;
};

export class VersusRoundManager {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus ?? null;
    this.respawnDelayMs = toRespawnDelayMs(options?.respawnDelayMs, DEFAULT_RESPAWN_DELAY_MS);
    this._unsubscribeFns = [];
    this._stats = [createEmptyStats(), createEmptyStats()];
    this._respawnTimersMs = [null, null];

    this.#subscribe();
  }

  update(deltaSeconds) {
    const numericDeltaSeconds = Number(deltaSeconds);
    const dtMs = Number.isFinite(numericDeltaSeconds) && numericDeltaSeconds > 0
      ? numericDeltaSeconds * 1000
      : 0;

    const readyToRespawn = [];
    if (dtMs <= 0) {
      return readyToRespawn;
    }

    for (let playerIndex = 0; playerIndex < VERSUS_PLAYER_COUNT; playerIndex += 1) {
      const timerMs = this._respawnTimersMs[playerIndex];
      if (!Number.isFinite(timerMs)) {
        continue;
      }

      const remainingMs = timerMs - dtMs;
      if (remainingMs > 0) {
        this._respawnTimersMs[playerIndex] = remainingMs;
        continue;
      }

      this._respawnTimersMs[playerIndex] = null;
      readyToRespawn.push(playerIndex);
    }

    return readyToRespawn;
  }

  getStats(index) {
    const playerIndex = parseVersusPlayerIndex(index);
    if (playerIndex === VERSUS_INVALID_PLAYER_INDEX) {
      return createEmptyStats();
    }

    return { ...this._stats[playerIndex] };
  }

  reset() {
    this._stats[0] = createEmptyStats();
    this._stats[1] = createEmptyStats();
    this._respawnTimersMs[0] = null;
    this._respawnTimersMs[1] = null;
  }

  dispose() {
    for (const unsubscribe of this._unsubscribeFns) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }

    this._unsubscribeFns.length = 0;
    this._respawnTimersMs[0] = null;
    this._respawnTimersMs[1] = null;
  }

  #subscribe() {
    if (!this.eventBus || typeof this.eventBus.on !== 'function') {
      return;
    }

    this._unsubscribeFns.push(
      this.eventBus.on('versus:dodge', (payload) => {
        const dodgerIndex = resolveVersusPlayerIndexFromPayload(payload, [
          'dodgerIndex',
          'targetIndex',
          'playerIndex',
          'index',
          'dodger',
          'target',
          'player',
        ]);

        if (dodgerIndex === VERSUS_INVALID_PLAYER_INDEX) {
          return;
        }

        this._stats[dodgerIndex].dodges += 1;
      })
    );

    this._unsubscribeFns.push(
      this.eventBus.on('versus:kill', (payload) => {
        const killerIndex = resolveVersusPlayerIndexFromPayload(payload, [
          'killerIndex',
          'shooterIndex',
          'attackerIndex',
          'killer',
          'shooter',
          'attacker',
        ]);
        const victimIndex = resolveVersusPlayerIndexFromPayload(payload, [
          'victimIndex',
          'targetIndex',
          'deadIndex',
          'victim',
          'target',
          'player',
        ]);

        if (killerIndex !== VERSUS_INVALID_PLAYER_INDEX) {
          this._stats[killerIndex].kills += 1;
        }

        if (victimIndex !== VERSUS_INVALID_PLAYER_INDEX) {
          this._stats[victimIndex].deaths += 1;
          this.#scheduleRespawn(victimIndex);
        }
      })
    );

    this._unsubscribeFns.push(
      this.eventBus.on('versus:player_hit', (payload) => {
        if (!isFatalHitPayload(payload)) {
          return;
        }

        const targetIndex = resolveVersusPlayerIndexFromPayload(payload, [
          'targetIndex',
          'victimIndex',
          'playerIndex',
          'index',
          'target',
          'victim',
          'player',
        ]);

        if (targetIndex === VERSUS_INVALID_PLAYER_INDEX) {
          return;
        }

        this.#scheduleRespawn(targetIndex);
      })
    );
  }

  #scheduleRespawn(playerIndex) {
    if (playerIndex < 0 || playerIndex >= VERSUS_PLAYER_COUNT) {
      return;
    }

    if (Number.isFinite(this._respawnTimersMs[playerIndex])) {
      return;
    }

    this._respawnTimersMs[playerIndex] = this.respawnDelayMs;
  }
}
