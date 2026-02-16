import { Camera } from "./Camera.js";
import { EventBus } from "./EventBus.js";
import { Input } from "./Input.js";
import {
  CANVAS_BACKGROUND_COLOR,
  FIXED_UPS,
} from "../config/constants.js";

export class Game {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Game requires an HTMLCanvasElement.");
    }

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D rendering context is not available.");
    }

    this.canvas = canvas;
    this.ctx = context;

    this.running = false;
    this.rafId = null;
    this.lastTime = 0;
    this.accumulator = 0;

    this.ups = FIXED_UPS;
    this.fixedStepMs = 1000 / this.ups;

    this.viewWidth = 1;
    this.viewHeight = 1;
    this.dpr = 1;

    this.eventBus = new EventBus();
    this.input = new Input();
    this.camera = new Camera(this.viewWidth, this.viewHeight);

    this.scenes = new Map();
    this.currentSceneName = null;
    this.currentScene = null;
    this.sceneData = {};

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
  }

  registerScene(name, scene) {
    if (typeof name !== "string" || name.trim().length === 0 || scene == null) {
      throw new Error("registerScene(name, scene) requires a non-empty scene name and object.");
    }

    this.scenes.set(name, scene);
    return scene;
  }

  switchScene(name, payload = undefined) {
    if (!this.scenes.has(name)) {
      return false;
    }

    const nextScene = this.scenes.get(name);
    const previousScene = this.currentScene;
    const previousSceneName = this.currentSceneName;
    const transition = {
      from: previousSceneName,
      to: name,
      payload,
    };

    if (previousScene && typeof previousScene.onExit === "function") {
      previousScene.onExit(this, transition);
    }

    this.currentSceneName = name;
    this.currentScene = nextScene;

    if (nextScene && typeof nextScene.onEnter === "function") {
      const maybePromise = nextScene.onEnter(this, transition);
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch((error) => {
          this.eventBus.emit("scene:error", {
            scene: name,
            error,
          });
        });
      }
    }

    this.eventBus.emit("scene:switch", {
      from: previousSceneName,
      to: name,
      fromScene: previousScene,
      toScene: nextScene,
      name,
      payload,
    });

    return true;
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();

    this.input.attach();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown, { passive: false });
    this.canvas.addEventListener("pointermove", this.handlePointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", this.handlePointerUp, { passive: false });
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel, { passive: false });
    this.canvas.addEventListener("pointerleave", this.handlePointerUp, { passive: false });
    this.rafId = window.requestAnimationFrame(this.loop);
    this.eventBus.emit("game:start");
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.input.detach();
    window.removeEventListener("resize", this.handleResize);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.removeEventListener("pointerleave", this.handlePointerUp);

    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.eventBus.emit("game:stop");
  }

  handleResize() {
    this.dpr = window.devicePixelRatio || 1;
    this.viewWidth = Math.max(1, window.innerWidth);
    this.viewHeight = Math.max(1, window.innerHeight);

    this.canvas.style.width = `${this.viewWidth}px`;
    this.canvas.style.height = `${this.viewHeight}px`;
    this.canvas.style.touchAction = "none";
    this.canvas.width = Math.max(1, Math.round(this.viewWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.viewHeight * this.dpr));

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.camera.setViewport(this.viewWidth, this.viewHeight);

    if (this.currentScene && typeof this.currentScene.onResize === "function") {
      this.currentScene.onResize(this.viewWidth, this.viewHeight, this);
    }

    this.eventBus.emit("game:resize", {
      width: this.viewWidth,
      height: this.viewHeight,
      dpr: this.dpr,
    });
  }

  loop(now) {
    if (!this.running) {
      return;
    }

    let frameTime = now - this.lastTime;
    if (frameTime > 250) {
      frameTime = 250;
    }

    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedStepMs) {
      this.update(this.fixedStepMs / 1000);
      this.accumulator -= this.fixedStepMs;
    }

    const interpolationAlpha = this.accumulator / this.fixedStepMs;
    this.render(interpolationAlpha);

    this.rafId = window.requestAnimationFrame(this.loop);
  }

  update(deltaSeconds) {
    if (this.currentScene && typeof this.currentScene.update === "function") {
      this.currentScene.update(deltaSeconds, this);
    }

    this.camera.update();
  }

  render(interpolationAlpha) {
    this.ctx.fillStyle = CANVAS_BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    if (this.currentScene && typeof this.currentScene.render === "function") {
      this.currentScene.render(this.ctx, interpolationAlpha, this);
    }
  }

  handlePointerDown(event) {
    this.routePointerEvent("handlePointerDown", event);
  }

  handlePointerMove(event) {
    this.routePointerEvent("handlePointerMove", event);
  }

  handlePointerUp(event) {
    this.routePointerEvent("handlePointerUp", event);
  }

  handlePointerCancel(event) {
    this.routePointerEvent("handlePointerCancel", event);
  }

  routePointerEvent(handlerName, event) {
    if (!this.currentScene || typeof this.currentScene !== "object") {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pointer = {
      id: event.pointerId ?? 0,
      x,
      y,
      button: event.button ?? 0,
      buttons: event.buttons ?? 0,
      pointerType: event.pointerType ?? "unknown",
      originalEvent: event,
    };

    const handler = this.currentScene[handlerName];
    const fallbackName = handlerName.replace("handle", "on");
    const fallback = this.currentScene[fallbackName];

    let handled = false;
    if (typeof handler === "function") {
      handled = handler.call(this.currentScene, pointer, this) === true;
    } else if (typeof fallback === "function") {
      handled = fallback.call(this.currentScene, pointer, this) === true;
    }

    if (handled && event.cancelable) {
      event.preventDefault();
    }
  }
}
