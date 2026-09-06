import * as ButtonModule from "../ui/Button.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import {
  cycleVersusMatchModeKey,
  getVersusMatchMode,
  loadSelectedVersusMatchModeKey,
  saveSelectedVersusMatchModeKey,
  VERSUS_MATCH_MODE_ROSTER,
} from "../config/versusMatchMode.js";
import { SpriteSheet } from "../rendering/SpriteSheet.js";
import {
  buildPlayerCharacterSheetDataUrl,
  cyclePlayerCharacterKey,
  getPlayerCharacterByKey,
  getPlayerCharacterByIndex,
  getPlayerCharacterIndexByKey,
  loadSelectedPlayerCharacterKey,
  PLAYER_CHARACTER_FRAME_SIZE,
  PLAYER_CHARACTER_ROSTER,
  saveSelectedPlayerCharacterKey,
} from "../theme/playerRoster.js";
import {
  asNumber,
  asPointer,
  rectContains,
  isObject,
  callAny,
  pointerAliases,
} from "./scenePointerUtils.js";

const ButtonClass = ButtonModule.Button;
const PREVIEW_FRAME_SEQUENCE = Object.freeze([0, 1, 2, 1, 3, 1]);
const CARD_COLUMNS = 3;
const CARD_ROWS = 2;

function resolveIntegerSpriteSize(availableSize, maxScale = 3) {
  const limit = Math.max(PLAYER_CHARACTER_FRAME_SIZE, Math.floor(Number(availableSize) || PLAYER_CHARACTER_FRAME_SIZE));
  for (let scale = maxScale; scale >= 1; scale -= 1) {
    const candidate = PLAYER_CHARACTER_FRAME_SIZE * scale;
    if (candidate <= limit) {
      return candidate;
    }
  }
  return PLAYER_CHARACTER_FRAME_SIZE;
}

