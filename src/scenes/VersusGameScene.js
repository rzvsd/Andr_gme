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
import { Background } from "../rendering/Background.js";
import { SpriteSheet } from "../rendering/SpriteSheet.js";
import { Animator } from "../rendering/Animator.js";
import { ParticleEmitter } from "../rendering/ParticleEmitter.js";
import {
  PLAYER_BULLET_DAMAGE,
  PLAYER_COLOR,
  PLAYER_FACING_MARKER_COLOR,
  PLAYER2_COLOR,
  PLAYER2_FACING_MARKER_COLOR,
} from "../config/constants.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { getActorFruitTheme, getBulletFruitTheme } from "../theme/fruitCombatTheme.js";
import {
  buildPlayerCharacterSheetDataUrl,
  getPlayerCharacterByKey,
  loadSelectedPlayerCharacterKey,
  PLAYER_CHARACTER_FEET_RATIO,
  PLAYER_CHARACTER_FRAME_SIZE,
} from "../theme/playerRoster.js";
import {
  calculateVersusArenaLayout,
  getVersusArenaDiagnostics,
  VERSUS_PANEL_WORLD_HEIGHT,
  VERSUS_PANEL_WORLD_WIDTH,
} from "./versusArena.js";

const BULLET_SPEED = 760;
const BULLET_LIFETIME_MS = 1500;
const BULLET_OFFSCREEN_MARGIN = 90;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 40;
const PLAYER_HEALTH = 100;
const PLAYER_DRAW_SCALE = 2;
const PLAYER_DRAW_WIDTH = PLAYER_CHARACTER_FRAME_SIZE * PLAYER_DRAW_SCALE;
const PLAYER_DRAW_HEIGHT = PLAYER_CHARACTER_FRAME_SIZE * PLAYER_DRAW_SCALE;
const PLAYER_SHOOT_Y_OFFSET = 5;
const VERSUS_GRAVITY = 1850;
const VERSUS_JUMP_SPEED = 600;
const VERSUS_JUMP_BOOST_SPEED = 720;
const VERSUS_JUMP_BOOST_WINDOW_MS = 220;
const VERSUS_PLAYER_MAX_SPEED = 330;
const VERSUS_PLAYER_ACCELERATION = 2650;
const VERSUS_PLAYER_FRICTION = 2900;
const VERSUS_KILLS_TO_WIN = 5;
const VERSUS_RESPAWN_DELAY_MS = 1350;
const SKY_TOP = "#c8d3e6";
const SKY_BOTTOM = "#dbe6f5";
const HAZE_COLOR = "rgba(255, 255, 255, 0.18)";
const DECOR_STRIP_COLOR = "#c7bdb2";
const DECOR_STRIP_TOP = "#e7ded3";
const PLATFORM_FACE_COLOR = "#295f12";
const PLATFORM_TOP_COLOR = "#3f7f1a";
const PLATFORM_EDGE_COLOR = "rgba(15, 41, 6, 0.7)";
const DIVIDER_CORE = "rgba(150, 131, 191, 0.54)";
const DIVIDER_GLOW = "rgba(181, 156, 214, 0.30)";
const SCARF_SWAY_AMPLITUDE = 8;
const HIT_FLASH_DURATION = 0.14;

const TEAM_STYLES = [
  {
    bulletCore: "#d83f39",
    bulletGlow: "rgba(255, 112, 89, 0.78)",
    accent: "#dc8f4b",
    scarf: "#d96738",
    panelTint: "rgba(176, 159, 162, 0.88)",
    fallbackBody: "#687642",
  },
  {
    bulletCore: "#4257d7",
    bulletGlow: "rgba(133, 150, 255, 0.82)",
    accent: "#4a61db",
    scarf: "#2f44be",
    panelTint: "rgba(138, 142, 197, 0.88)",
    fallbackBody: "#6b7c41",
  },
];

const isDev = () => Boolean(import.meta?.env?.DEV);
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const center = (entity) => ({
  x: entity.x + entity.width * 0.5,
  y: entity.y + entity.height * 0.5,
});
const emit = (eventBus, eventName, payload) => {
  eventBus?.emit?.(eventName, payload);
};
const clampAlpha = (value) => clamp(Number(value) || 0, 0, 1);

function createPlayerAnimator() {
  return new Animator(
    {
      idle: { frames: [0], fps: 2, loop: true },
      run: { frames: [1, 0], fps: 7, loop: true },
      jump: { frames: [2], fps: 1, loop: true },
      fall: { frames: [3], fps: 1, loop: true },
    },
    "idle"
  );
}

function getWorldRect(fullWidth, fullHeight, worldWidth, worldHeight) {
  const scale = Math.min(
    fullWidth / Math.max(1, worldWidth),
    fullHeight / Math.max(1, worldHeight)
  );
  const drawWidth = worldWidth * scale;
  const drawHeight = worldHeight * scale;

  return {
    drawX: Math.round((fullWidth - drawWidth) * 0.5),
    drawY: Math.round((fullHeight - drawHeight) * 0.5),
    drawWidth,
    drawHeight,
    scale,
  };
}

