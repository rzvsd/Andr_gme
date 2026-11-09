import { versusLevelOf } from "../scenes/versusArena.js";
import { hasShot, shotClipOf } from "../scenes/versus/versusShots.js";
import { attackGoal, buildCourse, hideGoal, nodeAt, routesFrom } from "./versusBotCourse.js";

const ACTIONS = Object.freeze(["left", "right", "jump", "shoot", "drop"]);
const DEFAULT_LOOKAHEAD_SECONDS = 0.52;
const DEFAULT_LANE_TOLERANCE_Y = 24;
const DEFAULT_SAFE_EDGE_INSET = 30;
const DEFAULT_TARGET_EPSILON = 4;
const DEFAULT_JUMP_REPEAT_MS = 120;
const DEFAULT_SHOOT_REPEAT_MS = 90;
const DEFAULT_MOVE_THREAT_SECONDS = 0.18;
const DEFAULT_JUMP_THREAT_SECONDS = 0.14;
// Bullets fly 1140 world px; arena v3 duels span up to about 1100.
const DEFAULT_SHOT_RANGE_X = 1100;
// Fire in short bursts, then reposition, so the bot doesn't stand still as a turret.
const BURST_MIN_SHOTS = 2;
const BURST_MAX_SHOTS = 4;
const BURST_PAUSE_MIN_MS = 500;
const BURST_PAUSE_MAX_MS = 1200;
const WANDER_MIN_MS = 500;
const WANDER_MAX_MS = 1300;
const WANDER_RANGE = 0.4;
const HOP_MIN_MS = 1200;
const HOP_MAX_MS = 2800;
// Arena v3 routes: how close (world px) counts as "there", how near a block the bot jumps to hop
// it, how long the opponent must stay on a new level before the bot follows, and how soon a
// bullet must hit for the bot to jump while it is on its way.
const ROUTE_EPSILON = 6;
const HOP_GAP = 12;
const LEVEL_SETTLE_MS = 300;
const ROUTE_DODGE_SECONDS = 0.2;
// Edge inset (world px) for fighting on a segment: segments are short and blocks end them.
const SEGMENT_EDGE_INSET = 4;

