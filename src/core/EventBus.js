export class EventBus {
  constructor() {
    this.events = new Map();
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
      handler(payload);
    }
  }
}
