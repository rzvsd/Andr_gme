import { Player } from "../entities/Player.js";
import { Enemy, ENEMY_TYPES } from "../entities/Enemy.js";
import { Bullet } from "../entities/Bullet.js";
import { Platform } from "../entities/Platform.js";
import { AISystem } from "../systems/AISystem.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { SpawnSystem } from "../systems/SpawnSystem.js";
import { ScoreSystem } from "../systems/ScoreSystem.js";
import { Background } from "../rendering/Background.js";
import { ParticleEmitter } from "../rendering/ParticleEmitter.js";
import { SpriteSheet } from "../rendering/SpriteSheet.js";
import { Animator } from "../rendering/Animator.js";
import { ObjectPool } from "../utils/pool.js";
import { CAMERA_LERP, PLAYER_BULLET_DAMAGE } from "../config/constants.js";
import { HUD } from "../ui/HUD.js";
import { Button } from "../ui/Button.js";
import { Joystick } from "../ui/Joystick.js";

const WORLD_MIN_WIDTH = 1600;
const WORLD_MULT = 3;
const GROUND_H = 56;
const PLAYER_BULLET_SPEED = 760;
const ENEMY_BULLET_SPEED = 430;
const BULLET_LIFE_MS = 2200;
const OFFSCREEN = 120;
const HUD_RIGHT_INSET = 84;
const PLAYER_VISUAL_SCALE = 1.75;
const ENEMY_VISUAL_SCALE = 1.7;
const ENEMY_SPRITE_FRAME_BY_TYPE = Object.freeze({
  [ENEMY_TYPES.GRUNT]: 0,
  [ENEMY_TYPES.SNIPER]: 1,
  [ENEMY_TYPES.RUSHER]: 2,
  [ENEMY_TYPES.TANK]: 3,
  [ENEMY_TYPES.BOSS]: 3,
});
const ENEMY_OUTLINE_COLOR_BY_TYPE = Object.freeze({
  [ENEMY_TYPES.GRUNT]: "#ef476f",
  [ENEMY_TYPES.SNIPER]: "#ff7f50",
  [ENEMY_TYPES.RUSHER]: "#f2c14e",
  [ENEMY_TYPES.TANK]: "#e63946",
  [ENEMY_TYPES.BOSS]: "#e63946",
});
const isDev = () => Boolean(import.meta?.env?.DEV);
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const emit = (bus, name, payload) => bus?.emit?.(name, payload);
const center = (e) => ({ x: e.x + e.width * 0.5, y: e.y + e.height * 0.5 });

export class GameScene {
  constructor() {
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.platforms = [];
    this.worldWidth = WORLD_MIN_WIDTH;
    this.groundY = 0;
    this.spawnPoints = [];
    this.assetsReady = false;
    this.assetsError = null;
    this.assetsErrorLogged = false;
    this.fallbackMode = false;
    this.preloadPromise = null;
    this.enemyPool = new ObjectPool(() => new Enemy(), (e) => e?.configure?.("GRUNT", { x: -9999, y: -9999 }));
    this.playerBulletPool = new ObjectPool(() => new Bullet(), (b) => b?.reset?.());
    this.enemyBulletPool = new ObjectPool(() => new Bullet(), (b) => b?.reset?.());
    this.enemyPool.preallocate(40);
    this.playerBulletPool.preallocate(80);
    this.enemyBulletPool.preallocate(80);
    this.aiSystem = new AISystem();
    this.physicsSystem = new PhysicsSystem();
    this.collisionSystem = new CollisionSystem();
    this.spawnSystem = new SpawnSystem({ enemyPool: this.enemyPool });
    this.systemPipeline = [this.aiSystem, this.physicsSystem, this.collisionSystem, this.spawnSystem];
    this.systemContext = {
      players: [],
      enemies: this.enemies,
      bullets: this.bullets,
      platforms: this.platforms,
      eventBus: null,
      nowMs: 0,
      enemyPool: this.enemyPool,
      spawnPoints: this.spawnPoints,
      autoStart: false,
    };
    this.scoreSystem = null;
    this.hudState = {};
    this.hud = new HUD({ style: { rightInset: HUD_RIGHT_INSET } });
    this.joystick = new Joystick();
    this.jumpButton = new Button({ label: "JMP" });
    this.shootButton = new Button({ label: "SHT" });
    this.pauseButton = new Button({ label: "II" });
    this.pointerOwners = new Map();
    this.pauseRequested = false;
    this.jumpQueued = false;
    this.shootQueued = false;
    this.shootHeld = false;
    this.jumpWasHeld = false;
    this.eventOff = [];
    this.keyBound = false;
    this.onKeyDown = (e) => {
      if (e.code === "Escape" || e.code === "KeyP") this.pauseRequested = true;
    };
    this.background = null;
    this.particles = new ParticleEmitter(220);
    this.playerSheet = null;
    this.enemySheet = null;
    this.bulletSheet = null;
    this.runStartedAtMs = 0;
    this.elapsedMs = 0;
    this.playerAnimator = new Animator({ idle: { frames: [0], fps: 4, loop: true }, run: { frames: [1], fps: 8, loop: true }, jump: { frames: [2], fps: 8, loop: true }, fall: { frames: [3], fps: 8, loop: true } }, "idle");
  }

