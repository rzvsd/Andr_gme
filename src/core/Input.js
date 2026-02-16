const KEYBOARD_MAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
  ArrowUp: "jump",
  KeyW: "jump",
  KeyJ: "shoot",
  KeyK: "shoot",
  KeyX: "shoot",
};

const LEFT_RIGHT_DEADZONE_PX = 12;
const SWIPE_UP_THRESHOLD_PX = 32;

export class Input {
  constructor() {
    this.attached = false;
    this.touchControlsEnabled = true;

    this.keyboardState = {
      left: false,
      right: false,
      jump: false,
      shoot: false,
    };

    this.touchState = {
      left: false,
      right: false,
      shoot: false,
    };

    this.pressedState = {
      jump: false,
      shoot: false,
    };

    this.leftTouch = null;
    this.rightTouchId = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }

  clearTouchState() {
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.shoot = false;
    this.leftTouch = null;
    this.rightTouchId = null;
  }

  setTouchControlsEnabled(enabled) {
    this.touchControlsEnabled = enabled !== false;
    if (!this.touchControlsEnabled) {
      this.clearTouchState();
    }
  }

  attach() {
    if (this.attached) {
      return;
    }

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    window.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    window.addEventListener("touchend", this.handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", this.handleTouchEnd, { passive: false });

    this.attached = true;
  }

  detach() {
    if (!this.attached) {
      return;
    }

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("touchstart", this.handleTouchStart);
    window.removeEventListener("touchmove", this.handleTouchMove);
    window.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("touchcancel", this.handleTouchEnd);

    this.keyboardState.left = false;
    this.keyboardState.right = false;
    this.keyboardState.jump = false;
    this.keyboardState.shoot = false;

    this.clearTouchState();
    this.attached = false;
  }

  isPressed(action) {
    if (action === "left") {
      return this.keyboardState.left || this.touchState.left;
    }

    if (action === "right") {
      return this.keyboardState.right || this.touchState.right;
    }

    if (action === "jump") {
      return this.keyboardState.jump;
    }

    if (action === "shoot") {
      return this.keyboardState.shoot || this.touchState.shoot;
    }

    return false;
  }

  consumePressed(action) {
    if (action !== "jump" && action !== "shoot") {
      return false;
    }

    const wasPressed = this.pressedState[action];
    this.pressedState[action] = false;
    return wasPressed;
  }

  handleKeyDown(event) {
    const action = KEYBOARD_MAP[event.code];
    if (!action) {
      return;
    }

    if (!this.keyboardState[action]) {
      this.keyboardState[action] = true;
      if (action === "jump" || action === "shoot") {
        this.pressedState[action] = true;
      }
    }
  }

  handleKeyUp(event) {
    const action = KEYBOARD_MAP[event.code];
    if (!action) {
      return;
    }

    this.keyboardState[action] = false;
  }

  handleTouchStart(event) {
    if (!this.touchControlsEnabled) {
      return;
    }

    let handled = false;
    const halfWidth = window.innerWidth / 2;

    for (const touch of event.changedTouches) {
      if (touch.clientX <= halfWidth) {
        if (!this.leftTouch) {
          this.leftTouch = {
            id: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            jumpTriggered: false,
          };
          this.touchState.left = false;
          this.touchState.right = false;
          handled = true;
        }
      } else if (this.rightTouchId === null) {
        this.rightTouchId = touch.identifier;
        this.touchState.shoot = true;
        this.pressedState.shoot = true;
        handled = true;
      }
    }

    if (handled && event.cancelable) {
      event.preventDefault();
    }
  }

  handleTouchMove(event) {
    if (!this.touchControlsEnabled) {
      return;
    }

    let handled = false;

    for (const touch of event.changedTouches) {
      if (this.leftTouch && touch.identifier === this.leftTouch.id) {
        const dx = touch.clientX - this.leftTouch.startX;
        const upwardDistance = this.leftTouch.startY - touch.clientY;

        if (dx <= -LEFT_RIGHT_DEADZONE_PX) {
          this.touchState.left = true;
          this.touchState.right = false;
        } else if (dx >= LEFT_RIGHT_DEADZONE_PX) {
          this.touchState.left = false;
          this.touchState.right = true;
        } else {
          this.touchState.left = false;
          this.touchState.right = false;
        }

        if (!this.leftTouch.jumpTriggered && upwardDistance >= SWIPE_UP_THRESHOLD_PX) {
          this.leftTouch.jumpTriggered = true;
          this.pressedState.jump = true;
        }

        handled = true;
      }

      if (this.rightTouchId !== null && touch.identifier === this.rightTouchId) {
        this.touchState.shoot = true;
        handled = true;
      }
    }

    if (handled && event.cancelable) {
      event.preventDefault();
    }
  }

  handleTouchEnd(event) {
    if (!this.touchControlsEnabled) {
      return;
    }

    let handled = false;

    for (const touch of event.changedTouches) {
      if (this.leftTouch && touch.identifier === this.leftTouch.id) {
        this.leftTouch = null;
        this.touchState.left = false;
        this.touchState.right = false;
        handled = true;
      }

      if (this.rightTouchId !== null && touch.identifier === this.rightTouchId) {
        this.rightTouchId = null;
        this.touchState.shoot = false;
        handled = true;
      }
    }

    if (handled && event.cancelable) {
      event.preventDefault();
    }
  }
}
