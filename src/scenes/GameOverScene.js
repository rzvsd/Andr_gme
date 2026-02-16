import * as ButtonModule from "../ui/Button.js";
import * as ScoreBoardModule from "../ui/ScoreBoard.js";
import {
  asNumber,
  isObject,
  asPointer,
  rectContains,
  callAny,
  pointerAliases,
} from "./scenePointerUtils.js";

const ButtonClass = ButtonModule.Button;
const ScoreBoardClass = ScoreBoardModule.ScoreBoard;
const MODE_VERSUS = "versus";

const normalizeMode = (value) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

function copyObject(target, value) {
  if (!isObject(value)) {
    return target;
  }

  for (const [key, val] of Object.entries(value)) {
    target[key] = val;
  }
  return target;
}

function normalizeStats(raw) {
  const score = asNumber(raw.score, asNumber(raw.finalScore, asNumber(raw.points, 0)));
  const kills = asNumber(raw.kills, asNumber(raw.enemiesKilled, 0));
  const dodges = asNumber(raw.dodges, asNumber(raw.bulletsDodged, 0));
  const wave = asNumber(
    raw.wave,
    asNumber(
      raw.currentWave,
      asNumber(raw.waves, asNumber(raw.waveNumber, asNumber(raw.lastWave, 0))),
    ),
  );
  const deaths = asNumber(raw.deaths, asNumber(raw.playerDeaths, 0));
  const highScore = asNumber(raw.highScore, asNumber(raw.bestScore, 0));
  const timeSeconds = asNumber(raw.timeSeconds, asNumber(raw.durationSeconds, asNumber(raw.time, 0)));

  return {
    score: Math.max(0, Math.round(score)),
    kills: Math.max(0, Math.round(kills)),
    dodges: Math.max(0, Math.round(dodges)),
    wave: Math.max(0, Math.round(wave)),
    deaths: Math.max(0, Math.round(deaths)),
    highScore: Math.max(0, Math.round(highScore)),
    timeSeconds: Math.max(0, Math.round(timeSeconds)),
  };
}

function collectMergedData(game, transition) {
  const merged = {};
  copyObject(merged, game?.sceneData);
  copyObject(merged, game?.sceneData?.stats);

  const payload = isObject(transition?.payload) ? transition.payload : transition;
  copyObject(merged, payload);
  copyObject(merged, payload?.stats);
  copyObject(merged, payload?.data);
  copyObject(merged, payload?.event);

  return merged;
}

function collectStats(game, transition) {
  return normalizeStats(collectMergedData(game, transition));
}

function collectResultMeta(game, transition) {
  const payload = isObject(transition?.payload) ? transition.payload : transition;
  const payloadStats = isObject(payload?.stats) ? payload.stats : null;
  const payloadData = isObject(payload?.data) ? payload.data : null;
  const payloadEvent = isObject(payload?.event) ? payload.event : null;
  const merged = collectMergedData(game, transition);

  const versusCandidates = [
    payload?.versus,
    payload?.versusResult,
    payloadStats?.versus,
    payloadStats?.versusResult,
    payloadData?.versus,
    payloadData?.versusResult,
    payloadEvent?.versus,
    payloadEvent?.versusResult,
  ];
  let versus = null;
  for (const candidate of versusCandidates) {
    if (isObject(candidate)) {
      versus = candidate;
      break;
    }
  }

  const modeCandidates = [
    normalizeMode(payload?.mode),
    normalizeMode(payload?.sourceMode),
    normalizeMode(payload?.sourceScene),
    normalizeMode(payload?.from),
    normalizeMode(payloadStats?.mode),
    normalizeMode(payloadStats?.sourceMode),
    normalizeMode(payloadStats?.sourceScene),
    normalizeMode(payloadData?.mode),
    normalizeMode(payloadEvent?.mode),
    normalizeMode(transition?.from),
  ];
  const isVersus = modeCandidates.includes(MODE_VERSUS) || isObject(versus);

  const winnerIndex = Math.round(asNumber(versus?.winnerIndex, asNumber(merged.winnerIndex, -1)));
  const loserIndex = Math.round(asNumber(versus?.loserIndex, asNumber(merged.loserIndex, -1)));
  const rawKillsToWin = asNumber(versus?.killsToWin, asNumber(merged.killsToWin, -1));

  return {
    isVersus,
    mode: isVersus ? MODE_VERSUS : "game",
    winnerIndex: winnerIndex >= 0 ? winnerIndex : -1,
    loserIndex: loserIndex >= 0 ? loserIndex : -1,
    killsToWin: rawKillsToWin >= 1 ? Math.round(rawKillsToWin) : null,
    p1Kills: Math.max(0, Math.round(asNumber(versus?.p1Kills, asNumber(merged.p1Kills, 0)))),
    p2Kills: Math.max(0, Math.round(asNumber(versus?.p2Kills, asNumber(merged.p2Kills, 0)))),
    p1Deaths: Math.max(0, Math.round(asNumber(versus?.p1Deaths, asNumber(merged.p1Deaths, 0)))),
    p2Deaths: Math.max(0, Math.round(asNumber(versus?.p2Deaths, asNumber(merged.p2Deaths, 0)))),
  };
}