  onEnter(game, transition = {}) {
    const payload = transition?.payload ?? transition ?? {};
    if (!this.preloadPromise) this.preloadPromise = this.preloadAssets();
    if (!this.player || payload.restart === true) this.resetRun(game);
    this.layout(game.viewWidth, game.viewHeight);
    game.input?.setTouchControlsEnabled?.(false);
    if (!this.keyBound) { window.addEventListener("keydown", this.onKeyDown); this.keyBound = true; }
    this.bindEvents(game.eventBus);
    game.camera.follow(this.player, CAMERA_LERP);
  }

  onExit(game) {
    this.unbindEvents();
    game?.input?.setTouchControlsEnabled?.(true);
    if (this.keyBound) { window.removeEventListener("keydown", this.onKeyDown); this.keyBound = false; }
    this.pointerOwners.clear();
    this.joystick.reset(); this.jumpButton.reset(); this.shootButton.reset(); this.pauseButton.reset();
  }

  onResize(width, height) {
    this.layout(width, height);
    if (this.player) this.player.y = Math.min(this.player.y, this.groundY - this.player.height);
    if (this.player) {
      this.updateStaticLevelGeometry(height);
    }
  }

  async preloadAssets() {
    this.assetsReady = false;
    this.assetsError = null;
    this.assetsErrorLogged = false;

    this.playerSheet = new SpriteSheet("/sprites/player_sheet.svg", { frameWidth: 64, frameHeight: 64, columns: 4, rows: 1 });
    this.enemySheet = new SpriteSheet("/sprites/enemy_sheet.svg", { frameWidth: 64, frameHeight: 64, columns: 4, rows: 1 });
    this.bulletSheet = new SpriteSheet("/sprites/bullets.svg", { frameWidth: 24, frameHeight: 32, columns: 5, rows: 1 });

    try {
      const loaded = await Promise.all([
        this.playerSheet.load(),
        this.enemySheet.load(),
        this.bulletSheet.load(),
      ]);

      this.fallbackMode = !loaded.every(Boolean);
      if (this.fallbackMode && isDev()) {
        console.warn("[GameScene] Sprite preload incomplete. Falling back to shape rendering.");
      }
    } catch (error) {
      this.assetsError = error;
      this.fallbackMode = true;
      if (isDev()) {
        console.error("[GameScene] Sprite preload failed. Falling back to shape rendering.", error);
        this.assetsErrorLogged = true;
      }
    } finally {
      this.assetsReady = true;
    }
  }

  resetRun(game) {
    this.worldWidth = Math.max(WORLD_MIN_WIDTH, (game.viewWidth || 1) * WORLD_MULT);
    this.groundY = (game.viewHeight || 1) - GROUND_H;
    this.releaseRunObjects();
    this.player = new Player({ x: 220, y: this.groundY - 40, width: 28, height: 40 }); this.player.isPlayer = true;
    this.updateStaticLevelGeometry(game.viewHeight || 1, false);
    this.enemies = []; this.bullets = []; this.playerBullets = []; this.enemyBullets = [];
    this.background = new Background(this.buildBackgroundLayers(game.viewHeight || 1), "#9ab0d4");
    this.spawnSystem = new SpawnSystem({ enemyPool: this.enemyPool });
    this.systemPipeline = [this.aiSystem, this.physicsSystem, this.collisionSystem, this.spawnSystem];
    this.scoreSystem?.dispose?.();
    this.scoreSystem = new ScoreSystem(game.eventBus);
    this.systemContext.players = this.player ? [this.player] : [];
    this.systemContext.enemies = this.enemies;
    this.systemContext.bullets = this.bullets;
    this.systemContext.platforms = this.platforms;
    this.systemContext.spawnPoints = this.spawnPoints;
    this.systemContext.enemyPool = this.enemyPool;
    this.runStartedAtMs = nowMs();
    this.elapsedMs = 0;
    this.pauseRequested = false;
  }

