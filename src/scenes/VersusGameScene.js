import { Player } from "../entities/Player.js";
import { Bullet } from "../entities/Bullet.js";
import { Platform } from "../entities/Platform.js";
import { Camera } from "../core/Camera.js";
import { VersusInput } from "../core/VersusInput.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { VersusCollisionSystem } from "../systems/VersusCollisionSystem.js";
import { VersusRoundManager } from "./VersusRoundManager.js";
import { VersusHUD } from "../ui/VersusHUD.js";
import { MuteButton } from "../ui/MuteButton.js";
import { ObjectPool } from "../utils/pool.js";
import { clamp } from "../utils/math.js";
import {
  CAMERA_LERP,
  PLAYER_BULLET_DAMAGE,
  PLAYER_COLOR,
  PLAYER_FACING_MARKER_COLOR,
  PLAYER2_COLOR,
  PLAYER2_FACING_MARKER_COLOR,
} from "../config/constants.js";
import { loadSettings, saveSettings } from "../config/settings.js";

const WORLD_MIN_WIDTH = 2200;
const GROUND_STRIP_H = 22;
const PLATFORM_COLOR = "#245c13";
const BASE_STRIP_COLOR = "#b7aea2";
const SKY_COLOR = "#aab7cc";
const DIVIDER_COLOR = "rgba(153, 131, 188, 0.86)";
const BULLET_SPEED = 780;
const BULLET_LIFETIME_MS = 2500;
const BULLET_OFFSCREEN_MARGIN = 180;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 40;
const PLAYER_Y_OFFSET = 2;
const PLAYER_HEALTH = 100;
const SHOOT_COLOR_P1 = "#e33f3f";
const SHOOT_COLOR_P2 = "#3f53d7";

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const center = (entity) => ({
  x: entity.x + entity.width * 0.5,
  y: entity.y + entity.height * 0.5,
});

