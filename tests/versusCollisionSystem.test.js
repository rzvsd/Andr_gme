import { describe, expect, it } from "vitest";

import { Platform } from "../src/entities/Platform.js";
import { Player } from "../src/entities/Player.js";
import {
  calculateVersusArenaLayout,
  VERSUS_LEFT_PLATFORM_ID,
  VERSUS_LEFT_PLATFORM_NAME,
  VERSUS_PLATFORM_TOP_COLLISION_HEIGHT,
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

  it("filters player collisions so each fighter only grounds on their own bridge", () => {
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

    expect(p1.onGround).toBe(false);
    expect(p1.y).toBe(rightPlatform.y - p1.height + 3);
    expect(p1.supportingPlatformId).toBe(null);

    expect(p2.onGround).toBe(false);
    expect(p2.y).toBe(leftPlatform.y - p2.height + 3);
    expect(p2.supportingPlatformId).toBe(null);
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
