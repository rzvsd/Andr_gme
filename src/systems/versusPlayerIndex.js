export const VERSUS_PLAYER_COUNT = 2;
export const VERSUS_INVALID_PLAYER_INDEX = -1;

const PLAYER1_LABELS = new Set(["p1", "player1", "player_1", "player-1"]);
const PLAYER2_LABELS = new Set(["2", "p2", "player2", "player_2", "player-2"]);

function parseLabel(value) {
  if (typeof value !== "string") {
    return VERSUS_INVALID_PLAYER_INDEX;
  }

  const label = value.trim().toLowerCase();
  if (label === "0") {
    return 0;
  }
  if (label === "1") {
    return 1;
  }
  if (PLAYER1_LABELS.has(label)) {
    return 0;
  }
  if (PLAYER2_LABELS.has(label)) {
    return 1;
  }
  return VERSUS_INVALID_PLAYER_INDEX;
}

export function parseVersusPlayerIndex(value, players = null) {
  if (Array.isArray(players)) {
    if (value === players[0]) {
      return 0;
    }
    if (value === players[1]) {
      return 1;
    }
  }

  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < VERSUS_PLAYER_COUNT
  ) {
    return value;
  }

  const fromLabel = parseLabel(value);
  if (fromLabel !== VERSUS_INVALID_PLAYER_INDEX) {
    return fromLabel;
  }

  if (!value || typeof value !== "object") {
    return VERSUS_INVALID_PLAYER_INDEX;
  }

  const directFields = [
    value.playerIndex,
    value.index,
    value.slot,
    value.ownerIndex,
    value.killerIndex,
    value.victimIndex,
    value.targetIndex,
    value.dodgerIndex,
    value.shooterIndex,
    value.attackerIndex,
  ];
  for (const field of directFields) {
    const parsed = parseVersusPlayerIndex(field, players);
    if (parsed !== VERSUS_INVALID_PLAYER_INDEX) {
      return parsed;
    }
  }

  const identityFields = [value.id, value.playerId, value.name, value.label, value.team];
  for (const field of identityFields) {
    const parsed = parseLabel(field);
    if (parsed !== VERSUS_INVALID_PLAYER_INDEX) {
      return parsed;
    }
  }

  const nestedEntities = [
    value.player,
    value.owner,
    value.entity,
    value.killer,
    value.victim,
    value.target,
    value.dodger,
    value.shooter,
    value.attacker,
  ];
  for (const nested of nestedEntities) {
    const parsed = parseVersusPlayerIndex(nested, players);
    if (parsed !== VERSUS_INVALID_PLAYER_INDEX) {
      return parsed;
    }
  }

  return VERSUS_INVALID_PLAYER_INDEX;
}

export function resolveVersusPlayerIndexFromPayload(payload, keys, players = null) {
  if (!payload || typeof payload !== "object" || !Array.isArray(keys)) {
    return VERSUS_INVALID_PLAYER_INDEX;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      continue;
    }
    const parsed = parseVersusPlayerIndex(payload[key], players);
    if (parsed !== VERSUS_INVALID_PLAYER_INDEX) {
      return parsed;
    }
  }

  return VERSUS_INVALID_PLAYER_INDEX;
}
