export class ObjectPool {
  constructor(factory, reset) {
    if (typeof factory !== 'function') {
      throw new TypeError('ObjectPool factory must be a function');
    }

    if (reset !== undefined && typeof reset !== 'function') {
      throw new TypeError('ObjectPool reset must be a function');
    }

    this._factory = factory;
    this._reset = reset;
    this._available = [];
    this._availableSet = new Set();
    this._active = new Set();
    this._all = new Set();
  }

  get size() {
    return this._all.size;
  }

  get activeCount() {
    return this._active.size;
  }

  acquire() {
    let obj;

    if (this._available.length > 0) {
      obj = this._available.pop();
      this._availableSet.delete(obj);
    } else {
      obj = this._factory();
      this._all.add(obj);
    }

    this._active.add(obj);
    return obj;
  }

  preallocate(count) {
    const target = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    for (let i = 0; i < target; i += 1) {
      const obj = this._factory();
      this._all.add(obj);
      if (!this._availableSet.has(obj)) {
        this._available.push(obj);
        this._availableSet.add(obj);
      }
    }
  }

  release(obj) {
    if (!this._active.has(obj)) {
      return;
    }

    this._active.delete(obj);

    if (this._reset) {
      this._reset(obj);
    }

    if (!this._availableSet.has(obj)) {
      this._available.push(obj);
      this._availableSet.add(obj);
    }
  }

  clear() {
    this._available.length = 0;
    this._availableSet.clear();
    this._active.clear();
    this._all.clear();
  }
}
