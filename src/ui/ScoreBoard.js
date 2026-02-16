import {
  formatNumber,
  pickNumber,
  resolveViewportSize,
  roundedRectPath,
  toNumber,
} from "./uiUtils.js";

const DEFAULT_STYLE = {
  overlayColor: "rgba(3, 8, 18, 0.62)",
  panelFill: "rgba(13, 20, 35, 0.94)",
  panelStroke: "rgba(148, 171, 212, 0.78)",
  panelRadius: 14,
  panelPaddingX: 22,
  panelPaddingTop: 18,
  panelPaddingBottom: 18,
  titleColor: "#f3f8ff",
  labelColor: "#bfd0ea",
  valueColor: "#ffffff",
  helperColor: "#9fb3d4",
  titleFont: "700 28px Arial",
  rowFont: "600 18px Arial",
  helperFont: "500 14px Arial",
  rowHeight: 30
};

export class ScoreBoard {
  constructor(options = {}) {
    const config = options && typeof options === "object" ? options : {};

    this.visible = config.visible !== false;
    this.stats = config.stats && typeof config.stats === "object" ? { ...config.stats } : {};
    this.title = typeof config.title === "string" ? config.title : "GAME OVER";
    this.helperText = typeof config.helperText === "string" ? config.helperText : "Tap to retry";
    this.style = {
      ...DEFAULT_STYLE,
      ...(config.style && typeof config.style === "object" ? config.style : {})
    };
  }

  static formatValue(value) {
    return formatNumber(value);
  }

  formatValue(value) {
    return ScoreBoard.formatValue(value);
  }

  setStats(stats) {
    this.stats = stats && typeof stats === "object" ? { ...stats } : {};
  }

  setVisible(visible) {
    this.visible = visible !== false;
  }

  render(ctx, stats) {
    if (!this.visible || !ctx || typeof ctx.save !== "function") {
      return;
    }

    const view = resolveViewportSize(ctx);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }

    const activeStats = stats && typeof stats === "object" ? stats : this.stats;
    const rows = this._buildRows(activeStats);

    const panelWidth = Math.min(420, Math.max(250, view.width - 24));
    const panelHeight =
      this.style.panelPaddingTop +
      this.style.panelPaddingBottom +
      64 +
      rows.length * this.style.rowHeight +
      34;
    const panelX = (view.width - panelWidth) * 0.5;
    const panelY = (view.height - panelHeight) * 0.5;

    ctx.save();
    ctx.fillStyle = this.style.overlayColor;
    ctx.fillRect(0, 0, view.width, view.height);

    roundedRectPath(ctx, panelX, panelY, panelWidth, panelHeight, toNumber(this.style.panelRadius, 12));
    ctx.fillStyle = this.style.panelFill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.style.panelStroke;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = this.style.titleFont;
    ctx.fillStyle = this.style.titleColor;
    ctx.fillText(this.title, panelX + panelWidth * 0.5, panelY + 32);

    const rowStartY = panelY + 74;
    ctx.font = this.style.rowFont;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const y = rowStartY + i * this.style.rowHeight;

      ctx.textAlign = "left";
      ctx.fillStyle = this.style.labelColor;
      ctx.fillText(row.label, panelX + this.style.panelPaddingX, y);

      ctx.textAlign = "right";
      ctx.fillStyle = this.style.valueColor;
      ctx.fillText(this.formatValue(row.value), panelX + panelWidth - this.style.panelPaddingX, y);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = this.style.helperColor;
    ctx.font = this.style.helperFont;
    ctx.fillText(
      this.helperText,
      panelX + panelWidth * 0.5,
      panelY + panelHeight - this.style.panelPaddingBottom - 8
    );

    ctx.restore();
  }

  _buildRows(stats) {
    const rows = [
      { label: "Score", value: pickNumber(stats, ["score"]) },
      { label: "Wave", value: pickNumber(stats, ["wave", "currentWave"]) },
      { label: "Kills", value: pickNumber(stats, ["kills"]) },
      { label: "Dodged", value: pickNumber(stats, ["dodges", "dodged", "bulletsDodged"]) },
      { label: "Deaths", value: pickNumber(stats, ["deaths"]) }
    ];

    const hits = pickNumber(stats, ["hits"], NaN);
    if (Number.isFinite(hits)) {
      rows.push({ label: "Hits", value: hits });
    }

    const highScore = pickNumber(stats, ["highScore", "bestScore"], NaN);
    if (Number.isFinite(highScore)) {
      rows.splice(1, 0, { label: "High Score", value: highScore });
    }

    return rows;
  }
}