function createActionFlags() {
  return {
    left: false,
    right: false,
    jump: false,
    shoot: false,
    drop: false,
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

  const holdFire = context?.holdFire === true;
  let targetX = preferredCombatX;
  let reason = "center";

  if (holdFire) {
    const wanderOffset = clamp(toNumber(context?.wanderOffset, 0), -1, 1);
    targetX = clamp(
      preferredCombatX + wanderOffset * (safeZone.maxX - safeZone.minX) * WANDER_RANGE,
      safeZone.minX,
      safeZone.maxX
    );
    reason = "reposition";
    if (context?.wantsHop === true && self.onGround) {
      pressed.jump = true;
      reason = "hop";
    }
  }

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

  if (holdFire) {
    // Repositioning: skip the face/shoot logic so movement isn't overridden.
  } else if (!threat && inFiringLane && self.facing !== desiredFacing) {
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

  if (!threat && !holdFire && !actions.left && !actions.right && !withinSafeZone) {
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
    this.random = typeof options.random === "function" ? options.random : Math.random;
    this.actions = createActionFlags();
    this.pressed = createActionFlags();
    this.reset();
    this.input = {
      isPressed: (action) => this.isPressed(action),
      consumePressed: (action) => this.consumePressed(action),
    };
  }

  // Moves the bot's absolute timers forward by `deltaMs` (the length of a pause).
  shiftTime(deltaMs) {
    const d = Number(deltaMs);
    if (!(d > 0)) {
      return;
    }
    this.pauseUntilMs += d;
    this.nextWanderAtMs += d;
    this.nextHopAtMs += d;
    this.levelCandidateSinceMs += d;
  }

  reset() {
    for (const action of ACTIONS) {
      this.actions[action] = false;
      this.pressed[action] = false;
    }
    this.lastJumpCommandAtMs = Number.NEGATIVE_INFINITY;
    this.lastShootCommandAtMs = Number.NEGATIVE_INFINITY;
    this.lastDecision = null;
    this.burstShotsLeft = 0;
    this.pauseUntilMs = Number.NEGATIVE_INFINITY;
    this.wanderOffset = 0;
    this.nextWanderAtMs = Number.NEGATIVE_INFINITY;
    this.nextHopAtMs = Number.NEGATIVE_INFINITY;
    this.opponentLevel = 0;
    this.levelCandidate = 0;
    this.levelCandidateSinceMs = Number.NEGATIVE_INFINITY;
    this.airTargetX = null;
  }

  randomBetween(min, max) {
    return min + this.random() * (max - min);
  }

  getPlayerInput() {
    return this.input;
  }

  update(_deltaSeconds, context = {}) {
    const nowMs = toNumber(context?.nowMs, 0);
    const holdFire = nowMs < this.pauseUntilMs;
    if (!holdFire && this.burstShotsLeft <= 0) {
      this.burstShotsLeft = Math.round(this.randomBetween(BURST_MIN_SHOTS, BURST_MAX_SHOTS));
    }
    if (nowMs >= this.nextWanderAtMs) {
      this.wanderOffset = this.randomBetween(-1, 1);
      this.nextWanderAtMs = nowMs + this.randomBetween(WANDER_MIN_MS, WANDER_MAX_MS);
    }

    const route = this.planRoute(context, nowMs);
    if (route?.move) {
      this.applyDecision(route, nowMs);
      return route;
    }

    const decision = planVersusBotFrame(
      {
        ...context,
        ...(route?.fightOn ? { ownPlatform: route.fightOn } : null),
        lastJumpCommandAtMs: this.lastJumpCommandAtMs,
        lastShootCommandAtMs: this.lastShootCommandAtMs,
        holdFire,
        wanderOffset: this.wanderOffset,
        // On a segment a random hop would land on the ledge above, so routes do the jumping.
        wantsHop: !route?.fightOn && nowMs >= this.nextHopAtMs,
      },
      route?.fightOn ? { ...this.options, safeEdgeInset: SEGMENT_EDGE_INSET } : this.options
    );

    if (decision.pressed.shoot) {
      this.burstShotsLeft -= 1;
      if (this.burstShotsLeft <= 0) {
        this.pauseUntilMs = nowMs + this.randomBetween(BURST_PAUSE_MIN_MS, BURST_PAUSE_MAX_MS);
      }
    }
    if (decision.debug.reason === "hop") {
      this.nextHopAtMs = nowMs + this.randomBetween(HOP_MIN_MS, HOP_MAX_MS);
    }

    this.applyDecision(decision, nowMs);
    return decision;
  }

  applyDecision(decision, nowMs) {
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
  }

  // Arena v3: with shots left the bot climbs or drops to the opponent's level and fights from the
  // segment nearest them; with none it hides behind a block until the clip refills. Returns
  // { move } to steer this frame, { fightOn } for the duel logic, or null without a platform list.
  planRoute(context, nowMs) {
    const self = context?.self ?? null;
    const opponent = context?.opponent ?? null;
    const category = toNumber(context?.ownPlatform?.collisionCategory, 0);
    if (!Array.isArray(context?.platforms) || category === 0 || !isActiveEntity(self) || !isActiveEntity(opponent)) {
      return null;
    }
    if (this.courseSource !== context.platforms || this.courseSize !== context.platforms.length) {
      this.course = buildCourse(context.platforms, category);
      this.courseSource = context.platforms;
      this.courseSize = context.platforms.length;
    }
    this.trackOpponentLevel(opponent, nowMs);

    const width = toNumber(self.width, 0);
    const centerX = toNumber(self.x, 0) + width * 0.5;
    const opponentX = centerOf(opponent).x;
    const opponentIsLeft = opponentX < centerX;
    if (!self.onGround) {
      return this.routeMove(this.airTargetX ?? centerX, centerX, "air");
    }
    const support = self.supportingPlatform;
    if (support?.kind === "block") {
      const offX = opponentIsLeft ? support.x - width * 0.5 - HOP_GAP : support.x + support.width + width * 0.5 + HOP_GAP;
      return this.routeMove(offX, centerX, "off_block", context);
    }
    const here = nodeAt(this.course, self);
    if (!here) {
      return null;
    }
    const reloading = !hasShot(shotClipOf(self), nowMs);
    const reachable = routesFrom(this.course, here, width);
    const goal = reloading
      ? hideGoal(this.course, reachable, here.level, opponentIsLeft)
      : attackGoal(this.course, reachable, this.opponentLevel, opponentX);
    const edge = goal ? reachable.get(goal) : null;
    if (!edge) {
      if (reloading) {
        // Right behind the block: dark, still, and out of every standing shot on this level.
        const coverX = opponentIsLeft ? here.minX + width * 0.5 + 2 : here.maxX - width * 0.5 - 2;
        return this.routeMove(coverX, centerX, "hide", context);
      }
      return { fightOn: { x: here.minX, y: here.support.y, width: here.maxX - here.minX, height: here.support.height } };
    }

    const route = this.routeMove(edge.x, centerX, edge.type, context);
    const ready = Math.abs(edge.x - centerX) <= ROUTE_EPSILON;
    if (edge.type === "climb" && ready) {
      route.pressed.jump = true;
      this.airTargetX = (edge.to.minX + edge.to.maxX) * 0.5;
    } else if (edge.type === "leap") {
      const toRight = edge.to.minX >= here.maxX;
      const lead = toRight ? edge.edgeX - (centerX + width * 0.5) : centerX - width * 0.5 - edge.edgeX;
      if (lead <= ROUTE_EPSILON) {
        route.pressed.jump = true;
        this.airTargetX = edge.x;
      }
    } else if (edge.type === "drop" && ready) {
      route.pressed.drop = true;
      route.pressed.jump = false;
      this.airTargetX = centerX;
    } else if (edge.type === "hop") {
      const ahead = edge.to.minX >= here.maxX;
      const gap = ahead ? here.maxX - (centerX + width * 0.5) : centerX - width * 0.5 - here.minX;
      if (gap <= HOP_GAP) {
        route.pressed.jump = true;
        this.airTargetX = edge.x;
      }
    }
    return route;
  }

  // Steer toward a body-centre x. Jumps away from a bullet about to hit, unless already in the air.
  routeMove(targetX, centerX, reason, context = null) {
    const actions = createActionFlags();
    const pressed = createActionFlags();
    if (centerX < targetX - ROUTE_EPSILON) {
      actions.right = true;
    } else if (centerX > targetX + ROUTE_EPSILON) {
      actions.left = true;
    }
    const threat = context ? findIncomingThreat(context.self, context.bullets) : null;
    if (threat && threat.timeToImpact <= ROUTE_DODGE_SECONDS) {
      pressed.jump = true;
    }
    return { move: true, actions, pressed, debug: { reason: `route_${reason}` } };
  }

  // The level the opponent stands on, once they have stayed there LEVEL_SETTLE_MS.
  trackOpponentLevel(opponent, nowMs) {
    if (!opponent.onGround || !opponent.supportingPlatform) {
      return;
    }
    const level = versusLevelOf(opponent.supportingPlatform);
    if (level === this.opponentLevel || level !== this.levelCandidate) {
      this.levelCandidate = level;
      this.levelCandidateSinceMs = nowMs;
      return;
    }
    if (nowMs - this.levelCandidateSinceMs >= LEVEL_SETTLE_MS) {
      this.opponentLevel = level;
    }
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