export class GameOverScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.buttons = [];
    this.retryButton = null;
    this.menuButton = null;
    this.scoreBoard = null;
    this.stats = normalizeStats({});
    this.resultMeta = collectResultMeta({}, {});
    this.titleText = "GAME OVER";
    this.subtitleText = "";
    this.scoreBoardRect = { x: 0, y: 0, width: 0, height: 0 };
    this.activePointerId = null;
    this.activeButton = null;
  }

  onEnter(game, transition) {
    this.stats = collectStats(game, transition);
    this.resultMeta = collectResultMeta(game, transition);
    this.titleText = this.resultMeta.isVersus ? "VERSUS RESULT" : "GAME OVER";
    this.subtitleText = this.resultMeta.isVersus ? this.getVersusSubtitle() : "";

    this.retryButton = this.createButton("Retry", () => {
      if (this.resultMeta.isVersus) {
        game.switchScene("versus", { restart: true });
        return;
      }
      game.switchScene("game", { restart: true });
    });
    this.menuButton = this.createButton("Menu", () => {
      game.switchScene("menu");
    });
    this.buttons = [this.retryButton, this.menuButton];
    this.scoreBoard = this.createScoreBoard(this.stats);
    this.activePointerId = null;
    this.activeButton = null;

    this.onResize(
      asNumber(game?.viewWidth, this.width),
      asNumber(game?.viewHeight, this.height),
      game,
    );
  }

  onExit(game, transition) {
    this.activePointerId = null;
    this.activeButton = null;
    for (const button of this.buttons) {
      this.setPressed(button, false);
    }
  }

  onResize(width, height, game) {
    this.width = Math.max(1, asNumber(width, 1));
    this.height = Math.max(1, asNumber(height, 1));

    const boardWidth = Math.min(620, Math.max(280, this.width * 0.7));
    const boardHeight = Math.min(300, Math.max(180, this.height * 0.34));
    const boardX = (this.width - boardWidth) * 0.5;
    const boardY = this.height * 0.24;
    this.setScoreBoardRect(boardX, boardY, boardWidth, boardHeight);

    const buttonWidth = Math.min(240, Math.max(150, this.width * 0.24));
    const buttonHeight = Math.min(66, Math.max(48, this.height * 0.075));
    const top = boardY + boardHeight + Math.max(16, this.height * 0.03);

    if (this.width >= 560) {
      const gap = Math.max(16, this.width * 0.03);
      const total = buttonWidth * 2 + gap;
      const left = (this.width - total) * 0.5;
      this.setButtonRect(this.retryButton, left, top, buttonWidth, buttonHeight);
      this.setButtonRect(this.menuButton, left + buttonWidth + gap, top, buttonWidth, buttonHeight);
    } else {
      const x = (this.width - buttonWidth) * 0.5;
      const gap = Math.max(12, this.height * 0.018);
      this.setButtonRect(this.retryButton, x, top, buttonWidth, buttonHeight);
      this.setButtonRect(this.menuButton, x, top + buttonHeight + gap, buttonWidth, buttonHeight);
    }
  }

  update(dt, game) {
    for (const button of this.buttons) {
      callAny(button, ["update"], [[dt, game], [dt], []]);
    }
    callAny(this.scoreBoard, ["update"], [[dt, game], [dt], []]);
  }

  render(ctx, alpha, game) {
    ctx.save();

    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#311116");
    gradient.addColorStop(1, "#12070a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#ffd7d7";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 52px Arial";
    ctx.fillText(this.titleText, this.width * 0.5, this.height * 0.13);

    if (this.subtitleText) {
      ctx.fillStyle = "#ffd7d7";
      ctx.font = "600 24px Arial";
      ctx.fillText(this.subtitleText, this.width * 0.5, this.height * 0.18);
    }

    this.renderScoreBoard(ctx, game);

    for (const button of this.buttons) {
      this.renderButton(ctx, button);
    }

    ctx.restore();
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
          // Try next signature.
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

  createScoreBoard(stats) {
    let board = null;

    if (typeof ScoreBoardClass === "function") {
      const factories = [
        () => new ScoreBoardClass({ stats }),
        () => new ScoreBoardClass(stats),
        () => new ScoreBoardClass(),
      ];

      for (const create of factories) {
        try {
          board = create();
          break;
        } catch {
          // Try the next constructor.
        }
      }
    }

    if (!isObject(board)) {
      board = {};
    }

    board.__sceneRect = { x: 0, y: 0, width: 0, height: 0 };
    this.applyScoreBoardStats(board, stats);
    return board;
  }

  applyScoreBoardStats(board, stats) {
    callAny(board, ["setStats", "setData", "setScoreData", "setResult"], [[stats]]);
    if (isObject(board)) {
      board.stats = stats;
      board.data = stats;
    }
  }

  setScoreBoardRect(x, y, width, height) {
    this.scoreBoardRect = {
      x: asNumber(x, 0),
      y: asNumber(y, 0),
      width: Math.max(0, asNumber(width, 0)),
      height: Math.max(0, asNumber(height, 0)),
    };

    callAny(
      this.scoreBoard,
      ["setBounds", "setRect", "setFrame"],
      [[this.scoreBoardRect.x, this.scoreBoardRect.y, this.scoreBoardRect.width, this.scoreBoardRect.height], [this.scoreBoardRect]],
    );
    callAny(this.scoreBoard, ["setPosition"], [[this.scoreBoardRect.x, this.scoreBoardRect.y]]);
    callAny(this.scoreBoard, ["setSize", "resize"], [[this.scoreBoardRect.width, this.scoreBoardRect.height]]);

    if (isObject(this.scoreBoard)) {
      if ("x" in this.scoreBoard) {
        this.scoreBoard.x = this.scoreBoardRect.x;
      }
      if ("y" in this.scoreBoard) {
        this.scoreBoard.y = this.scoreBoardRect.y;
      }
      if ("width" in this.scoreBoard) {
        this.scoreBoard.width = this.scoreBoardRect.width;
      }
      if ("height" in this.scoreBoard) {
        this.scoreBoard.height = this.scoreBoardRect.height;
      }
      if (isObject(this.scoreBoard.bounds)) {
        this.scoreBoard.bounds.x = this.scoreBoardRect.x;
        this.scoreBoard.bounds.y = this.scoreBoardRect.y;
        this.scoreBoard.bounds.width = this.scoreBoardRect.width;
        this.scoreBoard.bounds.height = this.scoreBoardRect.height;
      }
      if (isObject(this.scoreBoard.__sceneRect)) {
        this.scoreBoard.__sceneRect.x = this.scoreBoardRect.x;
        this.scoreBoard.__sceneRect.y = this.scoreBoardRect.y;
        this.scoreBoard.__sceneRect.width = this.scoreBoardRect.width;
        this.scoreBoard.__sceneRect.height = this.scoreBoardRect.height;
      }
    }
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
    ctx.fillStyle = pressed ? "#963434" : "#ba4343";
    ctx.strokeStyle = "#ffd9d9";
    ctx.lineWidth = 2;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 22px Arial";
    ctx.fillText(meta?.label ?? "Button", rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
    ctx.restore();
  }

  renderScoreBoard(ctx, game) {
    const custom = callAny(this.scoreBoard, ["render", "draw"], [[ctx, this.stats, game], [ctx, this.stats], [ctx]]);
    if (custom.called) {
      return;
    }

    const rect = this.scoreBoardRect;
    const lineHeight = 34;
    const startX = rect.x + Math.max(20, rect.width * 0.08);
    const valueX = rect.x + rect.width - Math.max(20, rect.width * 0.08);
    const startY = rect.y + Math.max(34, rect.height * 0.2);

    ctx.save();
    ctx.fillStyle = "rgba(40, 12, 16, 0.9)";
    ctx.strokeStyle = "#dc9ca0";
    ctx.lineWidth = 2;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    ctx.fillStyle = "#ffe9e9";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "600 24px Arial";
    ctx.fillText("Final Stats", startX, rect.y + 30);

    const rows = this.getScoreRows();

    ctx.font = "500 21px Arial";
    for (let i = 0; i < rows.length; i += 1) {
      const y = startY + i * lineHeight;
      if (y > rect.y + rect.height - 18) {
        break;
      }
      const [label, value] = rows[i];
      ctx.fillStyle = "#f3d0d0";
      ctx.textAlign = "left";
      ctx.fillText(label, startX, y);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.fillText(String(value), valueX, y);
    }
    ctx.restore();
  }

  getVersusSubtitle() {
    const winner = this.resultMeta.winnerIndex === 0
      ? "Player 1"
      : this.resultMeta.winnerIndex === 1
        ? "Player 2"
        : "Match";
    const score = `${this.resultMeta.p1Kills}-${this.resultMeta.p2Kills}`;
    return `${winner} wins (${score})`;
  }

  getScoreRows() {
    if (this.resultMeta.isVersus) {
      const winnerLabel = this.resultMeta.winnerIndex === 0
        ? "Player 1"
        : this.resultMeta.winnerIndex === 1
          ? "Player 2"
          : "N/A";
      const rows = [
        ["Winner", winnerLabel],
        ["P1 Kills", this.resultMeta.p1Kills],
        ["P2 Kills", this.resultMeta.p2Kills],
        ["P1 Deaths", this.resultMeta.p1Deaths],
        ["P2 Deaths", this.resultMeta.p2Deaths],
        ["Time", `${this.stats.timeSeconds}s`],
      ];
      if (this.resultMeta.killsToWin !== null) {
        rows.splice(1, 0, ["Target", this.resultMeta.killsToWin]);
      }
      return rows;
    }

    return [
      ["Score", this.stats.score],
      ["Kills", this.stats.kills],
      ["Dodges", this.stats.dodges],
      ["Wave", this.stats.wave],
      ["Deaths", this.stats.deaths],
      ["Time", `${this.stats.timeSeconds}s`],
      ["High Score", this.stats.highScore],
    ];
  }

  routePointer(methodName, pointer, game) {
    const names = pointerAliases(methodName);

    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const button = this.buttons[i];
      const result = callAny(button, names, [[pointer, game], [pointer], [pointer.x, pointer.y, pointer.id]]);
      if (result.called && Boolean(result.value)) {
        return true;
      }
    }

    return false;
  }
}
