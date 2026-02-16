import {
  clamp,
  normalizePointerInput,
  resolveViewportSize,
  toNumber,
} from "./uiUtils.js";

const DEFAULT_STYLE = {
  radiusFactor: 0.048,
  minRadius: 20,
  maxRadius: 34,
  marginFactor: 0.55,
  hitRadiusScale: 1.12,
  fillOn: "rgba(34, 95, 72, 0.94)",
  fillOff: "rgba(116, 55, 72, 0.95)",
  strokeOn: "rgba(173, 255, 218, 0.95)",
  strokeOff: "rgba(255, 191, 206, 0.95)",
  iconOn: "#e9fff5",
  iconOff: "#fff1f6",
  shadowColor: "rgba(0, 0, 0, 0.30)",
  shadowBlur: 10,
};

export class MuteButton {
  constructor() {
    this._muted = false;
    this.style = { ...DEFAULT_STYLE };
  }

  setMuted(value) {
    this._muted = value === true;
  }

  isMuted() {
    return this._muted;
  }

  render(ctx, viewWidth, viewHeight) {
    if (!ctx || typeof ctx.save !== "function") {
      return;
    }

    const view = this._resolveView(ctx, viewWidth, viewHeight);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }

    const layout = this._getLayout(view.width, view.height);
    const muted = this._muted;

    ctx.save();
    ctx.shadowColor = this.style.shadowColor;
    ctx.shadowBlur = toNumber(this.style.shadowBlur, 0);

    ctx.beginPath();
    ctx.arc(layout.cx, layout.cy, layout.radius, 0, Math.PI * 2);
    ctx.fillStyle = muted ? this.style.fillOff : this.style.fillOn;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = muted ? this.style.strokeOff : this.style.strokeOn;
    ctx.stroke();

    this._drawIcon(ctx, layout.cx, layout.cy, layout.radius, muted);
    ctx.restore();
  }

  handlePointerUp(pointer, viewWidth, viewHeight) {
    if (!this.contains(pointer, viewWidth, viewHeight)) {
      return false;
    }

    this._muted = !this._muted;
    return true;
  }

  contains(pointer, viewWidth, viewHeight) {
    const normalizedPointer = normalizePointerInput(pointer);
    if (!normalizedPointer) {
      return false;
    }

    const width = toNumber(viewWidth, NaN);
    const height = toNumber(viewHeight, NaN);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return false;
    }

    const layout = this._getLayout(width, height);
    const hitRadius = layout.radius * toNumber(this.style.hitRadiusScale, 1);
    const dx = normalizedPointer.x - layout.cx;
    const dy = normalizedPointer.y - layout.cy;
    if (dx * dx + dy * dy > hitRadius * hitRadius) {
      return false;
    }
    return true;
  }

  _drawIcon(ctx, centerX, centerY, radius, muted) {
    const size = radius * 0.95;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.strokeStyle = muted ? this.style.iconOff : this.style.iconOn;

    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.48, centerY - size * 0.18);
    ctx.lineTo(centerX - size * 0.28, centerY - size * 0.18);
    ctx.lineTo(centerX - size * 0.05, centerY - size * 0.38);
    ctx.lineTo(centerX - size * 0.05, centerY + size * 0.38);
    ctx.lineTo(centerX - size * 0.28, centerY + size * 0.18);
    ctx.lineTo(centerX - size * 0.48, centerY + size * 0.18);
    ctx.closePath();
    ctx.stroke();

    if (muted) {
      ctx.beginPath();
      ctx.moveTo(centerX + size * 0.08, centerY - size * 0.42);
      ctx.lineTo(centerX + size * 0.54, centerY + size * 0.42);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.arc(centerX + size * 0.02, centerY, size * 0.34, -0.85, 0.85);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX + size * 0.02, centerY, size * 0.50, -0.85, 0.85);
    ctx.stroke();
  }

  _getLayout(viewWidth, viewHeight) {
    const baseRadius = Math.min(viewWidth, viewHeight) * toNumber(this.style.radiusFactor, 0.048);
    const radius = clamp(
      baseRadius,
      toNumber(this.style.minRadius, 20),
      toNumber(this.style.maxRadius, 34),
    );
    const margin = clamp(radius * toNumber(this.style.marginFactor, 0.55), 10, 28);

    return {
      radius,
      cx: viewWidth - margin - radius,
      cy: viewHeight - margin - radius,
    };
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
