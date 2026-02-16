import * as ButtonModule from "../ui/Button.js";

const ButtonClass = ButtonModule.Button;

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object";
}

function asPointer(pointer) {
  if (!isObject(pointer)) {
    return null;
  }

  const x = asNumber(pointer.x, asNumber(pointer.clientX, NaN));
  const y = asNumber(pointer.y, asNumber(pointer.clientY, NaN));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x,
    y,
    id: pointer.id ?? pointer.pointerId ?? pointer.identifier ?? "primary",
  };
}

function rectContains(rect, pointer) {
  return (
    pointer.x >= rect.x &&
    pointer.x <= rect.x + rect.width &&
    pointer.y >= rect.y &&
    pointer.y <= rect.y + rect.height
  );
}

function callAny(target, names, argsVariants) {
  if (!isObject(target)) {
    return { called: false, value: undefined };
  }

  for (const name of names) {
    if (typeof target[name] !== "function") {
      continue;
    }

    for (const args of argsVariants) {
      try {
        const value = target[name](...args);
        return { called: true, value };
      } catch {
        // Try the next call pattern.
      }
    }
  }

  return { called: false, value: undefined };
}

function pointerAliases(methodName) {
  if (methodName === "handlePointerDown") {
    return ["handlePointerDown", "pointerDown", "onPointerDown"];
  }
  if (methodName === "handlePointerMove") {
    return ["handlePointerMove", "pointerMove", "onPointerMove"];
  }
  if (methodName === "handlePointerUp") {
    return ["handlePointerUp", "pointerUp", "onPointerUp"];
  }
  if (methodName === "handlePointerCancel") {
    return ["handlePointerCancel", "pointerCancel", "onPointerCancel"];
  }
  return [methodName];
}

