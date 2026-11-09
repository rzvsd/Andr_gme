import { Platform } from "../entities/Platform.js";
import { Bullet } from "../entities/Bullet.js";
import { Camera } from "../core/Camera.js";
import { VersusInput } from "../core/VersusInput.js";
import { PhysicsSystem } from "../systems/PhysicsSystem.js";
import { VersusBotController } from "../ai/VersusBotController.js";
import { VersusCollisionSystem } from "../systems/VersusCollisionSystem.js";
import { VersusRoundManager } from "./VersusRoundManager.js";
import { VersusHUD } from "../ui/VersusHUD.js";
import { PAUSE_HERO_DIM, VersusPauseOverlay } from "../ui/VersusPauseOverlay.js";
import { ObjectPool } from "../utils/pool.js";
import { ParticleEmitter } from "../rendering/ParticleEmitter.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { MOTION } from "../theme/tokens.js";
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
  PLAYER_DRAW_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLATFORM_FILL_COLOR,
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
import { shiftShotClip } from "./versus/versusShots.js";
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
    this.pauseOverlay = new VersusPauseOverlay();
    this.paused = false;
    this.pausedAtMs = 0;
    this.activeGame = null;
    this.muted = false;
    this.mutePointerId = null;
    this.mutePressUntilMs = 0;
    this.settings = loadSettings();
    this.cachedNowMs = 0;
    this.keyBound = false;
    this.exitRequested = false;
    this.matchEnded = false;
    this.roundStartedAtMs = 0;
    this.killsToWin = VERSUS_KILLS_TO_WIN;
    this.gameInputWasAttached = false;
    this.eventOff = [];

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
        // Escape is also the Android Back key (MainActivity dispatches it): one press pauses,
        // the next resumes. Quitting is the pause screen's QUIT TO MENU button.
        if (!event?.repeat) {
          this.setPaused(!this.paused, this.activeGame);
        }
        if (event?.cancelable) {
          event.preventDefault();
        }
      }
    };
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
    this.player2CharacterKey = this.assets.resolvePlayer2CharacterKey(payload, game, nextCharacterKey);
    this.matchModeKey = nextMatchModeKey;
    this.botController.reset();
    game.sceneData = {
      ...game.sceneData,
      playerCharacterKey: nextCharacterKey,
      player2CharacterKey: this.player2CharacterKey,
      botCharacterKey: this.botCharacterKey,
      matchMode: nextMatchModeKey,
    };
    this.settings = loadSettings();
    this.versusHUD.setPlayerLabels([
      getVersusMatchMode(this.matchModeKey).p1Label,
      getVersusMatchMode(this.matchModeKey).p2Label,
    ]);
    this.versusHUD.setKillsToWin(this.killsToWin);
    game?.audioManager?.setEnabled?.(this.settings.soundEnabled);
    game?.musicManager?.setEnabled?.(this.settings.musicEnabled);
    this.muted = !(this.settings.soundEnabled || this.settings.musicEnabled);
    this.mutePressUntilMs = 0;
    this.effects.reset();
    this.renderer.onSceneEnter();

    this.preloadPromise = this.assets.preloadAssets();

    this.versusInput.attach();
    this.versusInput.setShootButton(isVersusBotMatchMode(this.matchModeKey));
    this.activeGame = game;
    this.paused = false;
    this.pauseOverlay.hide();
    this.exitRequested = false;
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
    this.renderer.onSceneExit();
    this.versusInput.detach();
    this.matchCtl.unbindEvents();
    if (this.keyBound && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDown);
      this.keyBound = false;
    }
    this.exitRequested = false;
    this.paused = false;
    this.pauseOverlay.hide();
    this.activeGame = null;
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
        color: PLATFORM_FILL_COLOR,
      }))
    );

    this.spawnPoints[0] = { ...this.layout.spawnPoints[0] };
    this.spawnPoints[1] = { ...this.layout.spawnPoints[1] };

    this.layoutDiagnostics = getVersusArenaDiagnostics(this.layout, {
      bulletSpeed: BULLET_SPEED,
      bulletLifetimeMs: BULLET_LIFETIME_MS,
      jumpSpeed: VERSUS_JUMP_SPEED,
      gravity: VERSUS_GRAVITY,
      playerWidth: PLAYER_WIDTH,
      rigHeight: PLAYER_DRAW_HEIGHT,
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
      platform.kind = next.kind;
    }
    this.platforms.length = layout.length;
  }

  createOrResetPlayers() {
    this.playersCtl.createOrResetPlayers();
  }

  respawnPlayer(index) {
    this.playersCtl.respawnPlayer(index);
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
    if (this.paused) {
      // Only the overlay animates. No simulation step and no cachedNowMs refresh, so hit stop,
      // kill frame and reveal timers hold until play continues.
      this.pauseOverlay.update(dt);
      return;
    }
    if (dt <= 0 || !this.p1 || !this.p2 || this.matchEnded) {
      return;
    }

    this.cachedNowMs = nowMs();

    // The final kill can land inside a kill freeze: the result is checked before the time gate.
    const terminalResult = this.matchCtl.getTerminalResult();
    if (terminalResult) {
      this.matchCtl.finishMatch(game, terminalResult);
      return;
    }

    // Hit stop and kill freeze scale the simulation only. Input keeps its own state between
    // steps and the HUD and mute button never freeze.
    const simDt = dt * this.effects.getTimeScale(this.cachedNowMs);
    if (simDt <= 0) {
      return;
    }
    this.stepSimulation(simDt, game);
  }

  stepSimulation(dt, game) {
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
        platforms: this.platforms,
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
    this.effects.trackLandings(this.cachedNowMs);

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
    // Paused: the WebGL rigs darken with the pause fade (drawFighter leaves entry.dim alone), then
    // the overlay recolours the finished 2D frame, HUD included, and draws the pause screen.
    const dim = this.paused ? 1 - (1 - PAUSE_HERO_DIM) * this.pauseOverlay.fadeAlpha() : 1;
    for (const entry of this.renderer.heroEntries) {
      entry.dim = dim;
    }
    this.renderer.render(ctx, _alpha, game);
    if (this.paused) {
      this.pauseOverlay.render(ctx, this.width, this.height, this.settings);
    }
  }

  getDebugLines() {
    return this.renderer.getDebugLines();
  }

  renderDebugOverlay(ctx, game) {
    this.renderer.renderDebugOverlay(ctx, game);
  }

  // Press feedback for the mute button: held, or within MOTION.pressMs of the press.
  isMutePressed(now) {
    return this.mutePointerId !== null || Number(now) < this.mutePressUntilMs;
  }

  // Pause state. While paused the simulation, its timers and the match clock stand still, the
  // overlay takes every pointer and the music drops to the pause loop. Resume forgets held input
  // so a finger that was holding fire does not shoot when play continues.
  setPaused(paused, game) {
    if (paused === this.paused) {
      return;
    }
    this.paused = paused;
    this.mutePointerId = null;
    if (paused) {
      this.pausedAtMs = nowMs();
      this.pauseOverlay.show();
      game?.musicManager?.play?.("bgm_pause");
      return;
    }
    const pausedForMs = nowMs() - this.pausedAtMs;
    this.roundStartedAtMs += pausedForMs;
    this.effects.shiftTime(pausedForMs);
    this.botController.shiftTime?.(pausedForMs);
    this.players?.forEach((player) => shiftShotClip(player, pausedForMs));
    this.versusInput.reset();
    this.pauseOverlay.hide();
    game?.musicManager?.play?.("bgm_battle");
  }

  // A tap on a pause control. QUIT's click comes from the exit path in update(). A toggle is
  // applied before its click, so turning SFX on clicks and turning it off is silent.
  pressPauseControl(id, game) {
    if (id === "resume") {
      emit(game?.eventBus, "ui_click", { source: "pause_resume" });
      this.setPaused(false, game);
    } else if (id === "quit") {
      this.exitRequested = true;
    } else {
      const { soundEnabled, musicEnabled } = this.settings;
      this.setAudioEnabled(id === "sfx" ? !soundEnabled : soundEnabled, id === "music" ? !musicEnabled : musicEnabled, game);
      emit(game?.eventBus, "ui_click", { source: `pause_${id}` });
    }
  }

  // True once the pause screen has fully faded in: the renderer hides the WebGL rigs then.
  pauseHidesRigs() {
    return this.paused && this.pauseOverlay.fadeAlpha() >= 1;
  }

  // Writes both audio switches, applies them at once and keeps the mute button in step.
  setAudioEnabled(soundEnabled, musicEnabled, game) {
    this.settings = saveSettings({ soundEnabled, musicEnabled });
    game?.audioManager?.setEnabled?.(soundEnabled);
    game?.musicManager?.setEnabled?.(musicEnabled);
    this.muted = !(soundEnabled || musicEnabled);
  }

  // Paused: the pause screen owns every touch; the mute button and the fighters get none.
  handlePointerDown(pointer) {
    if (this.paused) {
      this.pauseOverlay.handlePointerDown(pointer, this.width, this.height);
      return true;
    }
    const pointerId = pointer?.id ?? null;
    if (pointerId !== null && this.versusHUD.muteContains(pointer, this.width, this.height)) {
      this.mutePointerId = pointerId;
      this.mutePressUntilMs = nowMs() + MOTION.pressMs;
      return true;
    }
    return this.versusInput.handlePointerDown(pointer, this.width);
  }

  handlePointerMove(pointer) {
    if (this.paused) {
      this.pauseOverlay.handlePointerMove(pointer, this.width, this.height);
      return true;
    }
    if (this.mutePointerId !== null && pointer?.id === this.mutePointerId) {
      return true;
    }
    return this.versusInput.handlePointerMove(pointer, this.width);
  }

  handlePointerUp(pointer, game) {
    if (this.paused) {
      const tapped = this.pauseOverlay.handlePointerUp(pointer, this.width, this.height);
      if (tapped) {
        this.pressPauseControl(tapped, game);
      }
      return true;
    }
    if (this.mutePointerId !== null && pointer?.id === this.mutePointerId) {
      this.mutePointerId = null;
      if (!this.versusHUD.muteContains(pointer, this.width, this.height)) {
        return true;
      }
      const on = this.muted;
      this.setAudioEnabled(on, on, game);
      emit(game?.eventBus, "ui_click", { source: "mute_toggle", muted: this.muted });
      return true;
    }

    return this.versusInput.handlePointerUp(pointer);
  }

  handlePointerCancel(pointer) {
    if (this.paused) {
      this.pauseOverlay.handlePointerCancel(pointer);
      return true;
    }
    if (this.mutePointerId !== null && pointer?.id === this.mutePointerId) {
      this.mutePointerId = null;
      return true;
    }
    return this.versusInput.handlePointerCancel(pointer);
  }
}
