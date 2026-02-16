const DEFAULT_FALLBACK_COLOR = "#000";

export class Background {
  constructor(layers = [], fallbackColor = DEFAULT_FALLBACK_COLOR) {
    this.fallbackColor =
      typeof fallbackColor === "string" ? fallbackColor : DEFAULT_FALLBACK_COLOR;
    this.layers = [];
    this.setLayers(layers);
  }

  setLayers(layers = []) {
    const nextLayers = Array.isArray(layers) ? layers : [];
    this.layers = nextLayers.map((layer) => this.#createLayerState(layer));
  }

  render(ctx, camera, viewportWidth, viewportHeight) {
    if (!ctx || typeof ctx.fillRect !== "function" || typeof ctx.drawImage !== "function") {
      return;
    }

    const width = this.#resolveDimension(viewportWidth, ctx.canvas?.width);
    const height = this.#resolveDimension(viewportHeight, ctx.canvas?.height);
    const cameraX = this.#toFiniteNumber(camera?.x, 0);
    const cameraY = this.#toFiniteNumber(camera?.y, 0);

    ctx.save();
    ctx.fillStyle = this.fallbackColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    for (const layer of this.layers) {
      if (!layer || layer.error || !layer.ready || !layer.image) {
        continue;
      }

      const sourceWidth = this.#toFiniteNumber(layer.image.naturalWidth ?? layer.image.width, 0);
      const sourceHeight = this.#toFiniteNumber(layer.image.naturalHeight ?? layer.image.height, 0);
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        continue;
      }

      const drawHeight = layer.height > 0 ? layer.height : sourceHeight;
      const drawWidth = (sourceWidth * drawHeight) / sourceHeight;
      if (!Number.isFinite(drawWidth) || drawWidth <= 0 || drawHeight <= 0) {
        continue;
      }

      const baseX = -cameraX * layer.parallaxX;
      const baseY = layer.y - cameraY * layer.parallaxY;

      ctx.save();
      ctx.globalAlpha *= layer.opacity;

      if (layer.repeatX) {
        const wrappedOffset = ((baseX % drawWidth) + drawWidth) % drawWidth;
        for (let x = wrappedOffset - drawWidth; x < width; x += drawWidth) {
          ctx.drawImage(layer.image, x, baseY, drawWidth, drawHeight);
        }
      } else {
        ctx.drawImage(layer.image, baseX, baseY, drawWidth, drawHeight);
      }

      ctx.restore();
    }
  }

  #createLayerState(layer) {
    const source = layer && typeof layer === "object" ? layer : {};
    const imageSrc = typeof source.imageSrc === "string" ? source.imageSrc.trim() : "";
    const baseParallax = this.#clamp(this.#toFiniteNumber(source.parallax, 1), 0, 1);
    const hasParallaxY = Object.prototype.hasOwnProperty.call(source, "parallaxY");

    const state = {
      image: null,
      imageSrc,
      parallaxX: this.#clamp(this.#toFiniteNumber(source.parallaxX, baseParallax), 0, 1),
      parallaxY: this.#clamp(this.#toFiniteNumber(source.parallaxY, hasParallaxY ? baseParallax : 0), 0, 1),
      y: this.#toFiniteNumber(source.y, 0),
      height: this.#toFiniteNumber(source.height, 0),
      opacity: this.#clamp(this.#toFiniteNumber(source.opacity, 1), 0, 1),
      repeatX: source.repeatX !== false,
      ready: false,
      error: false,
    };

    const providedImage = source.image ?? source.imageElement;
    if (this.#isImageLike(providedImage)) {
      state.image = providedImage;
      this.#attachImageStateHandlers(state, providedImage);
      return state;
    }

    if (state.imageSrc && typeof Image !== "undefined") {
      const image = new Image();
      image.decoding = "async";
      state.image = image;
      this.#attachImageStateHandlers(state, image);
      image.src = state.imageSrc;
      return state;
    }

    if (state.imageSrc) {
      state.error = true;
    }

    return state;
  }

  #attachImageStateHandlers(layer, image) {
    if (!layer || !image) {
      return;
    }

    if (this.#isImageReady(image)) {
      layer.ready = true;
      layer.error = false;
      return;
    }

    if (this.#isImageFailed(image)) {
      layer.ready = false;
      layer.error = true;
      return;
    }

    const onLoad = () => {
      layer.ready = this.#isImageReady(image);
      layer.error = !layer.ready;
      cleanup();
    };

    const onError = () => {
      layer.ready = false;
      layer.error = true;
      cleanup();
    };

    const cleanup = () => {
      if (typeof image.removeEventListener === "function") {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
      }
    };

    if (typeof image.addEventListener === "function") {
      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
    }
  }

  #isImageLike(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        ("complete" in value || "naturalWidth" in value || "width" in value)
    );
  }

  #isImageReady(image) {
    const complete = Boolean(image?.complete);
    if (!complete) {
      return false;
    }

    const width = this.#toFiniteNumber(image.naturalWidth ?? image.width, 0);
    const height = this.#toFiniteNumber(image.naturalHeight ?? image.height, 0);
    return width > 0 && height > 0;
  }

  #isImageFailed(image) {
    if (!image?.complete) {
      return false;
    }

    const width = this.#toFiniteNumber(image.naturalWidth ?? image.width, 0);
    const height = this.#toFiniteNumber(image.naturalHeight ?? image.height, 0);
    return width <= 0 || height <= 0;
  }

  #resolveDimension(primary, fallback) {
    const value = this.#toFiniteNumber(primary, fallback);
    return value > 0 ? value : 0;
  }

  #toFiniteNumber(value, defaultValue) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const fallback = Number(defaultValue);
    return Number.isFinite(fallback) ? fallback : 0;
  }

  #clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}
