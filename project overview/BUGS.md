# Bug Tracker

Use this file as the in-repo source of truth for bugs.

## Fields
- `ID`: Stable ID (`BUG-001`, `BUG-002`, ...)
- `Timestamp`: `YYYY-MM-DD HH:mm:ss +/-TZ`
- `Solved`: `Y` or `N`
- `Bug Description`: What failed and where
- `Solution Details`: Exact fix applied

## Bugs

===== PHASE 1 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-001 | 2026-02-15 15:46:40 +02:00 | Y | Dev server failed on Node `v21.6.0` with `vite@7` (`crypto.hash is not a function`). | Pinned `vite` to `^5.4.0` in `package.json`, reinstalled dependencies, verified dev server port `5173` opens, and verified `npm run build` succeeds. |
| BUG-002 | 2026-02-15 15:49:42 +02:00 | Y | Canvas backing resolution is not device-pixel-ratio aware, causing blur on high-DPI mobile screens. | Updated `src/main.js` and later `src/core/Game.js` to use DPR-aware canvas buffer sizing, CSS display sizing, and `ctx.setTransform(...)` reset to avoid cumulative scaling. Verified with build/dev checks. Solved at 2026-02-15 16:42:34 +02:00. |
| BUG-003 | 2026-02-15 15:49:42 +02:00 | Y | Mobile gesture/scroll handling is not locked (`overflow: hidden`, `touch-action: none` missing), which can cause browser hijack and bounce scroll. | Updated `index.html` CSS: `body { overflow: hidden; touch-action: none; overscroll-behavior: none; }` to prevent browser scroll/gesture interference. Solved at 2026-02-15 16:42:34 +02:00. |
| BUG-004 | 2026-02-15 15:49:42 +02:00 | Y | Mobile web app meta tags are missing in `index.html` head. | Added `<meta name="mobile-web-app-capable" content="yes">` and `<meta name="theme-color" content="#000000">` in `index.html` head. Solved at 2026-02-15 16:42:34 +02:00. |
| BUG-005 | 2026-02-15 15:49:42 +02:00 | Y | Bootstrap render loop has no fixed timestep/delta architecture and should be replaced by a phase-2 game loop module. | Added `src/core/Game.js` with fixed-timestep loop (60 UPS), `start()/stop()`, `update(dt)`, `render(alpha)`, and DPR-aware resize handling. Rewired `src/main.js` to instantiate and start `Game`. Verified `PORT_5173_OPEN=True` and successful `npm run build`. Solved at 2026-02-15 16:42:34 +02:00. |

===== PHASE 2 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-006 | 2026-02-15 17:13:18 +02:00 | Y | `Game.js` still contains test simulation/entity movement logic in `update()`, which should be scene/entities/systems responsibility. Must remove before Phase 4 to avoid god-object design. | Removed test simulation state and in-loop movement/physics from `src/core/Game.js`. `update(deltaSeconds)` now only delegates to `currentScene.update(deltaSeconds, this)` and then runs `camera.update()`. Solved at 2026-02-15 20:44:46 +02:00. |

===== PHASE 3 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-007 | 2026-02-15 17:26:19 +02:00 | Y | Physics unit mismatch between `src/config/constants.js` (frame-like values) and `src/core/Game.js` (pixels-per-second with `dt`) would break Phase 4 entity motion if constants were consumed directly. | Rewrote constants to pixels-per-second values (`GRAVITY=1600`, `PLAYER_MAX_SPEED=360`, `PLAYER_ACCELERATION=2400`, `PLAYER_FRICTION=2200`, `PLAYER_JUMP_SPEED=560`, `CAMERA_LERP=0.12`) and wired `Game.js` to use imported constants. |
| BUG-008 | 2026-02-15 17:26:19 +02:00 | Y | Config drift risk: `FIXED_UPS` constant existed but `Game.js` hardcoded `60`, so changing config had no effect. | Wired `Game.js` to use `FIXED_UPS` from `src/config/constants.js` for loop step configuration. |
| BUG-009 | 2026-02-15 17:26:19 +02:00 | Y | Object pool lacked pre-allocation path, causing first-use factory spikes and extra allocation pressure. | Added `preallocate(count)` to `src/utils/pool.js` so pools can be warm-filled before gameplay waves. |