export class VersusGameScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.worldWidth = VERSUS_PANEL_WORLD_WIDTH * 2;
    this.worldHeight = VERSUS_PANEL_WORLD_HEIGHT;
    this.platformY = 0;
    this.decorStripY = 0;
    this.decorStripHeight = 0;
    this.deathY = 0;
    this.layout = null;
    this.layoutDiagnostics = null;
    this.layoutWarningsLogged = false;

    this.players = [];
    this.p1 = null;
    this.p2 = null;
    this.spawnPoints = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.playerAnimators = [createPlayerAnimator(), createPlayerAnimator()];
    this.hitFlashTimers = [0, 0];

    this.platforms = [];
    this.bullets = [];
    this.p1Bullets = [];
    this.p2Bullets = [];

    this.p1BulletPool = new ObjectPool(() => new Bullet({ width: 22, height: 8 }), (b) => b?.reset?.());
    this.p2BulletPool = new ObjectPool(() => new Bullet({ width: 22, height: 8 }), (b) => b?.reset?.());
    this.p1BulletPool.preallocate(20);
    this.p2BulletPool.preallocate(20);

    this.p1Camera = new Camera(VERSUS_PANEL_WORLD_WIDTH, VERSUS_PANEL_WORLD_HEIGHT);
    this.p2Camera = new Camera(VERSUS_PANEL_WORLD_WIDTH, VERSUS_PANEL_WORLD_HEIGHT);
    this.worldCamera = new Camera(VERSUS_PANEL_WORLD_WIDTH * 2, VERSUS_PANEL_WORLD_HEIGHT);
    this.versusInput = new VersusInput();
    this.physicsSystem = new PhysicsSystem({
      gravity: VERSUS_GRAVITY,
      playerAcceleration: VERSUS_PLAYER_ACCELERATION,
      playerFriction: VERSUS_PLAYER_FRICTION,
      playerJumpSpeed: VERSUS_JUMP_SPEED,
      playerMaxSpeed: VERSUS_PLAYER_MAX_SPEED,
    });
    this.collisionSystem = new VersusCollisionSystem();
    this.roundManager = null;
    this.versusHUD = new VersusHUD();
    this.muteButton = new MuteButton();
    this.mutePointerId = null;
    this.settings = loadSettings();
    this.cachedNowMs = 0;
    this.keyBound = false;
    this.exitRequested = false;
    this.matchEnded = false;
    this.roundStartedAtMs = 0;
    this.killsToWin = VERSUS_KILLS_TO_WIN;
    this.gameInputWasAttached = false;
    this.eventOff = [];

    this.background = new Background([], SKY_BOTTOM);
    this.particles = new ParticleEmitter(140);
    this.playerSheet = null;
    this.playerSheetReady = false;
    this.playerSheetErrorLogged = false;
    this.preloadPromise = null;
    this.playerCharacterKey = loadSelectedPlayerCharacterKey();
    this.loadedPlayerCharacterKey = null;

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
    const payload = transition?.payload ?? transition ?? {};
    this.width = Math.max(1, Number(game?.viewWidth) || 1);
    this.height = Math.max(1, Number(game?.viewHeight) || 1);
    const nextCharacterKey = this.resolvePlayerCharacterKey(payload, game);
    const characterChanged =
      nextCharacterKey !== this.playerCharacterKey || nextCharacterKey !== this.loadedPlayerCharacterKey;
    this.playerCharacterKey = nextCharacterKey;
    game.sceneData = {
      ...game.sceneData,
      playerCharacterKey: nextCharacterKey,
    };
    this.settings = loadSettings();
    game?.audioManager?.setEnabled?.(this.settings.soundEnabled);
    game?.musicManager?.setEnabled?.(this.settings.musicEnabled);
    this.muteButton.setMuted(!(this.settings.soundEnabled || this.settings.musicEnabled));

    if (characterChanged) {
      this.preloadPromise = null;
      this.playerSheet = null;
      this.playerSheetReady = false;
      this.loadedPlayerCharacterKey = null;
    }
    if (!this.preloadPromise) {
      this.preloadPromise = this.preloadAssets();
    }

    this.versusInput.attach();
    this.versusInput.reset();
    this.exitRequested = false;
    this.matchEnded = false;
    this.roundStartedAtMs = nowMs();

    this.gameInputWasAttached = Boolean(game?.input?.attached);
    if (this.gameInputWasAttached) {
      game?.input?.detach?.();
    }
    game?.input?.setTouchControlsEnabled?.(false);
    if (!this.keyBound && typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKeyDown);
      this.keyBound = true;
    }

    this.layoutWorld();
    this.createOrResetPlayers();
    this.resetBullets();
    this.roundManager?.dispose?.();
    this.roundManager = new VersusRoundManager(game?.eventBus, {
      respawnDelayMs: VERSUS_RESPAWN_DELAY_MS,
    });
    this.roundManager.reset();
    this.syncHudFromRoundManager();
    this.bindEvents(game?.eventBus);
    this.updateCameras(true);
  }

  onExit(game) {
    this.versusInput.detach();
    this.unbindEvents();
    if (this.keyBound && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDown);
      this.keyBound = false;
    }
    this.exitRequested = false;
    this.matchEnded = false;
    this.roundStartedAtMs = 0;
    if (this.gameInputWasAttached) {
      game?.input?.attach?.();
      this.gameInputWasAttached = false;
    }
    game?.input?.setTouchControlsEnabled?.(true);
    this.roundManager?.dispose?.();
    this.roundManager = null;
    this.mutePointerId = null;
    this.particles.clear();
    this.resetBullets();
  }

  onResize(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.layoutWorld();
    this.applySpawnIfOutOfBounds(this.p1, 0);
    this.applySpawnIfOutOfBounds(this.p2, 1);
    this.updateCameras(true);
  }

  bindEvents(eventBus) {
    this.unbindEvents();
    if (!eventBus?.on) {
      return;
    }

    this.eventOff.push(
      eventBus.on("versus:player_hit", (payload) => {
        const targetIndex = this.resolvePlayerIndex(payload?.target ?? payload?.player ?? null, payload?.targetIndex);
        if (targetIndex >= 0) {
          this.hitFlashTimers[targetIndex] = HIT_FLASH_DURATION;
        }
        if (payload?.source !== "fall") {
          const target = payload?.target ?? payload?.player ?? null;
          const hitPoint = target ? center(target) : null;
          if (hitPoint) {
            const theme = getActorFruitTheme(target);
            this.spawnFruitBurst(hitPoint.x, hitPoint.y, payload?.isFatal ? 12 : 8, theme.juiceColors, {
              lifeMin: 0.16,
              lifeMax: 0.32,
              speedMin: 18,
              speedMax: payload?.isFatal ? 84 : 56,
              sizeMin: 1,
              sizeMax: 2.6,
            });
          }
        }
      })
    );
    this.eventOff.push(
      eventBus.on("versus:bullet_blocked", (payload) => {
        const bullet = payload?.bullet;
        if (!bullet) {
          return;
        }
        const hitPoint = center(bullet);
        const theme = getBulletFruitTheme(bullet);
        this.spawnFruitBurst(hitPoint.x, hitPoint.y, 5, theme.juiceColors, {
          lifeMin: 0.12,
          lifeMax: 0.22,
          speedMin: 12,
          speedMax: 42,
          sizeMin: 0.9,
          sizeMax: 2.1,
        });
      })
    );
  }

  unbindEvents() {
    for (const off of this.eventOff) {
      off?.();
    }
    this.eventOff.length = 0;
  }

  resolvePlayerIndex(player, fallbackIndex = -1) {
    if (player === this.p1 || fallbackIndex === 0) {
      return 0;
    }
    if (player === this.p2 || fallbackIndex === 1) {
      return 1;
    }
    return -1;
  }

  resolvePlayerCharacterKey(payload = {}, game) {
    const candidate = payload?.playerCharacterKey ?? game?.sceneData?.playerCharacterKey;
    return getPlayerCharacterByKey(typeof candidate === "string" ? candidate : loadSelectedPlayerCharacterKey()).key;
  }

  async preloadAssets() {
    this.loadedPlayerCharacterKey = this.playerCharacterKey;
    this.playerSheet = new SpriteSheet(buildPlayerCharacterSheetDataUrl(this.playerCharacterKey), {
      frameWidth: 64,
      frameHeight: 64,
      columns: 4,
      rows: 1,
      fallbackColor: "#6f8758",
    });

    try {
      this.playerSheetReady = await this.playerSheet.load();
    } catch (error) {
      this.playerSheetReady = false;
      if (isDev() && !this.playerSheetErrorLogged) {
        console.error("[VersusGameScene] player sprite preload failed; using procedural fighters.", error);
        this.playerSheetErrorLogged = true;
      }
    }

    return this.playerSheetReady;
  }

  layoutWorld() {
    this.layout = calculateVersusArenaLayout({
      playerWidth: PLAYER_WIDTH,
      playerHeight: PLAYER_HEIGHT,
    });
    this.worldWidth = this.layout.worldWidth;
    this.worldHeight = this.layout.worldHeight;
    this.platformY = this.layout.platformY;
    this.decorStripY = this.layout.decorStripY;
    this.decorStripHeight = this.layout.decorStripHeight;
    this.deathY = this.layout.deathY;

    this.applyPlatformLayout(
      this.layout.platforms.map((platform) => ({
        ...platform,
        color: PLATFORM_FACE_COLOR,
      }))
    );

    this.spawnPoints[0] = { ...this.layout.spawnPoints[0] };
    this.spawnPoints[1] = { ...this.layout.spawnPoints[1] };
    this.background.setLayers(this.buildBackgroundLayers());

    this.layoutDiagnostics = getVersusArenaDiagnostics(this.layout, {
      bulletSpeed: BULLET_SPEED,
      bulletLifetimeMs: BULLET_LIFETIME_MS,
      jumpSpeed: VERSUS_JUMP_SPEED,
      gravity: VERSUS_GRAVITY,
      playerWidth: PLAYER_WIDTH,
    });

    if (isDev() && this.layoutDiagnostics.issues.length > 0 && !this.layoutWarningsLogged) {
      console.warn("[VersusGameScene] arena diagnostics:", this.layoutDiagnostics.issues);
      this.layoutWarningsLogged = true;
    }

    this.p1Camera.setViewport(VERSUS_PANEL_WORLD_WIDTH, VERSUS_PANEL_WORLD_HEIGHT);
    this.p2Camera.setViewport(VERSUS_PANEL_WORLD_WIDTH, VERSUS_PANEL_WORLD_HEIGHT);
    this.worldCamera.setViewport(this.worldWidth, this.worldHeight);
    this.worldCamera.setPosition(0, 0);
  }

  buildBackgroundLayers() {
    return [
      {
        imageSrc: "/sprites/background_layer_1.svg",
        y: 0,
        height: this.worldHeight,
        parallaxX: 0.12,
        parallaxY: 0,
        opacity: 0.95,
      },
      {
        imageSrc: "/sprites/background_layer_2.svg",
        y: 32,
        height: this.worldHeight * 0.86,
        parallaxX: 0.24,
        parallaxY: 0,
        opacity: 0.78,
      },
    ];
  }

  applyPlatformLayout(layout) {
    for (let index = 0; index < layout.length; index += 1) {
      const next = layout[index];
      let platform = this.platforms[index];
      if (!(platform instanceof Platform)) {
        platform = new Platform(next.x, next.y, next.width, next.height, next.color, {
          id: next.id,
          name: next.name,
          collisionCategory: next.collisionCategory,
          playerCollisionOffsetY: next.playerCollisionOffsetY,
          playerCollisionHeight: next.playerCollisionHeight,
          isSolid: next.isSolid,
        });
        this.platforms[index] = platform;
      } else {
        platform.x = next.x;
        platform.y = next.y;
        platform.width = next.width;
        platform.height = next.height;
        platform.color = next.color;
        platform.id = next.id;
        platform.name = next.name;
        platform.collisionCategory = next.collisionCategory;
        platform.playerCollisionOffsetY = next.playerCollisionOffsetY;
        platform.playerCollisionHeight = next.playerCollisionHeight;
        platform.isSolid = next.isSolid !== false;
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
    this.p1.characterKey = this.playerCharacterKey;

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
    this.p2.characterKey = this.playerCharacterKey;

    this.players = [this.p1, this.p2];
    this.respawnPlayer(0);
    this.respawnPlayer(1);
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
    player.onGround = true;
    player.moveIntent = 0;
    player.jumpRequested = false;
    player.lastShotAtMs = Number.NEGATIVE_INFINITY;
    player.lastGroundJumpAtMs = Number.NEGATIVE_INFINITY;
    player.jumpBoostWindowMs = VERSUS_JUMP_BOOST_WINDOW_MS;
    player.jumpBoostSpeed = VERSUS_JUMP_BOOST_SPEED;
    player.jumpBoostConsumed = false;
    player.facing = index === 0 ? 1 : -1;
    player.characterKey = this.playerCharacterKey;
    player.supportingPlatform = null;
    player.supportingPlatformId = null;
    player.supportingPlatformName = null;
    player.supportingPlatformCategory = 0;
    this.hitFlashTimers[index] = 0;
    this.playerAnimators[index]?.play("idle", { reset: true });
  }

  applySpawnIfOutOfBounds(player, index) {
    if (!player) {
      return;
    }

    if (
      player.x < -BULLET_OFFSCREEN_MARGIN ||
      player.x > this.worldWidth + BULLET_OFFSCREEN_MARGIN ||
      player.y > this.deathY + 120 ||
      player.y < -180
    ) {
      this.respawnPlayer(index);
    }
  }

  update(deltaSeconds, game) {
    if (this.exitRequested) {
      this.exitRequested = false;
      emit(game?.eventBus, "ui_click", { source: "versus_exit" });
      game?.switchScene?.("menu", { from: "versus" });
      return;
    }

    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    if (dt <= 0 || !this.p1 || !this.p2 || this.matchEnded) {
      return;
    }

    this.cachedNowMs = nowMs();
    this.updateHitFlashTimers(dt);
    this.particles.update(dt);

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
      nowMs: this.cachedNowMs,
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

    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index];
      player.update(dt, physicsContext);
      player.x = clamp(player.x, 0, this.worldWidth - player.width);
      this.playerAnimators[index]?.play(player.animationState || "idle");
      this.playerAnimators[index]?.update(dt);
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
        bullet.y > this.deathY + BULLET_OFFSCREEN_MARGIN
      ) {
        bullet.deactivate();
      }
    }

    this.recycleBullets();
    this.applyFallDeaths(game?.eventBus);

    const terminalResult = this.getTerminalResult();
    if (terminalResult) {
      this.finishMatch(game, terminalResult);
      return;
    }

    const readyRespawns = this.roundManager?.update?.(dt) ?? [];
    for (const playerIndex of readyRespawns) {
      this.respawnPlayer(playerIndex);
    }

    this.syncHudFromRoundManager();
    this.updateCameras();
  }

  updateHitFlashTimers(dt) {
    for (let index = 0; index < this.hitFlashTimers.length; index += 1) {
      this.hitFlashTimers[index] = Math.max(0, this.hitFlashTimers[index] - dt);
    }
  }

  spawnFruitBurst(x, y, count, colors, options = {}) {
    const palette = Array.isArray(colors) && colors.length > 0 ? colors : ["#ffffff"];
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const lifeMin = Math.max(0.06, Number(options.lifeMin) || 0.12);
    const lifeMax = Math.max(lifeMin, Number(options.lifeMax) || lifeMin);
    const speedMin = Math.max(0, Number(options.speedMin) || 12);
    const speedMax = Math.max(speedMin, Number(options.speedMax) || speedMin);
    const sizeMin = Math.max(0.6, Number(options.sizeMin) || 1);
    const sizeMax = Math.max(sizeMin, Number(options.sizeMax) || sizeMin);

    for (let index = 0; index < total; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);
      this.particles.emit({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - speed * 0.15,
        life,
        size,
        color: palette[index % palette.length],
        shape: index % 3 === 0 ? "square" : "circle",
      });
    }
  }

  applyFallDeaths(eventBus) {
    for (let index = 0; index < this.players.length; index += 1) {
      const player = this.players[index];
      if (!player || player.active === false) {
        continue;
      }
      if (player.y <= this.deathY) {
        continue;
      }

      this.handleRingOut(index, eventBus);
    }
  }

  handleRingOut(playerIndex, eventBus) {
    const target = this.players[playerIndex];
    if (!target || target.active === false) {
      return false;
    }

    const killerIndex = playerIndex === 0 ? 1 : 0;
    const killer = this.players[killerIndex] ?? null;

    target.deactivate();
    target.vx = 0;
    target.vy = 0;
    target.onGround = false;
    this.hitFlashTimers[playerIndex] = HIT_FLASH_DURATION;

    emit(eventBus, "versus:player_hit", {
      target,
      targetIndex: playerIndex,
      shooter: killer,
      shooterIndex: killerIndex,
      damage: target.maxHealth,
      source: "fall",
      isFatal: true,
      death: true,
      dead: true,
    });

    emit(eventBus, "versus:kill", {
      killer,
      killerIndex,
      victim: target,
      victimIndex: playerIndex,
      source: "fall",
      damage: target.maxHealth,
    });

    return true;
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
    const fruitTheme = getActorFruitTheme(player);
    const from = center(player);
    const bullet = pool.acquire();

    bullet.fire({
      x: from.x + directionX * 16,
      y: from.y - PLAYER_SHOOT_Y_OFFSET,
      directionX,
      directionY: 0,
      speed: BULLET_SPEED,
      damage: PLAYER_BULLET_DAMAGE,
      owner: player,
      lifetimeMs: BULLET_LIFETIME_MS,
      color: fruitTheme.bulletCore,
      shape: "rect",
      characterKey: player.characterKey,
    });

    player.markShot(now);
    ownerList.push(bullet);
    this.bullets.push(bullet);
    emit(eventBus, "bullet_fired", { owner: ownerIndex, bullet });
    return true;
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

  updateCameras(force = false) {
    void force;
    this.worldCamera.setPosition(0, 0);
  }

  clampCamera(camera, playerIndex, force = false) {
    const range = this.layout?.cameraRanges?.[playerIndex];
    if (!camera || !range) {
      return;
    }

    if (force) {
      camera.setPosition(range.anchorX, 0);
      return;
    }

    camera.setPosition(clamp(camera.rawX ?? camera.x, range.minX, range.maxX), 0);
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

  getTerminalResult() {
    const p1Stats = this.roundManager?.getStats?.(0) ?? { kills: 0, deaths: 0, dodges: 0 };
    const p2Stats = this.roundManager?.getStats?.(1) ?? { kills: 0, deaths: 0, dodges: 0 };
    const p1Kills = Math.max(0, Math.round(Number(p1Stats.kills) || 0));
    const p2Kills = Math.max(0, Math.round(Number(p2Stats.kills) || 0));

    if (p1Kills < this.killsToWin && p2Kills < this.killsToWin) {
      return null;
    }

    const p1Deaths = Math.max(0, Math.round(Number(p1Stats.deaths) || 0));
    const p2Deaths = Math.max(0, Math.round(Number(p2Stats.deaths) || 0));
    const p1Dodges = Math.max(0, Math.round(Number(p1Stats.dodges) || 0));
    const p2Dodges = Math.max(0, Math.round(Number(p2Stats.dodges) || 0));

    let winnerIndex = 0;
    if (p1Kills !== p2Kills) {
      winnerIndex = p1Kills > p2Kills ? 0 : 1;
    } else if (p1Deaths !== p2Deaths) {
      winnerIndex = p1Deaths < p2Deaths ? 0 : 1;
    } else if (p1Dodges !== p2Dodges) {
      winnerIndex = p1Dodges > p2Dodges ? 0 : 1;
    }

    return {
      winnerIndex,
      loserIndex: winnerIndex === 0 ? 1 : 0,
      killsToWin: this.killsToWin,
      p1Kills,
      p2Kills,
      p1Deaths,
      p2Deaths,
      p1Dodges,
      p2Dodges,
    };
  }

  finishMatch(game, result) {
    if (this.matchEnded) {
      return;
    }
    this.matchEnded = true;

    const elapsedMs = this.roundStartedAtMs > 0 ? Math.max(0, nowMs() - this.roundStartedAtMs) : 0;
    const timeSeconds = Math.floor(elapsedMs / 1000);
    const winnerKills = result.winnerIndex === 0 ? result.p1Kills : result.p2Kills;
    const winnerDeaths = result.winnerIndex === 0 ? result.p1Deaths : result.p2Deaths;
    const winnerDodges = result.winnerIndex === 0 ? result.p1Dodges : result.p2Dodges;

    const stats = {
      mode: "versus",
      sourceScene: "versus",
      score: winnerKills,
      kills: winnerKills,
      deaths: winnerDeaths,
      dodges: winnerDodges,
      wave: result.killsToWin,
      highScore: 0,
      timeSeconds,
      winnerIndex: result.winnerIndex,
      loserIndex: result.loserIndex,
      killsToWin: result.killsToWin,
      p1Kills: result.p1Kills,
      p2Kills: result.p2Kills,
      p1Deaths: result.p1Deaths,
      p2Deaths: result.p2Deaths,
      p1Dodges: result.p1Dodges,
      p2Dodges: result.p2Dodges,
    };

    const versus = {
      winnerIndex: result.winnerIndex,
      loserIndex: result.loserIndex,
      killsToWin: result.killsToWin,
      p1Kills: result.p1Kills,
      p2Kills: result.p2Kills,
      p1Deaths: result.p1Deaths,
      p2Deaths: result.p2Deaths,
      p1Dodges: result.p1Dodges,
      p2Dodges: result.p2Dodges,
      timeSeconds,
    };

    game.sceneData = {
      ...game.sceneData,
      mode: "versus",
      sourceScene: "versus",
      stats,
      versusResult: versus,
    };

    game?.switchScene?.("game_over", {
      mode: "versus",
      sourceScene: "versus",
      stats,
      versus,
    });
  }

  render(ctx, _alpha, game) {
    const fullWidth = Math.max(1, Number(game?.viewWidth) || this.width);
    const fullHeight = Math.max(1, Number(game?.viewHeight) || this.height);
    const worldRect = getWorldRect(fullWidth, fullHeight, this.worldWidth, this.worldHeight);

    this.renderBackdrop(ctx, fullWidth, fullHeight);
    this.renderScaledBackdropWorld(ctx, worldRect);
    this.renderWorldScreen(ctx, worldRect);

    this.renderDivider(ctx, fullWidth, fullHeight);
    this.versusHUD.render(ctx, fullWidth, fullHeight);
    this.muteButton.render(ctx, fullWidth, fullHeight);
  }

  getDebugLines() {
    const worldRect = getWorldRect(this.width, this.height, this.worldWidth, this.worldHeight);
    const lines = [];
    if (this.p1) {
      lines.push(`P1 x=${this.p1.x.toFixed(2)} y=${this.p1.y.toFixed(2)}`);
      lines.push(`P1 frac x=${(this.p1.x % 1).toFixed(2)} y=${(this.p1.y % 1).toFixed(2)}`);
      const metrics = this.getPlayerDrawMetrics(this.p1, worldRect);
      lines.push(`P1 draw x=${metrics.screenX} y=${metrics.screenY} snapped=${Number.isInteger(metrics.screenX) && Number.isInteger(metrics.screenY)}`);
      lines.push(`P1 grounded=${Boolean(this.p1.onGround)} support=${this.p1.supportingPlatformName ?? "none"}`);
      if (this.p1.supportingPlatform) {
        const supportTop = Number(this.p1.supportingPlatform.y) + Number(this.p1.supportingPlatform.playerCollisionOffsetY || 0);
        const gap = supportTop - (this.p1.y + this.p1.height);
        lines.push(`P1 support gap=${gap.toFixed(2)} top=${supportTop.toFixed(2)}`);
      }
    }
    if (this.p2) {
      lines.push(`P2 x=${this.p2.x.toFixed(2)} y=${this.p2.y.toFixed(2)}`);
      lines.push(`P2 frac x=${(this.p2.x % 1).toFixed(2)} y=${(this.p2.y % 1).toFixed(2)}`);
      const metrics = this.getPlayerDrawMetrics(this.p2, worldRect);
      lines.push(`P2 draw x=${metrics.screenX} y=${metrics.screenY} snapped=${Number.isInteger(metrics.screenX) && Number.isInteger(metrics.screenY)}`);
      lines.push(`P2 grounded=${Boolean(this.p2.onGround)} support=${this.p2.supportingPlatformName ?? "none"}`);
      if (this.p2.supportingPlatform) {
        const supportTop = Number(this.p2.supportingPlatform.y) + Number(this.p2.supportingPlatform.playerCollisionOffsetY || 0);
        const gap = supportTop - (this.p2.y + this.p2.height);
        lines.push(`P2 support gap=${gap.toFixed(2)} top=${supportTop.toFixed(2)}`);
      }
    }
    lines.push(`WorldCam x=${Number(this.worldCamera.x).toFixed(2)} y=${Number(this.worldCamera.y).toFixed(2)}`);
    lines.push(`WorldCam raw x=${Number(this.worldCamera.rawX ?? this.worldCamera.x).toFixed(2)} y=${Number(this.worldCamera.rawY ?? this.worldCamera.y).toFixed(2)}`);
    return lines;
  }

  renderDebugOverlay(ctx, game) {
    const worldRect = getWorldRect(
      Math.max(1, Number(game?.viewWidth) || this.width),
      Math.max(1, Number(game?.viewHeight) || this.height),
      this.worldWidth,
      this.worldHeight
    );

    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);

    for (const platform of this.platforms) {
      if (!platform) {
        continue;
      }
      const bodyRect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
      const collisionBounds = platform.getPlayerCollisionBounds?.() ?? platform;
      const supportRect = this.projectWorldRectToScreen(
        worldRect,
        collisionBounds.x,
        collisionBounds.y,
        collisionBounds.width,
        collisionBounds.height
      );
      ctx.strokeStyle = "rgba(255, 183, 3, 0.45)";
      ctx.strokeRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      ctx.fillStyle = "rgba(255, 183, 3, 0.06)";
      ctx.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      ctx.strokeStyle = "#ffb703";
      ctx.strokeRect(supportRect.x, supportRect.y, supportRect.width, supportRect.height);
      ctx.fillStyle = "rgba(255, 183, 3, 0.16)";
      ctx.fillRect(supportRect.x, supportRect.y, supportRect.width, supportRect.height);
      ctx.fillStyle = "#fff4cc";
      ctx.font = "11px monospace";
      ctx.fillText(platform.name ?? platform.id ?? "platform", bodyRect.x + 4, bodyRect.y - 4);
    }

    ctx.setLineDash([]);
    this.renderPlayerDebug(ctx, worldRect, this.p1, "#7ae582");
    this.renderPlayerDebug(ctx, worldRect, this.p2, "#7ab6ff");
    ctx.restore();
  }

  renderPlayerDebug(ctx, worldRect, player, color) {
    if (!player) {
      return;
    }

    const bodyRect = this.projectWorldRectToScreen(worldRect, player.x, player.y, player.width, player.height);
    const metrics = this.getPlayerDrawMetrics(player, worldRect);
    const spriteRect = {
      x: metrics.screenX,
      y: metrics.screenY,
      width: metrics.screenWidth,
      height: metrics.screenHeight,
    };

    ctx.strokeStyle = color;
    ctx.strokeRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
    ctx.fillStyle = `${color}22`;
    ctx.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.strokeRect(spriteRect.x, spriteRect.y, spriteRect.width, spriteRect.height);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(metrics.originX, metrics.originY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(metrics.originX - 6, metrics.originY);
    ctx.lineTo(metrics.originX + 6, metrics.originY);
    ctx.moveTo(metrics.originX, metrics.originY - 6);
    ctx.lineTo(metrics.originX, metrics.originY + 6);
    ctx.stroke();
  }

  projectWorldRectToScreen(worldRect, x, y, width, height) {
    const screenPos = this.projectWorldPointToScreen(worldRect, x, y);
    return {
      x: screenPos.x,
      y: screenPos.y,
      width: Math.round(width * worldRect.scale),
      height: Math.round(height * worldRect.scale),
    };
  }

  projectWorldPointToScreen(worldRect, x, y) {
    return {
      x: Math.round(worldRect.drawX + (Number(x) - this.worldCamera.x) * worldRect.scale),
      y: Math.round(worldRect.drawY + (Number(y) - this.worldCamera.y) * worldRect.scale),
    };
  }

  getPlayerDrawMetrics(player, worldRect = null) {
    const drawX = player.x + player.width * 0.5 - PLAYER_DRAW_WIDTH * 0.5;
    const drawY = player.y + player.height - PLAYER_DRAW_HEIGHT * PLAYER_CHARACTER_FEET_RATIO;
    const screenPos = worldRect
      ? this.projectWorldPointToScreen(worldRect, drawX, drawY)
      : this.worldCamera.worldToScreen(drawX, drawY);
    const scaledWidth = worldRect
      ? Math.max(1, Math.round(PLAYER_DRAW_WIDTH * worldRect.scale))
      : PLAYER_DRAW_WIDTH;
    const scaledHeight = worldRect
      ? Math.max(1, Math.round(PLAYER_DRAW_HEIGHT * worldRect.scale))
      : PLAYER_DRAW_HEIGHT;
    return {
      drawX,
      drawY,
      drawWidth: PLAYER_DRAW_WIDTH,
      drawHeight: PLAYER_DRAW_HEIGHT,
      screenWidth: scaledWidth,
      screenHeight: scaledHeight,
      screenX: Number(screenPos?.x) || 0,
      screenY: Number(screenPos?.y) || 0,
      originX: Number(screenPos?.x) || 0,
      originY: Number(screenPos?.y) || 0,
    };
  }

  renderBackdrop(ctx, fullWidth, fullHeight) {
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, fullHeight);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, fullWidth, fullHeight);

    const leftTint = ctx.createLinearGradient(0, 0, fullWidth * 0.55, 0);
    leftTint.addColorStop(0, TEAM_STYLES[0].panelTint);
    leftTint.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = leftTint;
    ctx.fillRect(0, 0, fullWidth * 0.55, Math.min(fullHeight * 0.36, 240));

    const rightTint = ctx.createLinearGradient(fullWidth, 0, fullWidth * 0.45, 0);
    rightTint.addColorStop(0, TEAM_STYLES[1].panelTint);
    rightTint.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rightTint;
    ctx.fillRect(fullWidth * 0.45, 0, fullWidth * 0.55, Math.min(fullHeight * 0.36, 240));
    ctx.restore();
  }

  renderScaledBackdropWorld(ctx, worldRect) {
    ctx.save();
    ctx.translate(worldRect.drawX, worldRect.drawY);
    ctx.scale(worldRect.scale, worldRect.scale);
    this.renderSky(ctx);
    this.background.render(ctx, this.worldCamera, this.worldWidth, this.worldHeight);
    this.renderAtmosphere(ctx);
    this.renderDecorStrip(ctx, this.worldCamera);
    ctx.restore();
  }

  renderWorldScreen(ctx, worldRect) {
    for (const platform of this.platforms) {
      this.renderPlatformScreen(ctx, worldRect, platform);
    }
    for (const bullet of this.bullets) {
      if (bullet?.active !== false) {
        this.renderBulletScreen(ctx, worldRect, bullet);
      }
    }
    this.renderPlayerScreen(ctx, worldRect, this.p1, 0);
    this.renderPlayerScreen(ctx, worldRect, this.p2, 1);
    this.renderParticlesScreen(ctx, worldRect);
  }

  renderSky(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.worldHeight);
    gradient.addColorStop(0, SKY_TOP);
    gradient.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
  }

  renderAtmosphere(ctx) {
    ctx.save();
    ctx.fillStyle = HAZE_COLOR;
    ctx.beginPath();
    ctx.ellipse(this.worldWidth * 0.14, 132, 124, 38, -0.1, 0, Math.PI * 2);
    ctx.ellipse(this.worldWidth * 0.47, 168, 116, 34, 0.03, 0, Math.PI * 2);
    ctx.ellipse(this.worldWidth * 0.8, 148, 108, 32, 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderDecorStrip(ctx, camera) {
    const stripPos = camera.worldToScreen(0, this.decorStripY);
    const topY = stripPos.y;
    ctx.save();
    ctx.fillStyle = DECOR_STRIP_COLOR;
    ctx.fillRect(stripPos.x, topY, this.worldWidth, this.decorStripHeight);
    ctx.fillStyle = DECOR_STRIP_TOP;
    ctx.fillRect(stripPos.x, topY, this.worldWidth, 6);
    ctx.restore();
  }

  renderPlatformScreen(ctx, worldRect, platform) {
    if (!platform) {
      return;
    }

    const rect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
    const topHeight = Math.max(2, Math.round(6 * worldRect.scale));
    const edgeHeight = Math.max(2, Math.round(4 * worldRect.scale));

    ctx.save();
    ctx.fillStyle = PLATFORM_FACE_COLOR;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = PLATFORM_TOP_COLOR;
    ctx.fillRect(rect.x, rect.y, rect.width, topHeight);
    ctx.fillStyle = PLATFORM_EDGE_COLOR;
    ctx.fillRect(rect.x, rect.y + rect.height - edgeHeight, rect.width, edgeHeight);
    ctx.restore();
  }

  renderBulletScreen(ctx, worldRect, bullet) {
    const ownerIndex = bullet?.owner === this.p2 ? 1 : 0;
    const style = TEAM_STYLES[ownerIndex];
    const fruitTheme = getBulletFruitTheme(bullet);
    const rect = this.projectWorldRectToScreen(worldRect, bullet.x, bullet.y, bullet.width, bullet.height);

    const centerX = rect.x + rect.width * 0.5;
    const centerY = rect.y + rect.height * 0.5;
    const trailWidth = Math.max(10, Math.round((Math.abs(bullet.directionX) * 16 + 12) * worldRect.scale));
    const trailX = bullet.directionX >= 0 ? rect.x - trailWidth * 0.55 : rect.x + rect.width - 2;

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = style.bulletGlow;
    ctx.fillRect(Math.round(trailX), Math.round(centerY - 2), trailWidth, Math.max(2, Math.round(4 * worldRect.scale)));
    ctx.globalAlpha = 1;
    ctx.shadowColor = style.bulletGlow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = fruitTheme.bulletCore;
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY + 2);
    ctx.bezierCurveTo(centerX - 6, centerY - 2, centerX - 2, centerY - 5, centerX + 1, centerY - 4);
    ctx.bezierCurveTo(centerX + 4, centerY - 3, centerX + 5, centerY, centerX + 4, centerY + 3);
    ctx.bezierCurveTo(centerX + 2, centerY + 5, centerX - 2, centerY + 5, centerX - 5, centerY + 2);
    ctx.fill();
    ctx.fillStyle = fruitTheme.bulletAccent;
    ctx.beginPath();
    ctx.arc(centerX - 1.6, centerY - 1.2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a9242";
    ctx.beginPath();
    ctx.ellipse(centerX + 3.4, centerY - 4.4, 2.3, 1.2, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderPlayerScreen(ctx, worldRect, player, index) {
    if (!player || player.active === false) {
      return;
    }

    const metrics = this.getPlayerDrawMetrics(player, worldRect);
    this.renderPlayerShadowScreen(ctx, worldRect, player);

    const frame = this.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
    const flashing = clampAlpha(this.hitFlashTimers[index] / HIT_FLASH_DURATION);

    if (this.playerSheetReady && this.playerSheet?.isReady?.()) {
      this.renderSheetFighterScreen(ctx, metrics.screenX, metrics.screenY, metrics.screenWidth, metrics.screenHeight, player, frame, flashing, TEAM_STYLES[index]);
      return;
    }

    this.renderProceduralFighter(ctx, metrics.screenX, metrics.screenY, player, flashing, TEAM_STYLES[index]);
  }

  renderPlayerShadowScreen(ctx, worldRect, player) {
    const screenPos = this.projectWorldPointToScreen(worldRect, player.x + player.width * 0.5, player.y + player.height - 7);
    const radiusX = Math.max(8, Math.round(18 * worldRect.scale));
    const radiusY = Math.max(3, Math.round(6 * worldRect.scale));

    ctx.save();
    ctx.fillStyle = "rgba(23, 29, 33, 0.26)";
    ctx.beginPath();
    ctx.ellipse(screenPos.x, screenPos.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderSheetFighterScreen(ctx, x, y, drawWidth, drawHeight, player, frame, flashAlpha, teamStyle) {
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(x + drawWidth, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    this.playerSheet.drawFrame(ctx, x, y, frame, drawWidth, drawHeight);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = teamStyle.accent;
    ctx.fillRect(
      x + drawWidth * 0.22,
      y + drawHeight * 0.24,
      drawWidth * 0.07,
      drawHeight * 0.08
    );
    ctx.fillRect(
      x + drawWidth * 0.5,
      y + drawHeight * 0.36,
      drawWidth * 0.1,
      drawHeight * 0.045
    );

    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.48;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, drawWidth, drawHeight);
    }

    ctx.restore();
  }

  renderParticlesScreen(ctx, worldRect) {
    const previousAlpha = ctx.globalAlpha;
    const previousFillStyle = ctx.fillStyle;

    for (let index = 0; index < this.particles.activeCount; index += 1) {
      const particle = this.particles.particles[this.particles.activeIndices[index]];
      if (!particle?.active) {
        continue;
      }

      const alpha = particle.maxLife > 0 ? particle.life / particle.maxLife : 0;
      if (alpha <= this.particles.alphaCutoff) {
        continue;
      }

      const point = this.projectWorldPointToScreen(worldRect, particle.position.x, particle.position.y);
      const size = Math.max(1, Math.round(particle.size * worldRect.scale));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;

      if (particle.shape === "circle") {
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(point.x - size, point.y - size, size * 2, size * 2);
      }
    }

    ctx.globalAlpha = previousAlpha;
    ctx.fillStyle = previousFillStyle;
  }

  renderPlatform(ctx, camera, platform) {
    if (!platform) {
      return;
    }

    const pos = camera.worldToScreen(platform.x, platform.y);
    ctx.save();
    ctx.fillStyle = PLATFORM_FACE_COLOR;
    ctx.fillRect(pos.x, pos.y, platform.width, platform.height);
    ctx.fillStyle = PLATFORM_TOP_COLOR;
    ctx.fillRect(pos.x, pos.y, platform.width, 6);
    ctx.fillStyle = PLATFORM_EDGE_COLOR;
    ctx.fillRect(pos.x, pos.y + platform.height - 4, platform.width, 4);
    ctx.restore();
  }

  renderBullet(ctx, camera, bullet) {
    const ownerIndex = bullet?.owner === this.p2 ? 1 : 0;
    const style = TEAM_STYLES[ownerIndex];
    const fruitTheme = getBulletFruitTheme(bullet);
    const pos = bullet.projectToScreen(camera);
    if (!pos) {
      return;
    }

    const centerX = pos.x + bullet.width * 0.5;
    const centerY = pos.y + bullet.height * 0.5;
    const trailWidth = Math.max(10, Math.abs(bullet.directionX) * 16 + 12);
    const trailX = bullet.directionX >= 0 ? pos.x - trailWidth * 0.55 : pos.x + bullet.width - 2;

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = style.bulletGlow;
    ctx.fillRect(trailX, centerY - 2, trailWidth, 4);
    ctx.globalAlpha = 1;
    ctx.shadowColor = style.bulletGlow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = fruitTheme.bulletCore;
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY + 2);
    ctx.bezierCurveTo(centerX - 6, centerY - 2, centerX - 2, centerY - 5, centerX + 1, centerY - 4);
    ctx.bezierCurveTo(centerX + 4, centerY - 3, centerX + 5, centerY, centerX + 4, centerY + 3);
    ctx.bezierCurveTo(centerX + 2, centerY + 5, centerX - 2, centerY + 5, centerX - 5, centerY + 2);
    ctx.fill();
    ctx.fillStyle = fruitTheme.bulletAccent;
    ctx.beginPath();
    ctx.arc(centerX - 1.6, centerY - 1.2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a9242";
    ctx.beginPath();
    ctx.ellipse(centerX + 3.4, centerY - 4.4, 2.3, 1.2, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderPlayer(ctx, camera, player, index) {
    if (!player || player.active === false) {
      return;
    }

    const metrics = this.getPlayerDrawMetrics(player);
    const pos = player.projectToScreen(camera, metrics.drawX, metrics.drawY);
    if (!pos) {
      return;
    }

    this.renderPlayerShadow(ctx, camera, player);

    const frame = this.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
    const flashing = clampAlpha(this.hitFlashTimers[index] / HIT_FLASH_DURATION);

    if (this.playerSheetReady && this.playerSheet?.isReady?.()) {
      this.renderSheetFighter(ctx, pos.x, pos.y, player, frame, flashing, TEAM_STYLES[index]);
      return;
    }

    this.renderProceduralFighter(ctx, pos.x, pos.y, player, flashing, TEAM_STYLES[index]);
  }

  renderPlayerShadow(ctx, camera, player) {
    const pos = player.projectToScreen(camera, player.x + player.width * 0.5 - 18, player.y + player.height - 7);
    if (!pos) {
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(23, 29, 33, 0.26)";
    ctx.beginPath();
    ctx.ellipse(pos.x + 18, pos.y + 7, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderSheetFighter(ctx, x, y, player, frame, flashAlpha, teamStyle) {
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(x + PLAYER_DRAW_WIDTH, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    this.playerSheet.drawFrame(ctx, x, y, frame, PLAYER_DRAW_WIDTH, PLAYER_DRAW_HEIGHT);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = teamStyle.accent;
    ctx.fillRect(
      x + PLAYER_DRAW_WIDTH * 0.22,
      y + PLAYER_DRAW_HEIGHT * 0.24,
      PLAYER_DRAW_WIDTH * 0.07,
      PLAYER_DRAW_HEIGHT * 0.08
    );
    ctx.fillRect(
      x + PLAYER_DRAW_WIDTH * 0.5,
      y + PLAYER_DRAW_HEIGHT * 0.36,
      PLAYER_DRAW_WIDTH * 0.1,
      PLAYER_DRAW_HEIGHT * 0.045
    );

    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.48;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, PLAYER_DRAW_WIDTH, PLAYER_DRAW_HEIGHT);
    }

    ctx.restore();
  }

  renderProceduralFighter(ctx, x, y, player, flashAlpha, teamStyle) {
    const state = player.animationState || "idle";
    const facing = player.facing < 0 ? -1 : 1;
    const stride = state === "run" ? Math.sin(this.cachedNowMs * 0.018) * 10 : 0;
    const airOffset = state === "jump" ? -10 : state === "fall" ? 6 : 0;
    const scarfWave = Math.sin(this.cachedNowMs * 0.012) * SCARF_SWAY_AMPLITUDE;

    ctx.save();
    ctx.translate(x + PLAYER_DRAW_WIDTH * 0.5, y + PLAYER_DRAW_HEIGHT);
    ctx.scale(facing, 1);

    ctx.fillStyle = teamStyle.fallbackBody;
    ctx.strokeStyle = "#1d2711";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(-12, -22 + airOffset);
    ctx.lineTo(12, -22 + airOffset);
    ctx.lineTo(20, -58 + airOffset);
    ctx.lineTo(10, -86 + airOffset);
    ctx.lineTo(-10, -86 + airOffset);
    ctx.lineTo(-20, -58 + airOffset);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#cfb7a1";
    ctx.beginPath();
    ctx.arc(0, -94 + airOffset, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#37251e";
    ctx.beginPath();
    ctx.arc(0, -100 + airOffset, 17, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#202826";
    ctx.beginPath();
    ctx.moveTo(-16, -92 + airOffset);
    ctx.lineTo(16, -92 + airOffset);
    ctx.lineTo(8, -72 + airOffset);
    ctx.lineTo(-10, -72 + airOffset);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#1d2711";
    ctx.beginPath();
    ctx.moveTo(-8, -52 + airOffset);
    ctx.lineTo(-18 - stride * 0.2, -20 + airOffset);
    ctx.moveTo(8, -52 + airOffset);
    ctx.lineTo(26 + stride * 0.16, -28 + airOffset);
    ctx.moveTo(-6, -20 + airOffset);
    ctx.lineTo(-16 + stride, 8 + airOffset);
    ctx.moveTo(6, -20 + airOffset);
    ctx.lineTo(16 - stride, 10 + airOffset);
    ctx.stroke();

    ctx.strokeStyle = teamStyle.scarf;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(8, -76 + airOffset);
    ctx.lineTo(24 + scarfWave, -68 + airOffset);
    ctx.lineTo(34 + scarfWave * 0.7, -54 + airOffset);
    ctx.stroke();

    ctx.fillStyle = "#5c2e1c";
    ctx.fillRect(-2, -65 + airOffset, 5, 15);

    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.52;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-PLAYER_DRAW_WIDTH * 0.4, -PLAYER_DRAW_HEIGHT, PLAYER_DRAW_WIDTH * 0.8, PLAYER_DRAW_HEIGHT);
    }

    ctx.restore();
  }

  renderDivider(ctx, fullWidth, fullHeight) {
    const dividerX = fullWidth * 0.5;
    const dividerTop = 12;
    const dividerHeight = Math.min(132, Math.max(84, fullHeight * 0.17));
    ctx.save();
    ctx.fillStyle = DIVIDER_GLOW;
    ctx.fillRect(dividerX - 18, dividerTop, 36, dividerHeight);
    ctx.fillStyle = DIVIDER_CORE;
    ctx.fillRect(dividerX - 4, dividerTop + 10, 8, dividerHeight - 18);
    ctx.restore();
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
      emit(game?.eventBus, "ui_click", { source: "mute_toggle", muted });
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