export class MenuScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.playButton = null;
    this.soundButton = null;
    this.musicButton = null;
    this.prevButton = null;
    this.nextButton = null;
    this.characterButtons = [];
    this.buttons = [];
    this.activePointerId = null;
    this.activeButton = null;
    this.settings = loadSettings();
    this.previewRect = { x: 0, y: 0, width: 0, height: 0 };
    this.matchModeRect = { x: 0, y: 0, width: 0, height: 0 };
    this.selectedCharacterKey = loadSelectedPlayerCharacterKey();
    this.selectedMatchModeKey = loadSelectedVersusMatchModeKey();
    this.previewSheets = new Map();
    this.previewLoadPromise = null;
    this.previewTime = 0;
    this.keyBound = false;
    this.activeGame = null;
    this.modeButtons = [];
    this.onKeyDown = (event) => {
      const code = event?.code;
      if (code === "KeyQ") {
        this.shiftMatchMode(-1);
      } else if (code === "KeyE") {
        this.shiftMatchMode(1);
      } else if (code === "ArrowLeft" || code === "KeyA") {
        this.shiftSelection(-1);
      } else if (code === "ArrowRight" || code === "KeyD") {
        this.shiftSelection(1);
      } else if (code === "Enter" || code === "Space") {
        this.startSelectedCharacter(this.activeGame);
      } else if (/^Digit[1-6]$/.test(code || "")) {
        const index = Number(code.slice(-1)) - 1;
        const character = getPlayerCharacterByIndex(index);
        this.setSelectedCharacter(character?.key);
      } else {
        return;
      }

      if (event?.cancelable) {
        event.preventDefault();
      }
    };
  }

  onEnter(game, transition) {
    this.activeGame = game;
    this.settings = loadSettings();
    const payload = transition?.payload ?? transition ?? {};
    this.selectedCharacterKey = getPlayerCharacterByKey(
      payload?.playerCharacterKey ?? game?.sceneData?.playerCharacterKey ?? loadSelectedPlayerCharacterKey()
    ).key;
    this.selectedMatchModeKey = getVersusMatchMode(
      payload?.matchMode ?? game?.sceneData?.matchMode ?? loadSelectedVersusMatchModeKey()
    ).key;

    this.playButton = this.createButton("START DUEL", () => {
      this.startSelectedCharacter(game);
    });
    this.prevButton = this.createButton("<", () => {
      this.shiftSelection(-1);
      game.eventBus?.emit?.("ui_click", { source: "character_prev" });
    });
    this.nextButton = this.createButton(">", () => {
      this.shiftSelection(1);
      game.eventBus?.emit?.("ui_click", { source: "character_next" });
    });
    this.soundButton = this.createButton("", () => {
      this.settings = saveSettings({
        soundEnabled: !Boolean(this.settings.soundEnabled),
      });
      game.audioManager?.setEnabled?.(this.settings.soundEnabled);
      this.syncSettingsButtons();
      game.eventBus?.emit?.("ui_click", { source: "toggle_sound" });
    });
    this.musicButton = this.createButton("", () => {
      this.settings = saveSettings({
        musicEnabled: !Boolean(this.settings.musicEnabled),
      });
      game.musicManager?.setEnabled?.(this.settings.musicEnabled);
      this.syncSettingsButtons();
      game.eventBus?.emit?.("ui_click", { source: "toggle_music" });
    });
    this.characterButtons = PLAYER_CHARACTER_ROSTER.map((character) => {
      const button = this.createButton(character.name, () => {
        this.setSelectedCharacter(character.key);
        game.eventBus?.emit?.("ui_click", {
          source: "character_select",
          key: character.key,
        });
      });
      button.characterKey = character.key;
      return button;
    });
    this.modeButtons = VERSUS_MATCH_MODE_ROSTER.map((mode) => {
      const button = this.createButton(mode.name, () => {
        this.setSelectedMatchMode(mode.key);
        game.eventBus?.emit?.("ui_click", {
          source: "match_mode_select",
          mode: mode.key,
        });
      });
      button.matchModeKey = mode.key;
      return button;
    });

    this.syncSettingsButtons();
    this.buttons = [
      ...this.modeButtons,
      ...this.characterButtons,
      this.playButton,
      this.prevButton,
      this.nextButton,
      this.soundButton,
      this.musicButton,
    ];
    this.activePointerId = null;
    this.activeButton = null;
    this.previewTime = 0;
    this.ensurePreviewSheets();
    this.onResize(
      asNumber(game?.viewWidth, this.width),
      asNumber(game?.viewHeight, this.height),
      game,
    );

    if (!this.keyBound && typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKeyDown);
      this.keyBound = true;
    }
  }

  onExit() {
    this.activePointerId = null;
    this.activeButton = null;
    this.activeGame = null;
    for (const button of this.buttons) {
      this.setPressed(button, false);
    }
    if (this.keyBound && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDown);
      this.keyBound = false;
    }
  }

  onResize(width, height) {
    this.width = Math.max(1, asNumber(width, 1));
    this.height = Math.max(1, asNumber(height, 1));

    const sideInset = Math.max(18, this.width * 0.04);
    const previewWidth = Math.min(420, Math.max(260, this.width * 0.42));
    const previewHeight = Math.min(240, Math.max(176, this.height * 0.27));
    const previewX = (this.width - previewWidth) * 0.5;
    const previewY = Math.max(92, this.height * 0.16);
    const arrowSize = Math.min(64, Math.max(44, previewHeight * 0.26));
    const arrowY = previewY + (previewHeight - arrowSize) * 0.5;

    this.previewRect = {
      x: Math.round(previewX),
      y: Math.round(previewY),
      width: Math.round(previewWidth),
      height: Math.round(previewHeight),
    };

    this.setButtonRect(this.prevButton, previewX + 14, arrowY, arrowSize, arrowSize);
    this.setButtonRect(this.nextButton, previewX + previewWidth - arrowSize - 14, arrowY, arrowSize, arrowSize);

    const modeGap = Math.max(12, this.width * 0.018);
    const modeWidth = Math.round(Math.min(228, Math.max(118, (this.width - sideInset * 2 - modeGap) / 2)));
    const modeHeight = Math.round(Math.min(58, Math.max(44, this.height * 0.064)));
    const modeTotalWidth = modeWidth * 2 + modeGap;
    const modeX = Math.round((this.width - modeTotalWidth) * 0.5);
    const modeY = Math.round(previewY + previewHeight + Math.max(18, this.height * 0.024));

    this.matchModeRect = {
      x: modeX,
      y: modeY,
      width: modeTotalWidth,
      height: modeHeight,
    };

    for (let index = 0; index < this.modeButtons.length; index += 1) {
      this.setButtonRect(
        this.modeButtons[index],
        modeX + index * (modeWidth + modeGap),
        modeY,
        modeWidth,
        modeHeight,
      );
    }

    const cardGap = Math.max(10, this.width * 0.012);
    const columns = CARD_COLUMNS;
    const rows = CARD_ROWS;
    const cardWidth = Math.round(Math.min(
      156,
      Math.max(88, (this.width - sideInset * 2 - cardGap * (columns - 1)) / columns),
    ));
    const cardHeight = Math.round(Math.min(112, Math.max(84, this.height * 0.12)));
    const gridWidth = Math.round(columns * cardWidth + (columns - 1) * cardGap);
    const gridHeight = Math.round(rows * cardHeight + (rows - 1) * cardGap);
    const gridX = Math.round((this.width - gridWidth) * 0.5);
    const gridY = Math.round(modeY + modeHeight + Math.max(18, this.height * 0.024));

    for (let index = 0; index < this.characterButtons.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.setButtonRect(
        this.characterButtons[index],
        gridX + column * (cardWidth + cardGap),
        gridY + row * (cardHeight + cardGap),
        cardWidth,
        cardHeight,
      );
    }

    const buttonWidth = Math.min(280, Math.max(190, this.width * 0.28));
    const buttonHeight = Math.min(64, Math.max(50, this.height * 0.074));
    const buttonX = (this.width - buttonWidth) * 0.5;
    const buttonY = gridY + gridHeight + Math.max(18, this.height * 0.026);
    const settingsWidth = Math.min(220, Math.max(150, this.width * 0.22));
    const settingsHeight = Math.min(54, Math.max(42, this.height * 0.058));
    const settingsY = buttonY + buttonHeight + Math.max(12, this.height * 0.02);
    const settingsGap = Math.max(12, this.width * 0.02);

    this.setButtonRect(this.playButton, buttonX, buttonY, buttonWidth, buttonHeight);
    if (this.width >= 560) {
      const total = settingsWidth * 2 + settingsGap;
      const leftX = (this.width - total) * 0.5;
      this.setButtonRect(this.soundButton, leftX, settingsY, settingsWidth, settingsHeight);
      this.setButtonRect(this.musicButton, leftX + settingsWidth + settingsGap, settingsY, settingsWidth, settingsHeight);
    } else {
      const settingsX = (this.width - settingsWidth) * 0.5;
      this.setButtonRect(this.soundButton, settingsX, settingsY, settingsWidth, settingsHeight);
      this.setButtonRect(
        this.musicButton,
        settingsX,
        settingsY + settingsHeight + Math.max(10, this.height * 0.015),
        settingsWidth,
        settingsHeight,
      );
    }
  }

  update(dt, game) {
    this.previewTime += Math.max(0, Number(dt) || 0);
    for (const button of this.buttons) {
      callAny(button, ["update"], [[dt, game], [dt], []]);
    }
  }

  render(ctx) {
    ctx.save();

    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#13263f");
    gradient.addColorStop(0.58, "#10243a");
    gradient.addColorStop(1, "#08131f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    const glow = ctx.createRadialGradient(this.width * 0.5, this.height * 0.26, 20, this.width * 0.5, this.height * 0.26, this.width * 0.4);
    glow.addColorStop(0, "rgba(222, 244, 180, 0.16)");
    glow.addColorStop(1, "rgba(222, 244, 180, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f8fbff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 54px Arial";
    ctx.fillText("BULLET DODGE ARENA", this.width * 0.5, Math.max(48, this.height * 0.09));

    ctx.font = "400 20px Arial";
    ctx.fillStyle = "#b9cbe8";
    ctx.fillText("Pick duel mode + ninja, then start", this.width * 0.5, Math.max(84, this.height * 0.135));

    this.renderPreviewPanel(ctx);
    this.renderMatchModeSelector(ctx);
    this.renderRosterCards(ctx);

    this.renderButton(ctx, this.prevButton);
    this.renderButton(ctx, this.nextButton);
    this.renderButton(ctx, this.playButton);
    this.renderButton(ctx, this.soundButton);
    this.renderButton(ctx, this.musicButton);

    // M4: controls hint so versus is instantly playable without a tutorial screen.
    ctx.fillStyle = "rgba(185, 203, 232, 0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const hintSize = this.width < 560 ? 13 : 15;
    ctx.font = `400 ${hintSize}px Arial`;
    const hintY = Math.min(this.height - 14, this.soundButton?.y + this.soundButton?.height + 26 || this.height - 14);
    if (hintY > this.height * 0.5) {
      ctx.fillText(
        "P1: A/D move · W jump · J shoot    |    P2: ←/→ move · ↑ jump · L shoot    |    Touch: drag move · swipe up jump · tap/hold shoot",
        this.width * 0.5,
        hintY,
        Math.max(0, this.width - 24),
      );
    }

    ctx.restore();
  }

  renderPreviewPanel(ctx) {
    const selected = getPlayerCharacterByKey(this.selectedCharacterKey);
    const previewRect = this.previewRect;
    const selectedIndex = getPlayerCharacterIndexByKey(selected.key);
    const cardLabelY = previewRect.y + previewRect.height - 52;
    const shadowSize = Math.max(26, previewRect.width * 0.15);
    const spriteSize = resolveIntegerSpriteSize(Math.min(previewRect.height * 0.58, 168), 2);
    const bob = Math.sin(this.previewTime * 2.4) * 4;
    const frame = PREVIEW_FRAME_SEQUENCE[Math.floor(this.previewTime * 6) % PREVIEW_FRAME_SEQUENCE.length];
    const spriteX = Math.round(previewRect.x + previewRect.width * 0.5 - spriteSize * 0.5);
    const spriteY = Math.round(previewRect.y + 18 + bob);
    const shadowY = Math.round(previewRect.y + previewRect.height - 68);

    ctx.save();
    ctx.fillStyle = "rgba(7, 18, 29, 0.58)";
    ctx.strokeStyle = "rgba(220, 239, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.fillRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
    ctx.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(previewRect.x + 12, previewRect.y + 12, previewRect.width - 24, 16);

    ctx.fillStyle = "rgba(17, 27, 21, 0.34)";
    ctx.beginPath();
    ctx.ellipse(previewRect.x + previewRect.width * 0.5, shadowY, shadowSize, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const previewSheet = this.previewSheets.get(selected.key);
    const drewSheet = previewSheet?.isReady?.() && previewSheet.drawFrame(ctx, spriteX, spriteY, frame, spriteSize, spriteSize);
    if (!drewSheet) {
      this.renderPreviewFallback(ctx, selected, spriteX, spriteY, spriteSize);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Arial";
    ctx.fillText(selected.name, this.width * 0.5, cardLabelY + 12);

    ctx.fillStyle = "#c8d8f5";
    ctx.font = "600 15px Arial";
    ctx.fillText(
      `${selectedIndex + 1} / ${PLAYER_CHARACTER_ROSTER.length}  •  ${selected.goggles.toUpperCase()} GOGGLES`,
      this.width * 0.5,
      cardLabelY + 40,
    );
    ctx.restore();
  }

  renderPreviewFallback(ctx, character, x, y, size) {
    // M8: ninja fallback matching the roster sheets + in-game procedural fighter.
    const centerX = x + size * 0.5;
    const headY = y + size * 0.34;
    const headR = size * 0.17;
    ctx.save();
    ctx.fillStyle = character.bodyBottom;
    ctx.beginPath();
    ctx.arc(centerX, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = character.bodyTop;
    ctx.beginPath();
    ctx.arc(centerX, headY - headR * 0.25, headR * 0.95, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#202826";
    ctx.fillRect(centerX - headR * 0.75, headY - headR * 0.15, headR * 1.5, headR * 0.5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(centerX + headR * 0.1, headY - headR * 0.08, headR * 0.45, headR * 0.32);
    ctx.strokeStyle = character.leaf;
    ctx.lineWidth = Math.max(2, size * 0.03);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(centerX - headR * 0.9, headY - headR * 0.55);
    ctx.lineTo(centerX + headR * 0.9, headY - headR * 0.55);
    ctx.moveTo(centerX - headR * 0.8, headY - headR * 0.5);
    ctx.lineTo(centerX - headR * 1.5, headY - headR * 0.1);
    ctx.stroke();
    ctx.fillStyle = character.bodyTop;
    ctx.beginPath();
    ctx.moveTo(centerX - headR * 0.85, headY + headR * 0.7);
    ctx.lineTo(centerX + headR * 0.85, headY + headR * 0.7);
    ctx.lineTo(centerX + headR * 0.6, headY + headR * 1.9);
    ctx.lineTo(centerX - headR * 0.6, headY + headR * 1.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderMatchModeSelector(ctx) {
    const selectedMode = getVersusMatchMode(this.selectedMatchModeKey);
    const rect = this.matchModeRect;
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "700 14px Arial";
    ctx.fillStyle = "#d7e4f7";
    ctx.fillText("MATCH MODE", this.width * 0.5, rect.y - 12);

    for (const button of this.modeButtons) {
      this.renderMatchModeButton(ctx, button);
    }

    ctx.font = "600 13px Arial";
    ctx.fillStyle = "#bfd0eb";
    ctx.fillText(selectedMode.description, this.width * 0.5, rect.y + rect.height + 20);
    ctx.restore();
  }

  renderMatchModeButton(ctx, button) {
    const rect = this.getButtonRect(button);
    const meta = isObject(button.__sceneButton) ? button.__sceneButton : null;
    const pressed = Boolean(meta?.pressed);
    const selected = button.matchModeKey === this.selectedMatchModeKey;
    const mode = getVersusMatchMode(button.matchModeKey);

    ctx.save();
    ctx.fillStyle = selected ? "rgba(88, 129, 58, 0.34)" : "rgba(16, 28, 46, 0.78)";
    ctx.strokeStyle = selected ? "#dff6a4" : pressed ? "#dbe6ff" : "rgba(194, 212, 240, 0.36)";
    ctx.lineWidth = selected ? 3 : 2;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f7fbff";
    ctx.font = "700 16px Arial";
    ctx.fillText(mode.name.toUpperCase(), rect.x + rect.width * 0.5, rect.y + rect.height * 0.44);
    ctx.fillStyle = "#bfd0eb";
    ctx.font = "600 12px Arial";
    ctx.fillText(mode.shortLabel, rect.x + rect.width * 0.5, rect.y + rect.height * 0.72);
    ctx.restore();
  }

  renderRosterCards(ctx) {
    for (let index = 0; index < this.characterButtons.length; index += 1) {
      const button = this.characterButtons[index];
      const character = getPlayerCharacterByKey(button.characterKey);
      const rect = this.getButtonRect(button);
      const pressed = Boolean(button?.__sceneButton?.pressed);
      const selected = character.key === this.selectedCharacterKey;
      const previewSheet = this.previewSheets.get(character.key);
      const spriteSize = resolveIntegerSpriteSize(Math.min(rect.height * 0.62, rect.width * 0.56), 1);
      const spriteX = Math.round(rect.x + 10);
      const spriteY = Math.round(rect.y + rect.height * 0.5 - spriteSize * 0.5 - 8);
      const frame = selected ? 1 : 0;

      ctx.save();
      ctx.fillStyle = selected ? "rgba(102, 161, 74, 0.30)" : "rgba(16, 28, 46, 0.78)";
      ctx.strokeStyle = selected ? "#dff6a4" : pressed ? "#dbe6ff" : "rgba(194, 212, 240, 0.36)";
      ctx.lineWidth = selected ? 3 : 2;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

      if (previewSheet?.isReady?.()) {
        previewSheet.drawFrame(ctx, spriteX, spriteY, frame, spriteSize, spriteSize);
      } else {
        this.renderPreviewFallback(ctx, character, spriteX, spriteY, spriteSize);
      }

      ctx.fillStyle = "#f7fbff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "700 16px Arial";
      ctx.fillText(character.name.split(" ")[0].toUpperCase(), rect.x + spriteSize + 18, rect.y + rect.height * 0.44);
      ctx.fillStyle = "#bfd0eb";
      ctx.font = "600 12px Arial";
      ctx.fillText(`${character.goggles.toUpperCase()} GOGGLES`, rect.x + spriteSize + 18, rect.y + rect.height * 0.68);
      ctx.restore();
    }
  }

  handlePointerDown(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }

    const routed = this.routePointer("handlePointerDown", point, game);
    if (routed) {
      return true;
    }

    const button = this.findButtonAt(point);
    if (!button) {
      return false;
    }

    this.activePointerId = point.id;
    this.activeButton = button;
    this.setPressed(button, true);
    return true;
  }

  handlePointerMove(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }

    const routed = this.routePointer("handlePointerMove", point, game);
    if (routed) {
      return true;
    }

    if (this.activePointerId !== point.id || !this.activeButton) {
      return false;
    }

    const inside = rectContains(this.getButtonRect(this.activeButton), point);
    this.setPressed(this.activeButton, inside);
    return true;
  }

  handlePointerUp(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }

    const routed = this.routePointer("handlePointerUp", point, game);
    if (routed) {
      return true;
    }

    if (this.activePointerId !== point.id || !this.activeButton) {
      return false;
    }

    const button = this.activeButton;
    const inside = rectContains(this.getButtonRect(button), point);
    this.setPressed(button, false);
    this.activePointerId = null;
    this.activeButton = null;

    if (!inside) {
      return true;
    }

    this.pressButton(button, game);
    return true;
  }

  handlePointerCancel(pointer, game) {
    const point = asPointer(pointer);
    const routed = point ? this.routePointer("handlePointerCancel", point, game) : false;
    if (routed) {
      return true;
    }

    if (this.activeButton) {
      this.setPressed(this.activeButton, false);
      this.activeButton = null;
      this.activePointerId = null;
      return true;
    }

    return false;
  }

  ensurePreviewSheets() {
    if (this.previewLoadPromise) {
      return this.previewLoadPromise;
    }

    this.previewLoadPromise = Promise.all(
      PLAYER_CHARACTER_ROSTER.map(async (character) => {
        let sheet = this.previewSheets.get(character.key);
        if (!sheet) {
          sheet = new SpriteSheet(buildPlayerCharacterSheetDataUrl(character.key), {
            frameWidth: 64,
            frameHeight: 64,
            columns: 4,
            rows: 1,
            fallbackColor: character.bodyBottom,
          });
          this.previewSheets.set(character.key, sheet);
        }

        try {
          await sheet.load();
        } catch {
          // Keep menu usable with fallback art.
        }
      }),
    ).finally(() => {
      this.previewLoadPromise = null;
    });

    return this.previewLoadPromise;
  }

  startSelectedCharacter(game) {
    const targetGame = game ?? this.activeGame;
    if (!targetGame) {
      return;
    }

    const selectedKey = saveSelectedPlayerCharacterKey(this.selectedCharacterKey);
    const selectedMatchModeKey = saveSelectedVersusMatchModeKey(this.selectedMatchModeKey);
    targetGame.sceneData = {
      ...targetGame.sceneData,
      playerCharacterKey: selectedKey,
      matchMode: selectedMatchModeKey,
    };
    targetGame.eventBus?.emit?.("ui_click", {
      source: "start_game",
      key: selectedKey,
      matchMode: selectedMatchModeKey,
    });
    targetGame.switchScene("versus", {
      restart: true,
      playerCharacterKey: selectedKey,
      matchMode: selectedMatchModeKey,
    });
  }

  shiftMatchMode(direction) {
    this.selectedMatchModeKey = cycleVersusMatchModeKey(this.selectedMatchModeKey, direction);
  }

  shiftSelection(direction) {
    this.selectedCharacterKey = cyclePlayerCharacterKey(this.selectedCharacterKey, direction);
  }

  setSelectedCharacter(key) {
    this.selectedCharacterKey = getPlayerCharacterByKey(key).key;
  }

  setSelectedMatchMode(key) {
    this.selectedMatchModeKey = getVersusMatchMode(key).key;
  }

  createButton(label, onPress) {
    let button = null;
    const options = {
      label,
      text: label,
      onPress,
      onTap: onPress,
      onClick: onPress,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    if (typeof ButtonClass === "function") {
      const factories = [
        () => new ButtonClass(options),
        () => new ButtonClass(label, 0, 0, 0, 0, onPress),
        () => new ButtonClass(0, 0, 0, 0, label, onPress),
      ];

      for (const create of factories) {
        try {
          button = create();
          break;
        } catch {
          // Try the next constructor signature.
        }
      }
    }

    if (!isObject(button)) {
      button = {};
    }

    button.__sceneButton = {
      label,
      onPress,
      pressed: false,
      rect: { x: 0, y: 0, width: 0, height: 0 },
    };

    return button;
  }

  syncSettingsButtons() {
    const soundLabel = this.settings.soundEnabled ? "SFX: ON" : "SFX: OFF";
    const musicLabel = this.settings.musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
    this.setButtonLabel(this.soundButton, soundLabel);
    this.setButtonLabel(this.musicButton, musicLabel);
  }

  setButtonLabel(button, label) {
    if (!isObject(button)) {
      return;
    }
    if (isObject(button.__sceneButton)) {
      button.__sceneButton.label = label;
    }
    if ("label" in button) {
      button.label = label;
    }
    if ("text" in button) {
      button.text = label;
    }
    callAny(button, ["setLabel", "setText"], [[label]]);
  }

  setButtonRect(button, x, y, width, height) {
    if (!isObject(button)) {
      return;
    }

    const rect = {
      x: asNumber(x, 0),
      y: asNumber(y, 0),
      width: Math.max(0, asNumber(width, 0)),
      height: Math.max(0, asNumber(height, 0)),
    };

    callAny(button, ["setBounds", "setRect", "setFrame"], [[rect.x, rect.y, rect.width, rect.height], [rect]]);
    callAny(button, ["setPosition"], [[rect.x, rect.y]]);
    callAny(button, ["setSize", "resize"], [[rect.width, rect.height]]);

    if ("x" in button) {
      button.x = rect.x;
    }
    if ("y" in button) {
      button.y = rect.y;
    }
    if ("width" in button) {
      button.width = rect.width;
    }
    if ("height" in button) {
      button.height = rect.height;
    }
    if (isObject(button.bounds)) {
      button.bounds.x = rect.x;
      button.bounds.y = rect.y;
      button.bounds.width = rect.width;
      button.bounds.height = rect.height;
    }
    if (isObject(button.__sceneButton)) {
      button.__sceneButton.rect = rect;
    }
  }

  getButtonRect(button) {
    if (!isObject(button)) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    if (isObject(button.bounds)) {
      return {
        x: asNumber(button.bounds.x, 0),
        y: asNumber(button.bounds.y, 0),
        width: Math.max(0, asNumber(button.bounds.width, 0)),
        height: Math.max(0, asNumber(button.bounds.height, 0)),
      };
    }

    if (isObject(button.__sceneButton) && isObject(button.__sceneButton.rect)) {
      return button.__sceneButton.rect;
    }

    return {
      x: asNumber(button.x, 0),
      y: asNumber(button.y, 0),
      width: Math.max(0, asNumber(button.width, 0)),
      height: Math.max(0, asNumber(button.height, 0)),
    };
  }

  setPressed(button, pressed) {
    if (!isObject(button)) {
      return;
    }

    callAny(button, ["setPressed", "setDown", "setActive"], [[pressed]]);

    if ("pressed" in button) {
      button.pressed = pressed;
    }
    if (isObject(button.__sceneButton)) {
      button.__sceneButton.pressed = pressed;
    }
  }

  findButtonAt(pointer) {
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const button = this.buttons[i];
      if (rectContains(this.getButtonRect(button), pointer)) {
        return button;
      }
    }
    return null;
  }

  pressButton(button, game) {
    const result = callAny(button, ["press", "trigger", "click", "onPress", "onTap", "onClick"], [[game], []]);
    if (result.called) {
      return;
    }

    if (isObject(button.__sceneButton) && typeof button.__sceneButton.onPress === "function") {
      button.__sceneButton.onPress(game);
    }
  }

  renderButton(ctx, button) {
    const result = callAny(button, ["render", "draw"], [[ctx, this], [ctx]]);
    if (result.called) {
      return;
    }

    const rect = this.getButtonRect(button);
    const meta = isObject(button.__sceneButton) ? button.__sceneButton : null;
    const pressed = Boolean(meta?.pressed);

    ctx.save();
    ctx.fillStyle = pressed ? "#2f65d4" : "#3d7ef2";
    ctx.strokeStyle = "#dbe6ff";
    ctx.lineWidth = 2;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 24px Arial";
    ctx.fillText(meta?.label ?? "Button", rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
    ctx.restore();
  }

  routePointer(methodName, pointer, game) {
    const names = pointerAliases(methodName);

    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const button = this.buttons[i];
      const result = callAny(
        button,
        names,
        [[pointer, game], [pointer], [pointer.x, pointer.y, pointer.id]],
      );
      if (result.called && Boolean(result.value)) {
        return true;
      }
    }

    return false;
  }
}
