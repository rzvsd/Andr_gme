function toNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePointerInput(pointerOrX, y, pointerId) {
  if (pointerOrX && typeof pointerOrX === "object") {
    const xValue = toNumber(pointerOrX.x, toNumber(pointerOrX.clientX, toNumber(pointerOrX.pageX, NaN)));
    const yValue = toNumber(pointerOrX.y, toNumber(pointerOrX.clientY, toNumber(pointerOrX.pageY, NaN)));
    const idValue = toNumber(
      pointerOrX.pointerId,
      toNumber(pointerOrX.identifier, toNumber(pointerOrX.id, 0))
    );

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      return null;
    }

    return {
      x: xValue,
      y: yValue,
      id: idValue
    };
  }

  const xValue = toNumber(pointerOrX, NaN);
  const yValue = toNumber(y, NaN);
  const idValue = toNumber(pointerId, 0);

  if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
    return null;
  }

  return {
    x: xValue,
    y: yValue,
    id: idValue
  };
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

const DEFAULT_STYLE = {
  radius: 12,
  fill: "rgba(28, 38, 60, 0.82)",
  fillPressed: "rgba(62, 108, 196, 0.9)",
  fillDisabled: "rgba(60, 68, 82, 0.58)",
  stroke: "rgba(168, 188, 224, 0.85)",
  strokePressed: "rgba(220, 236, 255, 0.95)",
  text: "#f4f8ff",
  textDisabled: "#a5b2c4",
  font: "600 18px Arial",
  shadowColor: "rgba(0, 0, 0, 0.28)",
  shadowBlur: 14
};

export class Button {
  constructor(options = {}) {
    const config = options && typeof options === "object" ? options : {};

    this.x = toNumber(config.x, 0);
    this.y = toNumber(config.y, 0);
    this.width = Math.max(0, toNumber(config.width, 120));
    this.height = Math.max(0, toNumber(config.height, 48));
    this.label = typeof config.label === "string" ? config.label : "";
    this.visible = config.visible !== false;
    this.enabled = config.enabled !== false;
    this.onClick = typeof config.onClick === "function" ? config.onClick : null;

    this.style = {
      ...DEFAULT_STYLE,
      ...(config.style && typeof config.style === "object" ? config.style : {})
    };

    this._activePointerId = null;
    this._pressed = false;
    this._pointerInside = false;
  }

  setBounds(x, y, width, height) {
    this.x = toNumber(x, this.x);
    this.y = toNumber(y, this.y);
    this.width = Math.max(0, toNumber(width, this.width));
    this.height = Math.max(0, toNumber(height, this.height));
  }

  setLabel(label) {
    this.label = typeof label === "string" ? label : "";
  }

  setEnabled(enabled) {
    this.enabled = enabled !== false;
    if (!this.enabled) {
      this.reset();
    }
  }

  setVisible(visible) {
    this.visible = visible !== false;
    if (!this.visible) {
      this.reset();
    }
  }

  setOnClick(callback) {
    this.onClick = typeof callback === "function" ? callback : null;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  isPressed() {
    return this._pressed;
  }

  containsPoint(x, y) {
    if (!this.visible || this.width <= 0 || this.height <= 0) {
      return false;
    }

    const pointX = toNumber(x, NaN);
    const pointY = toNumber(y, NaN);
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
      return false;
    }

    return (
      pointX >= this.x &&
      pointX <= this.x + this.width &&
      pointY >= this.y &&
      pointY <= this.y + this.height
    );
  }

  handlePointerDown(pointerOrX, y, pointerId) {
    if (!this.enabled || !this.visible) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || !this.containsPoint(pointer.x, pointer.y)) {
      return false;
    }

    this._activePointerId = pointer.id;
    this._pressed = true;
    this._pointerInside = true;
    return true;
  }

  handlePointerMove(pointerOrX, y, pointerId) {
    if (!this._pressed) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || pointer.id !== this._activePointerId) {
      return false;
    }

    this._pointerInside = this.containsPoint(pointer.x, pointer.y);
    return true;
  }

  handlePointerUp(pointerOrX, y, pointerId) {
    if (!this._pressed) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || pointer.id !== this._activePointerId) {
      return false;
    }

    const clicked = this.enabled && this.visible && this._pointerInside && this.containsPoint(pointer.x, pointer.y);
    this.reset();

    if (clicked && typeof this.onClick === "function") {
      this.onClick(pointer, this);
    }

    return clicked;
  }

  handlePointerCancel(pointerOrX, y, pointerId) {
    if (!this._pressed) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || pointer.id !== this._activePointerId) {
      return false;
    }

    this.reset();
    return true;
  }

  reset() {
    this._activePointerId = null;
    this._pressed = false;
    this._pointerInside = false;
  }

  render(ctx) {
    if (!ctx || typeof ctx.save !== "function" || !this.visible || this.width <= 0 || this.height <= 0) {
      return;
    }

    const isPressed = this._pressed && this.enabled;
    const fillStyle = this.enabled
      ? (isPressed ? this.style.fillPressed : this.style.fill)
      : this.style.fillDisabled;
    const strokeStyle = isPressed ? this.style.strokePressed : this.style.stroke;
    const textStyle = this.enabled ? this.style.text : this.style.textDisabled;

    ctx.save();
    ctx.shadowColor = this.style.shadowColor;
    ctx.shadowBlur = toNumber(this.style.shadowBlur, 0);
    roundedRectPath(ctx, this.x, this.y, this.width, this.height, toNumber(this.style.radius, 0));
    ctx.fillStyle = fillStyle;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();

    if (this.label.length > 0) {
      ctx.fillStyle = textStyle;
      ctx.font = typeof this.style.font === "string" ? this.style.font : DEFAULT_STYLE.font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
    }

    ctx.restore();
  }
}
