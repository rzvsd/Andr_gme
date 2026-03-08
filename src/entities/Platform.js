import { Entity } from "./Entity.js";

const toNonNegativeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, numeric);
};

export class Platform extends Entity {
  constructor(x, y, width, height, color = "#2f7d1f", options = {}) {
    super({
      x,
      y,
      width,
      height,
      vx: 0,
      vy: 0,
    });

    this.color = color;
    this.id = typeof options?.id === "string" && options.id.length > 0 ? options.id : null;
    this.name = typeof options?.name === "string" && options.name.length > 0 ? options.name : null;
    this.collisionCategory = toNonNegativeNumber(options?.collisionCategory, 0);
    this.playerCollisionOffsetY = toNonNegativeNumber(options?.playerCollisionOffsetY, 0);
    const maxCollisionHeight = Math.max(0, this.height - this.playerCollisionOffsetY);
    this.playerCollisionHeight = toNonNegativeNumber(options?.playerCollisionHeight, maxCollisionHeight);
    this.isSolid = options?.isSolid !== false;
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

  getBodyBounds() {
    return super.getBounds();
  }

  getPlayerCollisionBounds() {
    const body = this.getBodyBounds();
    const offsetY = Math.min(body.height, toNonNegativeNumber(this.playerCollisionOffsetY, 0));
    const maxCollisionHeight = Math.max(0, body.height - offsetY);
    const collisionHeight = Math.min(
      maxCollisionHeight,
      toNonNegativeNumber(this.playerCollisionHeight, maxCollisionHeight)
    );

    return {
      x: body.x,
      y: body.y + offsetY,
      width: body.width,
      height: collisionHeight,
    };
  }
}