export class PauseScene {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.buttons = [];
    this.resumeButton = null;
    this.restartButton = null;
    this.menuButton = null;
    this.activePointerId = null;
    this.activeButton = null;
  }

  onEnter(game, transition) {
    this.resumeButton = this.createButton("Resume", () => {
      game.switchScene("game", { resume: true });
    });
    this.restartButton = this.createButton("Restart", () => {
      game.switchScene("game", { restart: true });
    });
    this.menuButton = this.createButton("Menu", () => {
      game.switchScene("menu");
    });

    this.buttons = [this.resumeButton, this.restartButton, this.menuButton];
    this.activePointerId = null;
    this.activeButton = null;

    this.onResize(
      asNumber(game?.viewWidth, this.width),
      asNumber(game?.viewHeight, this.height),
      game,
    );
  }

  onExit(game, transition) {
    this.activePointerId = null;
    this.activeButton = null;
    for (const button of this.buttons) {
      this.setPressed(button, false);
    }
  }

  onResize(width, height, game) {
    this.width = Math.max(1, asNumber(width, 1));
    this.height = Math.max(1, asNumber(height, 1));

    const buttonWidth = Math.min(320, Math.max(190, this.width * 0.3));
    const buttonHeight = Math.min(70, Math.max(50, this.height * 0.08));
    const gap = Math.max(14, this.height * 0.02);
    const startY = this.height * 0.42;
    const x = (this.width - buttonWidth) * 0.5;

    this.setButtonRect(this.resumeButton, x, startY, buttonWidth, buttonHeight);
    this.setButtonRect(this.restartButton, x, startY + buttonHeight + gap, buttonWidth, buttonHeight);
    this.setButtonRect(this.menuButton, x, startY + (buttonHeight + gap) * 2, buttonWidth, buttonHeight);
  }

  update(dt, game) {
    for (const button of this.buttons) {
      callAny(button, ["update"], [[dt, game], [dt], []]);
    }
  }

  render(ctx, alpha, game) {
    ctx.save();

    ctx.fillStyle = "rgba(4, 10, 22, 0.72)";
    ctx.fillRect(0, 0, this.width, this.height);

    const panelWidth = Math.min(520, this.width * 0.72);
    const panelHeight = Math.min(420, this.height * 0.68);
    const panelX = (this.width - panelWidth) * 0.5;
    const panelY = (this.height - panelHeight) * 0.5;

    ctx.fillStyle = "rgba(13, 27, 52, 0.92)";
    ctx.strokeStyle = "#6b87be";
    ctx.lineWidth = 2;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    ctx.fillStyle = "#ecf2ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 48px Arial";
    ctx.fillText("PAUSED", this.width * 0.5, this.height * 0.28);

    for (const button of this.buttons) {
      this.renderButton(ctx, button);
    }

    ctx.restore();
  }

  handlePointerDown(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }

    const routed = this.routePointer("handlePointerDown", point, game);
    if (routed) {
      return true;
    }

    const button = this.findButtonAt(point);
    if (!button) {
      return false;
    }

    this.activePointerId = point.id;
    this.activeButton = button;
    this.setPressed(button, true);
    return true;
  }

  handlePointerMove(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }

    const routed = this.routePointer("handlePointerMove", point, game);
    if (routed) {
      return true;
    }

    if (this.activePointerId !== point.id || !this.activeButton) {
      return false;
    }

    const inside = rectContains(this.getButtonRect(this.activeButton), point);
    this.setPressed(this.activeButton, inside);
    return true;
  }

  handlePointerUp(pointer, game) {
    const point = asPointer(pointer);
    if (!point) {
      return false;
    }

    const routed = this.routePointer("handlePointerUp", point, game);
    if (routed) {
      return true;
    }

    if (this.activePointerId !== point.id || !this.activeButton) {
      return false;
    }

    const button = this.activeButton;
    const inside = rectContains(this.getButtonRect(button), point);
    this.setPressed(button, false);
    this.activePointerId = null;
    this.activeButton = null;

    if (!inside) {
      return true;
    }

    this.pressButton(button, game);
    return true;
  }

  handlePointerCancel(pointer, game) {
    const point = asPointer(pointer);
    const routed = point ? this.routePointer("handlePointerCancel", point, game) : false;
    if (routed) {
      return true;
    }

    if (this.activeButton) {
      this.setPressed(this.activeButton, false);
      this.activeButton = null;
      this.activePointerId = null;
      return true;
    }

    return false;
  }

  createButton(label, onPress) {
    let button = null;
    const options = {
      label,
      text: label,
      onPress,
      onTap: onPress,
      onClick: onPress,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    if (typeof ButtonClass === "function") {
      const factories = [
        () => new ButtonClass(options),
        () => new ButtonClass(label, 0, 0, 0, 0, onPress),
        () => new ButtonClass(0, 0, 0, 0, label, onPress),
      ];

      for (const create of factories) {
        try {
          button = create();
          break;
        } catch {
          // Try next signature.
        }
      }
    }

    if (!isObject(button)) {
      button = {};
    }

    button.__sceneButton = {
      label,
      onPress,
      pressed: false,
      rect: { x: 0, y: 0, width: 0, height: 0 },
    };

    return button;
  }

  setButtonRect(button, x, y, width, height) {
    if (!isObject(button)) {
      return;
    }

    const rect = {
      x: asNumber(x, 0),
      y: asNumber(y, 0),
      width: Math.max(0, asNumber(width, 0)),
      height: Math.max(0, asNumber(height, 0)),
    };

    callAny(button, ["setBounds", "setRect", "setFrame"], [[rect.x, rect.y, rect.width, rect.height], [rect]]);
    callAny(button, ["setPosition"], [[rect.x, rect.y]]);
    callAny(button, ["setSize", "resize"], [[rect.width, rect.height]]);

    if ("x" in button) {
      button.x = rect.x;
    }
    if ("y" in button) {
      button.y = rect.y;
    }
    if ("width" in button) {
      button.width = rect.width;
    }
    if ("height" in button) {
      button.height = rect.height;
    }
    if (isObject(button.bounds)) {
      button.bounds.x = rect.x;
      button.bounds.y = rect.y;
      button.bounds.width = rect.width;
      button.bounds.height = rect.height;
    }
    if (isObject(button.__sceneButton)) {
      button.__sceneButton.rect = rect;
    }
  }

  getButtonRect(button) {
    if (!isObject(button)) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    if (isObject(button.bounds)) {
      return {
        x: asNumber(button.bounds.x, 0),
        y: asNumber(button.bounds.y, 0),
        width: Math.max(0, asNumber(button.bounds.width, 0)),
        height: Math.max(0, asNumber(button.bounds.height, 0)),
      };
    }

    if (isObject(button.__sceneButton) && isObject(button.__sceneButton.rect)) {
      return button.__sceneButton.rect;
    }

    return {
      x: asNumber(button.x, 0),
      y: asNumber(button.y, 0),
      width: Math.max(0, asNumber(button.width, 0)),
      height: Math.max(0, asNumber(button.height, 0)),
    };
  }

  setPressed(button, pressed) {
    if (!isObject(button)) {
      return;
    }

    callAny(button, ["setPressed", "setDown", "setActive"], [[pressed]]);
    if ("pressed" in button) {
      button.pressed = pressed;
    }
    if (isObject(button.__sceneButton)) {
      button.__sceneButton.pressed = pressed;
    }
  }

  findButtonAt(pointer) {
    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const button = this.buttons[i];
      if (rectContains(this.getButtonRect(button), pointer)) {
        return button;
      }
    }
    return null;
  }

  pressButton(button, game) {
    const result = callAny(button, ["press", "trigger", "click", "onPress", "onTap", "onClick"], [[game], []]);
    if (result.called) {
      return;
    }

    if (isObject(button.__sceneButton) && typeof button.__sceneButton.onPress === "function") {
      button.__sceneButton.onPress(game);
    }
  }

  renderButton(ctx, button) {
    const result = callAny(button, ["render", "draw"], [[ctx, this], [ctx]]);
    if (result.called) {
      return;
    }

    const rect = this.getButtonRect(button);
    const meta = isObject(button.__sceneButton) ? button.__sceneButton : null;
    const pressed = Boolean(meta?.pressed);

    ctx.save();
    ctx.fillStyle = pressed ? "#5f3d3d" : "#7b4f4f";
    ctx.strokeStyle = "#f2d7d7";
    ctx.lineWidth = 2;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 24px Arial";
    ctx.fillText(meta?.label ?? "Button", rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
    ctx.restore();
  }

  routePointer(methodName, pointer, game) {
    const names = pointerAliases(methodName);

    for (let i = this.buttons.length - 1; i >= 0; i -= 1) {
      const button = this.buttons[i];
      const result = callAny(button, names, [[pointer, game], [pointer], [pointer.x, pointer.y, pointer.id]]);
      if (result.called && Boolean(result.value)) {
        return true;
      }
    }

    return false;
  }
}
