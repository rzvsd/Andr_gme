const ACTION_LEFT = "left";
const ACTION_RIGHT = "right";
const ACTION_JUMP = "jump";
const ACTION_SHOOT = "shoot";
const ACTIONS = [ACTION_LEFT, ACTION_RIGHT, ACTION_JUMP, ACTION_SHOOT];

const TOUCH_ZONE_RATIO = 0.42;
const MAX_POINTERS_PER_PLAYER = 2;
const HORIZONTAL_DEADZONE_PX = 10;
const SWIPE_UP_THRESHOLD_PX = 28;
const SHOOT_HOLD_DELAY_MS = 120;
const TAP_SHOOT_MAX_MS = 240;
const TAP_MAX_TRAVEL_PX = 24;

const KEY_BINDINGS = Object.freeze({
  KeyA: { playerIndex: 0, action: ACTION_LEFT },
  KeyD: { playerIndex: 0, action: ACTION_RIGHT },
  KeyW: { playerIndex: 0, action: ACTION_JUMP },
  Space: { playerIndex: 0, action: ACTION_JUMP },
  KeyJ: { playerIndex: 0, action: ACTION_SHOOT },
  KeyX: { playerIndex: 0, action: ACTION_SHOOT },

  ArrowLeft: { playerIndex: 1, action: ACTION_LEFT },
  ArrowRight: { playerIndex: 1, action: ACTION_RIGHT },
  ArrowUp: { playerIndex: 1, action: ACTION_JUMP },
  Enter: { playerIndex: 1, action: ACTION_JUMP },
  KeyL: { playerIndex: 1, action: ACTION_SHOOT },
  Semicolon: { playerIndex: 1, action: ACTION_SHOOT },
});

