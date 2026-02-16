export class Entity {
  constructor({
    x = 0,
    y = 0,
    vx = 0,
    vy = 0,
    width = 0,
    height = 0,
    active = true,
  } = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = width;
    this.height = height;
    this.active = active;
  }

  update(_deltaSeconds, _context) {}

  render(_ctx, _camera) {}

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