===== PHASE 4 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-010 | 2026-02-15 21:01:29 +02:00 | Y | `Enemy.update()` reset `vy` to `0` every frame, which would cancel gravity from `PhysicsSystem` and cause floating enemies in Phase 5. | Removed vertical velocity reset from `src/entities/Enemy.js`. Enemy update now integrates existing `vx/vy` only and does not override gravity-driven vertical motion. |
| BUG-011 | 2026-02-15 21:01:29 +02:00 | Y | Entity update contracts were inconsistent (`Enemy.update(dt, context)` vs others `update(dt)`), creating system-integration ambiguity for generic entity iteration in Phase 5. | Standardized entity update signatures to `update(deltaSeconds, context)` across entity classes (`Entity`, `Platform`, `Bullet`, `Player`, `Enemy`) with optional/ignored context where not needed. Enemy no longer requires context for motion decisions inside entity update. |
| BUG-012 | 2026-02-15 21:01:29 +02:00 | Y | `Player.applyInput()` applied friction/velocity updates directly, creating double-friction risk once `PhysicsSystem` also applies friction in Phase 5. | Refactored `Player.applyInput()` to intent-only handling (`moveIntent`, facing, jump request). Removed in-entity friction/acceleration integration ownership from input path so PhysicsSystem can own shared friction behavior. |

===== PHASE 5 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-013 | 2026-02-15 21:19:32 +02:00 | Y | Jump impulse was owned in two places (`PhysicsSystem.update()` and `Player.update()`), creating fragile order-dependent behavior. | Removed jump handling from `src/entities/Player.js::update()`. Jump request consumption and impulse application now live only in `src/systems/PhysicsSystem.js`. |
| BUG-014 | 2026-02-15 21:19:32 +02:00 | Y | `SpawnSystem` instantiated enemies directly (`new Enemy(...)`) instead of using pooling, causing avoidable allocation churn across waves. | Added pool-aware spawn flow in `src/systems/SpawnSystem.js` (`enemyPool` support via constructor/context, acquire on spawn, recycle/release inactive enemies). Added `Enemy.configure(type, position)` for safe pooled reinitialization. |

===== PHASE 6 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-015 | 2026-02-15 21:36:03 +02:00 | Y | `SpriteSheet` loading lifecycle is manual (`load()` is not auto-invoked). If Phase 7 scene init forgets `await sheet.load()`, `isReady()` remains `false` and entities silently stay in fallback rectangle rendering. | Implemented explicit preload in `src/scenes/GameScene.js` with `await sheet.load()` for required sheets before gameplay update, gated update on preload completion, and added dev-mode hard failure on required asset preload errors. Solved at 2026-02-15 22:32:55 +02:00. |
| BUG-016 | 2026-02-15 21:38:54 +02:00 | Y | `ParticleEmitter.render()` used per-particle `beginPath + arc + fill`, which is heavier on low-end mobile devices. | Optimized default render path to square sprites via `fillRect` (no path construction). Kept optional `shape: "circle"` support for effects that require round particles. |
| BUG-017 | 2026-02-15 21:38:54 +02:00 | Y | `ParticleEmitter` camera projection used raw `camera.x/y` subtraction, making it fragile if camera projection logic changes (e.g., zoom). | Updated renderer to prefer `camera.worldToScreen(...)` when available, with subtraction fallback. Extended `Camera.worldToScreen/screenToWorld` to support optional output objects for low-allocation integration. |
| BUG-018 | 2026-02-15 21:38:54 +02:00 | Y | `SpriteSheet.drawFrame()` fallback branch manually restored only `fillStyle`, inconsistent with `save()/restore()` usage elsewhere. | Added `ctx.save()/ctx.restore()` fallback rendering when available, with manual `fillStyle` restoration fallback for minimal contexts. |
| BUG-019 | 2026-02-15 21:38:54 +02:00 | Y | Background parallax used one axis factor (`parallax`) for both X and Y, causing undesirable vertical drift on jump/camera Y movement. | Split background layer controls into `parallaxX` and `parallaxY`. Default behavior now keeps vertical parallax at `0` unless explicitly configured. |

