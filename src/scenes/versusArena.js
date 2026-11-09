export const VERSUS_PANEL_WORLD_WIDTH = 720;
export const VERSUS_PANEL_WORLD_HEIGHT = 760;
export const VERSUS_WORLD_WIDTH = VERSUS_PANEL_WORLD_WIDTH * 2;
// Arena v3, layout C "two forts" (owner pick 2026-11-02, mockup harness/evidence/T-19/mockups/
// arena-v3.html). World units; the design box shows the world at scale 0.54 with a 56 px x offset.
// Each side: a ground with edge walls, five jump-through ledges on three rows above it and three
// solid blocks. Each fighter only touches its own side.
export const VERSUS_PLATFORM_WIDTH = 504;
export const VERSUS_PLATFORM_HEIGHT = 26;
export const VERSUS_PLATFORM_TOP_COLLISION_HEIGHT = 6;
export const VERSUS_PLATFORM_Y = 688;
export const VERSUS_DECOR_STRIP_HEIGHT = 24;
export const VERSUS_DECOR_STRIP_Y = VERSUS_PANEL_WORLD_HEIGHT - VERSUS_DECOR_STRIP_HEIGHT;
export const VERSUS_DEATH_Y = VERSUS_PANEL_WORLD_HEIGHT + 72;
export const VERSUS_EDGE_PADDING = 80;
export const VERSUS_CENTER_GAP = 272;
// Four levels (ground + three ledge rows), 115 apart: 62 design px.
export const VERSUS_LEVEL_STEP = 115;
export const VERSUS_LEVEL_COUNT = 4;
export const VERSUS_LEDGE_HEIGHT = 15;
// Half a fighter: a block stops a shot fired standing on its level, not one fired from on top of a block.
export const VERSUS_BLOCK_SIZE = 44;
// Lowest world y a fighter's head may reach: the HUD band ends at design y 58.
export const VERSUS_HUD_BAND_BOTTOM = 108;
export const VERSUS_CAMERA_TRACK_SLACK = 92;
// Spawn in the front stretch of the ground, under the open end of the first ledge (not under a
// block, so a jump from the spawn lands on the ledge).
export const VERSUS_LEFT_SPAWN_RATIO = 0.87;
export const VERSUS_RIGHT_SPAWN_RATIO = 0.13;
export const VERSUS_LEFT_PLATFORM_ID = "versus-left-bridge";
export const VERSUS_RIGHT_PLATFORM_ID = "versus-right-bridge";
export const VERSUS_LEFT_PLATFORM_NAME = "Left Bridge";
export const VERSUS_RIGHT_PLATFORM_NAME = "Right Bridge";
export const VERSUS_LEFT_PLATFORM_CATEGORY = 1 << 0;
export const VERSUS_RIGHT_PLATFORM_CATEGORY = 1 << 1;
export const VERSUS_PLAYER_A_PLATFORM_MASK = VERSUS_LEFT_PLATFORM_CATEGORY;
export const VERSUS_PLAYER_B_PLATFORM_MASK = VERSUS_RIGHT_PLATFORM_CATEGORY;

// Left side; the right side mirrors it about the arena centre.
// Ledges: [x, width, level]. Blocks: [x, level they stand on]. No block sits under a ledge, so a
// fighter standing on a block never touches the ledge above it.
const LEFT_LEDGES = Object.freeze([
  [80, 142, 1],
  [362, 200, 1],
  [155, 226, 2],
  [80, 127, 3],
  [436, 122, 3],
]);
const LEFT_BLOCKS = Object.freeze([
  [277, 0],
  [433, 1],
  [266, 2],
]);

export const versusLevelY = (level) => VERSUS_PLATFORM_Y - level * VERSUS_LEVEL_STEP;

