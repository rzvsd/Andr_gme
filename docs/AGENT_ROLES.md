# 🤖 Agent Roles — Parallel Development Plan

## Philosophy

This project is structured so that **7 independent agents** can work in parallel without stepping on each other's toes. Each agent owns a specific folder and set of files. Communication between agents happens through **well-defined interfaces** (exported classes, event names, config constants).

---

## Agent Roster

### 🔧 Agent 1: Core Engine
**Owns:** `src/core/`  
**Priority:** FIRST (everything depends on this)  
**Delivers:**
- `Game.js` — Main game class with loop, scene management, canvas setup
- `Input.js` — Touch/keyboard input abstraction (emits events)
- `Physics.js` — Gravity, velocity, friction calculations
- `Camera.js` — Viewport following the player with smooth lerp
- `EventBus.js` — Global pub/sub event system

**Interfaces Exported:**
```javascript
// Other agents import these
import { Game } from '../core/Game.js';
import { Input } from '../core/Input.js';
import { Physics } from '../core/Physics.js';
import { Camera } from '../core/Camera.js';
import { EventBus } from '../core/EventBus.js';
```

**Dependencies:** `src/config/` only

---

### 🎮 Agent 2: Gameplay (Entities + Systems)
**Owns:** `src/entities/` + `src/systems/`  
**Priority:** SECOND (needs core engine interfaces)  
**Delivers:**
- `Entity.js` — Base class (position, velocity, bounds, active flag)
- `Player.js` — Player character with movement, jump, shoot
- `Bullet.js` — Projectile with direction, speed, owner
- `Platform.js` — Static rectangular collision body
- `PhysicsSystem.js` — Applies physics to all entities per frame

**Interfaces Exported:**
```javascript
import { Player } from '../entities/Player.js';
import { Bullet } from '../entities/Bullet.js';
```

**Dependencies:** `src/core/`, `src/config/`, `src/utils/`

---

### 🎨 Agent 3: Rendering
**Owns:** `src/rendering/`  
**Priority:** PARALLEL with Agent 2  
**Delivers:**
- `SpriteSheet.js` — Load and slice sprite sheets into frames
- `Animator.js` — Frame-based animation controller (play, loop, stop)
- `ParticleEmitter.js` — Lightweight particle system (explosions, smoke)

**Interfaces Exported:**
```javascript
import { SpriteSheet } from '../rendering/SpriteSheet.js';
import { Animator } from '../rendering/Animator.js';
import { ParticleEmitter } from '../rendering/ParticleEmitter.js';
```

**Dependencies:** `src/core/Camera.js`, `src/config/`

---

### 🖥️ Agent 4: UI & Scenes
**Owns:** `src/ui/` + `src/scenes/`  
**Priority:** THIRD (needs entities + rendering)  
**Delivers:**
- `MenuScene.js` — Title screen with Play/Settings/Scores
- `GameOverScene.js` — Death/retry screen

**Interfaces Exported:**
```javascript
import { MenuScene } from '../scenes/MenuScene.js';
// Scenes registered with Game.sceneManager
```

**Dependencies:** `src/core/`, `src/entities/`, `src/rendering/`, `src/systems/`, `src/config/`

---

### 🔊 Agent 5: Audio
**Owns:** `src/audio/` + `public/audio/`  
**Priority:** PARALLEL (independent, listens to EventBus)  
**Delivers:**
- `AudioManager.js` — SFX playback (pooled Audio elements)
- `MusicManager.js` — BGM loop with fade in/out

**Interfaces Exported:**
```javascript
import { AudioManager } from '../audio/AudioManager.js';
import { MusicManager } from '../audio/MusicManager.js';
```

**Dependencies:** `src/core/EventBus.js`, `src/config/`

**Note:** Audio agent only listens to events. It never imports entities or systems directly. This means it can be built completely independently.

---

### 📱 Agent 6: Platform & Build
**Owns:** `android/`, root config files (`vite.config.js`, `capacitor.config.ts`, `package.json`)  
**Priority:** CAN START IMMEDIATELY  
**Delivers:**
- Vite project configuration
- Capacitor setup for Android
- Build scripts (`npm run dev`, `npm run build`, `npx cap sync`)
- Android-specific touch optimizations

**Dependencies:** None (sets up the shell that other agents fill)

---

### 🖼️ Agent 7: Art & Assets
**Owns:** `public/audio/`, `public/fonts/`, `public/levels/`  
**Priority:** PARALLEL (produces assets other agents consume)  
**Delivers:**
- Player sprite sheet (all animations)
- Enemy sprite sheets (per type)
- Bullet sprites
- Platform tiles
- Background layers
- UI button images
- Sound effects (Web Audio compatible formats)
- Background music
- Custom game font

**Dependencies:** None (pure asset creation)

---

## Execution Order (Critical Path)

```
TIME ──────────────────────────────────────────────►

Agent 6 (Platform) ████████░░░░░░░░░░░░░░░░░░░░░░░░
Agent 7 (Art)      ████████████████████████░░░░░░░░░
Agent 1 (Core)     ████████████░░░░░░░░░░░░░░░░░░░░░
Agent 5 (Audio)    ░░░░████████████░░░░░░░░░░░░░░░░░
Agent 2 (Gameplay) ░░░░░░░░████████████████░░░░░░░░░
Agent 3 (Rendering)░░░░░░░░████████████████░░░░░░░░░
Agent 4 (UI/Scene) ░░░░░░░░░░░░░░░░████████████████░
INTEGRATION        ░░░░░░░░░░░░░░░░░░░░░░░░░░██████

████ = Active work
░░░░ = Waiting / not started
```

**Critical path:** Platform → Core → Gameplay → UI/Scenes → Integration

**Parallel tracks:** Art + Audio run alongside everything else.

---

## Communication Contract

All inter-agent communication happens through:

1. **EventBus events** (runtime):
   - `player_hit`, `enemy_killed`, `bullet_fired`, `bullet_dodged`
   - `wave_start`, `wave_cleared`, `game_over`
   - `score_updated`, `combo_increased`

2. **Shared config constants** (compile-time):
   - `CANVAS_WIDTH`, `CANVAS_HEIGHT`
   - `GRAVITY`, `PLAYER_SPEED`, `BULLET_SPEED`
   - `ENEMY_TYPES`, `WAVE_DEFINITIONS`

3. **Entity interface contract** (every entity has):
   - `x, y, width, height` — position & bounds
   - `vx, vy` — velocity
   - `active` — alive or pooled
   - `update(dt)` — per-frame logic
   - `render(ctx, camera)` — draw to canvas
