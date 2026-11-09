import { describe, expect, it } from "vitest";

import { Platform } from "../src/entities/Platform.js";
import { Player } from "../src/entities/Player.js";
import {
  calculateVersusArenaLayout,
  VERSUS_LEFT_PLATFORM_ID,
  VERSUS_LEFT_PLATFORM_NAME,
  VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
  VERSUS_RIGHT_PLATFORM_ID,
} from "../src/scenes/versusArena.js";
import { VersusCollisionSystem } from "../src/systems/VersusCollisionSystem.js";

function createPlayers() {
  const p1 = new Player({ width: 28, height: 40, active: true });
  p1.playerIndex = 0;
  p1.id = "p1";

  const p2 = new Player({ width: 28, height: 40, active: true });
  p2.playerIndex = 1;
  p2.id = "p2";

  return [p1, p2];
}

function createPlatformsFromLayout(layout) {
  return layout.platforms.map((platform) => (
    new Platform(platform.x, platform.y, platform.width, platform.height)
  ));
}

describe("VersusCollisionSystem", () => {
  it("keeps PlayerA grounded on the left bridge top strip and exposes support metadata", () => {
    const layout = calculateVersusArenaLayout();
    const [leftPlatform, rightPlatform] = createPlatformsFromLayout(layout);
    const [p1, p2] = createPlayers();

    p1.x = leftPlatform.x + 48;
    p1.y = leftPlatform.y - p1.height;
    p1.vy = 0;

    p2.active = false;

    const system = new VersusCollisionSystem();
    system.update(1 / 60, {
      players: [p1, p2],
      platforms: [leftPlatform, rightPlatform],
      bullets: [],
    });

    expect(p1.onGround).toBe(true);
    expect(p1.y).toBe(leftPlatform.y - p1.height);
    expect(p1.supportingPlatform).toBe(leftPlatform);
    expect(p1.supportingPlatformId).toBe(VERSUS_LEFT_PLATFORM_ID);
    expect(p1.supportingPlatformName).toBe(VERSUS_LEFT_PLATFORM_NAME);
    expect(leftPlatform.playerCollisionHeight).toBe(VERSUS_PLATFORM_TOP_COLLISION_HEIGHT);
  });

  it("keeps each fighter on its own bridge: a fighter over the other bridge is pulled back to its own end", () => {
    const layout = calculateVersusArenaLayout();
    const [leftPlatform, rightPlatform] = createPlatformsFromLayout(layout);
    const [p1, p2] = createPlayers();

    p1.x = rightPlatform.x + 56;
    p1.y = rightPlatform.y - p1.height + 3;
    p1.vy = 120;

    p2.x = leftPlatform.x + 56;
    p2.y = leftPlatform.y - p2.height + 3;
    p2.vy = 120;

    const system = new VersusCollisionSystem();
    system.update(1 / 60, {
      players: [p1, p2],
      platforms: [leftPlatform, rightPlatform],
      bullets: [],
    });

    expect(p1.x).toBe(leftPlatform.x + leftPlatform.width - p1.width);
    expect(p1.onGround).toBe(true);
    expect(p1.supportingPlatformId).toBe(VERSUS_LEFT_PLATFORM_ID);

    expect(p2.x).toBe(rightPlatform.x);
    expect(p2.onGround).toBe(true);
    expect(p2.supportingPlatformId).toBe(VERSUS_RIGHT_PLATFORM_ID);
  });

  it("clamps each fighter inside its own bridge so nobody can walk off the end", () => {
    const layout = calculateVersusArenaLayout();
    const platforms = createPlatformsFromLayout(layout);
    const [p1, p2] = createPlayers();
    const rightBridge = layout.rightPlatform;

    p2.x = rightBridge.x + rightBridge.width + 40;
    p2.y = rightBridge.y - p2.height;
    p2.vx = 300;
    p1.x = layout.leftPlatform.x + 100;
    p1.y = layout.leftPlatform.y - p1.height;

    const system = new VersusCollisionSystem();
    system.update(1 / 60, { p1, p2, players: [p1, p2], bullets: [], platforms });

    expect(p2.x).toBe(rightBridge.x + rightBridge.width - p2.width);
    expect(p2.vx).toBe(0);
    expect(p2.onGround).toBe(true);
    expect(p1.x).toBe(layout.leftPlatform.x + 100);
  });

  it("still blocks bullets on the full bridge body below the top support strip", () => {
    const layout = calculateVersusArenaLayout();
    const [leftPlatform, rightPlatform] = createPlatformsFromLayout(layout);
    const [p1, p2] = createPlayers();
    const system = new VersusCollisionSystem();
    const events = [];

    p2.active = false;

    const bullet = {
      x: rightPlatform.x + 60,
      y: rightPlatform.y + VERSUS_PLATFORM_TOP_COLLISION_HEIGHT + 4,
      width: 8,
      height: 8,
      damage: 10,
      owner: p1,
      active: true,
      deactivate() {
        this.active = false;
      },
    };

    system.update(1 / 60, {
      players: [p1, p2],
      platforms: [leftPlatform, rightPlatform],
      bullets: [bullet],
      eventBus: {
        emit(name, payload) {
          events.push({ name, payload });
        },
      },
    });

    expect(bullet.active).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("versus:bullet_blocked");
    expect(events[0].payload.platform).toBe(rightPlatform);
  });
});
