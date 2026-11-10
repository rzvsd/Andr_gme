import { createTowerWorld } from "../tower/towerWorld.js";
import { FLOORS, LADDERS, TOWER, WEAPONS } from "../tower/towerData.js";
import { getHeroDef } from "./versus/versusHeroLayer.js";
import { VersusPauseOverlay } from "../ui/VersusPauseOverlay.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { getPlayerCharacterByKey, loadSelectedPlayerCharacterKey, pickRandomPlayerCharacterKey } from "../theme/playerRoster.js";
import { COLORS, DESIGN_BOX, designBoxTransform, displayFont, textFont, trackingPx, withAlpha } from "../theme/tokens.js";

// The match: one player against the bot in the tower. A round ends with a knockout; the first to
// KILLS_TO_WIN rounds wins. The arena is dark during play. The lights are on for the round intro,
// after a knockout, and when a round runs longer than LIGHTS_ON_AFTER seconds.

const KILLS_TO_WIN = 5;
const INTRO_SECONDS = 1.6;
const LIGHTS_ON_AFTER = 60;
const BOT_MODE = "human-vs-bot";
const TEAM = [COLORS.p1, COLORS.p2];

// Controls and HUD, in the 891 x 411 design box.
const STICK = { x: 106, y: 334, r: 44 };
const BTN_SHOOT = { x: 806, y: 322, r: 34 };
const BTN_JUMP = { x: 730, y: 356, r: 24 };
const BTN_PAUSE = { x: 204, y: 24, r: 14 };
const MAP = { x: 357.5, y: 8, w: 176, h: 78 };
const CENTER_X = DESIGN_BOX.width / 2;

const inCircle = (p, c, pad = 8) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + pad;

export class TowerScene {
  constructor() {
    this.pauseOverlay = new VersusPauseOverlay();
    this.world = null;
    this.keys = new Set();
    this.pointers = new Map();
    this.touch = { stickX: 0, stickY: 0, jump: false, shoot: false };
    this.prev = { jump: false, shoot: false };
    this.paused = false;
    this.exitRequested = false;
    this.settings = loadSettings();
    this.onKeyDown = (event) => {
      if (event.repeat) return;
      // Escape is also the Android Back key: one press pauses, the next resumes.
      if (["Escape", "KeyP", "Backspace"].includes(event.code)) {
        this.setPaused(!this.paused);
        event.preventDefault();
        return;
      }
      this.keys.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
  }

  onEnter(game, transition = {}) {
    const payload = transition?.payload ?? transition ?? {};
    this.game = game;
    this.width = Math.max(1, Number(game?.viewWidth) || 1);
    this.height = Math.max(1, Number(game?.viewHeight) || 1);
    this.playerKey = getPlayerCharacterByKey(
      payload.playerCharacterKey ?? game?.sceneData?.playerCharacterKey ?? loadSelectedPlayerCharacterKey()
    ).key;
    this.botKey = pickRandomPlayerCharacterKey(this.playerKey);
    game.sceneData = {
      ...game.sceneData,
      playerCharacterKey: this.playerKey,
      player2CharacterKey: this.botKey,
      botCharacterKey: this.botKey,
      matchMode: BOT_MODE,
    };
    this.settings = loadSettings();
    game?.audioManager?.setEnabled?.(this.settings.soundEnabled);
    game?.musicManager?.setEnabled?.(this.settings.musicEnabled);

    this.gameInputWasAttached = Boolean(game?.input?.attached);
    if (this.gameInputWasAttached) game.input.detach?.();
    game?.input?.setTouchControlsEnabled?.(false);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.world = createTowerWorld([getHeroDef(this.playerKey), getHeroDef(this.botKey)], (kind, data) => this.onWorldEvent(kind, data));
    this.world.resize(this.width, this.height, game?.dpr ?? 1);
    this.paused = false;
    this.pauseOverlay.hide();
    this.exitRequested = false;
    this.round = 0;
    this.elapsed = 0;
    this.resetInput();
    this.startRound();
  }

  onExit(game) {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.world?.dispose();
    this.world = null;
    this.paused = false;
    this.pauseOverlay.hide();
    if (this.gameInputWasAttached) {
      game?.input?.attach?.();
      this.gameInputWasAttached = false;
    }
    game?.input?.setTouchControlsEnabled?.(true);
    this.game = null;
  }

  onResize(width, height, game) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.world?.resize(this.width, this.height, game?.dpr ?? 1);
  }

