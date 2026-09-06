import { Player } from "../entities/Player.js";
import { Bullet } from "../entities/Bullet.js";
import { Platform } from "../entities/Platform.js";
import { Camera } from "../core/Camera.js";
import { VersusInput } from "../core/VersusInput.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { VersusBotController } from "../ai/VersusBotController.js";
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
import {
  getVersusMatchMode,
  isVersusBotMatchMode,
  loadSelectedVersusMatchModeKey,
} from "../config/versusMatchMode.js";
import {
  buildPlayerCharacterSheetDataUrl,
  getPlayerCharacterByKey,
  loadSelectedPlayerCharacterKey,
  pickRandomPlayerCharacterKey,
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
const VERSUS_SPAWN_PROTECTION_MS = 1000;
const SKY_TOP = "#b6c6e5";
const SKY_BOTTOM = "#bccbe8";
const HAZE_COLOR = "rgba(255, 255, 255, 0.10)";
const DECOR_STRIP_COLOR = "#c9bfae";
const DECOR_STRIP_TOP = "#ddd3c0";
const PLATFORM_FACE_COLOR = "#245e10";
const PLATFORM_TOP_COLOR = "#2f7015";
const PLATFORM_EDGE_COLOR = "rgba(15, 41, 6, 0.7)";
const DIVIDER_CORE = "rgba(150, 131, 191, 0.60)";
const DIVIDER_GLOW = "rgba(181, 156, 214, 0.30)";
const SCARF_SWAY_AMPLITUDE = 8;
const HIT_FLASH_DURATION = 0.14;

const TEAM_STYLES = [
  {
    // P1 — expectation.png left: small red dots with soft red trail.
    bulletCore: "#e5322b",
    bulletGlow: "rgba(255, 96, 80, 0.65)",
    bulletAccent: "#ffd9d2",
    accent: "#dc8f4b",
    scarf: "#e8a13c",
    panelTint: "rgba(176, 159, 162, 0.88)",
    fallbackBody: "#2e3a24",
    headband: "#e8a13c",
    hitColors: ["#ffffff", "#ffc9bd", "#e5322b", "#7a1f1a"],
  },
  {
    // P2 — expectation.png middle/right: blue slug with yellow glow.
    bulletCore: "#2e4de6",
    bulletGlow: "rgba(255, 236, 120, 0.85)",
    bulletAccent: "#fff6b0",
    accent: "#4a61db",
    scarf: "#2f44be",
    panelTint: "rgba(138, 142, 197, 0.88)",
    fallbackBody: "#232d22",
    headband: "#3a55d8",
    hitColors: ["#ffffff", "#fff6b0", "#2e4de6", "#4a5a8a"],
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
    this.spawnProtectionMs = [0, 0];

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
    this.playerSheets = new Map();
    this.playerSheetErrorKeys = new Set();
    this.preloadPromise = null;
    this.playerCharacterKey = loadSelectedPlayerCharacterKey();
    this.botCharacterKey = this.playerCharacterKey;
    this.matchModeKey = loadSelectedVersusMatchModeKey();
    this.botController = new VersusBotController();

    this.onKeyDown = (event) => {
      const code = event?.code;
      if (code === "Escape" || code === "KeyP" || code === "Backspace") {
        // M6: double-press to quit — first press arms a 2s window, second confirms.
        // Prevents accidental phone Back / stray Esc from instantly killing the match.
        const now = nowMs();
        if (now < this.exitArmedUntilMs) {
          this.exitArmedUntilMs = 0;
          this.exitRequested = true;
        } else {
          this.exitArmedUntilMs = now + 2000;
        }
        if (event?.cancelable) {
          event.preventDefault();
        }
      }
    };
    this.exitArmedUntilMs = 0;
    this.invulnWatchdogFired = false;
  }

  onEnter(game, transition = {}) {
    const payload = transition?.payload ?? transition ?? {};
    this.width = Math.max(1, Number(game?.viewWidth) || 1);
    this.height = Math.max(1, Number(game?.viewHeight) || 1);
    const nextCharacterKey = this.resolvePlayerCharacterKey(payload, game);
    const nextMatchModeKey = this.resolveMatchModeKey(payload, game);
    this.playerCharacterKey = nextCharacterKey;
    this.botCharacterKey = this.resolveBotCharacterKey(nextCharacterKey, nextMatchModeKey);
    this.matchModeKey = nextMatchModeKey;
    this.botController.reset();
    game.sceneData = {
      ...game.sceneData,
      playerCharacterKey: nextCharacterKey,
      matchMode: nextMatchModeKey,
    };
    this.settings = loadSettings();
    this.versusHUD.setPlayerLabels([
      getVersusMatchMode(this.matchModeKey).p1Label,
      getVersusMatchMode(this.matchModeKey).p2Label,
    ]);
    game?.audioManager?.setEnabled?.(this.settings.soundEnabled);
    game?.musicManager?.setEnabled?.(this.settings.musicEnabled);
    this.muteButton.setMuted(!(this.settings.soundEnabled || this.settings.musicEnabled));

    this.preloadPromise = this.preloadAssets();

    this.versusInput.attach();
    this.versusInput.reset();
    this.exitRequested = false;
    this.exitArmedUntilMs = 0;
    this.invulnWatchdogFired = false;
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
    this.exitArmedUntilMs = 0;
    this.matchEnded = false;
    this.roundStartedAtMs = 0;
    this.spawnProtectionMs[0] = 0;
    this.spawnProtectionMs[1] = 0;
    if (this.p1) {
      this.p1.invulnerable = false;
    }
    if (this.p2) {
      this.p2.invulnerable = false;
    }
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
    this.botController.reset();
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
            // M2: impact palette follows the VICTIM team so hits read instantly like expectation.png.
            const victimIndex = targetIndex >= 0 ? targetIndex : 0;
            const palette = TEAM_STYLES[victimIndex]?.hitColors ?? ["#ffffff"];
            this.spawnFruitBurst(hitPoint.x, hitPoint.y, payload?.isFatal ? 14 : 8, palette, {
              lifeMin: 0.14,
              lifeMax: 0.32,
              speedMin: 30,
              speedMax: payload?.isFatal ? 130 : 80,
              sizeMin: 1.2,
              sizeMax: 3,
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
        const ownerIndex = bullet?.owner === this.p2 ? 1 : 0;
        const style = TEAM_STYLES[ownerIndex];
        this.spawnFruitBurst(hitPoint.x, hitPoint.y, 5, [style.bulletAccent, style.bulletCore, "#ffffff"], {
          lifeMin: 0.1,
          lifeMax: 0.22,
          speedMin: 20,
          speedMax: 70,
          sizeMin: 1,
          sizeMax: 2.2,
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

  resolveMatchModeKey(payload = {}, game) {
    const candidate = payload?.matchMode ?? game?.sceneData?.matchMode;
    return getVersusMatchMode(typeof candidate === "string" ? candidate : loadSelectedVersusMatchModeKey()).key;
  }

  resolveBotCharacterKey(playerCharacterKey, matchModeKey) {
    if (!isVersusBotMatchMode(matchModeKey)) {
      return getPlayerCharacterByKey(playerCharacterKey).key;
    }
    return pickRandomPlayerCharacterKey(playerCharacterKey);
  }

  getCharacterKeyForPlayer(index) {
    return index === 1 && isVersusBotMatchMode(this.matchModeKey)
      ? getPlayerCharacterByKey(this.botCharacterKey).key
      : getPlayerCharacterByKey(this.playerCharacterKey).key;
  }

  getPlayerSheet(characterKey) {
    const normalizedKey = getPlayerCharacterByKey(characterKey).key;
    return this.playerSheets.get(normalizedKey) ?? null;
  }

  async preloadAssets() {
    const keysToLoad = [...new Set([
      getPlayerCharacterByKey(this.playerCharacterKey).key,
      getPlayerCharacterByKey(this.botCharacterKey).key,
    ])];
    const results = await Promise.all(keysToLoad.map((characterKey) => this.preloadCharacterSheet(characterKey)));
    return results.every(Boolean);
  }

  async preloadCharacterSheet(characterKey) {
    const normalizedKey = getPlayerCharacterByKey(characterKey).key;
    let sheet = this.playerSheets.get(normalizedKey);
    if (!sheet) {
      sheet = new SpriteSheet(buildPlayerCharacterSheetDataUrl(normalizedKey), {
        frameWidth: 64,
        frameHeight: 64,
        columns: 4,
        rows: 1,
        fallbackColor: "#6f8758",
      });
      this.playerSheets.set(normalizedKey, sheet);
    }

    if (sheet.isReady?.()) {
      return true;
    }

    try {
      return await sheet.load();
    } catch (error) {
      if (isDev() && !this.playerSheetErrorKeys.has(normalizedKey)) {
        console.error(`[VersusGameScene] sprite preload failed for "${normalizedKey}"; using procedural fighter fallback.`, error);
        this.playerSheetErrorKeys.add(normalizedKey);
      }
      return false;
    }
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
    this.p1.characterKey = this.getCharacterKeyForPlayer(0);

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
    this.p2.characterKey = this.getCharacterKeyForPlayer(1);

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
    player.characterKey = this.getCharacterKeyForPlayer(index);
    player.supportingPlatform = null;
    player.supportingPlatformId = null;
    player.supportingPlatformName = null;
    player.supportingPlatformCategory = 0;
    this.hitFlashTimers[index] = 0;
    // M3: brief spawn protection so fixed spawns can't be spawn-killed by in-flight bullets.
    this.spawnProtectionMs[index] = VERSUS_SPAWN_PROTECTION_MS;
    player.invulnerable = true;
    this.playerAnimators[index]?.play("idle", { reset: true });
    if (index === 1 && isVersusBotMatchMode(this.matchModeKey)) {
      this.botController.reset();
    }
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
      game?.switchScene?.("menu", {
        from: "versus",
        playerCharacterKey: this.playerCharacterKey,
        matchMode: this.matchModeKey,
      });
      return;
    }

    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    if (dt <= 0 || !this.p1 || !this.p2 || this.matchEnded) {
      return;
    }

    this.cachedNowMs = nowMs();
    this.updateHitFlashTimers(dt);
    this.updateSpawnProtection(dt);
    this.particles.update(dt);

    const p1Input = this.versusInput.getPlayerInput(0);
    let p2Input = this.versusInput.getPlayerInput(1);

    if (isVersusBotMatchMode(this.matchModeKey)) {
      this.botController.update(dt, {
        self: this.p2,
        opponent: this.p1,
        bullets: this.bullets,
        ownPlatform: this.platforms[1],
        nowMs: this.cachedNowMs,
      });
      p2Input = this.botController.getPlayerInput();
    }

    this.p1.applyInput(p1Input, dt);
    this.p2.applyInput(p2Input, dt);

    // M3: dead players can't shoot — prevents input queue firing on respawn frame.
    if (this.p1.active !== false && (p1Input.consumePressed("shoot") || p1Input.isPressed("shoot"))) {
      this.fireBullet(this.p1, 0, game?.eventBus);
    }
    if (this.p2.active !== false && (p2Input.consumePressed("shoot") || p2Input.isPressed("shoot"))) {
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

  updateSpawnProtection(dt) {
    const dtMs = Math.max(0, Number(dt) || 0) * 1000;
    if (dtMs <= 0) {
      return;
    }
    for (let index = 0; index < this.players.length; index += 1) {
      const remaining = Math.max(0, Number(this.spawnProtectionMs[index]) || 0);
      if (remaining > 0) {
        const next = Math.max(0, remaining - dtMs);
        this.spawnProtectionMs[index] = next;
        const player = this.players[index];
        if (player && next <= 0) {
          player.invulnerable = false;
        }
        continue;
      }
      // M6 watchdog: protection expired but flag stuck — force-clear so nobody goes unkillable.
      const player = this.players[index];
      if (player && player.invulnerable === true && player.active !== false) {
        player.invulnerable = false;
        if (isDev() && !this.invulnWatchdogFired) {
          this.invulnWatchdogFired = true;
          console.warn(`[VersusGameScene] invulnerable watchdog cleared stuck flag on P${index + 1}`);
        }
      }
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
    target.invulnerable = false;
    target.moveIntent = 0;
    target.jumpRequested = false;
    this.hitFlashTimers[playerIndex] = HIT_FLASH_DURATION;
    this.spawnProtectionMs[playerIndex] = 0;

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
    // M2: versus bullets follow TEAM_STYLES (picture: red vs blue/yellow), not fruit roster.
    const style = TEAM_STYLES[ownerIndex === 1 ? 1 : 0];
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
      color: style.bulletCore,
      shape: "rect",
      characterKey: player.characterKey,
    });

    player.markShot(now);
    ownerList.push(bullet);
    this.bullets.push(bullet);
    // Small muzzle puff in team glow color — reads like expectation.png muzzle flash.
    this.spawnFruitBurst(from.x + directionX * 20, from.y - PLAYER_SHOOT_Y_OFFSET, 3, [style.bulletAccent, style.bulletGlow], {
      lifeMin: 0.08,
      lifeMax: 0.16,
      speedMin: 20,
      speedMax: 60,
      sizeMin: 1,
      sizeMax: 2,
    });
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
      matchMode: this.matchModeKey,
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
      matchMode: this.matchModeKey,
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
      playerCharacterKey: this.playerCharacterKey,
      matchMode: this.matchModeKey,
      stats,
      versusResult: versus,
    };

    game?.switchScene?.("game_over", {
      mode: "versus",
      sourceScene: "versus",
      playerCharacterKey: this.playerCharacterKey,
      matchMode: this.matchModeKey,
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
    this.renderExitConfirmHint(ctx, fullWidth, fullHeight);
  }

  renderExitConfirmHint(ctx, fullWidth, fullHeight) {
    // M6: only visible during the 2s armed window after first Esc/Back press.
    if (!ctx || typeof ctx.save !== "function") {
      return;
    }
    if (Number(this.exitArmedUntilMs) <= Number(this.cachedNowMs)) {
      return;
    }
    const label = "Press ESC again to quit to menu";
    ctx.save();
    ctx.font = "600 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const padX = 18;
    const textW = ctx.measureText ? ctx.measureText(label).width : label.length * 9;
    const pillW = Math.min(fullWidth - 32, textW + padX * 2);
    const pillH = 34;
    const pillX = Math.round((fullWidth - pillW) * 0.5);
    const pillY = Math.round(fullHeight - pillH - 76);
    ctx.fillStyle = "rgba(10, 16, 28, 0.82)";
    ctx.strokeStyle = "rgba(181, 156, 214, 0.9)";
    ctx.lineWidth = 2;
    if (typeof ctx.beginPath === "function" && typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 17);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(pillX, pillY, pillW, pillH);
    }
    ctx.fillStyle = "#f2ecff";
    ctx.fillText(label, Math.round(fullWidth * 0.5), Math.round(pillY + pillH * 0.5 + 1), Math.max(0, pillW - 16));
    ctx.restore();
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
    lines.push(`Match mode=${this.matchModeKey}`);
    if (isVersusBotMatchMode(this.matchModeKey) && this.botController.lastDecision) {
      lines.push(`Bot reason=${this.botController.lastDecision.reason}`);
      if (this.botController.lastDecision.threatTimeToImpact !== null) {
        lines.push(`Bot threat t=${this.botController.lastDecision.threatTimeToImpact.toFixed(2)}s`);
      }
    }
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
    // M1: flat sky like expectation.png — no team tints, HUD panels carry the color.
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, fullHeight);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, fullWidth, fullHeight);
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
    // M1: expectation.png has a flat sky — keep haze extremely subtle.
    ctx.save();
    ctx.fillStyle = HAZE_COLOR;
    ctx.beginPath();
    ctx.ellipse(this.worldWidth * 0.2, 140, 110, 26, -0.1, 0, Math.PI * 2);
    ctx.ellipse(this.worldWidth * 0.8, 155, 96, 24, 0.07, 0, Math.PI * 2);
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
    // M2: picture-style slugs — solid core + soft glow trail, no fruit leaf.
    const ownerIndex = bullet?.owner === this.p2 ? 1 : 0;
    const style = TEAM_STYLES[ownerIndex];
    const rect = this.projectWorldRectToScreen(worldRect, bullet.x, bullet.y, bullet.width, bullet.height);

    const centerX = rect.x + rect.width * 0.5;
    const centerY = rect.y + rect.height * 0.5;
    const dir = (Number(bullet.directionX) || 0) >= 0 ? 1 : -1;
    const trailLen = Math.max(12, Math.round(22 * worldRect.scale));
    const trailX = dir >= 0 ? Math.round(centerX - trailLen) : Math.round(centerX);
    const coreW = Math.max(6, Math.round(12 * worldRect.scale));
    const coreH = Math.max(4, Math.round(7 * worldRect.scale));

    ctx.save();
    // Glow trail
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = style.bulletGlow;
    ctx.fillRect(trailX, Math.round(centerY - coreH * 0.35), trailLen, Math.max(2, Math.round(coreH * 0.7)));
    // Core slug
    ctx.globalAlpha = 1;
    ctx.shadowColor = style.bulletGlow;
    ctx.shadowBlur = 6;
    ctx.fillStyle = style.bulletCore;
    const coreX = Math.round(centerX - coreW * 0.5);
    const coreY = Math.round(centerY - coreH * 0.5);
    ctx.fillRect(coreX, coreY, coreW, coreH);
    // Hot highlight dot (yellow-white like expectation.png)
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.bulletAccent;
    ctx.fillRect(dir >= 0 ? coreX + 1 : coreX + coreW - 3, coreY + 1, 2, Math.max(1, coreH - 2));
    ctx.restore();
  }

  renderPlayerScreen(ctx, worldRect, player, index) {
    if (!player || player.active === false) {
      return;
    }

    // M3: spawn-protection blink — 8Hz, so protection reads without hiding the fighter.
    const protectedMs = Number(this.spawnProtectionMs[index]) || 0;
    if (protectedMs > 0 && Math.floor(this.cachedNowMs / 125) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      const metricsBlink = this.getPlayerDrawMetrics(player, worldRect);
      this.renderPlayerShadowScreen(ctx, worldRect, player);
      const frameBlink = this.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
      const flashingBlink = clampAlpha(this.hitFlashTimers[index] / HIT_FLASH_DURATION);
      const sheetBlink = this.getPlayerSheet(player.characterKey);
      if (sheetBlink?.isReady?.()) {
        this.renderSheetFighterScreen(ctx, sheetBlink, metricsBlink.screenX, metricsBlink.screenY, metricsBlink.screenWidth, metricsBlink.screenHeight, player, frameBlink, flashingBlink, TEAM_STYLES[index]);
      } else {
        this.renderProceduralFighter(ctx, metricsBlink.screenX, metricsBlink.screenY, player, flashingBlink, TEAM_STYLES[index]);
      }
      ctx.restore();
      return;
    }

    const metrics = this.getPlayerDrawMetrics(player, worldRect);
    this.renderPlayerShadowScreen(ctx, worldRect, player);

    const frame = this.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
    const flashing = clampAlpha(this.hitFlashTimers[index] / HIT_FLASH_DURATION);

    const playerSheet = this.getPlayerSheet(player.characterKey);
    if (playerSheet?.isReady?.()) {
      this.renderSheetFighterScreen(ctx, playerSheet, metrics.screenX, metrics.screenY, metrics.screenWidth, metrics.screenHeight, player, frame, flashing, TEAM_STYLES[index]);
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

  renderSheetFighterScreen(ctx, sheet, x, y, drawWidth, drawHeight, player, frame, flashAlpha, teamStyle) {
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(x + drawWidth, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    sheet.drawFrame(ctx, x, y, frame, drawWidth, drawHeight);

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
    const pos = bullet.projectToScreen(camera);
    if (!pos) {
      return;
    }

    const centerX = pos.x + bullet.width * 0.5;
    const centerY = pos.y + bullet.height * 0.5;
    const dir = (Number(bullet.directionX) || 0) >= 0 ? 1 : -1;

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = style.bulletGlow;
    ctx.fillRect(dir >= 0 ? centerX - 22 : centerX, centerY - 2, 22, 4);
    ctx.globalAlpha = 1;
    ctx.shadowColor = style.bulletGlow;
    ctx.shadowBlur = 6;
    ctx.fillStyle = style.bulletCore;
    ctx.fillRect(Math.round(centerX - 6), Math.round(centerY - 3.5), 12, 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.bulletAccent;
    ctx.fillRect(dir >= 0 ? Math.round(centerX - 5) : Math.round(centerX + 3), Math.round(centerY - 2.5), 2, 5);
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

    const playerSheet = this.getPlayerSheet(player.characterKey);
    if (playerSheet?.isReady?.()) {
      this.renderSheetFighter(playerSheet, ctx, pos.x, pos.y, player, frame, flashing, TEAM_STYLES[index]);
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

  renderSheetFighter(sheet, ctx, x, y, player, frame, flashAlpha, teamStyle) {
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(x + PLAYER_DRAW_WIDTH, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    sheet.drawFrame(ctx, x, y, frame, PLAYER_DRAW_WIDTH, PLAYER_DRAW_HEIGHT);

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
    // M2: mini-ninja like expectation.png — dark mask, headband tails in team color,
    // readable at small scale, distinct P1/P2 by headband + outline.
    const state = player.animationState || "idle";
    const facing = player.facing < 0 ? -1 : 1;
    const runPhase = Math.sin(this.cachedNowMs * 0.018);
    const stride = state === "run" ? runPhase * 10 : 0;
    const crouch = state === "idle" ? 2 : 0;
    const airOffset = state === "jump" ? -10 : state === "fall" ? 6 : 0;
    const scarfWave = Math.sin(this.cachedNowMs * 0.012) * SCARF_SWAY_AMPLITUDE;
    const body = teamStyle.fallbackBody || "#2e3a24";
    const headband = teamStyle.headband || teamStyle.scarf || "#e8a13c";

    ctx.save();
    ctx.translate(x + PLAYER_DRAW_WIDTH * 0.5, y + PLAYER_DRAW_HEIGHT);
    ctx.scale(facing, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Team outline so P1/P2 never blend (fixes PLAYTEST-002 at sprite level).
    // M5: blur 6 — 10 is ~2x fill cost on mobile WebView for same readability.
    ctx.shadowColor = headband;
    ctx.shadowBlur = 6;

    // Legs — run cycle, jump tuck, crouch idle like picture right fighter.
    ctx.strokeStyle = "#1c2416";
    ctx.lineWidth = 9;
    ctx.beginPath();
    if (state === "jump") {
      ctx.moveTo(-4, -26 + airOffset);
      ctx.lineTo(-12, -8);
      ctx.moveTo(4, -26 + airOffset);
      ctx.lineTo(12, -10);
    } else if (state === "fall") {
      ctx.moveTo(-4, -26 + airOffset);
      ctx.lineTo(-14, -4);
      ctx.moveTo(4, -26 + airOffset);
      ctx.lineTo(14, -6);
    } else {
      ctx.moveTo(-4, -26);
      ctx.lineTo(-8 + stride * 0.8, 0 - crouch);
      ctx.moveTo(4, -26);
      ctx.lineTo(10 - stride * 0.8, 0 - crouch);
    }
    ctx.stroke();
    // Pants highlight
    ctx.strokeStyle = "#4a5d33";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, -26 + airOffset * 0.5);
    ctx.lineTo(-7 + stride * 0.5, -8);
    ctx.moveTo(4, -26 + airOffset * 0.5);
    ctx.lineTo(8 - stride * 0.5, -8);
    ctx.stroke();

    // Torso — dark tunic
    ctx.shadowBlur = 6;
    ctx.fillStyle = body;
    ctx.strokeStyle = "#141a10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-13, -24 + airOffset);
    ctx.lineTo(13, -24 + airOffset);
    ctx.lineTo(10, -58 + airOffset);
    ctx.lineTo(-10, -58 + airOffset);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Belt + blaster hint (facing gun)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10140d";
    ctx.fillRect(-13, -34 + airOffset, 26, 5);
    ctx.fillStyle = "#5c2e1c";
    ctx.fillRect(8, -46 + airOffset, 14, 7);
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(18, -44 + airOffset, 8, 4);

    // Arms — forward aim when running/shooting, tucked when jumping
    ctx.strokeStyle = body;
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (state === "jump" || state === "fall") {
      ctx.moveTo(-6, -52 + airOffset);
      ctx.lineTo(-14, -38 + airOffset);
      ctx.moveTo(6, -52 + airOffset);
      ctx.lineTo(20, -44 + airOffset);
    } else {
      ctx.moveTo(-6, -52);
      ctx.lineTo(-12 + stride * 0.2, -36);
      ctx.moveTo(6, -52);
      ctx.lineTo(22, -42 + stride * 0.15);
    }
    ctx.stroke();

    // Head — dark mask with skin eye slit like expectation ninjas
    ctx.fillStyle = "#d9b896";
    ctx.beginPath();
    ctx.arc(1, -70 + airOffset, 13, 0, Math.PI * 2);
    ctx.fill();
    // Mask top + eye band
    ctx.fillStyle = "#202826";
    ctx.beginPath();
    ctx.arc(1, -73 + airOffset, 13.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(-12, -74 + airOffset, 27, 9);
    // White eye slit (facing direction reads instantly)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, -72 + airOffset, 9, 4);
    ctx.fillStyle = "#111111";
    ctx.fillRect(9, -72 + airOffset, 3, 4);

    // Headband + tails in team color — the P1/P2 distinguisher from distance
    ctx.strokeStyle = headband;
    ctx.fillStyle = headband;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-12, -78 + airOffset);
    ctx.lineTo(14, -78 + airOffset);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, -77 + airOffset);
    ctx.lineTo(-26 + scarfWave * 0.6, -70 + airOffset);
    ctx.lineTo(-32 + scarfWave, -58 + airOffset);
    ctx.stroke();

    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-PLAYER_DRAW_WIDTH * 0.4, -PLAYER_DRAW_HEIGHT, PLAYER_DRAW_WIDTH * 0.8, PLAYER_DRAW_HEIGHT);
    }

    ctx.restore();
  }

  renderDivider(ctx, fullWidth, fullHeight) {
    // M1: match expectation.png — short split in the top HUD + thin full-height center line.
    const dividerX = Math.round(fullWidth * 0.5);
    const dividerTop = 8;
    const dividerHeight = Math.min(150, Math.max(96, fullHeight * 0.19));
    ctx.save();
    // Faint full-height center line (like bug4.png reference, but subtle so it doesn't read as a wall).
    ctx.fillStyle = "rgba(150, 131, 191, 0.35)";
    ctx.fillRect(dividerX - 2, 0, 4, fullHeight);
    // Stronger top segment where the two HUD panels meet.
    ctx.fillStyle = DIVIDER_GLOW;
    ctx.fillRect(dividerX - 14, dividerTop, 28, dividerHeight);
    ctx.fillStyle = DIVIDER_CORE;
    ctx.fillRect(dividerX - 4, dividerTop + 8, 8, dividerHeight - 14);
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