// Level (0 = ground) of a support's top surface, or of the floor a block stands on.
export function versusLevelOf(platform) {
  if (!platform) {
    return 0;
  }
  const floorY = platform.kind === "block" ? Number(platform.y) + Number(platform.height) : Number(platform.y);
  return Math.max(0, Math.round((VERSUS_PLATFORM_Y - floorY) / VERSUS_LEVEL_STEP));
}

const createSpawnPoint = (platform, ratio, playerWidth, playerHeight) => {
  const supportY = Number(platform.y) + Math.max(0, Number(platform.playerCollisionOffsetY) || 0);
  return {
    x: platform.x + platform.width * ratio - playerWidth * 0.5,
    y: supportY - playerHeight,
  };
};

const createBridge = ({
  id,
  name,
  collisionCategory,
  x,
  y,
}) => ({
  id,
  name,
  kind: "ground",
  collisionCategory,
  playerCollisionOffsetY: 0,
  playerCollisionHeight: VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
  x,
  y,
  width: VERSUS_PLATFORM_WIDTH,
  height: VERSUS_PLATFORM_HEIGHT,
});

const mirrorX = (x, width) => VERSUS_WORLD_WIDTH - x - width;

function createSidePieces(side, collisionCategory) {
  const right = side === "right";
  const label = right ? "Right" : "Left";
  const ledges = LEFT_LEDGES.map(([x, width, level], index) => ({
    id: `versus-${side}-ledge-${index + 1}`,
    name: `${label} Ledge ${index + 1}`,
    kind: "ledge",
    collisionCategory,
    playerCollisionOffsetY: 0,
    playerCollisionHeight: VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
    x: right ? mirrorX(x, width) : x,
    y: versusLevelY(level),
    width,
    height: VERSUS_LEDGE_HEIGHT,
  }));
  const blocks = LEFT_BLOCKS.map(([x, level], index) => ({
    id: `versus-${side}-block-${index + 1}`,
    name: `${label} Block ${index + 1}`,
    kind: "block",
    collisionCategory,
    playerCollisionOffsetY: 0,
    playerCollisionHeight: VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
    x: right ? mirrorX(x, VERSUS_BLOCK_SIZE) : x,
    y: versusLevelY(level) - VERSUS_BLOCK_SIZE,
    width: VERSUS_BLOCK_SIZE,
    height: VERSUS_BLOCK_SIZE,
  }));
  return { ledges, blocks };
}

export function calculateVersusArenaLayout({
  playerWidth = 28,
  playerHeight = 40,
} = {}) {
  const leftPlatform = createBridge({
    id: VERSUS_LEFT_PLATFORM_ID,
    name: VERSUS_LEFT_PLATFORM_NAME,
    collisionCategory: VERSUS_LEFT_PLATFORM_CATEGORY,
    x: VERSUS_EDGE_PADDING,
    y: VERSUS_PLATFORM_Y,
  });
  const rightPlatform = createBridge({
    id: VERSUS_RIGHT_PLATFORM_ID,
    name: VERSUS_RIGHT_PLATFORM_NAME,
    collisionCategory: VERSUS_RIGHT_PLATFORM_CATEGORY,
    x: VERSUS_WORLD_WIDTH - VERSUS_EDGE_PADDING - VERSUS_PLATFORM_WIDTH,
    y: VERSUS_PLATFORM_Y,
  });
  const left = createSidePieces("left", VERSUS_LEFT_PLATFORM_CATEGORY);
  const right = createSidePieces("right", VERSUS_RIGHT_PLATFORM_CATEGORY);

  const spawnPoints = [
    createSpawnPoint(leftPlatform, VERSUS_LEFT_SPAWN_RATIO, playerWidth, playerHeight),
    createSpawnPoint(rightPlatform, VERSUS_RIGHT_SPAWN_RATIO, playerWidth, playerHeight),
  ];

  const leftAnchorX = 0;
  const rightAnchorX = VERSUS_WORLD_WIDTH - VERSUS_PANEL_WORLD_WIDTH;

  return {
    panelWorldWidth: VERSUS_PANEL_WORLD_WIDTH,
    panelWorldHeight: VERSUS_PANEL_WORLD_HEIGHT,
    worldWidth: VERSUS_WORLD_WIDTH,
    worldHeight: VERSUS_PANEL_WORLD_HEIGHT,
    platformY: VERSUS_PLATFORM_Y,
    levelStep: VERSUS_LEVEL_STEP,
    levelYs: Array.from({ length: VERSUS_LEVEL_COUNT }, (_, level) => versusLevelY(level)),
    decorStripY: VERSUS_DECOR_STRIP_Y,
    decorStripHeight: VERSUS_DECOR_STRIP_HEIGHT,
    deathY: VERSUS_DEATH_Y,
    leftPlatform,
    rightPlatform,
    // Grounds first: the collision system and the bot find a fighter's ground by that order.
    platforms: [leftPlatform, rightPlatform, ...left.ledges, ...right.ledges, ...left.blocks, ...right.blocks],
    spawnPoints,
    cameraRanges: [
      {
        anchorX: leftAnchorX,
        minX: Math.max(0, leftAnchorX - VERSUS_CAMERA_TRACK_SLACK),
        maxX: Math.min(rightAnchorX, leftAnchorX + VERSUS_CAMERA_TRACK_SLACK),
      },
      {
        anchorX: rightAnchorX,
        minX: Math.max(0, rightAnchorX - VERSUS_CAMERA_TRACK_SLACK),
        maxX: Math.min(rightAnchorX, rightAnchorX + VERSUS_CAMERA_TRACK_SLACK),
      },
    ],
  };
}

