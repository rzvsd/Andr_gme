import {
  clamp,
  formatNumber,
  pickNumber,
  resolveViewportSize,
  roundedRectPath,
  toNumber,
} from "./uiUtils.js";

const ROWS = [
  {
    label: "BULLETS DODGED",
    keys: ["bulletsDodged", "dodges", "dodged"],
  },
  {
    label: "DEATHS",
    keys: ["deaths"],
  },
  {
    label: "KILLS",
    keys: ["kills"],
  },
];

const HAND_FONT = '"Comic Sans MS", "Segoe Print", "Chalkboard SE", "Trebuchet MS", cursive';

const DEFAULT_STYLE = {
  inset: 10,
  gap: 10,
  panelMinWidth: 184,
  panelMaxWidth: 360,
  panelRadius: 12,
  panelStrokeWidth: 2,
  rowFont: `700 22px ${HAND_FONT}`,
  valueFont: `700 22px ${HAND_FONT}`,
  rowStartY: 32,
  rowHeight: 38,
  rowLabelInset: 12,
  rowValueInset: 12,
  shadowColor: "rgba(0, 0, 0, 0.22)",
  shadowBlur: 8,
};

const LEFT_COLORS = {
  panelFill: "rgba(200, 178, 178, 0.98)",
  panelTint: "rgba(212, 190, 190, 0.85)",
  panelStroke: "rgba(190, 165, 165, 0.95)",
  titleColor: "#fff0e5",
  labelColor: "#111111",
  valueColor: "#111111",
};

const RIGHT_COLORS = {
  panelFill: "rgba(142, 140, 216, 0.98)",
  panelTint: "rgba(158, 156, 222, 0.85)",
  panelStroke: "rgba(150, 148, 210, 0.95)",
  titleColor: "#f6f1ff",
  labelColor: "#111111",
  valueColor: "#111111",
};

export class VersusHUD {
  constructor() {
    this._state = [{}, {}];
    this.titles = ["P1", "P2"];
    this.style = { ...DEFAULT_STYLE };
  }

  setPlayerLabels(labels = []) {
    const nextLabels = Array.isArray(labels) ? labels : [labels];
    this.titles = [
      typeof nextLabels[0] === "string" && nextLabels[0].trim().length > 0 ? nextLabels[0].trim() : "P1",
      typeof nextLabels[1] === "string" && nextLabels[1].trim().length > 0 ? nextLabels[1].trim() : "P2",
    ];
  }

  setState(playerIndex, stats) {
    const normalizedIndex = this._normalizePlayerIndex(playerIndex);
    this._state[normalizedIndex] = stats && typeof stats === "object" ? { ...stats } : {};
  }

  getState(playerIndex) {
    const normalizedIndex = this._normalizePlayerIndex(playerIndex);
    const state = this._state[normalizedIndex];
    return state && typeof state === "object" ? { ...state } : {};
  }

  render(ctx, viewWidth, viewHeight) {
    if (!ctx || typeof ctx.save !== "function") {
      return;
    }

    const view = this._resolveView(ctx, viewWidth, viewHeight);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }

    const inset = toNumber(this.style.inset, 14);
    const gap = toNumber(this.style.gap, 14);
    const availableHalfWidth = Math.max(0, (view.width - inset * 2 - gap) * 0.5);
    const minPanelWidth = toNumber(this.style.panelMinWidth, 184);
    const maxPanelWidth = toNumber(this.style.panelMaxWidth, 360);
    const panelWidth = availableHalfWidth >= minPanelWidth
      ? clamp(availableHalfWidth, minPanelWidth, maxPanelWidth)
      : availableHalfWidth;
    const panelHeight =
      toNumber(this.style.rowStartY, 34) +
      ROWS.length * toNumber(this.style.rowHeight, 24) +
      16;
    const rightX = Math.max(inset, view.width - inset - panelWidth);

    ctx.save();
    this._drawPanel(ctx, inset, inset, panelWidth, panelHeight, this.titles[0], this._state[0], LEFT_COLORS);
    this._drawPanel(ctx, rightX, inset, panelWidth, panelHeight, this.titles[1], this._state[1], RIGHT_COLORS);
    ctx.restore();

    this._drawTouchHint(ctx, view);
  }

  _drawTouchHint(ctx, view) {
    // M7: in-HUD controls hint so swipe-jump / tap-shoot are discoverable mid-match.
    if (!ctx || typeof ctx.save !== "function" || !view || view.width <= 0 || view.height <= 0) {
      return;
    }
    const label = "Drag: move · Swipe up: jump · Tap / hold: shoot";
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${view.width < 560 ? 11 : 13}px Arial`;
    ctx.fillStyle = "#2b3a55";
    ctx.fillText(label, Math.round(view.width * 0.5), Math.round(view.height - 14), Math.max(0, view.width - 120));
    ctx.restore();
  }

  _drawPanel(ctx, x, y, width, height, title, state, colors) {
    if (width <= 0 || height <= 0) {
      return;
    }

    const radius = toNumber(this.style.panelRadius, 14);

    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.save();
    ctx.shadowColor = this.style.shadowColor;
    ctx.shadowBlur = toNumber(this.style.shadowBlur, 0);
    ctx.fillStyle = colors.panelFill;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = colors.panelTint;
    ctx.fillRect(x + 2, y + 2, Math.max(0, width - 4), Math.max(0, height * 0.36));

    ctx.lineWidth = toNumber(this.style.panelStrokeWidth, 2);
    ctx.strokeStyle = colors.panelStroke;
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.stroke();

    for (let i = 0; i < ROWS.length; i += 1) {
      const row = ROWS[i];
      const rowY =
        y +
        toNumber(this.style.rowStartY, 34) +
        i * toNumber(this.style.rowHeight, 24);

      ctx.textAlign = "left";
      ctx.font = this.style.rowFont;
      ctx.fillStyle = colors.labelColor;
      ctx.fillText(row.label, x + toNumber(this.style.rowLabelInset, 12), rowY);

      const value = pickNumber(state, row.keys, 0);
      ctx.textAlign = "right";
      ctx.font = this.style.valueFont;
      ctx.fillStyle = colors.valueColor;
      ctx.fillText(
        formatNumber(value),
        x + width - toNumber(this.style.rowValueInset, 12),
        rowY,
      );
    }
  }

  _normalizePlayerIndex(playerIndex) {
    const parsed = toNumber(playerIndex, 0);
    return parsed >= 1 ? 1 : 0;
  }

  _resolveView(ctx, viewWidth, viewHeight) {
    const width = toNumber(viewWidth, NaN);
    const height = toNumber(viewHeight, NaN);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width, height };
    }

    return resolveViewportSize(ctx);
  }
}