===== PHASE 7 =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-020 | 2026-02-16 07:34:10 +02:00 | Y | `PLAYER_BULLET_DAMAGE` was referenced in `src/scenes/GameScene.js` but never defined, causing a runtime `ReferenceError` in the firing path. | Added `PLAYER_BULLET_DAMAGE=25` in `src/config/constants.js` and imported it in `src/scenes/GameScene.js`, restoring valid player bullet damage at runtime. |
| BUG-021 | 2026-02-16 07:34:10 +02:00 | Y | `GameScene.render()` drew both fallback primitives and sprite frames for entities when assets were loaded, causing double-render and unnecessary GPU work. | Updated `src/scenes/GameScene.js` render flow to use exclusive paths: fallback primitives only in `fallbackMode`, sprite rendering otherwise. |
| BUG-022 | 2026-02-16 07:34:10 +02:00 | Y | Fall/death damage path bypassed `player_hit` event emission, so hit SFX and death accounting relying on events could be skipped. | Updated fall-death handling in `src/scenes/GameScene.js` to emit `player_hit` with `isFatal/death/dead` metadata after applying damage. Also updated `src/systems/CollisionSystem.js` to include fatal metadata on bullet hits for consistent death tracking. |

===== PLAYTEST HOTFIXES =====

| ID | Timestamp | Solved (Y/N) | Bug Description | Solution Details |
|---|---|---|---|---|
| BUG-023 | 2026-02-16 08:50:12 +02:00 | Y | `PLAYTEST-001`: Retry button did not trigger scene transition in game over flow. | Fixed pointer routing in `src/scenes/GameOverScene.js` so button events are treated as handled only when button handlers return truthy. This removed the false-positive consume path that blocked `Retry`/`Menu` activation. |
| BUG-024 | 2026-02-16 08:50:12 +02:00 | Y | `PLAYTEST-002`: Player and enemies were visually hard to distinguish during gameplay. | Updated `src/scenes/GameScene.js` sprite rendering to improve readability: mapped enemy types to distinct sprite frames, rendered actor sprites at larger visual scale, and added explicit per-type/player outline colors while keeping gameplay hitboxes unchanged. |
| BUG-025 | 2026-02-16 08:50:12 +02:00 | Y | `PLAYTEST-003`: Game over stats commonly appeared as all-zero (or near-zero) despite active runs. | Improved stat capture consistency: `src/systems/ScoreSystem.js` now tracks active wave on `wave_start`; `src/scenes/GameScene.js` now stores robust run stats (`wave` fallback via current wave + `timeSeconds`); `src/scenes/GameOverScene.js` normalization now accepts `currentWave/waveNumber` fallbacks. |
| BUG-026 | 2026-02-16 08:50:12 +02:00 | Y | `PLAYTEST-004`: HUD right-panel labels rendered but Wave/Score values were obscured/blank in playtest layout. | Added right-side HUD inset support in `src/ui/HUD.js` and applied it from `src/scenes/GameScene.js` to keep right HUD metrics clear of top-right controls. Also hardened numeric parsing in `src/ui/HUD.js` and `src/ui/ScoreBoard.js` to prevent silent value drops from numeric-string payloads. |
| BUG-027 | 2026-02-16 08:55:17 +02:00 | Y | `PLAYTEST-001` follow-up: pointer-routing bug remained in `MenuScene` and `PauseScene` (only fixed in `GameOverScene` initially), so taps could still be consumed without triggering button actions. | Applied the same routing fix to `src/scenes/MenuScene.js` and `src/scenes/PauseScene.js`: pointer routes now return handled only when `result.called && Boolean(result.value)`. Verified transitions via scene-level pointer simulation (`Play` -> `game restart`, `Resume` -> `game resume`). |
