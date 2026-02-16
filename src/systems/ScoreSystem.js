export class ScoreSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this._unsubscribeFns = [];
    this._initialState = {
      score: 0,
      kills: 0,
      dodges: 0,
      wave: 0,
      deaths: 0,
      hits: 0
    };
    this.state = { ...this._initialState };

    if (!this.eventBus || typeof this.eventBus.on !== "function") {
      return;
    }

    this._unsubscribeFns.push(
      this.eventBus.on("enemy_killed", (payload) => {
        this.state.kills += 1;
        this.state.score += this._resolvePoints(100, payload);
      })
    );

    this._unsubscribeFns.push(
      this.eventBus.on("bullet_dodged", (payload) => {
        this.state.dodges += 1;
        this.state.score += this._resolvePoints(10, payload);
      })
    );

    this._unsubscribeFns.push(
      this.eventBus.on("wave_start", (payload) => {
        this.state.wave = this._resolveWave(payload, this.state.wave);
      })
    );

    this._unsubscribeFns.push(
      this.eventBus.on("wave_cleared", (payload) => {
        this.state.wave = this._resolveWave(payload, this.state.wave + 1);

        this.state.score += this._resolvePoints(500, payload);
      })
    );

    this._unsubscribeFns.push(
      this.eventBus.on("player_hit", (payload) => {
        this.state.hits += 1;
        this.state.deaths += this._resolveDeaths(payload);
      })
    );
  }

  _resolvePoints(defaultPoints, payload) {
    if (!payload || typeof payload !== "object") {
      return defaultPoints;
    }

    if (typeof payload.points === "number") {
      return payload.points;
    }

    if (typeof payload.extraPoints === "number") {
      return defaultPoints + payload.extraPoints;
    }

    return defaultPoints;
  }

  _resolveDeaths(payload) {
    if (!payload || typeof payload !== "object") {
      return 0;
    }

    if (typeof payload.deaths === "number") {
      return payload.deaths;
    }

    return payload.death === true || payload.isFatal === true || payload.dead === true ? 1 : 0;
  }

  _resolveWave(payload, fallback = 0) {
    if (!payload || typeof payload !== "object") {
      return Math.max(0, Math.round(fallback));
    }

    const candidates = [payload.wave, payload.currentWave, payload.waveNumber];
    for (const value of candidates) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
      }
    }

    return Math.max(0, Math.round(fallback));
  }

  getState() {
    return { ...this.state };
  }

  reset() {
    this.state = { ...this._initialState };
  }

  update(_deltaSeconds) {}

  dispose() {
    for (const unsubscribe of this._unsubscribeFns) {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    }

    this._unsubscribeFns = [];
  }
}
