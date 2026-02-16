import { clamp } from "../utils/math.js";

export class Physics {
  static applyGravity(vy, gravity, dt) {
    return vy + gravity * dt;
  }

  static integrate(value, velocity, dt) {
    return value + velocity * dt;
  }

  static applyFriction(vx, friction, dt) {
    const magnitude = Math.max(0, Math.abs(vx) - friction * dt);
    return Math.sign(vx) * magnitude;
  }

  static aabbOverlap(a, b) {
    return (
      a.x <= b.x + b.width &&
      a.x + a.width >= b.x &&
      a.y <= b.y + b.height &&
      a.y + a.height >= b.y
    );
  }

  static clamp(value, min, max) {
    return clamp(value, min, max);
  }
}
