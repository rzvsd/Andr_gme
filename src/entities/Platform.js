import { Entity } from "./Entity.js";

export class Platform extends Entity {
  constructor(x, y, width, height, color = "#2f7d1f") {
    super({
      x,
      y,
      width,
      height,
      vx: 0,
      vy: 0,
    });

    this.color = color;
  }

  update(_deltaSeconds, _context) {
    this.vx = 0;
    this.vy = 0;
  }

  render(ctx, camera) {
    const hasWorldToScreen = typeof camera?.worldToScreen === "function";
    const position = hasWorldToScreen
      ? camera.worldToScreen(this.x, this.y)
      : { x: this.x, y: this.y };

    ctx.fillStyle = this.color;
    ctx.fillRect(position.x, position.y, this.width, this.height);
  }
}
