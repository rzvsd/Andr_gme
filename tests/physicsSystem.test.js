import { describe, expect, it } from "vitest";
import { Player } from "../src/entities/Player.js";
import { PhysicsSystem } from "../src/systems/PhysicsSystem.js";

function createBoostedPlayer() {
  const player = new Player({ onGround: true });
  player.jumpBoostWindowMs = 220;
  player.jumpBoostSpeed = 720;
  player.jumpBoostConsumed = false;
  player.lastGroundJumpAtMs = Number.NEGATIVE_INFINITY;
  return player;
}

describe("PhysicsSystem jump boost", () => {
  it("applies a stronger second jump tap shortly after takeoff", () => {
    const player = createBoostedPlayer();
    const system = new PhysicsSystem({
      gravity: 0,
      playerJumpSpeed: 600,
    });

    player.jumpRequested = true;
    system.update(1 / 60, {
      players: [player],
      nowMs: 1000,
    });

    expect(player.vy).toBe(-600);
    expect(player.onGround).toBe(false);
    expect(player.jumpBoostConsumed).toBe(false);

    player.jumpRequested = true;
    player.vy = -240;
    system.update(1 / 60, {
      players: [player],
      nowMs: 1120,
    });

    expect(player.vy).toBe(-720);
    expect(player.jumpBoostConsumed).toBe(true);
  });

  it("allows only one boost and expires the window", () => {
    const player = createBoostedPlayer();
    const system = new PhysicsSystem({
      gravity: 0,
      playerJumpSpeed: 600,
    });

    player.jumpRequested = true;
    system.update(1 / 60, {
      players: [player],
      nowMs: 2000,
    });

    player.jumpRequested = true;
    player.vy = -160;
    system.update(1 / 60, {
      players: [player],
      nowMs: 2090,
    });

    expect(player.vy).toBe(-720);
    expect(player.jumpBoostConsumed).toBe(true);

    player.jumpRequested = true;
    player.vy = -150;
    system.update(1 / 60, {
      players: [player],
      nowMs: 2140,
    });
    expect(player.vy).toBe(-150);

    const latePlayer = createBoostedPlayer();
    latePlayer.jumpRequested = true;
    system.update(1 / 60, {
      players: [latePlayer],
      nowMs: 3000,
    });

    latePlayer.jumpRequested = true;
    latePlayer.vy = -120;
    system.update(1 / 60, {
      players: [latePlayer],
      nowMs: 3260,
    });

    expect(latePlayer.vy).toBe(-120);
    expect(latePlayer.jumpBoostConsumed).toBe(false);
  });
});
