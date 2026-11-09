import { describe, expect, it } from "vitest";
import { Player } from "../src/entities/Player.js";
import { PLAYER_HEALTH } from "../src/scenes/versus/versusConfig.js";
import { VersusPlayers } from "../src/scenes/versus/versusPlayers.js";
import { VersusProjectiles } from "../src/scenes/versus/versusProjectiles.js";
import {
  VERSUS_SHOTS_PER_CLIP,
  VERSUS_SHOT_REFILL_MS,
  createShotClip,
  hasShot,
  shiftShotClip,
  shotRefillProgress,
  spendShot,
} from "../src/scenes/versus/versusShots.js";

// Owner rule 2026-11-02: three shots, all back 3 s after the last shot, three hits kill.

function createScene() {
  const fired = [];
  const pool = { acquire: () => ({ fire(options) { fired.push(options); } }) };
  const scene = {
    fired,
    hitFlashTimers: [0, 0],
    spawnProtectionMs: [0, 0],
    cachedNowMs: 1000,
    bullets: [],
    p1Bullets: [],
    p2Bullets: [],
    p1BulletPool: pool,
    p2BulletPool: pool,
    playerAnimators: [],
    spawnPoints: [{ x: 100, y: 100 }, { x: 900, y: 100 }],
    assets: { getCharacterKeyForPlayer: () => "pudd" },
    matchModeKey: "human-vs-human",
  };
  scene.playersCtl = new VersusPlayers(scene);
  return scene;
}

function createFighter() {
  return new Player({ x: 100, y: 100, width: 28, height: 40, facing: 1, maxHealth: PLAYER_HEALTH });
}

describe("shot clip", () => {
  it("gives three shots, then refuses until 3 s after the last one", () => {
    const clip = createShotClip();
    expect(spendShot(clip, 0)).toBe(true);
    expect(spendShot(clip, 220)).toBe(true);
    expect(spendShot(clip, 440)).toBe(true);
    expect(spendShot(clip, 660)).toBe(false);
    expect(hasShot(clip, 440 + VERSUS_SHOT_REFILL_MS - 1)).toBe(false);
    expect(hasShot(clip, 440 + VERSUS_SHOT_REFILL_MS)).toBe(true);
    expect(clip.shotsLeft).toBe(VERSUS_SHOTS_PER_CLIP);
  });

  it("refills a partly used clip 3 s after the last shot", () => {
    const clip = createShotClip();
    spendShot(clip, 0);
    expect(clip.shotsLeft).toBe(2);
    expect(hasShot(clip, VERSUS_SHOT_REFILL_MS)).toBe(true);
    expect(clip.shotsLeft).toBe(3);
  });

  it("does not delay the refill when an empty fighter keeps trying", () => {
    const clip = createShotClip();
    spendShot(clip, 0);
    spendShot(clip, 220);
    spendShot(clip, 440);
    expect(spendShot(clip, 1500)).toBe(false);
    expect(spendShot(clip, 3000)).toBe(false);
    expect(spendShot(clip, 3440)).toBe(true);
  });

  it("reports refill progress for the HUD", () => {
    const clip = createShotClip();
    expect(shotRefillProgress(clip, 0)).toBe(1);
    spendShot(clip, 0);
    expect(shotRefillProgress(clip, VERSUS_SHOT_REFILL_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it("does not refill while the match is paused", () => {
    const fighter = { shotClip: createShotClip() };
    spendShot(fighter.shotClip, 0);
    spendShot(fighter.shotClip, 220);
    spendShot(fighter.shotClip, 440);
    shiftShotClip(fighter, 10000); // paused for 10 s right after the burst
    expect(hasShot(fighter.shotClip, 10000)).toBe(false);
    expect(hasShot(fighter.shotClip, 10440 + VERSUS_SHOT_REFILL_MS)).toBe(true);
  });
});

describe("shooting in a match", () => {
  it("a fighter holding fire for 10 s shoots in bursts of three and is visible under half the time", () => {
    const scene = createScene();
    const projectiles = new VersusProjectiles(scene);
    const fighter = createFighter();
    const shotTimes = [];
    let visibleFrames = 0;
    const frames = 600;
    for (let frame = 0; frame < frames; frame += 1) {
      scene.cachedNowMs = 1000 + (frame * 1000) / 60;
      if (projectiles.fireBullet(fighter, 0, null)) {
        shotTimes.push(scene.cachedNowMs);
      }
      if (scene.playersCtl.getRevealAlpha(0) > 0) {
        visibleFrames += 1;
      }
      scene.playersCtl.updateHitFlashTimers(1 / 60);
    }

    expect(shotTimes).toHaveLength(9);
    for (let index = 3; index < shotTimes.length; index += 1) {
      expect(shotTimes[index] - shotTimes[index - 3]).toBeGreaterThan(VERSUS_SHOT_REFILL_MS);
    }
    expect(visibleFrames / frames).toBeLessThan(0.5);
  });

  it("three hits kill and two do not", () => {
    const scene = createScene();
    new VersusProjectiles(scene).fireBullet(createFighter(), 0, null);
    const damage = scene.fired[0].damage;
    const victim = createFighter();
    victim.takeDamage(damage);
    victim.takeDamage(damage);
    expect(victim.health).toBeGreaterThan(0);
    victim.takeDamage(damage);
    expect(victim.health).toBe(0);
  });

  it("a respawned fighter has all three shots again", () => {
    const scene = createScene();
    const projectiles = new VersusProjectiles(scene);
    const fighter = createFighter();
    scene.players = [fighter, createFighter()];
    for (let shot = 0; shot < 3; shot += 1) {
      scene.cachedNowMs = 1000 + shot * 300;
      expect(projectiles.fireBullet(fighter, 0, null)).toBe(true);
    }
    scene.cachedNowMs = 2000;
    expect(projectiles.fireBullet(fighter, 0, null)).toBe(false);

    scene.playersCtl.respawnPlayer(0);
    expect(projectiles.fireBullet(fighter, 0, null)).toBe(true);
  });
});
