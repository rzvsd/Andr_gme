# 🔨 8-Phase Build Order

## Overview

The build follows a strict dependency order — each phase builds on the previous one. Phases that can run in parallel are noted.

---

## Phase 1: Project Initialization
**Goal:** Working Vite dev server with an empty canvas.

| File | What |
|---|---|
| `package.json` | Vite, Capacitor, Vitest dependencies |
| `vite.config.js` | Dev server config |
| `index.html` | Canvas element, viewport meta, font `@font-face` |
| `src/main.js` | Create canvas, instantiate Game, start loop |

**Done when:** `npm run dev` → browser shows a blank canvas at `localhost:5173`.

---

## Phase 2: Core Engine
**Goal:** Game loop running at 60fps, input processing, physics math ready.

| File | What |
|---|---|
| `src/core/EventBus.js` | `on()`, `off()`, `emit()` pub/sub |
| `src/core/Game.js` | Fixed-timestep loop, scene manager, canvas context |
| `src/core/Input.js` | Touch + keyboard → unified actions (left, right, jump, shoot) |
| `src/core/Physics.js` | `applyGravity()`, `integrate()`, `aabbOverlap()` |
| `src/core/Camera.js` | Follow target with lerp, world↔screen transforms |

**Done when:** Game loop logs `update()` and `render()` at 60fps in console.

---

## Phase 3: Config & Utils *(parallel with Phase 2)*
**Goal:** All constants centralized, utility functions available.

| File | What |
|---|---|
| `src/config/constants.js` | `CANVAS_WIDTH`, `GRAVITY`, `PLAYER_SPEED`, wave defs, colors |
| `src/config/settings.js` | Sound/music toggles, saved to localStorage |
| `src/utils/math.js` | `clamp()`, `lerp()`, `randomRange()`, `distance()` |
| `src/utils/pool.js` | `ObjectPool` class with `acquire()` / `release()` |
| `src/utils/storage.js` | `save(key, data)`, `load(key)` with JSON + error handling |

**Done when:** Constants are importable, pool can allocate/release objects.

---

## Phase 4: Entities
**Goal:** Player runs, jumps, shoots. Enemies exist with different types.

| File | What |
|---|---|
| `src/entities/Entity.js` | Base class: x, y, vx, vy, width, height, active, update, render |
| `src/entities/Player.js` | Responds to input, has HP, fires bullets |
| `src/entities/Enemy.js` | 5 types (Grunt, Sniper, Rusher, Tank, Boss), each with behavior |
| `src/entities/Bullet.js` | Travels in direction, damages on hit, poolable |
| `src/entities/Platform.js` | Static rectangle with collision surface |

**Done when:** Player moves with arrow keys, bullets fire, enemies have placeholder rectangles.

---

## Phase 5: Systems
**Goal:** Full gameplay logic — physics, collisions, AI, waves, scoring.

| File | What |
|---|---|
| `src/systems/PhysicsSystem.js` | Apply gravity + friction to all entities each frame |
| `src/systems/CollisionSystem.js` | AABB checks, bullet↔entity and entity↔platform resolution |
| `src/systems/AISystem.js` | Per-enemy decision: patrol, aim, chase, shoot |
| `src/systems/SpawnSystem.js` | Wave definitions, spawn timing, difficulty curve |
| `src/systems/ScoreSystem.js` | Listen to events, maintain kills/dodges/wave/score |

**Done when:** Player can play through 3+ waves — enemies spawn, shoot, die, score counts.

---

## Phase 6: Rendering & Assets *(art can start in Phase 1)*
**Goal:** Sprites replace placeholder rectangles, animations play, particles pop.

| File | What |
|---|---|
| `src/rendering/SpriteSheet.js` | Load PNG, slice into frame rects by grid |
| `src/rendering/Animator.js` | Play frame sequences at N fps, loop/once modes |
| `src/rendering/ParticleEmitter.js` | Short-lived particles for explosions, sparks |
| `src/rendering/Background.js` | 2-3 parallax layers scrolling at different speeds |
| `public/sprites/*.png` | All sprite sheet assets |

**Done when:** Characters are animated sprites, explosions play on death, background scrolls.

---

## Phase 7: UI, Scenes & Audio
**Goal:** Complete game flow from menu to gameplay to game over. Touch controls. Sound.

| File | What |
|---|---|
| `src/ui/HUD.js` | Renders kills, dodges, wave, score text on canvas |
| `src/ui/Button.js` | Touch-responsive button with press/release visual |
| `src/ui/Joystick.js` | Virtual joystick outputting x/y (-1 to 1) |
| `src/ui/ScoreBoard.js` | End-game stats panel |
| `src/scenes/MenuScene.js` | Title + Play button |
| `src/scenes/GameScene.js` | Orchestrates all entities + systems |
| `src/scenes/PauseScene.js` | Overlay with resume/restart |
| `src/scenes/GameOverScene.js` | Score summary + retry |
| `src/audio/AudioManager.js` | SFX pool, event-driven |
| `src/audio/MusicManager.js` | BGM loop with fade |

**Done when:** Full flow: Menu → Play → Gameplay → Pause → Game Over → Retry. Touch works. Sound plays.

---

## Phase 8: Polish & Android Packaging
**Goal:** Runs as an Android APK at 60fps.

| Task | What |
|---|---|
| Capacitor config | `capacitor.config.ts`, `npx cap add android` |
| Android manifest | Landscape lock, fullscreen, min SDK 24 |
| Performance | Profile & fix any frame drops, optimize draw calls |
| Level data | `public/levels/arena_1.json` etc. |
| Final test | End-to-end on browser + Android device |

**Done when:** APK installs on Android phone, game plays smoothly at 60fps with touch controls.

---

## Dependency Graph

```
Phase 1 ──► Phase 2 ──► Phase 4 ──► Phase 5 ──► Phase 7 ──► Phase 8
              │                                     ▲
              ├──► Phase 3 (parallel) ──────────────┘
              │                                     
              └──► Phase 6 (art can start early) ───┘
```

Phases 3, 6, and partially 7 (audio) can be worked on in parallel with the main critical path.