  releaseRunObjects() {
    const released = new Set();
    const releaseEntity = (entity, pool) => {
      if (!entity || released.has(entity)) return;
      if (typeof entity.deactivate === "function") entity.deactivate();
      pool?.release?.(entity);
      released.add(entity);
    };

    for (const enemy of this.enemies) releaseEntity(enemy, this.enemyPool);
    for (const bullet of this.playerBullets) releaseEntity(bullet, this.playerBulletPool);
    for (const bullet of this.enemyBullets) releaseEntity(bullet, this.enemyBulletPool);
    for (const bullet of this.bullets) {
      if (released.has(bullet)) continue;
      const pool = typeof bullet?.owner === "string" && bullet.owner.toLowerCase() === "player"
        ? this.playerBulletPool
        : this.enemyBulletPool;
      releaseEntity(bullet, pool);
    }
  }

  bindEvents(eventBus) {
    this.unbindEvents();
    this.eventOff.push(eventBus.on("enemy_shoot", ({ enemy }) => this.fireEnemyBullet(enemy, eventBus)));
    this.eventOff.push(eventBus.on("enemy_killed", ({ enemy }) => { const c = center(enemy); this.particles.burst(14, { x: c.x, y: c.y, life: 0.4, size: 2, color: "#fca5a5" }); }));
  }

  unbindEvents() { for (const off of this.eventOff) off?.(); this.eventOff = []; }

  getLevelPlatforms() {
    return [
      { x: 0, y: this.groundY, width: this.worldWidth, height: GROUND_H },
      { x: this.worldWidth * 0.28, y: this.groundY - 170, width: 280, height: 28 },
      { x: this.worldWidth * 0.62, y: this.groundY - 220, width: 300, height: 28 },
    ];
  }

  applyPlatformLayout(layout) {
    for (let i = 0; i < layout.length; i += 1) {
      const next = layout[i];
      let platform = this.platforms[i];
      if (!(platform instanceof Platform)) {
        platform = new Platform(next.x, next.y, next.width, next.height);
        this.platforms[i] = platform;
      } else {
        platform.x = next.x;
        platform.y = next.y;
        platform.width = next.width;
        platform.height = next.height;
        platform.active = true;
      }
    }
    this.platforms.length = layout.length;
  }

  updateStaticLevelGeometry(viewHeight, syncBackground = true) {
    this.applyPlatformLayout(this.getLevelPlatforms());
    this.spawnPoints = [
      { x: -40, y: this.groundY - 80 },
      { x: this.worldWidth * 0.35, y: this.groundY - 260 },
      { x: this.worldWidth + 40, y: this.groundY - 80 },
    ];

    if (syncBackground && this.background) {
      this.background.setLayers(this.buildBackgroundLayers(viewHeight));
    }
  }

  buildBackgroundLayers(viewHeight) {
    return [
      { imageSrc: "/sprites/background_layer_1.svg", y: 0, height: viewHeight, parallaxX: 0.2, parallaxY: 0 },
      { imageSrc: "/sprites/background_layer_2.svg", y: 40, height: viewHeight, parallaxX: 0.45, parallaxY: 0 },
    ];
  }