export function getVersusArenaDiagnostics(
  layout,
  {
    bulletSpeed = 0,
    bulletLifetimeMs = 0,
    jumpSpeed = 0,
    gravity = 1,
    playerWidth = 28,
    rigHeight = 0,
  } = {}
) {
  const bulletRange = Math.max(0, Number(bulletSpeed) || 0) * Math.max(0, Number(bulletLifetimeMs) || 0) / 1000;
  const leftSpawn = layout?.spawnPoints?.[0] ?? { x: 0 };
  const rightSpawn = layout?.spawnPoints?.[1] ?? { x: 0 };
  const spawnDistance = Math.max(0, (Number(rightSpawn.x) || 0) - (Number(leftSpawn.x) || 0));
  const levelStep = Number(layout?.levelStep) || 0;
  const levelYs = Array.isArray(layout?.levelYs) ? layout.levelYs : [];
  const jumpApex = gravity > 0
    ? ((Math.max(0, Number(jumpSpeed) || 0) ** 2) / (2 * gravity))
    : 0;
  // Highest point of a fighter's head: a full jump from the top level.
  const topLevelY = levelYs.length > 0 ? Math.min(...levelYs) : Number(layout?.platformY) || 0;
  const apexHeadY = topLevelY - jumpApex - Math.max(0, Number(rigHeight) || 0);

  const issues = [];
  if (bulletRange > 0 && spawnDistance > bulletRange * 0.8) {
    issues.push(`spawn distance ${spawnDistance.toFixed(1)} exceeds 80% of bullet range ${bulletRange.toFixed(1)}`);
  }
  if (levelStep > 0 && jumpApex < levelStep * 1.15) {
    issues.push(`jump apex ${jumpApex.toFixed(1)} does not clear the next level (${levelStep})`);
  }
  if (rigHeight > 0 && apexHeadY < VERSUS_HUD_BAND_BOTTOM) {
    issues.push(`a jump from the top level reaches y ${apexHeadY.toFixed(1)}, into the HUD band`);
  }
  if (spawnDistance <= playerWidth * 8) {
    issues.push(`spawn distance ${spawnDistance.toFixed(1)} is too tight for a duel lane`);
  }

  return {
    bulletRange,
    spawnDistance,
    jumpApex,
    levelStep,
    apexHeadY,
    issues,
  };
}
