export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.x = 0;
    this.y = 0;
    this.rawX = 0;
    this.rawY = 0;
    this.roundPixels = true;
    this.target = null;
    this.lerpFactor = 0.1;

    this.setViewport(viewportWidth, viewportHeight);
  }

  setViewport(width, height) {
    const numericWidth = Number(width);
    const numericHeight = Number(height);

    this.viewportWidth = Number.isFinite(numericWidth) && numericWidth > 0 ? numericWidth : 1;
    this.viewportHeight = Number.isFinite(numericHeight) && numericHeight > 0 ? numericHeight : 1;
  }

  follow(target, lerpFactor = 0.1) {
    this.target = target ?? null;

    const numericLerpFactor = Number(lerpFactor);
    if (Number.isFinite(numericLerpFactor)) {
      this.lerpFactor = Math.min(1, Math.max(0, numericLerpFactor));
    }
  }

  setPosition(x, y) {
    const nextX = Number(x);
    const nextY = Number(y);
    this.rawX = Number.isFinite(nextX) ? nextX : this.rawX;
    this.rawY = Number.isFinite(nextY) ? nextY : this.rawY;
    this.#applyPixelSnap();
  }

  update() {
    if (!this.target) {
      this.#applyPixelSnap();
      return;
    }

    const width = this.#getTargetDimension("width", "w");
    const height = this.#getTargetDimension("height", "h");

    const targetX = this.target.x + width / 2 - this.viewportWidth / 2;
    const targetY = this.target.y + height / 2 - this.viewportHeight / 2;

    this.rawX += (targetX - this.rawX) * this.lerpFactor;
    this.rawY += (targetY - this.rawY) * this.lerpFactor;
    this.#applyPixelSnap();
  }

  worldToScreen(x, y, outPoint) {
    const point = outPoint && typeof outPoint === "object" ? outPoint : {};
    const screenX = Number(x) - this.x;
    const screenY = Number(y) - this.y;
    point.x = this.roundPixels ? Math.round(screenX) : screenX;
    point.y = this.roundPixels ? Math.round(screenY) : screenY;
    return point;
  }

  screenToWorld(x, y, outPoint) {
    const point = outPoint && typeof outPoint === "object" ? outPoint : {};
    point.x = Number(x) + this.x;
    point.y = Number(y) + this.y;
    return point;
  }

  #getTargetDimension(primaryKey, fallbackKey) {
    const primary = Number(this.target?.[primaryKey]);
    if (Number.isFinite(primary)) {
      return primary;
    }

    const fallback = Number(this.target?.[fallbackKey]);
    return Number.isFinite(fallback) ? fallback : 0;
  }

  #applyPixelSnap() {
    this.x = this.roundPixels ? Math.round(this.rawX) : this.rawX;
    this.y = this.roundPixels ? Math.round(this.rawY) : this.rawY;
  }
}
