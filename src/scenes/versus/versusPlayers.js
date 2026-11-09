import { Player } from "../../entities/Player.js";
import { isVersusBotMatchMode } from "../../config/versusMatchMode.js";
import {
  PLAYER_COLOR,
  PLAYER_FACING_MARKER_COLOR,
  PLAYER2_COLOR,
  PLAYER2_FACING_MARKER_COLOR,
} from "../../config/constants.js";
import { clamp } from "../../utils/math.js";
import {
  BULLET_OFFSCREEN_MARGIN,
  PLAYER_HEIGHT,
  PLAYER_HEALTH,
  PLAYER_WIDTH,
  REVEAL_FADE_SECONDS,
  REVEAL_ON_HIT_SECONDS,
  VERSUS_JUMP_BOOST_SPEED,
  VERSUS_JUMP_BOOST_WINDOW_MS,
  VERSUS_SPAWN_PROTECTION_MS,
  isDev,
} from "./versusConfig.js";
import { resetShotClip } from "./versusShots.js";

export class VersusPlayers {
  constructor(scene) {
    this.s = scene;
    // Dark arena: seconds each fighter stays visible. 0 = hidden.
    this.revealTimers = [0, 0];
    this.lastHitFlash = [0, 0];
  }

  revealPlayer(index, seconds) {
    if (index !== 0 && index !== 1) {
      return;
    }
    this.revealTimers[index] = Math.max(this.revealTimers[index], Math.max(0, Number(seconds) || 0));
  }

  getRevealAlpha(index) {
    const remaining = Number(this.revealTimers[index]) || 0;
    if (remaining <= 0) {
      return 0;
    }
    return clamp(remaining / REVEAL_FADE_SECONDS, 0, 1);
  }

  resolvePlayerIndex(player, fallbackIndex = -1) {
    if (player === this.s.p1 || fallbackIndex === 0) {
      return 0;
    }
    if (player === this.s.p2 || fallbackIndex === 1) {
      return 1;
    }
    return -1;
  }

  createOrResetPlayers() {
    if (!(this.s.p1 instanceof Player)) {
      this.s.p1 = new Player({
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        maxHealth: PLAYER_HEALTH,
        health: PLAYER_HEALTH,
        color: PLAYER_COLOR,
        markerColor: PLAYER_FACING_MARKER_COLOR,
      });
      this.s.p1.playerIndex = 0;
      this.s.p1.id = "p1";
    }
    this.s.p1.characterKey = this.s.assets.getCharacterKeyForPlayer(0);

    if (!(this.s.p2 instanceof Player)) {
      this.s.p2 = new Player({
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        maxHealth: PLAYER_HEALTH,
        health: PLAYER_HEALTH,
        color: PLAYER2_COLOR,
        markerColor: PLAYER2_FACING_MARKER_COLOR,
      });
      this.s.p2.playerIndex = 1;
      this.s.p2.id = "p2";
    }
    this.s.p2.characterKey = this.s.assets.getCharacterKeyForPlayer(1);

    this.s.players = [this.s.p1, this.s.p2];
    this.respawnPlayer(0);
    this.respawnPlayer(1);
  }

  respawnPlayer(index) {
    const player = this.s.players[index];
    const spawn = this.s.spawnPoints[index];
    if (!player || !spawn) {
      return;
    }

    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.active = true;
    player.health = player.maxHealth;
    player.onGround = true;
    player.moveIntent = 0;
    player.jumpRequested = false;
    player.dropRequested = false;
    player.dropThroughPlatform = null;
    player.lastShotAtMs = Number.NEGATIVE_INFINITY;
    resetShotClip(player);
    player.lastGroundJumpAtMs = Number.NEGATIVE_INFINITY;
    player.jumpBoostWindowMs = VERSUS_JUMP_BOOST_WINDOW_MS;
    player.jumpBoostSpeed = VERSUS_JUMP_BOOST_SPEED;
    player.jumpBoostConsumed = false;
    player.facing = index === 0 ? 1 : -1;
    player.characterKey = this.s.assets.getCharacterKeyForPlayer(index);
    player.supportingPlatform = null;
    player.supportingPlatformId = null;
    player.supportingPlatformName = null;
    player.supportingPlatformCategory = 0;
    this.s.hitFlashTimers[index] = 0;
    this.revealTimers[index] = 0;
    this.lastHitFlash[index] = 0;
    // M3: brief spawn protection so fixed spawns can't be spawn-killed by in-flight bullets.
    this.s.spawnProtectionMs[index] = VERSUS_SPAWN_PROTECTION_MS;
    player.invulnerable = true;
    this.s.playerAnimators[index]?.play("idle", { reset: true });
    if (index === 1 && isVersusBotMatchMode(this.s.matchModeKey)) {
      this.s.botController.reset();
    }
  }

  applySpawnIfOutOfBounds(player, index) {
    if (!player) {
      return;
    }

    if (
      player.x < -BULLET_OFFSCREEN_MARGIN ||
      player.x > this.s.worldWidth + BULLET_OFFSCREEN_MARGIN ||
      player.y > this.s.deathY + 120 ||
      player.y < -180
    ) {
      this.respawnPlayer(index);
    }
  }

  updateHitFlashTimers(dt) {
    for (let index = 0; index < this.s.hitFlashTimers.length; index += 1) {
      // A hit flash timer only ever grows when the match registers a new hit.
      if (this.s.hitFlashTimers[index] > this.lastHitFlash[index]) {
        this.revealPlayer(index, REVEAL_ON_HIT_SECONDS);
      }
      this.s.hitFlashTimers[index] = Math.max(0, this.s.hitFlashTimers[index] - dt);
      this.lastHitFlash[index] = this.s.hitFlashTimers[index];
      this.revealTimers[index] = Math.max(0, this.revealTimers[index] - dt);
    }
  }

  updateSpawnProtection(dt) {
    const dtMs = Math.max(0, Number(dt) || 0) * 1000;
    if (dtMs <= 0) {
      return;
    }
    for (let index = 0; index < this.s.players.length; index += 1) {
      const remaining = Math.max(0, Number(this.s.spawnProtectionMs[index]) || 0);
      if (remaining > 0) {
        const next = Math.max(0, remaining - dtMs);
        this.s.spawnProtectionMs[index] = next;
        const player = this.s.players[index];
        if (player && next <= 0) {
          player.invulnerable = false;
        }
        continue;
      }
      // M6 watchdog: protection expired but flag stuck — force-clear so nobody goes unkillable.
      const player = this.s.players[index];
      if (player && player.invulnerable === true && player.active !== false) {
        player.invulnerable = false;
        if (isDev() && !this.s.invulnWatchdogFired) {
          this.s.invulnWatchdogFired = true;
          console.warn(`[VersusGameScene] invulnerable watchdog cleared stuck flag on P${index + 1}`);
        }
      }
    }
  }

  stepAnimations(dt, physicsContext) {
    for (let index = 0; index < this.s.players.length; index += 1) {
      const player = this.s.players[index];
      player.update(dt, physicsContext);
      player.x = clamp(player.x, 0, this.s.worldWidth - player.width);
      this.s.playerAnimators[index]?.play(player.animationState || "idle");
      this.s.playerAnimators[index]?.update(dt);
    }
  }
}
