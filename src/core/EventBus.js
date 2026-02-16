export class EventBus {
  constructor() {
    this.events = new Map();
    this._handlingError = false;
  }

  on(eventName, handler) {
    if (typeof handler !== "function") {
      return () => {};
    }

    const handlers = this.events.get(eventName) ?? new Set();
    handlers.add(handler);
    this.events.set(eventName, handlers);

    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const handlers = this.events.get(eventName);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.events.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const handlers = this.events.get(eventName);
    if (!handlers || handlers.size === 0) return;

    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        this.#reportHandlerError(eventName, handler, payload, error);
      }
    }
  }

  #reportHandlerError(eventName, handler, payload, error) {
    if (this._handlingError) {
      console.error("[EventBus] Nested handler error.", error);
      return;
    }

    const errorPayload = {
      eventName,
      handler,
      payload,
      error,
    };

    const errorHandlers = this.events.get("eventbus:error");
    if (!errorHandlers || errorHandlers.size === 0) {
      console.error("[EventBus] Handler threw while emitting event.", errorPayload);
      return;
    }

    this._handlingError = true;
    try {
      for (const errorHandler of [...errorHandlers]) {
        try {
          errorHandler(errorPayload);
        } catch (nestedError) {
          console.error("[EventBus] Error handler threw.", nestedError);
        }
      }
    } finally {
      this._handlingError = false;
    }
  }
}