export class VersusGameScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.worldWidth = WORLD_MIN_WIDTH;
    this.platformY = 0;
    this.groundY = 0;

    this.players = [];
    this.p1 = null;
    this.p2 = null;
    this.spawnPoints = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

    this.platforms = [];
    this.bullets = [];
    this.p1Bullets = [];
    this.p2Bullets = [];

    this.p1BulletPool = new ObjectPool(() => new Bullet({ width: 16, height: 6 }), (b) => b?.reset?.());
    this.p2BulletPool = new ObjectPool(() => new Bullet({ width: 16, height: 6 }), (b) => b?.reset?.());
    this.p1BulletPool.preallocate(24);
    this.p2BulletPool.preallocate(24);

    this.p1Camera = new Camera(1, 1);
    this.p2Camera = new Camera(1, 1);
    this.versusInput = new VersusInput();
    this.physicsSystem = new PhysicsSystem();
    this.collisionSystem = new VersusCollisionSystem();
    this.roundManager = null;
    this.versusHUD = new VersusHUD();
    this.muteButton = new MuteButton();
    this.mutePointerId = null;
    this.settings = loadSettings();
    this.cachedNowMs = 0;
    this.keyBound = false;
    this.exitRequested = false;
    this.gameInputWasAttached = false;
    this.onKeyDown = (event) => {
      const code = event?.code;
      if (code === "Escape" || code === "KeyP" || code === "Backspace") {
        this.exitRequested = true;
        if (event?.cancelable) {
          event.preventDefault();
        }
      }
    };
  }

  onEnter(game, transition = {}) {
    void transition;
    this.width = Math.max(1, Number(game?.viewWidth) || 1);
    this.height = Math.max(1, Number(game?.viewHeight) || 1);
    this.settings = loadSettings();
    game?.audioManager?.setEnabled?.(this.settings.soundEnabled);
    game?.musicManager?.setEnabled?.(this.settings.musicEnabled);
    this.muteButton.setMuted(!(this.settings.soundEnabled || this.settings.musicEnabled));

    this.versusInput.attach();
    this.versusInput.reset();
    this.exitRequested = false;

    this.gameInputWasAttached = Boolean(game?.input?.attached);
    if (this.gameInputWasAttached) {
      game?.input?.detach?.();
    }
    game?.input?.setTouchControlsEnabled?.(false);
    if (!this.keyBound && typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKeyDown);
      this.keyBound = true;
    }

    this.layoutWorld(this.width, this.height);
    this.createOrResetPlayers();
    this.resetBullets();
    this.roundManager?.dispose?.();
    this.roundManager = new VersusRoundManager(game?.eventBus, { respawnDelayMs: 1500 });
    this.roundManager.reset();
    this.syncHudFromRoundManager();

    this.p1Camera.setViewport(this.width * 0.5, this.height);
    this.p2Camera.setViewport(this.width * 0.5, this.height);
    this.p1Camera.follow(this.p1, CAMERA_LERP);
    this.p2Camera.follow(this.p2, CAMERA_LERP);
    this.p1Camera.update();
    this.p2Camera.update();
    this.clampCamera(this.p1Camera);
    this.clampCamera(this.p2Camera);
  }

  onExit(game) {
    this.versusInput.detach();
    if (this.keyBound && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDown);
      this.keyBound = false;
    }
    this.exitRequested = false;
    if (this.gameInputWasAttached) {
      game?.input?.attach?.();
      this.gameInputWasAttached = false;
    }
    game?.input?.setTouchControlsEnabled?.(true);
    this.roundManager?.dispose?.();
    this.roundManager = null;
    this.mutePointerId = null;
    this.resetBullets();
  }

  onResize(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.layoutWorld(this.width, this.height);
    this.applySpawnIfOutOfBounds(this.p1, 0);
    this.applySpawnIfOutOfBounds(this.p2, 1);

    this.p1Camera.setViewport(this.width * 0.5, this.height);
    this.p2Camera.setViewport(this.width * 0.5, this.height);
  }

  layoutWorld(viewWidth, viewHeight) {
    this.worldWidth = Math.max(WORLD_MIN_WIDTH, Math.round(viewWidth * 2.3));
    this.groundY = Math.max(0, viewHeight - GROUND_STRIP_H);
    this.platformY = Math.max(80, Math.round(viewHeight * 0.84));

    const edgePad = Math.max(120, Math.round(viewWidth * 0.12));
    const platformWidth = Math.max(320, Math.round(viewWidth * 0.48));
    const leftX = edgePad;
    const rightX = Math.max(leftX + platformWidth + 260, this.worldWidth - edgePad - platformWidth);

    this.applyPlatformLayout([
      { x: leftX, y: this.platformY, width: platformWidth, height: 30, color: PLATFORM_COLOR },
      { x: rightX, y: this.platformY, width: platformWidth, height: 30, color: PLATFORM_COLOR },
      { x: 0, y: this.groundY, width: this.worldWidth, height: GROUND_STRIP_H, color: BASE_STRIP_COLOR },
    ]);

    this.spawnPoints[0] = {
      x: leftX + platformWidth * 0.74 - PLAYER_WIDTH * 0.5,
      y: this.platformY - PLAYER_HEIGHT - PLAYER_Y_OFFSET,
    };
    this.spawnPoints[1] = {
      x: rightX + platformWidth * 0.26 - PLAYER_WIDTH * 0.5,
      y: this.platformY - PLAYER_HEIGHT - PLAYER_Y_OFFSET,
    };
  }

  applyPlatformLayout(layout) {
    for (let i = 0; i < layout.length; i += 1) {
      const next = layout[i];
      let platform = this.platforms[i];
      if (!(platform instanceof Platform)) {
        platform = new Platform(next.x, next.y, next.width, next.height, next.color);
        this.platforms[i] = platform;
      } else {
        platform.x = next.x;
        platform.y = next.y;
        platform.width = next.width;
        platform.height = next.height;
        platform.color = next.color;
        platform.active = true;
      }
    }
    this.platforms.length = layout.length;
  }

  createOrResetPlayers() {
    if (!(this.p1 instanceof Player)) {
      this.p1 = new Player({
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        maxHealth: PLAYER_HEALTH,
        health: PLAYER_HEALTH,
        color: PLAYER_COLOR,
        markerColor: PLAYER_FACING_MARKER_COLOR,
      });
      this.p1.playerIndex = 0;
      this.p1.id = "p1";
    }

    if (!(this.p2 instanceof Player)) {
      this.p2 = new Player({
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        maxHealth: PLAYER_HEALTH,
        health: PLAYER_HEALTH,
        color: PLAYER2_COLOR,
        markerColor: PLAYER2_FACING_MARKER_COLOR,
      });
      this.p2.playerIndex = 1;
      this.p2.id = "p2";
    }

    this.players = [this.p1, this.p2];
    this.respawnPlayer(0);
    this.respawnPlayer(1);
    this.p1.facing = 1;
    this.p2.facing = -1;
  }

  applySpawnIfOutOfBounds(player, index) {
    if (!player) {
      return;
    }

    if (
      player.x < -BULLET_OFFSCREEN_MARGIN ||
      player.x > this.worldWidth + BULLET_OFFSCREEN_MARGIN ||
      player.y > this.height + 420 ||
      player.y < -420
    ) {
      this.respawnPlayer(index);
    }
  }

  respawnPlayer(index) {
    const player = this.players[index];
    const spawn = this.spawnPoints[index];
    if (!player || !spawn) {
      return;
    }

    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.active = true;
    player.health = player.maxHealth;
    player.onGround = false;
    player.moveIntent = 0;
    player.jumpRequested = false;
    player.lastShotAtMs = Number.NEGATIVE_INFINITY;
    player.facing = index === 0 ? 1 : -1;
  }

  resetBullets() {
    const released = new Set();
    const release = (bullet, pool) => {
      if (!bullet || released.has(bullet)) {
        return;
      }
      pool?.release?.(bullet);
      released.add(bullet);
    };

    for (const bullet of this.p1Bullets) {
      release(bullet, this.p1BulletPool);
    }
    for (const bullet of this.p2Bullets) {
      release(bullet, this.p2BulletPool);
    }
    for (const bullet of this.bullets) {
      if (released.has(bullet)) {
        continue;
      }
      const pool = bullet?.owner === this.p1 ? this.p1BulletPool : this.p2BulletPool;
      release(bullet, pool);
    }

    this.bullets.length = 0;
    this.p1Bullets.length = 0;
    this.p2Bullets.length = 0;
  }

  update(deltaSeconds, game) {
    if (this.exitRequested) {
      this.exitRequested = false;
      game?.eventBus?.emit?.("ui_click", { source: "versus_exit" });
      game?.switchScene?.("menu", { from: "versus" });
      return;
    }

    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    if (dt <= 0 || !this.p1 || !this.p2) {
      return;
    }

    this.cachedNowMs = nowMs();
    const p1Input = this.versusInput.getPlayerInput(0);
    const p2Input = this.versusInput.getPlayerInput(1);

    this.p1.applyInput(p1Input, dt);
    this.p2.applyInput(p2Input, dt);

    if (p1Input.consumePressed("shoot") || p1Input.isPressed("shoot")) {
      this.fireBullet(this.p1, 0, game?.eventBus);
    }
    if (p2Input.consumePressed("shoot") || p2Input.isPressed("shoot")) {
      this.fireBullet(this.p2, 1, game?.eventBus);
    }

    const physicsContext = {
      players: this.players,
      enemies: [],
      bullets: this.bullets,
      platforms: this.platforms,
    };
    this.physicsSystem.update(dt, physicsContext);

    this.collisionSystem.update(dt, {
      p1: this.p1,
      p2: this.p2,
      players: this.players,
      bullets: this.bullets,
      platforms: this.platforms,
      eventBus: game?.eventBus,
    });

    for (const player of this.players) {
      player.update(dt, physicsContext);
      player.x = clamp(player.x, 0, this.worldWidth - player.width);
    }

    for (const bullet of this.bullets) {
      if (bullet?.active !== false) {
        bullet.update(dt, physicsContext);
      }

      if (!bullet || bullet.active === false) {
        continue;
      }

      if (
        bullet.x < -BULLET_OFFSCREEN_MARGIN ||
        bullet.x > this.worldWidth + BULLET_OFFSCREEN_MARGIN ||
        bullet.y < -BULLET_OFFSCREEN_MARGIN ||
        bullet.y > this.height + BULLET_OFFSCREEN_MARGIN
      ) {
        bullet.deactivate();
      }
    }

    this.recycleBullets();

    const readyRespawns = this.roundManager?.update?.(dt) ?? [];
    for (const playerIndex of readyRespawns) {
      this.respawnPlayer(playerIndex);
    }

    this.syncHudFromRoundManager();
    this.updateCameras();
  }

  fireBullet(player, ownerIndex, eventBus) {
    if (!player || player.active === false) {
      return false;
    }

    const now = this.cachedNowMs || nowMs();
    if (!player.canShoot(now)) {
      return false;
    }

    const pool = ownerIndex === 0 ? this.p1BulletPool : this.p2BulletPool;
    const ownerList = ownerIndex === 0 ? this.p1Bullets : this.p2Bullets;
    const fallbackDirection = ownerIndex === 0 ? 1 : -1;
    const directionX = player.facing < 0 ? -1 : player.facing > 0 ? 1 : fallbackDirection;
    const bulletColor = ownerIndex === 0 ? SHOOT_COLOR_P1 : SHOOT_COLOR_P2;
    const from = center(player);
    const bullet = pool.acquire();

    bullet.fire({
      x: from.x + directionX * (player.width * 0.45),
      y: from.y - 3,
      directionX,
      directionY: 0,
      speed: BULLET_SPEED,
      damage: PLAYER_BULLET_DAMAGE,
      owner: player,
      lifetimeMs: BULLET_LIFETIME_MS,
      color: bulletColor,
      shape: "rect",
    });

    player.markShot(now);
    ownerList.push(bullet);
    this.bullets.push(bullet);
    eventBus?.emit?.("bullet_fired", { owner: ownerIndex, bullet });
    return true;
  }

  recycleBullets() {
    const compactOwned = (list, pool) => {
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < list.length; readIndex += 1) {
        const bullet = list[readIndex];
        if (bullet?.active !== false) {
          list[writeIndex] = bullet;
          writeIndex += 1;
          continue;
        }
        pool.release(bullet);
      }
      list.length = writeIndex;
    };

    compactOwned(this.p1Bullets, this.p1BulletPool);
    compactOwned(this.p2Bullets, this.p2BulletPool);

    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.bullets.length; readIndex += 1) {
      const bullet = this.bullets[readIndex];
      if (bullet?.active !== false) {
        this.bullets[writeIndex] = bullet;
        writeIndex += 1;
      }
    }
    this.bullets.length = writeIndex;
  }

  updateCameras() {
    this.p1Camera.follow(this.p1, CAMERA_LERP);
    this.p2Camera.follow(this.p2, CAMERA_LERP);
    this.p1Camera.update();
    this.p2Camera.update();
    this.clampCamera(this.p1Camera);
    this.clampCamera(this.p2Camera);
  }

  clampCamera(camera) {
    if (!camera) {
      return;
    }
    const maxX = Math.max(0, this.worldWidth - camera.viewportWidth);
    camera.x = clamp(camera.x, 0, maxX);
    camera.y = 0;
  }

  syncHudFromRoundManager() {
    const p1Stats = this.roundManager?.getStats?.(0) ?? { kills: 0, deaths: 0, dodges: 0 };
    const p2Stats = this.roundManager?.getStats?.(1) ?? { kills: 0, deaths: 0, dodges: 0 };

    this.versusHUD.setState(0, {
      bulletsDodged: p1Stats.dodges,
      deaths: p1Stats.deaths,
      kills: p1Stats.kills,
    });
    this.versusHUD.setState(1, {
      bulletsDodged: p2Stats.dodges,
      deaths: p2Stats.deaths,
      kills: p2Stats.kills,
    });
  }

  render(ctx, _alpha, game) {
    const fullWidth = Math.max(1, Number(game?.viewWidth) || this.width);
    const fullHeight = Math.max(1, Number(game?.viewHeight) || this.height);
    const halfWidth = fullWidth * 0.5;

    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, fullWidth, fullHeight);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, halfWidth, fullHeight);
    ctx.clip();
    this.renderWorld(ctx, this.p1Camera, halfWidth, fullHeight);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(halfWidth, 0, halfWidth, fullHeight);
    ctx.clip();
    ctx.translate(halfWidth, 0);
    this.renderWorld(ctx, this.p2Camera, halfWidth, fullHeight);
    ctx.restore();

    ctx.fillStyle = DIVIDER_COLOR;
    ctx.fillRect(halfWidth - 3, 0, 6, fullHeight);

    this.versusHUD.render(ctx, fullWidth, fullHeight);
    this.muteButton.render(ctx, fullWidth, fullHeight);
  }

  renderWorld(ctx, camera, viewportWidth, viewportHeight) {
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    for (const platform of this.platforms) {
      platform.render(ctx, camera);
    }

    for (const bullet of this.bullets) {
      if (bullet?.active !== false) {
        bullet.render(ctx, camera);
      }
    }

    if (this.p1?.active !== false) {
      this.p1.render(ctx, camera);
    }
    if (this.p2?.active !== false) {
      this.p2.render(ctx, camera);
    }
  }

  handlePointerDown(pointer) {
    const pointerId = pointer?.id ?? null;
    if (pointerId !== null && this.muteButton.contains(pointer, this.width, this.height)) {
      this.mutePointerId = pointerId;
      return true;
    }
    return this.versusInput.handlePointerDown(pointer, this.width);
  }

  handlePointerMove(pointer) {
    if (this.mutePointerId !== null && pointer?.id === this.mutePointerId) {
      return true;
    }
    return this.versusInput.handlePointerMove(pointer, this.width);
  }

  handlePointerUp(pointer, game) {
    if (this.mutePointerId !== null && pointer?.id === this.mutePointerId) {
      this.mutePointerId = null;
      if (!this.muteButton.handlePointerUp(pointer, this.width, this.height)) {
        return true;
      }
      const muted = this.muteButton.isMuted();
      const soundEnabled = !muted;
      const musicEnabled = !muted;
      this.settings = saveSettings({ soundEnabled, musicEnabled });
      game?.audioManager?.setEnabled?.(soundEnabled);
      game?.musicManager?.setEnabled?.(musicEnabled);
      game?.eventBus?.emit?.("ui_click", { source: "mute_toggle", muted });
      return true;
    }

    return this.versusInput.handlePointerUp(pointer);
  }

  handlePointerCancel(pointer) {
    if (this.mutePointerId !== null && pointer?.id === this.mutePointerId) {
      this.mutePointerId = null;
      return true;
    }
    return this.versusInput.handlePointerCancel(pointer);
  }
}