  layout(width, height) {
    const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1);
    this.worldWidth = Math.max(this.worldWidth, w * WORLD_MULT, WORLD_MIN_WIDTH); this.groundY = h - GROUND_H;
    const r = Math.max(46, Math.min(68, w * 0.075)), pad = 18, bs = Math.max(56, Math.min(74, w * 0.08));
    this.joystick.setCenter(pad + r, h - pad - r); this.joystick.setRadius(r, r * 0.46);
    this.jumpButton.setBounds(w - pad - bs * 2 - 12, h - pad - bs, bs, bs);
    this.shootButton.setBounds(w - pad - bs, h - pad - bs, bs, bs);
    this.pauseButton.setBounds(w - pad - 56, pad, 56, 42);
  }

  update(dt, game) {
    if (this.assetsError && isDev() && !this.assetsErrorLogged) {
      console.error("[GameScene] Continuing in fallback mode after asset preload error.", this.assetsError);
      this.assetsErrorLogged = true;
    }
    if (!this.assetsReady || !this.player) return;

    const frameNowMs = nowMs();
    if (this.runStartedAtMs > 0) {
      this.elapsedMs = Math.max(0, frameNowMs - this.runStartedAtMs);
    }

    if (this.pauseRequested) {
      this.pauseRequested = false;
      emit(game.eventBus, "ui_click", { source: "pause" });
      game.switchScene("pause", { resume: true });
      return;
    }

    const move = (game.input.isPressed("right") ? 1 : 0) - (game.input.isPressed("left") ? 1 : 0);
    const joyX = this.joystick.getValue().x;
    this.player.moveIntent = Math.abs(joyX) > 0.08 ? joyX : move;

    const jumpHeld = this.jumpButton.isPressed();
    if (jumpHeld && !this.jumpWasHeld) {
      this.jumpQueued = true;
    }
    this.jumpWasHeld = jumpHeld;

    if (game.input.consumePressed("jump") || this.jumpQueued) {
      this.player.jumpRequested = true;
      this.jumpQueued = false;
    }

    if (game.input.consumePressed("shoot")) {
      this.shootQueued = true;
    }
    this.shootHeld = game.input.isPressed("shoot") || this.shootButton.isPressed();
    this.firePlayerBullet(game);

    if (!this.spawnSystem.waveActive && this.enemies.length === 0) {
      this.spawnSystem.startWave(this.spawnSystem.currentWave + 1);
    }

    const context = this.buildSystemContext(game.eventBus, frameNowMs);
    for (const system of this.systemPipeline) {
      if (system && typeof system.update === "function") {
        system.update(dt, context);
      }
    }

    this.player.update(dt, context);
    this.playerAnimator.play(this.player.animationState || "idle");
    this.playerAnimator.update(dt);

    for (const enemy of this.enemies) {
      if (enemy?.active !== false) {
        enemy.update(dt, context);
      }
    }

    for (const bullet of this.bullets) {
      if (bullet?.active !== false) {
        bullet.update(dt, context);
      }
      if (
        bullet &&
        (bullet.x < -OFFSCREEN ||
          bullet.x > this.worldWidth + OFFSCREEN ||
          bullet.y < -OFFSCREEN * 2 ||
          bullet.y > this.groundY + OFFSCREEN * 2)
      ) {
        bullet.deactivate();
      }
    }

    this.recycleBullets();
    this.particles.update(dt);

    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x > this.worldWidth - this.player.width) {
      this.player.x = this.worldWidth - this.player.width;
    }

    if (this.player.y > this.groundY + 320 && this.player.active !== false) {
      const before = Number(this.player.health) || 0;
      const damage = this.player.maxHealth;
      this.player.takeDamage(damage);
      const after = Number(this.player.health) || 0;
      const isFatal = this.player.active === false || (before > 0 && after <= 0);
      emit(game.eventBus, "player_hit", { player: this.player, damage, source: "fall", isFatal, death: isFatal, dead: isFatal });
    }

    const hudState = this.buildHudState(frameNowMs);
    if (this.player.active === false) {
      const best = Math.max(Number(game.sceneData?.highScore || 0), hudState.score);
      game.sceneData = {
        ...game.sceneData,
        highScore: best,
        stats: { ...hudState, highScore: best },
      };
      game.switchScene("game_over", { stats: game.sceneData.stats });
      return;
    }

    this.hud.setState(hudState);
    game.camera.follow(this.player, CAMERA_LERP);
  }

  buildSystemContext(eventBus, currentNowMs) {
    const context = this.systemContext;
    context.players.length = 0;
    if (this.player) {
      context.players.push(this.player);
    }
    context.enemies = this.enemies;
    context.bullets = this.bullets;
    context.platforms = this.platforms;
    context.eventBus = eventBus;
    context.nowMs = currentNowMs;
    context.enemyPool = this.enemyPool;
    context.spawnPoints = this.spawnPoints;
    context.autoStart = false;
    return context;
  }

  buildHudState(currentNowMs = nowMs()) {
    const s = this.scoreSystem?.getState?.() || {};
    const currentWave = Math.max(0, Math.round(Number(this.spawnSystem?.currentWave ?? 0) || 0));
    const scoreWave = Math.max(0, Math.round(Number(s.wave) || 0));
    const wave = Math.max(currentWave, scoreWave);
    const elapsedMs = this.runStartedAtMs > 0
      ? Math.max(0, currentNowMs - this.runStartedAtMs)
      : Math.max(0, this.elapsedMs);
    const timeSeconds = Math.floor(elapsedMs / 1000);
    const state = this.hudState;
    state.score = Number(s.score) || 0;
    state.kills = Number(s.kills) || 0;
    state.dodges = Number(s.dodges) || 0;
    state.deaths = Number(s.deaths) || 0;
    state.hits = Number(s.hits) || 0;
    state.wave = wave;
    state.currentWave = currentWave;
    state.timeSeconds = timeSeconds;
    state.health = this.player?.health || 0;
    state.maxHealth = this.player?.maxHealth || 1;
    state.fallbackMode = this.fallbackMode;
    return state;
  }

  firePlayerBullet(game) {
    const wants = this.shootQueued || this.shootHeld; if (!wants || this.player.active === false) return;
    const t = nowMs(); if (!this.player.canShoot(t)) return;
    const b = this.playerBulletPool.acquire(), c = center(this.player);
    b.fire({ x: c.x, y: c.y - 4, directionX: this.player.facing >= 0 ? 1 : -1, directionY: 0, speed: PLAYER_BULLET_SPEED, damage: PLAYER_BULLET_DAMAGE, owner: "player", lifetimeMs: BULLET_LIFE_MS, color: "#3b82f6" });
    this.player.markShot(t); this.playerBullets.push(b); this.bullets.push(b); this.shootQueued = false; emit(game.eventBus, "bullet_fired", { owner: "player", bullet: b });
  }

  fireEnemyBullet(enemy, bus) {
    if (!enemy || enemy.active === false || !this.player || this.player.active === false) return;
    const b = this.enemyBulletPool.acquire(), from = center(enemy), to = center(this.player), dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    b.fire({ x: from.x, y: from.y, directionX: dx / len, directionY: dy / len, speed: ENEMY_BULLET_SPEED, damage: Math.max(4, Number(enemy.damage) || 8), owner: enemy, lifetimeMs: BULLET_LIFE_MS, color: "#ef4444" });
    this.enemyBullets.push(b); this.bullets.push(b); emit(bus, "bullet_fired", { owner: "enemy", bullet: b });
  }

  recycleBullets() {
    const compactOwnedBullets = (list, pool) => {
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

    compactOwnedBullets(this.playerBullets, this.playerBulletPool);
    compactOwnedBullets(this.enemyBullets, this.enemyBulletPool);

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

  getEnemySpriteFrame(enemy) {
    return ENEMY_SPRITE_FRAME_BY_TYPE[enemy?.type] ?? 0;
  }

  getEnemyOutlineColor(enemy) {
    return ENEMY_OUTLINE_COLOR_BY_TYPE[enemy?.type] ?? "#ef476f";
  }

  renderActorSprite(ctx, camera, entity, spriteSheet, frameIndex, scale, outlineColor) {
    if (!entity || entity.active === false || !camera) return;
    const visualScale = Math.max(1, Number(scale) || 1);
    const drawWidth = entity.width * visualScale;
    const drawHeight = entity.height * visualScale;
    const drawX = entity.x - (drawWidth - entity.width) * 0.5;
    const drawY = entity.y - (drawHeight - entity.height);
    const projected = camera.worldToScreen(drawX, drawY);
    if (!Number.isFinite(projected?.x) || !Number.isFinite(projected?.y)) return;
    spriteSheet?.drawFrame(ctx, projected.x, projected.y, frameIndex, drawWidth, drawHeight);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = outlineColor;
    ctx.strokeRect(projected.x, projected.y, drawWidth, drawHeight);
    ctx.restore();
  }

  render(ctx, _alpha, game) {
    if (!this.assetsReady) { ctx.fillStyle = "#0b1020"; ctx.fillRect(0, 0, game.viewWidth, game.viewHeight); ctx.fillStyle = "#f8fafc"; ctx.font = "600 24px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Loading assets...", game.viewWidth * 0.5, game.viewHeight * 0.5); return; }
    this.background?.render(ctx, game.camera, game.viewWidth, game.viewHeight);
    for (const p of this.platforms) p?.render(ctx, game.camera);
    if (this.fallbackMode) {
      for (const e of this.enemies) if (e?.active !== false) e.render(ctx, game.camera);
      for (const b of this.bullets) if (b?.active !== false) b.render(ctx, game.camera);
      if (this.player?.active !== false) this.player.render(ctx, game.camera);
    } else {
      this.renderActorSprite(ctx, game.camera, this.player, this.playerSheet, this.playerAnimator.getCurrentFrame(), PLAYER_VISUAL_SCALE, "#4fc3f7");
      for (const e of this.enemies) if (e?.active !== false) this.renderActorSprite(ctx, game.camera, e, this.enemySheet, this.getEnemySpriteFrame(e), ENEMY_VISUAL_SCALE, this.getEnemyOutlineColor(e));
      for (const b of this.bullets) if (b?.active !== false) { const p = game.camera.worldToScreen(b.x, b.y); this.bulletSheet?.drawFrame(ctx, p.x, p.y, typeof b.owner === "string" ? 0 : 2, b.width, b.height); }
    }
    this.particles.render(ctx, game.camera);
    this.hud.render(ctx, this.hudState);
    this.joystick.render(ctx); this.jumpButton.render(ctx); this.shootButton.render(ctx); this.pauseButton.render(ctx);
  }

  handlePointerDown(pointer) {
    const id = pointer?.id ?? 0;
    if (this.pauseButton.handlePointerDown(pointer)) return this.pointerOwners.set(id, "pause"), true;
    if (this.jumpButton.handlePointerDown(pointer)) return this.pointerOwners.set(id, "jump"), true;
    if (this.shootButton.handlePointerDown(pointer)) return this.pointerOwners.set(id, "shoot"), true;
    if (this.joystick.handlePointerDown(pointer)) return this.pointerOwners.set(id, "joystick"), true;
    return false;
  }

  handlePointerMove(pointer) {
    const owner = this.pointerOwners.get(pointer?.id ?? 0);
    if (owner === "pause") return this.pauseButton.handlePointerMove(pointer);
    if (owner === "jump") return this.jumpButton.handlePointerMove(pointer);
    if (owner === "shoot") return this.shootButton.handlePointerMove(pointer);
    if (owner === "joystick") return this.joystick.handlePointerMove(pointer);
    return false;
  }

  handlePointerUp(pointer, game) {
    const id = pointer?.id ?? 0, owner = this.pointerOwners.get(id); this.pointerOwners.delete(id);
    if (owner === "pause") { const click = this.pauseButton.handlePointerUp(pointer); if (click) { this.pauseRequested = true; emit(game?.eventBus, "ui_click", { source: "pause" }); } return true; }
    if (owner === "jump") { const click = this.jumpButton.handlePointerUp(pointer); if (click) { this.jumpQueued = true; emit(game?.eventBus, "ui_click", { source: "jump" }); } return true; }
    if (owner === "shoot") { const click = this.shootButton.handlePointerUp(pointer); if (click) { this.shootQueued = true; emit(game?.eventBus, "ui_click", { source: "shoot" }); } return true; }
    if (owner === "joystick") return this.joystick.handlePointerUp(pointer);
    return false;
  }

  handlePointerCancel(pointer) {
    const id = pointer?.id ?? 0, owner = this.pointerOwners.get(id); this.pointerOwners.delete(id);
    if (owner === "pause") return this.pauseButton.handlePointerCancel(pointer);
    if (owner === "jump") return this.jumpButton.handlePointerCancel(pointer);
    if (owner === "shoot") return this.shootButton.handlePointerCancel(pointer);
    if (owner === "joystick") return this.joystick.handlePointerCancel(pointer);
    return false;
  }
}
