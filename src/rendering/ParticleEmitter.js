const DEFAULT_CAPACITY = 200;
const DEFAULT_ALPHA_CUTOFF = 0.02;
const TWO_PI = Math.PI * 2;

function toFiniteNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toPositiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

export class ParticleEmitter {
  constructor(capacity = DEFAULT_CAPACITY) {
    const parsedCapacity = Math.floor(toPositiveNumber(capacity, DEFAULT_CAPACITY));

    this.capacity = parsedCapacity;
    this.particles = new Array(parsedCapacity);
    this.activeIndices = new Int32Array(parsedCapacity);
    this.activeLookup = new Int32Array(parsedCapacity);
    this.freeIndices = new Int32Array(parsedCapacity);
    this.activeCount = 0;
    this.freeTop = parsedCapacity - 1;
    this.alphaCutoff = DEFAULT_ALPHA_CUTOFF;
    this._projectionPoint = { x: 0, y: 0 };

    for (let i = 0; i < parsedCapacity; i += 1) {
      this.particles[i] = {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        life: 0,
        maxLife: 0,
        size: 1,
        color: "#ffffff",
        shape: "square",
        active: false,
      };
      this.activeLookup[i] = -1;
      this.freeIndices[i] = parsedCapacity - 1 - i;
    }
  }

  emit(options = {}) {
    if (this.freeTop < 0) {
      return false;
    }

    const particleIndex = this.freeIndices[this.freeTop];
    this.freeTop -= 1;

    const particle = this.particles[particleIndex];
    const position = options.position;
    const velocity = options.velocity;

    particle.position.x = toFiniteNumber(options.x ?? position?.x, 0);
    particle.position.y = toFiniteNumber(options.y ?? position?.y, 0);
    particle.velocity.x = toFiniteNumber(options.vx ?? velocity?.x, 0);
    particle.velocity.y = toFiniteNumber(options.vy ?? velocity?.y, 0);
    particle.maxLife = toPositiveNumber(options.maxLife ?? options.life, 1);
    particle.life = particle.maxLife;
    particle.size = toPositiveNumber(options.size, 2);
    particle.color = typeof options.color === "string" ? options.color : "#ffffff";
    particle.shape = options.shape === "circle" ? "circle" : "square";
    particle.active = true;

    this.activeIndices[this.activeCount] = particleIndex;
    this.activeLookup[particleIndex] = this.activeCount;
    this.activeCount += 1;

    return true;
  }

  burst(count, options = {}) {
    const parsedCount = Math.max(0, Math.floor(toFiniteNumber(count, 0)));
    let emitted = 0;

    for (let i = 0; i < parsedCount; i += 1) {
      if (!this.emit(options)) {
        break;
      }
      emitted += 1;
    }

    return emitted;
  }

  update(deltaSeconds) {
    const delta = toFiniteNumber(deltaSeconds, 0);
    if (delta <= 0 || this.activeCount === 0) {
      return;
    }

    let i = 0;
    while (i < this.activeCount) {
      const particleIndex = this.activeIndices[i];
      const particle = this.particles[particleIndex];

      particle.life -= delta;
      if (particle.life <= 0) {
        this.#deactivateAt(i);
        continue;
      }

      particle.position.x += particle.velocity.x * delta;
      particle.position.y += particle.velocity.y * delta;
      i += 1;
    }
  }

  render(ctx, camera) {
    if (!ctx || this.activeCount === 0) {
      return;
    }

    const cameraX = toFiniteNumber(camera?.x, 0);
    const cameraY = toFiniteNumber(camera?.y, 0);
    const hasWorldToScreen = typeof camera?.worldToScreen === "function";
    const previousAlpha = ctx.globalAlpha;
    const previousFillStyle = ctx.fillStyle;

    for (let i = 0; i < this.activeCount; i += 1) {
      const particle = this.particles[this.activeIndices[i]];
      const alpha = particle.maxLife > 0 ? particle.life / particle.maxLife : 0;

      if (alpha <= this.alphaCutoff) {
        continue;
      }

      const projected = hasWorldToScreen
        ? camera.worldToScreen(particle.position.x, particle.position.y, this._projectionPoint)
        : null;
      const screenX = toFiniteNumber(projected?.x, particle.position.x - cameraX);
      const screenY = toFiniteNumber(projected?.y, particle.position.y - cameraY);
      const size = toPositiveNumber(particle.size, 1);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;

      if (
        particle.shape === "circle" &&
        typeof ctx.beginPath === "function" &&
        typeof ctx.arc === "function" &&
        typeof ctx.fill === "function"
      ) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, TWO_PI);
        ctx.fill();
      } else if (typeof ctx.fillRect === "function") {
        const half = size;
        ctx.fillRect(screenX - half, screenY - half, size * 2, size * 2);
      }
    }

    ctx.globalAlpha = previousAlpha;
    ctx.fillStyle = previousFillStyle;
  }

  clear() {
    for (let i = 0; i < this.capacity; i += 1) {
      const particle = this.particles[i];
      particle.active = false;
      particle.life = 0;
      particle.maxLife = 0;
      this.activeLookup[i] = -1;
      this.freeIndices[i] = this.capacity - 1 - i;
    }

    this.activeCount = 0;
    this.freeTop = this.capacity - 1;
  }

  getActiveCount() {
    return this.activeCount;
  }

  #deactivateAt(activeArrayIndex) {
    const particleIndex = this.activeIndices[activeArrayIndex];
    const lastActiveIndex = this.activeCount - 1;

    if (activeArrayIndex !== lastActiveIndex) {
      const swappedParticleIndex = this.activeIndices[lastActiveIndex];
      this.activeIndices[activeArrayIndex] = swappedParticleIndex;
      this.activeLookup[swappedParticleIndex] = activeArrayIndex;
    }

    this.activeCount = lastActiveIndex;
    this.activeLookup[particleIndex] = -1;

    const particle = this.particles[particleIndex];
    particle.active = false;
    particle.life = 0;

    this.freeTop += 1;
    this.freeIndices[this.freeTop] = particleIndex;
  }
}
