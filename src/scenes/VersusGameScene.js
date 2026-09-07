import { Platform } from "../entities/Platform.js";
import { Bullet } from "../entities/Bullet.js";
import { Camera } from "../core/Camera.js";
import { VersusInput } from "../core/VersusInput.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { VersusBotController } from "../ai/VersusBotController.js";
import { VersusCollisionSystem } from "../systems/VersusCollisionSystem.js";
import { VersusRoundManager } from "./VersusRoundManager.js";
import { VersusHUD } from "../ui/VersusHUD.js";
import { MuteButton } from "../ui/MuteButton.js";
import { ObjectPool } from "../utils/pool.js";
import { Background } from "../rendering/Background.js";
import { ParticleEmitter } from "../rendering/ParticleEmitter.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import {
  getVersusMatchMode,
  isVersusBotMatchMode,
  loadSelectedVersusMatchModeKey,
} from "../config/versusMatchMode.js";
import { loadSelectedPlayerCharacterKey } from "../theme/playerRoster.js";
import {
  calculateVersusArenaLayout,
  getVersusArenaDiagnostics,
  VERSUS_PANEL_WORLD_HEIGHT,
  VERSUS_PANEL_WORLD_WIDTH,
} from "./versusArena.js";
import {
  BULLET_LIFETIME_MS,
  BULLET_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLATFORM_FACE_COLOR,
  SKY_BOTTOM,
  VERSUS_GRAVITY,
  VERSUS_JUMP_SPEED,
  VERSUS_KILLS_TO_WIN,
  VERSUS_PLAYER_ACCELERATION,
  VERSUS_PLAYER_FRICTION,
  VERSUS_PLAYER_MAX_SPEED,
  VERSUS_RESPAWN_DELAY_MS,
  createPlayerAnimator,
  emit,
  isDev,
  nowMs,
} from "./versus/versusConfig.js";
import { VersusAssets } from "./versus/versusAssets.js";
import { VersusPlayers } from "./versus/versusPlayers.js";
import { VersusProjectiles } from "./versus/versusProjectiles.js";
import { VersusEffects } from "./versus/versusEffects.js";
import { VersusMatch } from "./versus/versusMatch.js";
import { VersusRenderer } from "./versus/versusRenderer.js";

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

    // M11: instruments — the scene conducts, these play.
    this.assets = new VersusAssets(this);
    this.playersCtl = new VersusPlayers(this);
    this.projectiles = new VersusProjectiles(this);
    this.effects = new VersusEffects(this);
    this.matchCtl = new VersusMatch(this);
    this.renderer = new VersusRenderer(this);

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
    const nextCharacterKey = this.assets.resolvePlayerCharacterKey(payload, game);
    const nextMatchModeKey = this.assets.resolveMatchModeKey(payload, game);
    this.playerCharacterKey = nextCharacterKey;
    this.botCharacterKey = this.assets.resolveBotCharacterKey(nextCharacterKey, nextMatchModeKey);
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

    this.preloadPromise = this.assets.preloadAssets();

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
    this.projectiles.resetBullets();
    this.roundManager?.dispose?.();
    this.roundManager = new VersusRoundManager(game?.eventBus, {
      respawnDelayMs: VERSUS_RESPAWN_DELAY_MS,
    });
    this.roundManager.reset();
    this.matchCtl.syncHudFromRoundManager();
    this.matchCtl.bindEvents(game?.eventBus);
    this.updateCameras(true);
  }

  onExit(game) {
    this.versusInput.detach();
    this.matchCtl.unbindEvents();
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
    this.projectiles.resetBullets();
    this.botController.reset();
  }

  onResize(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.layoutWorld();
    this.playersCtl.applySpawnIfOutOfBounds(this.p1, 0);
    this.playersCtl.applySpawnIfOutOfBounds(this.p2, 1);
    this.updateCameras(true);
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
    this.background.setLayers(this.assets.buildBackgroundLayers());

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
    this.playersCtl.createOrResetPlayers();
  }

  respawnPlayer(index) {
    this.playersCtl.respawnPlayer(index);
  }

  handleRingOut(playerIndex, eventBus) {
    return this.matchCtl.handleRingOut(playerIndex, eventBus);
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
    this.playersCtl.updateHitFlashTimers(dt);
    this.playersCtl.updateSpawnProtection(dt);
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
      this.projectiles.fireBullet(this.p1, 0, game?.eventBus);
    }
    if (this.p2.active !== false && (p2Input.consumePressed("shoot") || p2Input.isPressed("shoot"))) {
      this.projectiles.fireBullet(this.p2, 1, game?.eventBus);
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

    this.playersCtl.stepAnimations(dt, physicsContext);
    this.projectiles.stepBullets(dt, physicsContext);
    this.projectiles.recycleBullets();
    this.matchCtl.applyFallDeaths(game?.eventBus);

    const terminalResult = this.matchCtl.getTerminalResult();
    if (terminalResult) {
      this.matchCtl.finishMatch(game, terminalResult);
      return;
    }

    const readyRespawns = this.roundManager?.update?.(dt) ?? [];
    for (const playerIndex of readyRespawns) {
      this.playersCtl.respawnPlayer(playerIndex);
    }

    this.matchCtl.syncHudFromRoundManager();
    this.updateCameras();
  }

  updateCameras(force = false) {
    void force;
    this.worldCamera.setPosition(0, 0);
  }

  render(ctx, _alpha, game) {
    this.renderer.render(ctx, _alpha, game);
  }

  getDebugLines() {
    return this.renderer.getDebugLines();
  }

  renderDebugOverlay(ctx, game) {
    this.renderer.renderDebugOverlay(ctx, game);
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
