function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNonNegativeInt(value, fallback = 0) {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

function toPositiveNumber(value, fallback = 0) {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return value > 0 ? value : fallback;
}

export class SpriteSheet {
  constructor(source, options = {}) {
    this.source = String(source ?? "");
    this.frameWidth = toPositiveNumber(options.frameWidth, 0);
    this.frameHeight = toPositiveNumber(options.frameHeight, 0);
    this.columns = toNonNegativeInt(options.columns, 0);
    this.rows = toNonNegativeInt(options.rows, 0);
    this.fallbackColor = options.fallbackColor || "#ff00ff";

    this.image = null;
    this._ready = false;
    this._error = null;
    this._loadPromise = null;
    this._namedFrames = new Map();
  }

  async load() {
    if (this._ready && this.image) {
      return true;
    }

    if (this._loadPromise) {
      return this._loadPromise;
    }

    this._loadPromise = new Promise((resolve) => {
      if (!this.source || typeof Image === "undefined") {
        this._ready = false;
        this._error = new Error("SpriteSheet image loading is unavailable.");
        this._loadPromise = null;
        resolve(false);
        return;
      }

      const image = new Image();
      this.image = image;

      let settled = false;
      const finalize = (ok, errorValue) => {
        if (settled) {
          return;
        }
        settled = true;

        image.onload = null;
        image.onerror = null;

        this._ready = ok;
        this._error = ok ? null : errorValue || new Error("SpriteSheet image failed to load.");

        if (ok) {
          if (!this.columns && this.frameWidth > 0) {
            this.columns = Math.floor(image.naturalWidth / this.frameWidth);
          }
          if (!this.rows && this.frameHeight > 0) {
            this.rows = Math.floor(image.naturalHeight / this.frameHeight);
          }
        }

        this._loadPromise = null;
        resolve(ok);
      };

      image.onload = () => finalize(true, null);
      image.onerror = () => finalize(false, new Error(`SpriteSheet load failed: ${this.source}`));

      try {
        image.src = this.source;
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        finalize(false, normalizedError);
      }

      if (image.complete) {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          finalize(true, null);
        } else {
          finalize(false, new Error(`SpriteSheet load failed: ${this.source}`));
        }
      }
    });

    return this._loadPromise;
  }

  isReady() {
    return this._ready;
  }

  setNamedFrames(map) {
    this._namedFrames.clear();
    if (!map) {
      return;
    }

    if (map instanceof Map) {
      for (const [name, selector] of map.entries()) {
        this._namedFrames.set(String(name), selector);
      }
      return;
    }

    if (typeof map === "object") {
      for (const [name, selector] of Object.entries(map)) {
        this._namedFrames.set(String(name), selector);
      }
    }
  }

  getNamedFrameRect(name) {
    return this._resolveNamedFrameRect(String(name), new Set());
  }

  getFrameRectByIndex(index) {
    const resolvedColumns = this._getColumns();
    const resolvedRows = this._getRows();
    const normalizedIndex = toNonNegativeInt(index, -1);

    if (normalizedIndex < 0 || resolvedColumns <= 0 || resolvedRows <= 0) {
      return null;
    }

    const maxFrames = resolvedColumns * resolvedRows;
    if (normalizedIndex >= maxFrames) {
      return null;
    }

    const row = Math.floor(normalizedIndex / resolvedColumns);
    const col = normalizedIndex % resolvedColumns;
    return this.getFrameRect(row, col);
  }

  getFrameRect(row, col) {
    const resolvedColumns = this._getColumns();
    const resolvedRows = this._getRows();
    const normalizedRow = toNonNegativeInt(row, -1);
    const normalizedCol = toNonNegativeInt(col, -1);

    if (
      normalizedRow < 0 ||
      normalizedCol < 0 ||
      resolvedColumns <= 0 ||
      resolvedRows <= 0 ||
      normalizedRow >= resolvedRows ||
      normalizedCol >= resolvedColumns ||
      this.frameWidth <= 0 ||
      this.frameHeight <= 0
    ) {
      return null;
    }

    const index = normalizedRow * resolvedColumns + normalizedCol;
    return {
      x: normalizedCol * this.frameWidth,
      y: normalizedRow * this.frameHeight,
      width: this.frameWidth,
      height: this.frameHeight,
      row: normalizedRow,
      col: normalizedCol,
      index,
    };
  }

  drawFrame(ctx, x, y, frameSelector, drawWidth, drawHeight) {
    if (!ctx) {
      return false;
    }

    const frameRect = this._resolveFrameSelector(frameSelector);
    const widthFromFrame = frameRect ? frameRect.width : this.frameWidth;
    const heightFromFrame = frameRect ? frameRect.height : this.frameHeight;
    const targetWidth = toPositiveNumber(drawWidth, toPositiveNumber(widthFromFrame, 0));
    const targetHeight = toPositiveNumber(drawHeight, toPositiveNumber(heightFromFrame, 0));

    const canDrawImage =
      this._ready &&
      !this._error &&
      this.image &&
      frameRect &&
      typeof ctx.drawImage === "function" &&
      targetWidth > 0 &&
      targetHeight > 0;

    if (canDrawImage) {
      try {
        ctx.drawImage(
          this.image,
          frameRect.x,
          frameRect.y,
          frameRect.width,
          frameRect.height,
          x,
          y,
          targetWidth,
          targetHeight
        );
        return true;
      } catch (_error) {
        // Fall through to fallback drawing path.
      }
    }

    if (typeof ctx.fillRect === "function" && targetWidth > 0 && targetHeight > 0) {
      if (typeof ctx.save === "function" && typeof ctx.restore === "function") {
        ctx.save();
        ctx.fillStyle = this.fallbackColor;
        ctx.fillRect(x, y, targetWidth, targetHeight);
        ctx.restore();
      } else {
        const previousFillStyle = ctx.fillStyle;
        ctx.fillStyle = this.fallbackColor;
        ctx.fillRect(x, y, targetWidth, targetHeight);
        ctx.fillStyle = previousFillStyle;
      }
    }

    return false;
  }

  _resolveFrameSelector(frameSelector) {
    if (typeof frameSelector === "number") {
      return this.getFrameRectByIndex(frameSelector);
    }

    if (typeof frameSelector === "string") {
      return this.getNamedFrameRect(frameSelector);
    }

    if (Array.isArray(frameSelector) && frameSelector.length >= 2) {
      return this.getFrameRect(frameSelector[0], frameSelector[1]);
    }

    if (frameSelector && typeof frameSelector === "object") {
      if (
        isFiniteNumber(frameSelector.x) &&
        isFiniteNumber(frameSelector.y) &&
        isFiniteNumber(frameSelector.width) &&
        isFiniteNumber(frameSelector.height)
      ) {
        const width = toPositiveNumber(frameSelector.width, 0);
        const height = toPositiveNumber(frameSelector.height, 0);
        if (width <= 0 || height <= 0) {
          return null;
        }

        return {
          x: frameSelector.x,
          y: frameSelector.y,
          width,
          height,
        };
      }

      if (isFiniteNumber(frameSelector.index)) {
        return this.getFrameRectByIndex(frameSelector.index);
      }

      if (isFiniteNumber(frameSelector.row) && isFiniteNumber(frameSelector.col)) {
        return this.getFrameRect(frameSelector.row, frameSelector.col);
      }
    }

    return null;
  }

  _resolveNamedFrameRect(name, visitedNames) {
    if (!name || !this._namedFrames.has(name) || visitedNames.has(name)) {
      return null;
    }

    visitedNames.add(name);
    const selector = this._namedFrames.get(name);

    if (typeof selector === "string" && this._namedFrames.has(selector)) {
      return this._resolveNamedFrameRect(selector, visitedNames);
    }

    return this._resolveFrameSelector(selector);
  }

  _getColumns() {
    if (this.columns > 0) {
      return this.columns;
    }
    if (this._ready && this.image && this.frameWidth > 0) {
      return Math.floor(this.image.naturalWidth / this.frameWidth);
    }
    return 0;
  }

  _getRows() {
    if (this.rows > 0) {
      return this.rows;
    }
    if (this._ready && this.image && this.frameHeight > 0) {
      return Math.floor(this.image.naturalHeight / this.frameHeight);
    }
    return 0;
  }
}
