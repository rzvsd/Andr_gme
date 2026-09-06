export class VersusEffects {
  constructor(scene) {
    this.s = scene;
  }

  spawnFruitBurst(x, y, count, colors, options = {}) {
    const palette = Array.isArray(colors) && colors.length > 0 ? colors : ["#ffffff"];
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const lifeMin = Math.max(0.06, Number(options.lifeMin) || 0.12);
    const lifeMax = Math.max(lifeMin, Number(options.lifeMax) || lifeMin);
    const speedMin = Math.max(0, Number(options.speedMin) || 12);
    const speedMax = Math.max(speedMin, Number(options.speedMax) || speedMin);
    const sizeMin = Math.max(0.6, Number(options.sizeMin) || 1);
    const sizeMax = Math.max(sizeMin, Number(options.sizeMax) || sizeMin);

    for (let index = 0; index < total; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);
      this.s.particles.emit({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - speed * 0.15,
        life,
        size,
        color: palette[index % palette.length],
        shape: index % 3 === 0 ? "square" : "circle",
      });
    }
  }
}
