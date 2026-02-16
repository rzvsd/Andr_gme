import {
  clamp,
  formatNumber,
  pickNumber,
  resolveViewportSize,
  roundedRectPath,
  toNumber,
} from "./uiUtils.js";

const DEFAULT_STYLE = {
  padding: 16,
  gap: 10,
  panelWidthLeft: 194,
  panelWidthRight: 178,
  rightInset: 0,
  rowHeight: 24,
  rowPaddingX: 14,
  panelPaddingTop: 12,
  panelPaddingBottom: 10,
  panelRadius: 12,
  panelFill: "rgba(10, 16, 30, 0.74)",
  panelStroke: "rgba(140, 166, 210, 0.65)",
  labelColor: "#d4deef",
  valueColor: "#f3f8ff",
  font: "600 15px Arial",
  healthBarWidth: 220,
  healthBarHeight: 14,
  healthBarOffsetY: 18,
  healthBarRadius: 7,
  healthBarLabelColor: "#d4deef",
  healthBarFillColor: "#36d37e",
  healthBarBackColor: "rgba(13, 28, 50, 0.9)",
  healthBarStrokeColor: "rgba(157, 191, 255, 0.65)",
  healthBarCriticalColor: "#f97373"
};

export class HUD {
  constructor(options = {}) {
    const config = options && typeof options === "object" ? options : {};

    this.visible = config.visible !== false;
    this.state = config.state && typeof config.state === "object" ? { ...config.state } : {};
    this.style = {
      ...DEFAULT_STYLE,
      ...(config.style && typeof config.style === "object" ? config.style : {})
    };
  }

  setState(scoreState) {
    this.state = scoreState && typeof scoreState === "object" ? { ...scoreState } : {};
  }

  setVisible(visible) {
    this.visible = visible !== false;
  }

  render(ctx, scoreState) {
    if (!this.visible || !ctx || typeof ctx.save !== "function") {
      return;
    }

    const view = resolveViewportSize(ctx);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }

    const activeState = scoreState && typeof scoreState === "object" ? scoreState : this.state;
    const leftLines = [
      { label: "Dodged", value: pickNumber(activeState, ["dodges", "dodged", "bulletsDodged"]) },
      { label: "Deaths", value: pickNumber(activeState, ["deaths"]) },
      { label: "Kills", value: pickNumber(activeState, ["kills"]) }
    ];
    const rightLines = [
      { label: "Wave", value: pickNumber(activeState, ["wave", "currentWave"]) },
      { label: "Score", value: pickNumber(activeState, ["score"]) }
    ];

    const leftPanelHeight =
      this.style.panelPaddingTop +
      this.style.panelPaddingBottom +
      leftLines.length * this.style.rowHeight;
    const rightPanelHeight =
      this.style.panelPaddingTop +
      this.style.panelPaddingBottom +
      rightLines.length * this.style.rowHeight;

    const leftX = this.style.padding;
    const topY = this.style.padding;
    const rightX = view.width - this.style.padding - toNumber(this.style.rightInset, 0) - this.style.panelWidthRight;

    ctx.save();
    this._drawPanel(
      ctx,
      leftX,
      topY,
      this.style.panelWidthLeft,
      leftPanelHeight,
      leftLines
    );

    this._drawPanel(
      ctx,
      rightX,
      topY,
      this.style.panelWidthRight,
      rightPanelHeight,
      rightLines
    );
    this._drawHealthBar(ctx, view, activeState, leftPanelHeight, rightPanelHeight);
    ctx.restore();
  }

  _drawPanel(ctx, x, y, width, height, lines) {
    if (!ctx || width <= 0 || height <= 0) {
      return;
    }

    roundedRectPath(ctx, x, y, width, height, toNumber(this.style.panelRadius, 10));
    ctx.fillStyle = this.style.panelFill;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = this.style.panelStroke;
    ctx.stroke();

    ctx.font = this.style.font;
    ctx.textBaseline = "middle";

    for (let i = 0; i < lines.length; i += 1) {
      const row = lines[i] || {};
      const rowY = y + this.style.panelPaddingTop + i * this.style.rowHeight + this.style.rowHeight / 2;

      ctx.textAlign = "left";
      ctx.fillStyle = this.style.labelColor;
      ctx.fillText(String(row.label || ""), x + this.style.rowPaddingX, rowY);

      ctx.textAlign = "right";
      ctx.fillStyle = this.style.valueColor;
      ctx.fillText(formatNumber(toNumber(row.value, 0)), x + width - this.style.rowPaddingX, rowY);
    }
  }

  _drawHealthBar(ctx, view, state, leftPanelHeight, rightPanelHeight) {
    const hp = Math.max(0, pickNumber(state, ["health"], 0));
    const maxHp = Math.max(1, pickNumber(state, ["maxHealth"], 1));
    const ratio = clamp(hp / maxHp, 0, 1);

    const width = clamp(
      toNumber(this.style.healthBarWidth, 220),
      140,
      Math.max(140, view.width - this.style.padding * 2)
    );
    const height = clamp(toNumber(this.style.healthBarHeight, 14), 10, 24);
    const preferredY = this.style.padding + Math.max(leftPanelHeight, rightPanelHeight) + toNumber(this.style.healthBarOffsetY, 18);
    const maxY = Math.max(this.style.padding, view.height - this.style.padding - height);
    const y = clamp(preferredY, this.style.padding, maxY);
    const x = (view.width - width) * 0.5;
    const radius = clamp(toNumber(this.style.healthBarRadius, 7), 0, height * 0.5);

    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = this.style.healthBarBackColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.style.healthBarStrokeColor;
    ctx.stroke();

    if (ratio > 0) {
      roundedRectPath(ctx, x, y, width * ratio, height, radius);
      ctx.fillStyle = ratio <= 0.3 ? this.style.healthBarCriticalColor : this.style.healthBarFillColor;
      ctx.fill();
    }

    const topLabelY = y - 6;
    const bottomLabelY = y + height + 14;
    const labelY = topLabelY >= this.style.padding ? topLabelY : bottomLabelY;
    if (labelY <= view.height - this.style.padding) {
      ctx.textBaseline = "alphabetic";
      ctx.font = "600 13px Arial";
      ctx.fillStyle = this.style.healthBarLabelColor;
      ctx.textAlign = "left";
      ctx.fillText("HP", x, labelY);
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(hp)}/${Math.round(maxHp)}`, x + width, labelY);
    }
  }
}
