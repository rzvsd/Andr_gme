import { describe, expect, it } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { ScoreSystem } from "../src/systems/ScoreSystem.js";
import { SpawnSystem } from "../src/systems/SpawnSystem.js";
import { ENEMY_TYPES } from "../src/entities/Enemy.js";

describe("ScoreSystem scoring boundaries", () => {
  it("scores kills, dodges, waves, and fatal hits", () => {
    const bus = new EventBus();
    const scores = new ScoreSystem(bus);

    bus.emit("wave_start", { wave: 3 });
    bus.emit("enemy_killed", {});
    bus.emit("bullet_dodged", {});
    bus.emit("wave_cleared", { wave: 3 });
    bus.emit("player_hit", { isFatal: true });

    const state = scores.getState();
    expect(state.wave).toBe(3);
    expect(state.kills).toBe(1);
    expect(state.dodges).toBe(1);
    expect(state.deaths).toBe(1);
    expect(state.score).toBe(100 + 10 + 500);
    scores.dispose();
  });

  it("ignores non-fatal hits for the death counter", () => {
    const bus = new EventBus();
    const scores = new ScoreSystem(bus);
    bus.emit("player_hit", { damage: 10 });
    expect(scores.getState().deaths).toBe(0);
    expect(scores.getState().hits).toBe(1);
    scores.dispose();
  });
});

describe("SpawnSystem wave boundaries", () => {
  it("scales wave 1 and wave 5 (boss) definitions", () => {
    const spawner = new SpawnSystem();
    const wave1 = spawner.startWave(1);
    expect(wave1.currentWave).toBe(1);
    expect(wave1.pendingSpawns).toBeGreaterThan(0);

    const wave5 = spawner.startWave(5);
    const types = spawner.pendingSpawns.map((entry) => entry.type);
    expect(types).toContain(ENEMY_TYPES.BOSS);
    expect(wave5.pendingSpawns).toBeGreaterThan(wave1.pendingSpawns);
  });

  it("reports a cleared wave only when nothing is pending or active", () => {
    const spawner = new SpawnSystem();
    spawner.startWave(1);
    expect(spawner.isWaveCleared({ enemies: [] })).toBe(false);
    spawner.pendingSpawns.length = 0;
    expect(spawner.isWaveCleared({ enemies: [] })).toBe(true);
    expect(spawner.isWaveCleared({ enemies: [{ active: true }] })).toBe(false);
  });
});
