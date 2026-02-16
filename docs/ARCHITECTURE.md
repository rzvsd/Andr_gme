# 🏗️ Technical Architecture

## Overview

Bullet Dodge Arena uses a **custom HTML5 Canvas engine** with an Entity-Component-System (ECS) inspired architecture. The game is wrapped for Android using **Capacitor**.

---

## Tech Stack Decision Rationale

| Considered | Pros | Cons | Decision |
|---|---|---|---|
| Unity | Powerful, mature | Requires Unity Editor, C#, heavy | ❌ |
| Godot | Lightweight, 2D-first | Requires editor, GDScript | ❌ |
| LibGDX | Java/Android native | Complex setup, Java | ❌ |
| **HTML5 Canvas + Vite + Capacitor** | **Pure code, fast dev, wraps to Android** | **WebView perf (acceptable for 2D)** | ✅ |

**Why Canvas + Capacitor?**
- Entire game exists as code files — no binary editors needed
- Vite gives hot-reload during development
- Capacitor wraps the HTML5 game as a native Android app
- HTML5 Canvas is performant enough for a 2D game at 60fps
- One codebase, also playable in browser for testing

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    index.html                        │
│                    main.js                           │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│                   Game (core/Game.js)                │
│  ┌──────────┐ ┌───────────┐ ┌────────────────────┐  │
│  │ GameLoop │ │ SceneMgr  │ │ AssetLoader        │  │
│  │ (60fps)  │ │           │ │                    │  │
│  └────┬─────┘ └─────┬─────┘ └────────────────────┘  │
│       │             │                                │
│       ▼             ▼                                │
│  ┌──────────────────────────────────────────────┐    │
│  │              Active Scene                     │    │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │    │
│  │  │ Update  │ │ Render   │ │ Handle Input  │  │    │
│  │  │ Systems │ │ Pipeline │ │               │  │    │
│  │  └────┬────┘ └────┬─────┘ └───────────────┘  │    │
│  └───────┼───────────┼──────────────────────────┘    │
│          │           │                                │
│          ▼           ▼                                │
│  ┌───────────┐ ┌──────────┐                          │
│  │ Entities  │ │ Canvas   │                          │
│  │ Pool      │ │ Context  │                          │
│  └───────────┘ └──────────┘                          │
└─────────────────────────────────────────────────────┘
              │
              ▼ (Capacitor)
┌─────────────────────────────────────────────────────┐
│              Android WebView (APK)                   │
└─────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph

```
config (constants, settings)
   │
   ├──► core/Game.js (imports config)
   │       ├──► core/Input.js
   │       ├──► core/Physics.js
   │       ├──► core/Camera.js
   │       └──► core/EventBus.js
   │
   ├──► entities/* (imports core, config)
   │       ├──► Entity.js (base class)
   │       ├──► Player.js
   │       ├──► Enemy.js
   │       ├──► Bullet.js
   │       └──► Platform.js
   │
   ├──► systems/* (imports entities, core)
   │       ├──► PhysicsSystem.js
   │       ├──► CollisionSystem.js
   │       ├──► AISystem.js
   │       ├──► SpawnSystem.js
   │       └──► ScoreSystem.js
   │
   ├──► rendering/* (imports entities, core)
   │       ├──► SpriteSheet.js
   │       ├──► Animator.js
   │       ├──► ParticleEmitter.js
   │       └──► Background.js
   │
   ├──► ui/* (imports core, rendering)
   │       ├──► HUD.js
   │       ├──► Button.js
   │       ├──► Joystick.js
   │       └──► ScoreBoard.js
   │
   ├──► scenes/* (imports everything above)
   │       ├──► MenuScene.js
   │       ├──► GameScene.js
   │       ├──► PauseScene.js
   │       └──► GameOverScene.js
   │
   ├──► audio/* (imports core/EventBus)
   │       ├──► AudioManager.js
   │       └──► MusicManager.js
   │
   └──► utils/* (standalone helpers)
           ├──► math.js
           ├──► pool.js
           └──► storage.js
```

---

## Key Design Patterns

### 1. Game Loop (Fixed Timestep)
```javascript
// Pseudocode
const TICK_RATE = 1/60;  // 60 updates per second
let accumulator = 0;

function loop(timestamp) {
    const dt = timestamp - lastTime;
    accumulator += dt;
    
    while (accumulator >= TICK_RATE) {
        update(TICK_RATE);  // Physics & logic
        accumulator -= TICK_RATE;
    }
    
    render(accumulator / TICK_RATE);  // Interpolated render
    requestAnimationFrame(loop);
}
```

### 2. Object Pooling (Bullets)
Bullets are recycled, not garbage collected:
- Pre-allocate pool of 200 bullet objects
- `acquire()` grabs an inactive bullet
- `release()` returns it to the pool
- Zero GC pressure during gameplay

### 3. Event Bus (Decoupling)
Modules communicate through events, not direct references:
```
EventBus.emit('enemy_killed', { enemy, points: 100 })
EventBus.emit('bullet_dodged', { distance: 5 })
EventBus.emit('wave_cleared', { wave: 3 })
```

### 4. Scene State Machine
```
MENU ──[play]──► GAME ──[pause]──► PAUSE
                   │                  │
                   │ [die]        [resume]
                   ▼                  │
               GAME_OVER ◄───────────┘
                   │
               [retry]──► GAME
               [menu]──► MENU
```

---

## Performance Strategy

| Technique | What It Does |
|---|---|
| Object pooling | Eliminates GC for bullets, particles |
| Spatial hashing | Fast collision queries (grid-based) |
| Dirty rectangles | Only redraw changed screen areas |
| Sprite batching | Minimize canvas state changes |
| Off-screen canvas | Pre-render static elements |
| requestAnimationFrame | Sync with display refresh |
| Fixed timestep | Consistent physics regardless of FPS |
