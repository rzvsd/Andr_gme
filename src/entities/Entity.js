export class Entity {
  constructor({
    x = 0,
    y = 0,
    vx = 0,
    vy = 0,
    width = 1,
    height = 1,
    active = true,
  } = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = Math.max(0, Number(width) || 0);
    this.height = Math.max(0, Number(height) || 0);
    this.active = active;
  }

  update(_deltaSeconds, _context) {}

  render(_ctx, _camera) {}

  projectToScreen(camera, x = this.x, y = this.y) {
    let renderX = Number(x);
    let renderY = Number(y);

    if (camera && typeof camera.worldToScreen === "function") {
      const screenPosition = camera.worldToScreen(renderX, renderY);
      renderX = Number(screenPosition?.x);
      renderY = Number(screenPosition?.y);
    } else if (camera && typeof camera === "object") {
      const cameraX = Number(camera.x);
      const cameraY = Number(camera.y);
      renderX -= Number.isFinite(cameraX) ? cameraX : 0;
      renderY -= Number.isFinite(cameraY) ? cameraY : 0;
    }

    if (!Number.isFinite(renderX) || !Number.isFinite(renderY)) {
      return null;
    }

    return { x: renderX, y: renderY };
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  setVelocity(vx, vy) {
    this.vx = vx;
    this.vy = vy;
  }

  activate(x = this.x, y = this.y) {
    this.x = x;
    this.y = y;
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }
}
