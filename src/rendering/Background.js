const DEFAULT_FALLBACK_COLOR = "#000";
const DEFAULT_MAX_IMAGE_CACHE_ENTRIES = 32;

export class Background {
  constructor(
    layers = [],
    fallbackColor = DEFAULT_FALLBACK_COLOR,
    maxImageCacheEntries = DEFAULT_MAX_IMAGE_CACHE_ENTRIES
  ) {
    this.fallbackColor =
      typeof fallbackColor === "string" ? fallbackColor : DEFAULT_FALLBACK_COLOR;
    this.layers = [];
    this._imageCache = new Map();
    this._maxImageCacheEntries = this.#resolveCacheLimit(maxImageCacheEntries);
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
      if (!layer || !layer.image) {
        continue;
      }

      if (!layer.ready) {
        layer.ready = this.#isImageReady(layer.image);
        layer.error = !layer.ready && this.#isImageFailed(layer.image);
      }

      if (layer.error || !layer.ready) {
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
      state.ready = this.#isImageReady(providedImage);
      state.error = !state.ready && this.#isImageFailed(providedImage);
      return state;
    }

    if (state.imageSrc && typeof Image !== "undefined") {
      const image = this.#getCachedImage(state.imageSrc);
      image.decoding = "async";
      state.image = image;
      state.ready = this.#isImageReady(image);
      state.error = !state.ready && this.#isImageFailed(image);
      return state;
    }

    if (state.imageSrc) {
      state.error = true;
    }

    return state;
  }

  #getCachedImage(imageSrc) {
    if (this._imageCache.has(imageSrc)) {
      const image = this._imageCache.get(imageSrc);
      this._imageCache.delete(imageSrc);
      this._imageCache.set(imageSrc, image);
      return image;
    }

    const image = new Image();
    image.decoding = "async";
    image.src = imageSrc;
    this._imageCache.set(imageSrc, image);
    this.#trimImageCache();
    return image;
  }

  #trimImageCache() {
    while (this._imageCache.size > this._maxImageCacheEntries) {
      const oldestKey = this._imageCache.keys().next().value;
      if (typeof oldestKey === "undefined") {
        break;
      }
      this._imageCache.delete(oldestKey);
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

  #resolveCacheLimit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_MAX_IMAGE_CACHE_ENTRIES;
    }

    return Math.max(1, Math.floor(numeric));
  }
}
