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

const DEFAULT_STYLE = {
  inset: 14,
  gap: 14,
  panelMinWidth: 184,
  panelMaxWidth: 360,
  panelRadius: 14,
  panelStrokeWidth: 2,
  rowFont: "900 22px Arial",
  valueFont: "900 22px Arial",
  rowStartY: 34,
  rowHeight: 58,
  rowLabelInset: 12,
  rowValueInset: 12,
  shadowColor: "rgba(0, 0, 0, 0.28)",
  shadowBlur: 10,
};

const LEFT_COLORS = {
  panelFill: "rgba(176, 159, 162, 0.98)",
  panelTint: "rgba(189, 169, 170, 0.8)",
  panelStroke: "rgba(194, 174, 176, 0.95)",
  titleColor: "#fff0e5",
  labelColor: "#111111",
  valueColor: "#111111",
};

const RIGHT_COLORS = {
  panelFill: "rgba(138, 142, 197, 0.98)",
  panelTint: "rgba(152, 156, 209, 0.82)",
  panelStroke: "rgba(161, 165, 222, 0.95)",
  titleColor: "#f6f1ff",
  labelColor: "#111111",
  valueColor: "#111111",
};

export class VersusHUD {
  constructor() {
    this._state = [{}, {}];
    this.style = { ...DEFAULT_STYLE };
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
    this._drawPanel(ctx, inset, inset, panelWidth, panelHeight, "P1", this._state[0], LEFT_COLORS);
    this._drawPanel(ctx, rightX, inset, panelWidth, panelHeight, "P2", this._state[1], RIGHT_COLORS);
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