  startRound() {
    this.world.resetRound(this.round);
    this.world.setLit(true);
    this.phase = "intro";
    this.phaseT = INTRO_SECONDS;
    this.roundT = 0;
    this.roundEnded = false;
    this.lastWinner = -1;
  }

  onWorldEvent(kind, data) {
    const bus = this.game?.eventBus;
    if (kind === "shot") bus?.emit("bullet_fired", data);
    else if (kind === "hit") bus?.emit("versus:player_hit", data);
    else if (kind === "jump" && data.team === 0) bus?.emit("jump", data);
    else if (kind === "ko") {
      bus?.emit("versus:kill", data);
      this.phase = "ko";
      this.lastWinner = data.winner;
      this.world.setLit(true);
    } else if (kind === "round_end") this.roundEnded = true;
  }

  update(dt, game) {
    if (this.exitRequested) {
      this.exitRequested = false;
      game?.eventBus?.emit("ui_click", { source: "versus_exit" });
      game?.switchScene?.("menu", { from: "versus", playerCharacterKey: this.playerKey, matchMode: BOT_MODE });
      return;
    }
    if (this.paused) {
      this.pauseOverlay.update(dt);
      return;
    }
    this.elapsed += dt;
    if (this.phase === "intro") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = "play";
        this.world.setLit(false);
      }
    } else if (this.phase === "play") {
      this.roundT += dt;
      if (this.roundT >= LIGHTS_ON_AFTER && !this.world.isLit()) this.world.setLit(true);
    }
    this.world.step(dt, this.readInput(), this.phase !== "intro");
    if (this.roundEnded) {
      const { p1, p2 } = this.world;
      if (Math.max(p1.score, p2.score) >= KILLS_TO_WIN) {
        this.finish(game);
      } else {
        this.round += 1;
        this.startRound();
      }
    }
  }

  finish(game) {
    const { p1, p2 } = this.world;
    const winnerIndex = p2.score > p1.score ? 1 : 0;
    const versus = {
      winnerIndex,
      loserIndex: 1 - winnerIndex,
      killsToWin: KILLS_TO_WIN,
      p1Kills: p1.score,
      p2Kills: p2.score,
      p1Deaths: p2.score,
      p2Deaths: p1.score,
      p1Dodges: 0,
      p2Dodges: 0,
      timeSeconds: Math.round(this.elapsed),
    };
    const winnerKills = winnerIndex === 0 ? p1.score : p2.score;
    const stats = {
      ...versus,
      mode: "versus",
      sourceScene: "versus",
      matchMode: BOT_MODE,
      playerCharacterKey: this.playerKey,
      player2CharacterKey: this.botKey,
      botCharacterKey: this.botKey,
      score: winnerKills,
      kills: winnerKills,
      deaths: winnerIndex === 0 ? p2.score : p1.score,
      dodges: 0,
      wave: KILLS_TO_WIN,
      highScore: 0,
    };
    const result = { mode: "versus", sourceScene: "versus", playerCharacterKey: this.playerKey, matchMode: BOT_MODE, stats };
    game.sceneData = { ...game.sceneData, ...result, versusResult: versus };
    game.switchScene("game_over", { ...result, versus });
  }

  // ---------- input ----------
  resetInput() {
    this.keys.clear();
    this.pointers.clear();
    Object.assign(this.touch, { stickX: 0, stickY: 0, jump: false, shoot: false });
  }

  readInput() {
    const { keys, touch, prev } = this;
    const keyX = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    const slow = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const stickX = Math.abs(touch.stickX) > 0.25 ? touch.stickX : 0;
    const jump = keys.has("Space") || touch.jump;
    const shoot = keys.has("KeyF") || keys.has("KeyK") || keys.has("Enter") || touch.shoot;
    const input = {
      moveX: keyX !== 0 ? keyX * (slow ? 0.5 : 1) : stickX,
      up: keys.has("ArrowUp") || keys.has("KeyW") || touch.stickY < -0.6,
      down: keys.has("ArrowDown") || keys.has("KeyS") || touch.stickY > 0.6,
      jumpEdge: jump && !prev.jump,
      shootEdge: shoot && !prev.shoot,
    };
    prev.jump = jump;
    prev.shoot = shoot;
    return input;
  }

  toDesign(pointer) {
    const { scale, offsetX, offsetY } = designBoxTransform(this.width, this.height);
    return { x: (pointer.x - offsetX) / scale, y: (pointer.y - offsetY) / scale };
  }

  moveStick(p) {
    const dx = (p.x - STICK.x) / STICK.r;
    const dy = (p.y - STICK.y) / STICK.r;
    const len = Math.max(1, Math.hypot(dx, dy));
    this.touch.stickX = dx / len;
    this.touch.stickY = dy / len;
  }

  handlePointerDown(pointer) {
    if (this.paused) {
      this.pauseOverlay.handlePointerDown(pointer, this.width, this.height);
      return true;
    }
    const p = this.toDesign(pointer);
    let role = null;
    if (inCircle(p, BTN_SHOOT)) role = "shoot";
    else if (inCircle(p, BTN_JUMP)) role = "jump";
    else if (inCircle(p, BTN_PAUSE, 10)) this.setPaused(true);
    else if (p.x < 330) role = "stick";
    if (!role) return true;
    this.pointers.set(pointer.id, role);
    if (role === "stick") this.moveStick(p);
    else this.touch[role] = true;
    return true;
  }

  handlePointerMove(pointer) {
    if (this.paused) this.pauseOverlay.handlePointerMove(pointer, this.width, this.height);
    else if (this.pointers.get(pointer.id) === "stick") this.moveStick(this.toDesign(pointer));
    return true;
  }

  handlePointerUp(pointer, game) {
    if (this.paused) {
      const tapped = this.pauseOverlay.handlePointerUp(pointer, this.width, this.height);
      if (tapped) this.pressPauseControl(tapped, game);
      return true;
    }
    this.releasePointer(pointer);
    return true;
  }

  handlePointerCancel(pointer) {
    if (this.paused) this.pauseOverlay.handlePointerCancel(pointer);
    else this.releasePointer(pointer);
    return true;
  }

  releasePointer(pointer) {
    const role = this.pointers.get(pointer.id);
    this.pointers.delete(pointer.id);
    if (role === "stick") this.touch.stickX = this.touch.stickY = 0;
    else if (role) this.touch[role] = false;
  }

  // ---------- pause ----------
  setPaused(paused) {
    if (paused === this.paused || !this.world) return;
    this.paused = paused;
    this.resetInput();
    if (paused) {
      this.pauseOverlay.show();
      this.game?.musicManager?.play?.("bgm_pause");
    } else {
      this.pauseOverlay.hide();
      this.game?.musicManager?.play?.("bgm_battle");
    }
  }

  pressPauseControl(id, game) {
    if (id === "resume") {
      game?.eventBus?.emit("ui_click", { source: "pause_resume" });
      this.setPaused(false);
    } else if (id === "quit") {
      this.exitRequested = true;
    } else {
      const { soundEnabled, musicEnabled } = this.settings;
      this.settings = saveSettings({
        soundEnabled: id === "sfx" ? !soundEnabled : soundEnabled,
        musicEnabled: id === "music" ? !musicEnabled : musicEnabled,
      });
      game?.audioManager?.setEnabled?.(this.settings.soundEnabled);
      game?.musicManager?.setEnabled?.(this.settings.musicEnabled);
      game?.eventBus?.emit("ui_click", { source: `pause_${id}` });
    }
  }

  // ---------- drawing ----------
  render(ctx) {
    const world = this.world;
    if (!world) return;
    world.render();
    ctx.drawImage(world.canvas, 0, 0, this.width, this.height);
    this.drawHud(ctx);
    if (this.paused) this.pauseOverlay.render(ctx, this.width, this.height, this.settings);
  }

  drawHud(ctx) {
    const world = this.world;
    const { p1, p2, events, pickups, cam, view } = world;
    const { scale, offsetX, offsetY } = designBoxTransform(this.width, this.height);
    const lit = world.isLit();

    const label = (text, x, y, font, color = COLORS.text, align = "left", caps = 0) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.letterSpacing = `${caps}px`;
      ctx.fillText(text, x, y);
    };
    const pill = (x, y, w, h, fill = COLORS.surface2, stroke = COLORS.line) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    const circleButton = (b, text, pressed) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = pressed ? COLORS.surface2 : withAlpha(COLORS.bg, 0.6);
      ctx.fill();
      ctx.strokeStyle = COLORS.lineStrong;
      ctx.lineWidth = b.r > 30 ? 3 : 1;
      ctx.stroke();
      if (text) label(text, b.x, b.y + 1, textFont(11, 600), COLORS.text, "center", trackingPx(11));
    };
    const scorePill = (f, x, name) => {
      pill(x, 10, 150, 28);
      ctx.fillStyle = TEAM[f.team];
      ctx.beginPath();
      ctx.arc(x + 16, 24, 5, 0, Math.PI * 2);
      ctx.fill();
      label(name, x + 28, 24.5, textFont(12, 600));
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = i < f.hp ? TEAM[f.team] : COLORS.line;
        ctx.fillRect(x + 76 + i * 12, 20, 9, 8);
      }
      label(String(f.score), x + 136, 25, displayFont(16), COLORS.text, "right");
    };

    ctx.save();
    // Sounds as ripples in the world: the bot's are bright, the player's own are faint.
    for (const e of events) {
      if (e.t > 0.8) continue;
      const [sx, sy] = world.toScreen(e.x, e.y);
      const fade = 1 - e.t / 0.8;
      ctx.strokeStyle = withAlpha(e.who === p2 ? COLORS.p2 : COLORS.text, fade * (e.who === p2 ? 0.85 : 0.35));
      ctx.lineWidth = (e.loud ? 2 : 1.2) * scale;
      const r = ((e.loud ? 10 : 4) + e.t * (e.loud ? 46 : 16)) * scale;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, e.kind === "step" || e.kind === "land" ? r * 0.35 : r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The name of a pickup shows with the lights on, or when the player is near it.
    for (const p of pickups) {
      if (p.wait > 0 || this.phase !== "play" || !(lit || (Math.abs(p.x - p1.x) < 7 && Math.abs(p.y - p1.y) < 1.5))) continue;
      const [sx, sy] = world.toScreen(p.x, p.y + 2.2);
      label(WEAPONS[p.weapon].name, sx, sy, textFont(11 * scale, 600), COLORS.muted, "center", trackingPx(11) * scale);
    }

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Mini map: the tower, the own place, and each loud sound of the bot for a moment.
    ctx.beginPath();
    ctx.roundRect(MAP.x, MAP.y, MAP.w, MAP.h, 10);
    ctx.fillStyle = withAlpha(COLORS.bg, 0.92);
    ctx.fill();
    ctx.strokeStyle = COLORS.lineStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    const mx = (x) => MAP.x + 10 + ((x + TOWER.half) / (TOWER.half * 2)) * (MAP.w - 20);
    const my = (y) => MAP.y + MAP.h - 9 - (y / TOWER.top) * (MAP.h - 18);
    ctx.strokeStyle = withAlpha(COLORS.structure, 0.75);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const f of FLOORS) {
      ctx.moveTo(mx(f.x0), my(f.y));
      ctx.lineTo(mx(f.x1), my(f.y));
    }
    ctx.stroke();
    ctx.strokeStyle = withAlpha(COLORS.structure, 0.3);
    ctx.beginPath();
    for (const l of LADDERS) {
      ctx.moveTo(mx(l.x), my(l.y0));
      ctx.lineTo(mx(l.x), my(l.y1));
    }
    ctx.stroke();
    ctx.strokeStyle = withAlpha(COLORS.text, 0.45);
    ctx.strokeRect(mx(cam.x - view.w / 2), my(cam.y + view.h / 2), mx(view.w) - mx(0), my(0) - my(view.h));
    for (const e of events) {
      if (e.who !== p2 || !e.loud) continue;
      ctx.strokeStyle = withAlpha(COLORS.p2, 1 - e.t / 2.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx(e.x), my(e.y) - 2, 2.5 + e.t * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.p1;
    ctx.beginPath();
    ctx.arc(mx(p1.x), my(p1.y) - 2.5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Round clock: the time until the lights come on.
    if (this.phase === "play") {
      const left = Math.max(0, Math.ceil(LIGHTS_ON_AFTER - this.roundT));
      if (lit) label("LIGHTS ON", CENTER_X, 100, textFont(12, 600), COLORS.accent, "center", trackingPx(12));
      else label(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, CENTER_X, 100, textFont(12, 600), COLORS.muted, "center");
    }

    scorePill(p1, 28, "YOU");
    scorePill(p2, DESIGN_BOX.width - 28 - 150, "BOT");
    circleButton(BTN_PAUSE, "", false);
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(BTN_PAUSE.x - 4.5, BTN_PAUSE.y - 5, 3, 10);
    ctx.fillRect(BTN_PAUSE.x + 1.5, BTN_PAUSE.y - 5, 3, 10);

    // Banners.
    if (this.phase === "intro") {
      label(`ROUND ${this.round + 1}`, CENTER_X, 160, displayFont(36), COLORS.text, "center", trackingPx(36));
      if (this.round === 0) {
        label(`FIRST TO ${KILLS_TO_WIN}`, CENTER_X, 192, textFont(13, 600), COLORS.accent, "center", trackingPx(13));
        ["LADDER: STICK UP OR DOWN", "LOCKER: STICK DOWN TO HIDE", "SMALL PUSH: QUIET WALK"].forEach((hint, i) =>
          label(hint, CENTER_X, 226 + i * 18, textFont(11, 600), COLORS.muted, "center", trackingPx(11)));
      }
    } else if (this.phase === "ko") {
      const won = this.lastWinner === 0;
      label(won ? "YOU SCORE" : "BOT SCORES", CENTER_X, 160, displayFont(36), TEAM[won ? 0 : 1], "center", trackingPx(36));
    }

    // Controls.
    const { touch } = this;
    ctx.beginPath();
    ctx.arc(STICK.x, STICK.y, STICK.r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(COLORS.bg, 0.6);
    ctx.fill();
    ctx.strokeStyle = COLORS.lineStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(STICK.x + touch.stickX * 26, STICK.y + touch.stickY * 26, 18, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.surface2;
    ctx.fill();
    ctx.stroke();
    circleButton(BTN_SHOOT, "SHOOT", touch.shoot);
    circleButton(BTN_JUMP, "JUMP", touch.jump);
    // Shots left on the SHOOT ring; a picked-up weapon shows its name and uses.
    const base = p1.weapon === "base";
    const left = base ? p1.shots : p1.uses;
    const total = base ? 3 : WEAPONS[p1.weapon].uses;
    ctx.strokeStyle = base ? COLORS.text : WEAPONS[p1.weapon].color;
    ctx.lineWidth = 3;
    for (let i = 0; i < left; i += 1) {
      const a0 = -Math.PI / 2 + (i / total) * Math.PI * 2 + 0.12;
      ctx.beginPath();
      ctx.arc(BTN_SHOOT.x, BTN_SHOOT.y, BTN_SHOOT.r, a0, a0 + (Math.PI * 2) / total - 0.24);
      ctx.stroke();
    }
    label(WEAPONS[p1.weapon].name, BTN_SHOOT.x, BTN_SHOOT.y - 50, textFont(12, 600), base ? COLORS.muted : WEAPONS[p1.weapon].color, "center", trackingPx(12));
    ctx.restore();
  }
}