function createActionFlags() {
  return {
    left: false,
    right: false,
    jump: false,
    shoot: false,
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getPointerId(pointer) {
  if (!pointer || typeof pointer !== "object") {
    return null;
  }
  const value = pointer.id ?? pointer.pointerId ?? pointer.identifier;
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function getPointerX(pointer) {
  if (!pointer || typeof pointer !== "object") {
    return null;
  }
  const value = pointer.x ?? pointer.clientX ?? pointer.pageX;
  return isFiniteNumber(value) ? value : null;
}

function getPointerY(pointer) {
  if (!pointer || typeof pointer !== "object") {
    return null;
  }
  const value = pointer.y ?? pointer.clientY ?? pointer.pageY;
  return isFiniteNumber(value) ? value : null;
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export class VersusInput {
  constructor() {
    this.attached = false;

    this.players = [
      {
        keyboard: createActionFlags(),
        touch: createActionFlags(),
        pressed: createActionFlags(),
      },
      {
        keyboard: createActionFlags(),
        touch: createActionFlags(),
        pressed: createActionFlags(),
      },
    ];

    this.pointerSessions = new Map();
    // M7: up to MAX_POINTERS_PER_PLAYER fingers per player — first finger steers,
    // any finger can tap/hold shoot or swipe jump. Enables move + shoot at once.
    this.activePointersByPlayer = [[], []];

    this.playerInputs = [
      {
        isPressed: (action) => this.isPressed(0, action),
        consumePressed: (action) => this.consumePressed(0, action),
      },
      {
        isPressed: (action) => this.isPressed(1, action),
        consumePressed: (action) => this.consumePressed(1, action),
      },
    ];

    this.emptyInput = {
      isPressed: () => false,
      consumePressed: () => false,
    };

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  attach() {
    if (this.attached || typeof window === "undefined") {
      return;
    }
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.attached = true;
  }

  detach() {
    if (this.attached && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
    }
    this.attached = false;
    this.reset();
  }

  reset() {
    this.pointerSessions.clear();
    this.activePointersByPlayer[0] = [];
    this.activePointersByPlayer[1] = [];

    for (const player of this.players) {
      for (const action of ACTIONS) {
        player.keyboard[action] = false;
        player.touch[action] = false;
        player.pressed[action] = false;
      }
    }
  }

  getPlayerInput(playerIndex) {
    if (playerIndex === 0 || playerIndex === 1) {
      return this.playerInputs[playerIndex];
    }
    return this.emptyInput;
  }

  isPressed(playerIndex, action) {
    const player = this.players[playerIndex];
    if (!player || typeof action !== "string") {
      return false;
    }
    this.updateShootHoldForPlayer(playerIndex, getNowMs());

    const normalized = action.toLowerCase();
    if (normalized === ACTION_LEFT) {
      return player.keyboard.left || player.touch.left;
    }
    if (normalized === ACTION_RIGHT) {
      return player.keyboard.right || player.touch.right;
    }
    if (normalized === ACTION_JUMP) {
      return player.keyboard.jump;
    }
    if (normalized === ACTION_SHOOT) {
      return player.keyboard.shoot || player.touch.shoot;
    }
    return false;
  }

  consumePressed(playerIndex, action) {
    const player = this.players[playerIndex];
    if (!player || typeof action !== "string") {
      return false;
    }
    this.updateShootHoldForPlayer(playerIndex, getNowMs());

    const normalized = action.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(player.pressed, normalized)) {
      return false;
    }

    const wasPressed = player.pressed[normalized];
    player.pressed[normalized] = false;
    return wasPressed;
  }

  onKeyDown(event) {
    const binding = event?.code ? KEY_BINDINGS[event.code] : null;
    if (!binding) {
      return;
    }

    const player = this.players[binding.playerIndex];
    if (!player.keyboard[binding.action]) {
      player.keyboard[binding.action] = true;
      player.pressed[binding.action] = true;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  onKeyUp(event) {
    const binding = event?.code ? KEY_BINDINGS[event.code] : null;
    if (!binding) {
      return;
    }
    this.players[binding.playerIndex].keyboard[binding.action] = false;
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  handlePointerDown(pointer, viewWidth) {
    const pointerId = getPointerId(pointer);
    const x = getPointerX(pointer);
    const y = getPointerY(pointer);
    const width = this.resolveViewWidth(viewWidth);

    if (pointerId === null || x === null || y === null || width <= 0) {
      return false;
    }
    if (this.pointerSessions.has(pointerId)) {
      return false;
    }

    const playerIndex = this.resolveTouchPlayer(x, width);
    if (playerIndex < 0) {
      return false;
    }
    const activeList = this.activePointersByPlayer[playerIndex];
    if (!Array.isArray(activeList) || activeList.length >= MAX_POINTERS_PER_PLAYER) {
      return false;
    }

    const nowMs = getNowMs();
    const session = {
      id: pointerId,
      playerIndex,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      downAtMs: nowMs,
      jumpTriggered: false,
      shootHoldTriggered: false,
      zoneWidth: width * TOUCH_ZONE_RATIO,
      viewWidth: width,
    };

    this.pointerSessions.set(pointerId, session);
    this.activePointersByPlayer[playerIndex].push(pointerId);
    // Only the first (steering) finger drives movement; second finger is actions-only.
    if (this.activePointersByPlayer[playerIndex][0] === pointerId) {
      this.syncTouchMoveDirection(session);
    }
    this.updateShootHold(session, nowMs);
    return true;
  }

  handlePointerMove(pointer, viewWidth) {
    const pointerId = getPointerId(pointer);
    if (pointerId === null) {
      return false;
    }

    const session = this.pointerSessions.get(pointerId);
    if (!session) {
      return false;
    }

    const x = getPointerX(pointer);
    const y = getPointerY(pointer);
    if (x !== null) {
      session.lastX = x;
    }
    if (y !== null) {
      session.lastY = y;
    }

    const width = this.resolveViewWidth(viewWidth);
    if (width > 0) {
      session.viewWidth = width;
      session.zoneWidth = width * TOUCH_ZONE_RATIO;
    }

    // Only the steering finger (first) drives left/right; action finger moves freely.
    if (this.activePointersByPlayer[session.playerIndex]?.[0] === pointerId) {
      this.syncTouchMoveDirection(session);
    }
    if (!session.jumpTriggered && session.startY - session.lastY >= SWIPE_UP_THRESHOLD_PX) {
      session.jumpTriggered = true;
      this.players[session.playerIndex].pressed.jump = true;
    }
    this.updateShootHold(session, getNowMs());
    return true;
  }

  handlePointerUp(pointer) {
    return this.releasePointer(pointer, true);
  }

  handlePointerCancel(pointer) {
    return this.releasePointer(pointer, false);
  }

  resolveViewWidth(viewWidth) {
    if (isFiniteNumber(viewWidth) && viewWidth > 0) {
      return viewWidth;
    }
    if (typeof window !== "undefined" && isFiniteNumber(window.innerWidth) && window.innerWidth > 0) {
      return window.innerWidth;
    }
    return 0;
  }

  resolveTouchPlayer(x, viewWidth) {
    const zoneWidth = viewWidth * TOUCH_ZONE_RATIO;
    if (x <= zoneWidth) {
      return 0;
    }
    if (x >= viewWidth - zoneWidth) {
      return 1;
    }
    return -1;
  }

  syncTouchMoveDirection(session) {
    const player = this.players[session.playerIndex];
    const zoneCenterX = session.playerIndex === 0
      ? session.zoneWidth * 0.5
      : session.viewWidth - session.zoneWidth * 0.5;
    const deltaX = session.lastX - zoneCenterX;

    if (deltaX <= -HORIZONTAL_DEADZONE_PX) {
      player.touch.left = true;
      player.touch.right = false;
      return;
    }
    if (deltaX >= HORIZONTAL_DEADZONE_PX) {
      player.touch.left = false;
      player.touch.right = true;
      return;
    }
    player.touch.left = false;
    player.touch.right = false;
  }

  updateShootHold(session, nowMs) {
    const player = this.players[session.playerIndex];
    if (!session.shootHoldTriggered && nowMs - session.downAtMs >= SHOOT_HOLD_DELAY_MS) {
      session.shootHoldTriggered = true;
      player.pressed.shoot = true;
    }
    this.recomputeTouchShoot(session.playerIndex);
  }

  recomputeTouchShoot(playerIndex) {
    const player = this.players[playerIndex];
    if (!player) {
      return;
    }
    const ids = this.activePointersByPlayer[playerIndex] ?? [];
    let held = false;
    for (const id of ids) {
      const session = this.pointerSessions.get(id);
      if (session?.shootHoldTriggered) {
        held = true;
        break;
      }
    }
    player.touch.shoot = held;
  }

  updateShootHoldForPlayer(playerIndex, nowMs) {
    const ids = this.activePointersByPlayer[playerIndex] ?? [];
    if (ids.length === 0) {
      return;
    }
    let pruned = false;
    for (const id of [...ids]) {
      const session = this.pointerSessions.get(id);
      if (!session) {
        const at = this.activePointersByPlayer[playerIndex].indexOf(id);
        if (at >= 0) {
          this.activePointersByPlayer[playerIndex].splice(at, 1);
          pruned = true;
        }
        continue;
      }
      this.updateShootHold(session, nowMs);
    }
    if (pruned) {
      this.recomputeTouchShoot(playerIndex);
    }
  }

  releasePointer(pointer, allowTapShoot) {
    const pointerId = getPointerId(pointer);
    if (pointerId === null) {
      return false;
    }

    const session = this.pointerSessions.get(pointerId);
    if (!session) {
      return false;
    }

    const x = getPointerX(pointer);
    const y = getPointerY(pointer);
    if (x !== null) {
      session.lastX = x;
    }
    if (y !== null) {
      session.lastY = y;
    }

    const nowMs = getNowMs();
    this.updateShootHold(session, nowMs);
    const holdDuration = nowMs - session.downAtMs;
    const travelX = Math.abs(session.lastX - session.startX);
    const travelY = Math.abs(session.lastY - session.startY);

    if (
      allowTapShoot &&
      !session.shootHoldTriggered &&
      !session.jumpTriggered &&
      holdDuration <= TAP_SHOOT_MAX_MS &&
      travelX <= TAP_MAX_TRAVEL_PX &&
      travelY <= TAP_MAX_TRAVEL_PX
    ) {
      this.players[session.playerIndex].pressed.shoot = true;
    }

    this.pointerSessions.delete(pointerId);
    const activeList = this.activePointersByPlayer[session.playerIndex];
    const wasSteering = Array.isArray(activeList) && activeList[0] === pointerId;
    if (Array.isArray(activeList)) {
      const at = activeList.indexOf(pointerId);
      if (at >= 0) {
        activeList.splice(at, 1);
      }
    }

    const player = this.players[session.playerIndex];
    if (wasSteering) {
      // Promote the remaining finger to steering so movement never sticks.
      const nextId = this.activePointersByPlayer[session.playerIndex][0];
      const nextSession = nextId !== undefined ? this.pointerSessions.get(nextId) : null;
      if (nextSession) {
        this.syncTouchMoveDirection(nextSession);
      } else {
        player.touch.left = false;
        player.touch.right = false;
      }
    }
    this.recomputeTouchShoot(session.playerIndex);
    return true;
  }
}

export default VersusInput;
