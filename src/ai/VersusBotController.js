const ACTIONS = Object.freeze(["left", "right", "jump", "shoot"]);
const DEFAULT_LOOKAHEAD_SECONDS = 0.52;
const DEFAULT_LANE_TOLERANCE_Y = 24;
const DEFAULT_SAFE_EDGE_INSET = 30;
const DEFAULT_TARGET_EPSILON = 4;
const DEFAULT_JUMP_REPEAT_MS = 120;
const DEFAULT_SHOOT_REPEAT_MS = 90;
const DEFAULT_MOVE_THREAT_SECONDS = 0.18;
const DEFAULT_JUMP_THREAT_SECONDS = 0.14;
const DEFAULT_SHOT_RANGE_X = 680;

function createActionFlags() {
  return {
    left: false,
    right: false,
    jump: false,
    shoot: false,
  };
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isActiveEntity(entity) {
  return Boolean(entity) && entity.active !== false;
}

function centerOf(entity) {
  return {
    x: toNumber(entity?.x, 0) + toNumber(entity?.width, 0) * 0.5,
    y: toNumber(entity?.y, 0) + toNumber(entity?.height, 0) * 0.5,
  };
}

function clamp(value, min, max) {
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
}

function getPlatformBounds(platform) {
  if (platform && typeof platform.getPlayerCollisionBounds === "function") {
    return platform.getPlayerCollisionBounds();
  }
  return platform ?? null;
}

function getSafeZone(platform, entity, edgeInset = DEFAULT_SAFE_EDGE_INSET) {
  const bounds = getPlatformBounds(platform);
  if (!bounds) {
    return null;
  }

  const entityWidth = Math.max(0, toNumber(entity?.width, 0));
  const platformX = toNumber(bounds.x, 0);
  const platformWidth = Math.max(0, toNumber(bounds.width, 0));
  const inset = Math.max(0, edgeInset);
  const safeMinX = platformX + inset;
  const safeMaxX = platformX + Math.max(0, platformWidth - entityWidth - inset);
  const preferredX = clamp(
    platformX + platformWidth * 0.5 - entityWidth * 0.5,
    safeMinX,
    safeMaxX
  );

  return {
    minX: safeMinX,
    maxX: safeMaxX,
    preferredX,
    platformX,
    platformWidth,
    entityWidth,
  };
}

export function findIncomingThreat(self, bullets, options = {}) {
  if (!isActiveEntity(self) || !Array.isArray(bullets) || bullets.length === 0) {
    return null;
  }

  const selfCenter = centerOf(self);
  const lookaheadSeconds = Math.max(0.05, toNumber(options.lookaheadSeconds, DEFAULT_LOOKAHEAD_SECONDS));
  const laneToleranceY = Math.max(8, toNumber(options.laneToleranceY, DEFAULT_LANE_TOLERANCE_Y));

  let closestThreat = null;

  for (const bullet of bullets) {
    if (!isActiveEntity(bullet) || bullet.owner === self) {
      continue;
    }

    const bulletCenter = centerOf(bullet);
    const vx = toNumber(
      bullet?.vx,
      toNumber(bullet?.directionX, 0) * toNumber(bullet?.speed, 0)
    );
    const vy = toNumber(
      bullet?.vy,
      toNumber(bullet?.directionY, 0) * toNumber(bullet?.speed, 0)
    );

    if (Math.abs(vx) <= 0.001) {
      continue;
    }

    const dx = selfCenter.x - bulletCenter.x;
    const timeToImpact = dx / vx;
    if (timeToImpact < 0 || timeToImpact > lookaheadSeconds) {
      continue;
    }

    const predictedY = bulletCenter.y + vy * timeToImpact;
    const verticalWindow = toNumber(self?.height, 0) * 0.45 + toNumber(bullet?.height, 0) * 0.8 + laneToleranceY;
    if (Math.abs(predictedY - selfCenter.y) > verticalWindow) {
      continue;
    }

    const threat = {
      bullet,
      timeToImpact,
      directionX: vx < 0 ? -1 : 1,
      predictedY,
    };

    if (!closestThreat || threat.timeToImpact < closestThreat.timeToImpact) {
      closestThreat = threat;
    }
  }

  return closestThreat;
}

export function planVersusBotFrame(context = {}, options = {}) {
  const self = context?.self ?? null;
  const opponent = context?.opponent ?? null;
  const bullets = Array.isArray(context?.bullets) ? context.bullets : [];
  const nowMs = toNumber(context?.nowMs, 0);
  const safeZone = getSafeZone(
    context?.ownPlatform ?? context?.platform ?? null,
    self,
    Math.max(0, toNumber(options.safeEdgeInset, DEFAULT_SAFE_EDGE_INSET))
  );
  const targetEpsilon = Math.max(1, toNumber(options.targetEpsilon, DEFAULT_TARGET_EPSILON));
  const shotRangeX = Math.max(60, toNumber(options.shotRangeX, DEFAULT_SHOT_RANGE_X));
  const laneToleranceY = Math.max(8, toNumber(options.laneToleranceY, DEFAULT_LANE_TOLERANCE_Y));
  const moveThreatSeconds = Math.max(0.05, toNumber(options.moveThreatSeconds, DEFAULT_MOVE_THREAT_SECONDS));
  const jumpThreatSeconds = Math.max(0.04, toNumber(options.jumpThreatSeconds, DEFAULT_JUMP_THREAT_SECONDS));
  const jumpRepeatMs = Math.max(0, toNumber(options.jumpRepeatMs, DEFAULT_JUMP_REPEAT_MS));
  const shootRepeatMs = Math.max(0, toNumber(options.shootRepeatMs, DEFAULT_SHOOT_REPEAT_MS));

  const actions = createActionFlags();
  const pressed = createActionFlags();

  if (!isActiveEntity(self) || !isActiveEntity(opponent) || !safeZone) {
    return {
      actions,
      pressed,
      debug: {
        reason: "inactive",
        preferredX: safeZone?.preferredX ?? null,
        nowMs,
      },
    };
  }

  const selfCenter = centerOf(self);
  const opponentCenter = centerOf(opponent);
  const threat = findIncomingThreat(self, bullets, {
    lookaheadSeconds: options.lookaheadSeconds,
    laneToleranceY,
  });
  const desiredFacing = opponentCenter.x < selfCenter.x ? -1 : 1;
  const preferredCombatX = clamp(
    safeZone.platformX + safeZone.platformWidth * (desiredFacing < 0 ? 0.28 : 0.72) - safeZone.entityWidth * 0.5,
    safeZone.minX,
    safeZone.maxX
  );
  const horizontalToOpponent = opponentCenter.x - selfCenter.x;
  const verticalDelta = Math.abs(opponentCenter.y - selfCenter.y);
  const inFiringLane =
    Math.abs(horizontalToOpponent) <= shotRangeX &&
    verticalDelta <= laneToleranceY &&
    Math.sign(horizontalToOpponent || desiredFacing) === desiredFacing;
  const withinSafeZone =
    toNumber(self.x, 0) >= safeZone.minX - targetEpsilon &&
    toNumber(self.x, 0) <= safeZone.maxX + targetEpsilon;
  const roomLeft = Math.max(0, toNumber(self.x, 0) - safeZone.minX);
  const roomRight = Math.max(0, safeZone.maxX - toNumber(self.x, 0));

  let targetX = preferredCombatX;
  let reason = "center";

  if (threat) {
    reason = "threat";
    const dodgeDirection = threat.directionX > 0 ? 1 : -1;
    const awayRoom = dodgeDirection > 0 ? roomRight : roomLeft;
    const bestDirection = roomRight >= roomLeft ? 1 : -1;

    if (awayRoom > targetEpsilon && threat.timeToImpact >= moveThreatSeconds) {
      targetX = dodgeDirection > 0 ? safeZone.maxX : safeZone.minX;
      reason = dodgeDirection > 0 ? "threat_move_right" : "threat_move_left";
    } else if (
      nowMs - toNumber(context?.lastJumpCommandAtMs, Number.NEGATIVE_INFINITY) >= jumpRepeatMs &&
      (self.onGround || threat.timeToImpact <= jumpThreatSeconds)
    ) {
      pressed.jump = true;
      reason = "threat_jump";
    } else if (bestDirection !== 0) {
      targetX = bestDirection > 0 ? safeZone.maxX : safeZone.minX;
      reason = bestDirection > 0 ? "threat_escape_right" : "threat_escape_left";
    }
  }

  if (toNumber(self.x, 0) < targetX - targetEpsilon) {
    actions.right = true;
  } else if (toNumber(self.x, 0) > targetX + targetEpsilon) {
    actions.left = true;
  }

  if (!threat && inFiringLane && self.facing !== desiredFacing) {
    if (desiredFacing < 0 && roomLeft > targetEpsilon) {
      actions.left = true;
      actions.right = false;
      reason = "face_left";
    } else if (desiredFacing > 0 && roomRight > targetEpsilon) {
      actions.right = true;
      actions.left = false;
      reason = "face_right";
    }
  } else if (
    !threat &&
    inFiringLane &&
    self.facing === desiredFacing &&
    typeof self.canShoot === "function" &&
    self.canShoot(nowMs) &&
    nowMs - toNumber(context?.lastShootCommandAtMs, Number.NEGATIVE_INFINITY) >= shootRepeatMs
  ) {
    pressed.shoot = true;
    reason = "attack";
  }

  if (!threat && !actions.left && !actions.right && !withinSafeZone) {
    if (toNumber(self.x, 0) < preferredCombatX) {
      actions.right = true;
      reason = "recover_right";
    } else if (toNumber(self.x, 0) > preferredCombatX) {
      actions.left = true;
      reason = "recover_left";
    }
  }

  return {
    actions,
    pressed,
    debug: {
      reason,
      preferredX: preferredCombatX,
      threatTimeToImpact: threat?.timeToImpact ?? null,
      inFiringLane,
      verticalDelta,
      nowMs,
    },
  };
}

export class VersusBotController {
  constructor(options = {}) {
    this.options = { ...options };
    this.actions = createActionFlags();
    this.pressed = createActionFlags();
    this.lastJumpCommandAtMs = Number.NEGATIVE_INFINITY;
    this.lastShootCommandAtMs = Number.NEGATIVE_INFINITY;
    this.lastDecision = null;
    this.input = {
      isPressed: (action) => this.isPressed(action),
      consumePressed: (action) => this.consumePressed(action),
    };
  }

  reset() {
    for (const action of ACTIONS) {
      this.actions[action] = false;
      this.pressed[action] = false;
    }
    this.lastJumpCommandAtMs = Number.NEGATIVE_INFINITY;
    this.lastShootCommandAtMs = Number.NEGATIVE_INFINITY;
    this.lastDecision = null;
  }

  getPlayerInput() {
    return this.input;
  }

  update(_deltaSeconds, context = {}) {
    const nowMs = toNumber(context?.nowMs, 0);
    const decision = planVersusBotFrame(
      {
        ...context,
        lastJumpCommandAtMs: this.lastJumpCommandAtMs,
        lastShootCommandAtMs: this.lastShootCommandAtMs,
      },
      this.options
    );

    for (const action of ACTIONS) {
      this.actions[action] = Boolean(decision.actions[action]);
      this.pressed[action] = Boolean(decision.pressed[action]);
    }

    if (this.pressed.jump) {
      this.lastJumpCommandAtMs = nowMs;
    }
    if (this.pressed.shoot) {
      this.lastShootCommandAtMs = nowMs;
    }

    this.lastDecision = decision.debug;
    return decision;
  }

  isPressed(action) {
    const normalized = typeof action === "string" ? action.toLowerCase() : "";
    return Boolean(this.actions[normalized]);
  }

  consumePressed(action) {
    const normalized = typeof action === "string" ? action.toLowerCase() : "";
    if (!this.pressed[normalized]) {
      return false;
    }
    this.pressed[normalized] = false;
    return true;
  }
}
