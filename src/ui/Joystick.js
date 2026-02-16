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

const DEFAULT_STYLE = {
  baseFill: "rgba(20, 28, 44, 0.3)",
  baseStroke: "rgba(154, 176, 213, 0.8)",
  deadzoneStroke: "rgba(120, 142, 178, 0.45)",
  knobFill: "rgba(97, 160, 255, 0.9)",
  knobStroke: "rgba(240, 248, 255, 0.9)",
  activeGlow: "rgba(130, 180, 255, 0.35)",
  lineWidth: 2
};

export class Joystick {
  constructor(options = {}) {
    const config = options && typeof options === "object" ? options : {};

    this.x = toNumber(config.x, 0);
    this.y = toNumber(config.y, 0);
    this.radius = Math.max(1, toNumber(config.radius, 56));
    this.knobRadius = Math.max(1, toNumber(config.knobRadius, this.radius * 0.43));
    this.deadzone = clamp(toNumber(config.deadzone, 0.16), 0, 0.95);
    this.activationRadius = Math.max(this.radius, toNumber(config.activationRadius, this.radius * 1.25));
    this.visible = config.visible !== false;
    this.enabled = config.enabled !== false;

    this.style = {
      ...DEFAULT_STYLE,
      ...(config.style && typeof config.style === "object" ? config.style : {})
    };

    this.pointerId = null;
    this.active = false;

    this.rawX = 0;
    this.rawY = 0;
    this.valueX = 0;
    this.valueY = 0;
  }

  setCenter(x, y) {
    this.x = toNumber(x, this.x);
    this.y = toNumber(y, this.y);
  }

  setRadius(radius, knobRadius) {
    this.radius = Math.max(1, toNumber(radius, this.radius));
    this.knobRadius = Math.max(1, toNumber(knobRadius, this.radius * 0.43));
    this.activationRadius = Math.max(this.radius, this.activationRadius);
    this._applyVector(this.rawX * this.radius, this.rawY * this.radius);
  }

  setDeadzone(deadzone) {
    this.deadzone = clamp(toNumber(deadzone, this.deadzone), 0, 0.95);
    this._applyVector(this.rawX * this.radius, this.rawY * this.radius);
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

  getValue() {
    return {
      x: this.valueX,
      y: this.valueY
    };
  }

  get xAxis() {
    return this.valueX;
  }

  get yAxis() {
    return this.valueY;
  }

  containsPoint(x, y) {
    if (!this.visible) {
      return false;
    }

    const pointX = toNumber(x, NaN);
    const pointY = toNumber(y, NaN);
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
      return false;
    }

    return Math.hypot(pointX - this.x, pointY - this.y) <= this.activationRadius;
  }

  handlePointerDown(pointerOrX, y, pointerId) {
    if (!this.enabled || !this.visible || this.active) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || !this.containsPoint(pointer.x, pointer.y)) {
      return false;
    }

    this.active = true;
    this.pointerId = pointer.id;
    this._applyVector(pointer.x - this.x, pointer.y - this.y);
    return true;
  }

  handlePointerMove(pointerOrX, y, pointerId) {
    if (!this.active) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || pointer.id !== this.pointerId) {
      return false;
    }

    this._applyVector(pointer.x - this.x, pointer.y - this.y);
    return true;
  }

  handlePointerUp(pointerOrX, y, pointerId) {
    if (!this.active) {
      return false;
    }

    const pointer = normalizePointerInput(pointerOrX, y, pointerId);
    if (!pointer || pointer.id !== this.pointerId) {
      return false;
    }

    this.reset();
    return true;
  }

  handlePointerCancel(pointerOrX, y, pointerId) {
    return this.handlePointerUp(pointerOrX, y, pointerId);
  }

  reset() {
    this.pointerId = null;
    this.active = false;
    this.rawX = 0;
    this.rawY = 0;
    this.valueX = 0;
    this.valueY = 0;
  }

  render(ctx) {
    if (!ctx || typeof ctx.save !== "function" || !this.visible || this.radius <= 0) {
      return;
    }

    const deadzoneRadius = this.radius * this.deadzone;
    const knobX = this.x + this.rawX * this.radius;
    const knobY = this.y + this.rawY * this.radius;

    ctx.save();

    if (this.active) {
      ctx.fillStyle = this.style.activeGlow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = this.style.baseFill;
    ctx.strokeStyle = this.style.baseStroke;
    ctx.lineWidth = toNumber(this.style.lineWidth, 2);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (deadzoneRadius > 0) {
      ctx.strokeStyle = this.style.deadzoneStroke;
      ctx.beginPath();
      ctx.arc(this.x, this.y, deadzoneRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.style.knobFill;
    ctx.strokeStyle = this.style.knobStroke;
    ctx.beginPath();
    ctx.arc(knobX, knobY, this.knobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _applyVector(dx, dy) {
    const distance = Math.hypot(dx, dy);
    const maxDistance = Math.max(1, this.radius);

    let safeDx = toNumber(dx, 0);
    let safeDy = toNumber(dy, 0);

    if (distance > maxDistance && distance > 0) {
      const scalar = maxDistance / distance;
      safeDx *= scalar;
      safeDy *= scalar;
    }

    this.rawX = clamp(safeDx / maxDistance, -1, 1);
    this.rawY = clamp(safeDy / maxDistance, -1, 1);

    const magnitude = Math.hypot(this.rawX, this.rawY);
    if (magnitude <= this.deadzone || magnitude === 0) {
      this.valueX = 0;
      this.valueY = 0;
      return;
    }

    const adjustedMagnitude = (magnitude - this.deadzone) / (1 - this.deadzone);
    const scale = adjustedMagnitude / magnitude;
    this.valueX = clamp(this.rawX * scale, -1, 1);
    this.valueY = clamp(this.rawY * scale, -1, 1);
  }
}
