import { describe, expect, it } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { AudioManager } from "../src/audio/AudioManager.js";
import { ObjectPool } from "../src/utils/pool.js";
import { Bullet } from "../src/entities/Bullet.js";

describe("AudioManager safety guards", () => {
  it("never throws without AudioContext or HTML Audio", () => {
    const bus = new EventBus();
    const audio = new AudioManager(bus, { unlocked: true, enabled: true });
    expect(() => audio.play("sfx_shoot")).not.toThrow();
    expect(audio.play("sfx_shoot")).toBe(false);
    expect(() => audio.unlock()).not.toThrow();
    expect(() => audio.dispose()).not.toThrow();
  });

  it("blocks playback while muted and survives event storms", () => {
    const bus = new EventBus();
    const audio = new AudioManager(bus, { unlocked: true, enabled: true });
    audio.subscribe();
    audio.setEnabled(false);
    expect(audio.play("sfx_hit")).toBe(false);
    expect(() => {
      for (let i = 0; i < 30; i += 1) {
        bus.emit("versus:kill", {});
        bus.emit("ui_click", {});
      }
    }).not.toThrow();
    audio.dispose();
  });
});

describe("ObjectPool gameplay recycling", () => {
  it("reuses released bullets instead of allocating", () => {
    const pool = new ObjectPool(() => new Bullet({ width: 22, height: 8 }), (b) => b?.reset?.());
    pool.preallocate(4);
    expect(pool.size).toBe(4);

    const owner = { playerIndex: 0 };
    const a = pool.acquire();
    a.fire({ x: 0, y: 0, directionX: 1, directionY: 0, speed: 100, damage: 25, owner, lifetimeMs: 1000 });
    expect(a.active).not.toBe(false);
    expect(pool.activeCount).toBe(1);

    a.deactivate();
    pool.release(a);
    expect(pool.activeCount).toBe(0);

    const b = pool.acquire();
    expect(b).toBe(a);
    expect(pool.size).toBe(4);
  });

  it("tolerates double release without corrupting the pool", () => {
    const pool = new ObjectPool(() => ({ id: Math.random() }));
    const obj = pool.acquire();
    pool.release(obj);
    pool.release(obj);
    expect(pool.activeCount).toBe(0);
    const again = pool.acquire();
    expect(again).toBe(obj);
  });
});
