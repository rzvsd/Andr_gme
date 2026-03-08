export const VERSUS_PANEL_WORLD_WIDTH = 720;
export const VERSUS_PANEL_WORLD_HEIGHT = 760;
export const VERSUS_WORLD_WIDTH = VERSUS_PANEL_WORLD_WIDTH * 2;
export const VERSUS_PLATFORM_WIDTH = 420;
export const VERSUS_PLATFORM_HEIGHT = 24;
export const VERSUS_PLATFORM_TOP_COLLISION_HEIGHT = 6;
export const VERSUS_PLATFORM_Y = 620;
export const VERSUS_DECOR_STRIP_HEIGHT = 24;
export const VERSUS_DECOR_STRIP_Y = VERSUS_PANEL_WORLD_HEIGHT - VERSUS_DECOR_STRIP_HEIGHT;
export const VERSUS_DEATH_Y = VERSUS_PANEL_WORLD_HEIGHT + 72;
export const VERSUS_EDGE_PADDING = 150;
export const VERSUS_CENTER_GAP = 300;
export const VERSUS_CAMERA_TRACK_SLACK = 92;
export const VERSUS_LEFT_SPAWN_RATIO = 0.72;
export const VERSUS_RIGHT_SPAWN_RATIO = 0.28;
export const VERSUS_LEFT_PLATFORM_ID = "versus-left-bridge";
export const VERSUS_RIGHT_PLATFORM_ID = "versus-right-bridge";
export const VERSUS_LEFT_PLATFORM_NAME = "Left Bridge";
export const VERSUS_RIGHT_PLATFORM_NAME = "Right Bridge";
export const VERSUS_LEFT_PLATFORM_CATEGORY = 1 << 0;
export const VERSUS_RIGHT_PLATFORM_CATEGORY = 1 << 1;
export const VERSUS_PLAYER_A_PLATFORM_MASK = VERSUS_LEFT_PLATFORM_CATEGORY;
export const VERSUS_PLAYER_B_PLATFORM_MASK = VERSUS_RIGHT_PLATFORM_CATEGORY;

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
  collisionCategory,
  playerCollisionOffsetY: 0,
  playerCollisionHeight: VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
  x,
  y,
  width: VERSUS_PLATFORM_WIDTH,
  height: VERSUS_PLATFORM_HEIGHT,
});

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
    decorStripY: VERSUS_DECOR_STRIP_Y,
    decorStripHeight: VERSUS_DECOR_STRIP_HEIGHT,
    deathY: VERSUS_DEATH_Y,
    leftPlatform,
    rightPlatform,
    platforms: [leftPlatform, rightPlatform],
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
  } = {}
) {
  const bulletRange = Math.max(0, Number(bulletSpeed) || 0) * Math.max(0, Number(bulletLifetimeMs) || 0) / 1000;
  const leftSpawn = layout?.spawnPoints?.[0] ?? { x: 0 };
  const rightSpawn = layout?.spawnPoints?.[1] ?? { x: 0 };
  const spawnDistance = Math.max(0, (Number(rightSpawn.x) || 0) - (Number(leftSpawn.x) || 0));
  const platformY = Number(layout?.platformY) || 0;
  const deathY = Number(layout?.deathY) || 0;
  const decorStripY = Number(layout?.decorStripY) || 0;
  const fallDepth = Math.max(0, deathY - platformY);
  const visualDrop = Math.max(0, decorStripY - platformY);
  const jumpApex = gravity > 0
    ? ((Math.max(0, Number(jumpSpeed) || 0) ** 2) / (2 * gravity))
    : 0;

  const issues = [];
  if (bulletRange > 0 && spawnDistance > bulletRange * 0.8) {
    issues.push(`spawn distance ${spawnDistance.toFixed(1)} exceeds 80% of bullet range ${bulletRange.toFixed(1)}`);
  }
  if (jumpApex > 0 && visualDrop <= jumpApex * 1.15) {
    issues.push(`platform drop ${visualDrop.toFixed(1)} is too close to jump apex ${jumpApex.toFixed(1)}`);
  }
  if (spawnDistance <= playerWidth * 8) {
    issues.push(`spawn distance ${spawnDistance.toFixed(1)} is too tight for a duel lane`);
  }

  return {
    bulletRange,
    spawnDistance,
    fallDepth,
    visualDrop,
    jumpApex,
    issues,
  };
}
