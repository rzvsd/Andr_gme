# 🛡️ SAFETY REVIEW — Senior Dev Audit Log

> **This file is exclusively maintained by the reviewer (Antigravity).**  
> It tracks every issue, concern, and design risk found during code reviews.  
> Items are marked `[DONE]` when resolved or `[TBD]` when still open.

---

## Phase 1: Project Initialization

### Critical Issues
- `[DONE]` **BUG-001: Vite 7 incompatible with Node 21.** Pinned to `^5.4.0`. Verified.

### Code Quality
- `[DONE]` **BUG-002: No DPI awareness.** Canvas was rendering at CSS pixels, not device pixels. Fixed with `devicePixelRatio` scaling in `Game.js`.
- `[DONE]` **BUG-003: Browser gesture hijacking.** Added `overflow: hidden`, `touch-action: none`, `overscroll-behavior: none`.
- `[DONE]` **BUG-004: Missing mobile meta tags.** Added `mobile-web-app-capable` and `theme-color`.
- `[DONE]` **BUG-005: No fixed timestep.** Replaced simple RAF loop with proper accumulator-based fixed timestep in `Game.js`.

### Debt / Minor
- `[DONE]` **~~Dead CSS rule.~~ Fixed.** `#game-canvas` rule in `index.html` now only sets `display: block` — size rules removed. XPHASE-005 resolved.

---

## Phase 2: Core Engine

### Critical Issues
- `[DONE]` **~~BUG-006: Test simulation hardcoded in Game.js.~~ Fixed.** Simulation object, movement/physics logic, and unused imports removed from `Game.js` (228→182 lines). `update()` now only delegates to `currentScene.update()` + `camera.update()`. Clean separation of concerns achieved.

### Code Quality
- `[DONE]` **EventBus.js:** Production quality. Safe mid-emit unsubscribe via spread copy. Returns unsubscribe function. Cleans up empty event maps.
- `[DONE]` **Physics.js:** Clean static utility class. Pure functions, no side effects.
- `[DONE]` **Input.js:** Comprehensive dual-mode (keyboard + touch). `consumePressed()` for one-shot actions is correct for platformer input. `passive: false` on touch events is necessary.
- `[DONE]` **Camera.js:** Defensive `Number.isFinite()` guards. Flexible dimension lookup with fallback keys.

### Design Risks
- `[TBD]` **Input.js touch vs future Joystick conflict.** Current touch handling splits screen in half (left = movement, right = shoot). When `Joystick.js` is added in Phase 7, these two systems will fight over touch ownership. Plan: Input.js should expose a way to disable raw touch zones when Joystick is active, OR Joystick should replace the left-half touch handler entirely.
- `[DONE]` **~~Physics.clamp() duplication.~~ Fixed.** Centralized through `utils/math.js`. Physics module now delegates through the shared math util path.

### Architecture
- `[DONE]` **Scene lifecycle contract.** `onEnter(game)`, `onExit(game)`, `update(dt, game)`, `render(ctx, alpha, game)`, `onResize(w, h, game)` — well-defined, consistent.
- `[DONE]` **Event-driven lifecycle.** `game:start`, `game:stop`, `scene:switch`, `game:resize` events emitted at correct points.

---

## Phase 3: Config & Utils

### Critical Issues
- `[DONE]` **~~🔴 BUG-007: PHYSICS UNIT MISMATCH.~~ Fixed.** `constants.js` rewritten to pixels-per-second: `GRAVITY=1600`, `PLAYER_JUMP_SPEED=560`, `PLAYER_FRICTION=2200`, `PLAYER_ACCELERATION=2400`, `PLAYER_MAX_SPEED=360`. Now matches `Game.js` integration model.
- `[DONE]` **~~🔴 BUG-008: `FIXED_UPS` not wired.~~ Fixed.** `Game.js` now imports `FIXED_UPS` from constants and uses it for tick rate calculation.

### Code Quality
- `[DONE]` **constants.js uses named exports.** ✅ Pre-review guidance followed.
- `[DONE]` **settings.js self-contains its localStorage calls.** ✅ Does not import `storage.js`. Has its own `persistSettings()` and `hasLocalStorage()`. Pre-review guidance followed.
- `[DONE]` **pool.js API matches Phase 4 contract.** `acquire()`, `release(obj)`, `size`, `activeCount` all present. ✅
- `[DONE]` **math.js: clamp() auto-corrects swapped min/max.** `Math.min(min, max)` / `Math.max(min, max)` — defensive, good.
- `[DONE]` **math.js: lerp() clamps alpha to [0,1].** Prevents extrapolation. Correct for game use.
- `[DONE]` **storage.js: namespaced keys.** Prefix `bullet-dodge-arena:` prevents collision with other apps on same origin.
- `[DONE]` **pool.js: double-release protection.** `_availableSet` prevents the same object appearing twice in the available stack. Smart.
- `[DONE]` **settings.js: `Object.freeze` on defaults.** Prevents accidental mutation of the template.

### Design Risks
- `[DONE]` **~~🟡 settings.js and storage.js overlap.~~ Fixed.** `settings.js` now imports `load`/`save` from `storage.js` and uses key `'settings'` (prefixed automatically by storage wrapper). No more direct `localStorage` calls — single persistence path.
- `[DONE]` **~~🟡 BUG-009: pool.js pre-allocation.~~ Fixed.** `preallocate(count)` method added. Validates input with `Number.isFinite()`, floors to integer, creates objects into available pool. Prevents GC burst during first gameplay wave.
- `[TBD]` **🟢 constants.js is thin.** Only 14 constants. Missing: enemy speeds, bullet speeds, wave definitions, scoring values, canvas dimensions, HUD colors. These will need to be added in Phases 4-5. Not a bug — just noting that this file will grow significantly.

---

## Phase 4: Entities

### Critical Issues
- `[DONE]` **~~`[HIGH]` BUG-010: Enemy.js had no gravity.~~ Fixed.** `this.vy = 0` removed from `update()`. Enemy now integrates existing `vx`/`vy` without overwriting — PhysicsSystem can freely apply gravity. State detection (`jumping`/`falling`/`moving`/`idle`) based on actual velocity.
- `[DONE]` **~~`[HIGH]` BUG-011: `update()` signature mismatch.~~ Fixed.** All entities standardized to `update(deltaSeconds, context)`: Entity, Player, Bullet, Platform, Enemy. Phase 5 systems can iterate generically.
- `[DONE]` **~~`[HIGH]` BUG-012: Double-friction risk.~~ Fixed.** `Player.applyInput()` is now intent-only: sets `moveIntent`, `facing`, `jumpRequested`. No acceleration, friction, or velocity clamping. PhysicsSystem will be the single owner of player physics.

### Code Quality
- `[DONE]` **Entity.js: Clean base class.** Destructured options, `getBounds()`, `activate()/deactivate()` lifecycle. Correct.
- `[DONE]` **Platform.js: Minimal and correct.** Static entity, zeroes velocity in `update()`, camera-aware render.
- `[DONE]` **Bullet.js: Pool-compatible.** `reset()` method matches `ObjectPool` reset callback contract. `fire()` validates and normalizes all inputs. Lifetime-based auto-deactivation.
- `[DONE]` **Enemy.js: Good data-driven type system.** `ENEMY_DEFAULTS` with frozen config per type. Health bar rendering built in. `decideAction()` stub ready for Phase 5 AISystem.
- `[DONE]` **Player.js: `canShoot()`/`markShot()` pattern.** Clean cooldown system using timestamp delta, not frame counters. Correct.
- `[DONE]` **Bullet.js: Direction normalization.** `fire()` normalizes direction vector and handles zero-length fallback to `(1,0)`. Prevents NaN propagation.

### Design Risks
- `[DONE]` **~~`[MEDIUM]` Render methods are copy-pasted across Player, Enemy, and Bullet.~~ Fixed.** Camera projection logic extracted to `Entity.projectToScreen(camera, x, y)` in `Entity.js:24`. All three subclasses (`Player.js:119`, `Enemy.js:195`, `Bullet.js:122`) now call `this.projectToScreen(camera)` instead of inline projection code.
- `[DONE]` **~~`[MEDIUM]` Player.js inlined `clamp()`.~~ Fixed.** Now imports `clamp` from `utils/math.js`. Local `toNumberOr` helper remains (acceptable — too small/specific for a shared util).
- `[DONE]` **~~`[LOW]` Player/Enemy colors hardcoded in entities.~~ Fixed.** `PLAYER_COLOR` and `ENEMY_COLOR_BY_TYPE` centralized in `constants.js:11-20`. `Player.js` imports `PLAYER_COLOR`; `Enemy.js` imports `ENEMY_COLOR_BY_TYPE`.
- `[DONE]` **~~`[LOW]` Entity.js `width`/`height` default to `0`.~~ Fixed.** Base `Entity` constructor now defaults to `width = 1, height = 1` (`Entity.js:7-8`). Prevents zero-area ghost entities.

---

## Phase 5: Systems

### Critical Issues
- `[DONE]` **~~`[HIGH]` BUG-013: Double jump handling.~~ Fixed.** Jump impulse removed from `Player.update()` — now animation/state only. PhysicsSystem is the single owner of jump consumption + impulse application.
- `[DONE]` **~~`[HIGH]` BUG-014: SpawnSystem bypassed ObjectPool.~~ Fixed.** SpawnSystem now accepts `enemyPool` via constructor options or context. Uses `#acquireEnemy()` (pool → factory → `new` fallback) and `#recycleInactiveEnemies()` to release dead enemies back to pool. `Enemy.configure(type, position)` added for safe pooled reinitialization — resets all properties cleanly.

### Code Quality
- `[DONE]` **PhysicsSystem: Clean ownership model.** Reads `moveIntent` from player/enemy, applies acceleration/friction/gravity, integrates position. Resets `moveIntent = 0` after consuming. This is exactly right — physics owns movement, entities own intent.
- `[DONE]` **CollisionSystem: Correct AABB with minimum-overlap resolution.** Separates on smallest overlap axis (X vs Y). Sets `onGround = true` only when resolved upward (`deltaY < 0`). Bullet ownership detection is flexible (string, object ref, or array inclusion).
- `[DONE]` **AISystem: Data-driven shoot ranges per type.** Sniper gets 520px range, Rusher 200px. Snipers don't chase (`type !== SNIPER` guard). `findNearestActivePlayerOnX` is clean and efficient.
- `[DONE]` **ScoreSystem: Event-driven, properly unsubscribes via `dispose()`.** Uses return values from `eventBus.on()` for cleanup. `_resolvePoints` allows payload-driven scoring overrides.
- `[DONE]` **SpawnSystem: Procedural wave generation.** `buildWaveDefinition()` scales difficulty per wave with TYPE_DELAY_MULTIPLIER. Boss every 5th wave. Loop guard `< 200` prevents infinite spawn loops.
- `[DONE]` **CollisionSystem: `deactivateEntity()` helper.** Gracefully handles entities with or without `deactivate()` method. Zeroes velocity on deactivation.
- `[DONE]` **PhysicsSystem: Uses `Physics.applyFriction()` and `Physics.applyGravity()` from core.** No reimplementation — proper delegation to core module.

### Design Risks
- `[DONE]` **~~`[MEDIUM]` CollisionSystem resets `onGround = false` at line 110 before checking platforms.~~ Fixed.** `CollisionSystem.#resolveEntitiesAgainstPlatforms()` now uses a local `grounded` flag (`CollisionSystem.js:109`) that accumulates across all platform checks, and assigns `entity.onGround = grounded` once at the end (`CollisionSystem.js:140`). No flickering, no execution-order dependency.
- `[TBD]` **`[MEDIUM]` `bullet_dodged` event has no emitter.** `ScoreSystem` listens for `'bullet_dodged'` events (line 27), but nobody emits this event. Not `CollisionSystem`, not `AISystem`, not `PhysicsSystem`. The dodge counter will always be 0 unless something emits this event later. **Needs a system or logic that detects "bullet passed near player without hitting" and emits `bullet_dodged`.** This could be a simple check in CollisionSystem or a separate proximity check.
- `[DONE]` **~~`[MEDIUM]` System execution order is undefined.~~ Fixed.** `GameScene` now defines an explicit `systemPipeline` array (`GameScene.js:75`) ordering `[aiSystem, physicsSystem, collisionSystem, spawnSystem]`. `update()` iterates this array (`GameScene.js:279-283`), enforcing the correct execution order.
- `[DONE]` **~~`[LOW]` `toNumber`, `asArray`, `isActiveEntity`, `emitEvent` helpers are duplicated across systems.~~ Fixed.** Extracted to shared `systems/systemUtils.js:1-37`. All 4 system files (`AISystem`, `PhysicsSystem`, `CollisionSystem`, `SpawnSystem`) now import from it.

---

## Phase 6: Rendering & Assets

### Critical Issues
- `[DONE]` **~~`[HIGH]` BUG-015: SpriteSheet `load()` is never called automatically.~~ Fixed in Phase 7.** `GameScene.preloadAssets()` explicitly calls `await this.playerSheet.load()`, `await this.enemySheet.load()`, `await this.bulletSheet.load()`. DEV mode guard throws on failure. `fallbackMode` flag gates sprite vs rectangle rendering.

### Code Quality
- `[DONE]` **SpriteSheet: Option C fallback implemented.** `drawFrame()` tries `ctx.drawImage()` first; on failure or not-ready, falls back to `ctx.fillRect()` with `fallbackColor`. Entities won't break if assets 404.
- `[DONE]` **SpriteSheet: Flexible frame selectors.** `_resolveFrameSelector()` accepts index (number), name (string), `[row, col]` array, or `{x, y, width, height}` rect. Future-proof for JSON atlas support.
- `[DONE]` **SpriteSheet: Named frame alias chain with cycle detection.** `_resolveNamedFrameRect()` uses `visitedNames` Set to prevent infinite recursion on circular aliases.
- `[DONE]` **SpriteSheet: Auto-derives grid dimensions.** If `columns`/`rows` not specified, calculates from `image.naturalWidth / frameWidth` after load.
- `[DONE]` **Animator: Accumulated-time model — correct.** `this.elapsedSeconds += delta`, then `Math.floor(elapsed / frameDuration)` for frame index. No frame-counting drift. Loop uses modulo. One-shot clamps with `Math.min`.
- `[DONE]` **Animator: `onComplete` callback for one-shot animations.** Fires exactly once when a non-looping animation finishes. `completed` flag prevents double-fire.
- `[DONE]` **Animator: Animation name contract documented.** Comment block explicitly lists `idle`, `run`, `jump`, `fall` — matches Player.js `animationState` values exactly.
- `[DONE]` **Animator: `resolveState()` fallback chain.** Requested state → current state → `'idle'` → `null`. Prevents crashes if a state name is missing.
- `[DONE]` **ParticleEmitter: Pre-allocated pool with free-list stack.** All particles allocated in constructor. `freeIndices` stack + `activeIndices` + `activeLookup` for O(1) activate/deactivate. Zero `new` at runtime. Zero GC pressure.
- `[DONE]` **ParticleEmitter: Hard cap at `capacity` (default 200).** `emit()` returns `false` when full. `burst(20)` stops when pool is exhausted.
- `[DONE]` **ParticleEmitter: Swap-remove deactivation.** `#deactivateAt()` swaps dead particle with last active, then decrements count. O(1), no splice. Correct data-oriented pattern.
- `[DONE]` **Background: Parallax wrapping is correct.** `((baseX % drawWidth) + drawWidth) % drawWidth` handles negative camera positions. Tiles seamlessly in both directions.
- `[DONE]` **Background: Auto-loads images in constructor.** Handles load/error with cleanup. Graceful fallback to solid color fill.
- `[DONE]` **Background: `save()`/`restore()` around alpha changes.** Won't leak opacity to subsequent draw calls.
- `[DONE]` **Manifest and README: Clean contracts.** Animation name contract documented. Option C behavior specified.

### Design Risks
- `[DONE]` **~~`[MEDIUM]` BUG-016: ParticleEmitter render perf.~~ Fixed.** Default render path now uses `fillRect` (square particles). Circle via `beginPath()/arc()/fill()` only when `shape: 'circle'` is explicit. Saves ~2 draw calls per particle.
- `[DONE]` **~~`[MEDIUM]` BUG-017: ParticleEmitter camera projection.~~ Fixed.** Now prefers `camera.worldToScreen()` with reusable `_projectionPoint` object. Falls back to raw subtraction if unavailable. Camera.worldToScreen also updated to accept optional `outPoint` parameter for zero-allocation in tight loops.
- `[DONE]` **~~`[LOW]` BUG-018: SpriteSheet fallback save/restore.~~ Fixed.** Fallback draw path now uses `ctx.save()/ctx.restore()` when available, with manual `fillStyle` restore as fallback for minimal contexts.
- `[DONE]` **~~`[LOW]` BUG-019: Background vertical parallax.~~ Fixed.** Split into `parallaxX` and `parallaxY`. Vertical parallax defaults to `0` unless explicitly set. Sky/mountain layers won't shift on jump.

---

## Phase 7: UI, Scenes & Audio

### Critical Issues
- `[DONE]` **~~🔴 BUG-020: `PLAYER_BULLET_DAMAGE` is undefined.~~ Fixed.** `PLAYER_BULLET_DAMAGE = 25` added to `constants.js:10`, imported and used in `GameScene.js:15,210`. Player bullets now deal 25 damage. Verified constant exists, is imported, and is passed to `b.fire()`.
- `[DONE]` **~~🔴 BUG-021: Double-render of player, enemies, and bullets.~~ Fixed.** `GameScene.render()` now uses mutually exclusive branches: `if (this.fallbackMode)` draws entity `.render()` rectangles, `else` draws SpriteSheet frames. No double-draw. Verified at `GameScene.js:230-239`.
- `[DONE]` **~~🟡 BUG-022: `GameScene` does not emit `player_hit` for fall damage.~~ Fixed.** Fall damage path (`GameScene.js:192-198`) now emits `player_hit` with `{ player, damage, source: "fall", isFatal, death, dead }`. `CollisionSystem.js:200-213` also updated to include `isFatal`/`death`/`dead` metadata on bullet-to-player hits for consistent death tracking.

### Code Quality
- `[DONE]` **`main.js`: Clean bootstrap.** Registers all 4 scenes, creates `AudioManager` + `MusicManager`, subscribes event handlers, attaches to `game.eventBus`. Clean `beforeunload` disposal. No issues.
- `[DONE]` **`Game.js`: Unified `routePointerEvent()`.** Translates DOM `PointerEvent` to scene-relative coordinates and delegates to `currentScene.handlePointerDown/Move/Up/Cancel()`. Falls back to `onPointerDown/Move/Up/Cancel()` aliases. `preventDefault()` only when handled. Correct.
- `[DONE]` **`Button.js`: Production quality.** Rounded-rect path rendering, press/release state tracking, multi-signature pointer normalization, `enabled`/`visible` guards, `reset()` for clean state. `handlePointerUp` only fires `onClick` if pointer is still inside bounds and button is enabled. Correct.
- `[DONE]` **`HUD.js`: Clean panel rendering.** Two-panel layout (left: dodges/deaths/kills, right: wave/score). `resolveViewportSize()` handles DPI-scaled canvases. `pickNumber()` with key aliases for flexible state input.
- `[DONE]` **`Joystick.js`: Proper deadzone math.** `_applyVector()` clamps to unit circle, subtracts deadzone from magnitude, rescales output to 0→1 range. Activation radius prevents accidental touches. `reset()` zeroes all values on pointer up. Correct.
- `[DONE]` **`ScoreBoard.js`: Flexible row builder.** `_buildRows()` conditionally includes `hits` and `highScore` rows. `resolveViewportSize()` for DPI-aware centering. `formatValue()` uses `toLocaleString` for comma formatting.
- `[DONE]` **`AudioManager.js`: Robust event-driven sound.** HTML5 Audio pooling per sound name (max 6). Auto-unlock via silent data-URI probe. Pending plays queue (max 24). Per-source fallback on error (tries `.webm` then `.mp3`). `failedSounds` set prevents retrying broken assets. `dispose()` cleans everything.
- `[DONE]` **`MusicManager.js`: Scene-aware track switching.** Listens to `scene:switch` and `scene_enter` for auto-track changes. `fadeTo()` with setInterval-based volume interpolation. `NotAllowedError` queues pending track for retry on next `unlock()`. Source fallback chain matches `AudioManager` pattern.
- `[DONE]` **`GameScene.onEnter()`: Lazy asset preloading.** `preloadAssets()` called once, `assetsReady` flag gates `update()` and `render()`. Loading screen shown while waiting.
- `[DONE]` **`GameScene.update()`: System execution order correct.** Line 162: `aiSystem → physicsSystem → collisionSystem → spawnSystem`. This matches the required order identified in Phase 5 (XPHASE concern). Entity updates run after systems.
- `[DONE]` **`GameScene`: Pointer ownership tracking.** `pointerOwners` Map tracks which UI element owns each touch point. Prevents one finger's movement from leaking to another element's handler. Clean per-element routing.
- `[DONE]` **`PauseScene.render()`: Semi-transparent overlay.** `rgba(4, 10, 22, 0.72)` draws correctly over whatever the previous frame rendered (pause overlay pattern). Panel + buttons centered.
- `[DONE]` **`GameOverScene.collectStats()`: Deep merge from multiple sources.** Merges `game.sceneData`, `transition.payload`, `payload.stats`, `payload.data`, `payload.event` — handles any stat shape the caller uses. `normalizeStats()` rounds and clamps all values.
- `[DONE]` **BUG-015 RESOLVED.** `GameScene.preloadAssets()` (line 109–117) explicitly calls `await this.playerSheet.load()`, `await this.enemySheet.load()`, `await this.bulletSheet.load()`. DEV mode guard throws if any load fails. `fallbackMode` flag set correctly.

### Design Risks
- `[DONE]` **~~🟡 Massive code duplication across `MenuScene`, `PauseScene`, `GameOverScene`.~~ Fixed.** Shared pointer helpers (`asNumber`, `isObject`, `asPointer`, `rectContains`, `callAny`, `pointerAliases`) extracted to `scenes/scenePointerUtils.js:1-82`. All 3 scenes now import from it instead of defining locally.
- `[DONE]` **~~🟡 `callAny()` silently swallows exceptions.~~ Fixed.** `scenePointerUtils.js:60` now calls `console.error()` in dev mode (`isDev()` guard) when all signature variants fail. Real bugs are no longer silently swallowed.
- `[DONE]` **~~🟡 Touch input conflict between `Input.js` and Joystick.~~ Fixed.** Added `Input.setTouchControlsEnabled(enabled)` method (`Input.js:58`). `GameScene.onEnter()` calls `setTouchControlsEnabled(false)` to disable raw touch handlers while Joystick/Buttons are active. `onExit()` restores by calling `setTouchControlsEnabled(true)`. All touch handlers early-return when disabled. `clearTouchState()` zeroes touch state on disable.
- `[DONE]` **~~🟡 No health bar in HUD.~~ Fixed.** Added `HUD._drawHealthBar()` method (`HUD.js:200-235`). Renders centered health bar below stat panels with rounded rect, background fill, stroke, proportional fill bar, critical color (red) when HP ≤ 30%, and `HP` + `current/max` labels. Style is configurable via `DEFAULT_STYLE` object.
- `[DONE]` **~~🟢 No settings UI.~~ Fixed.** `MenuScene` now imports `loadSettings`/`saveSettings` (`MenuScene.js:2`) and provides SFX/Music toggle buttons. `syncSettingsButtons()` (`MenuScene.js:264`) updates labels. Settings persisted through `settings.js` → `storage.js` wrapper.
- `[TBD]` **🟢 No audio assets exist.** `AudioManager` and `MusicManager` expect files at `/audio/*.webm` and `/audio/*.mp3`, but the `public/` directory has no audio files. Code now warns once per missing sound/track (`AudioManager.js:242`, `MusicManager.js:365`). Not a code bug — content gap.
- `[DONE]` **~~🟢 `GameOverScene` `timeSeconds` is always 0.~~ Fixed.** `GameScene.buildHudState()` (`GameScene.js:413-416`) now computes `timeSeconds = Math.floor(elapsedMs / 1000)` from `runStartedAtMs`. Stats payload passes `timeSeconds` to `GameOverScene.normalizeStats()` (`GameOverScene.js:39`).
- `[DONE]` **~~🟢 `MusicManager.fadeTo()` uses `setInterval(50ms)`.~~ Fixed.** Now uses `requestAnimationFrame` as the primary fade mechanism (`MusicManager.js:206-228`), falling back to `setInterval` only when RAF is unavailable. `#clearFadeTimer()` handles both timer types via a `{ type, id }` shape.

### Runtime Testing Bugs (2026-02-16 live playtest)

> First live test on `localhost:5173` (desktop, Chrome). Colored-rectangle fallback mode (no sprite assets).

- `[DONE]` **~~🔴 PLAYTEST-001: Retry button does not work on Game Over screen.~~ Fixed (BUG-023, BUG-027).** All three UI scenes (`GameOverScene`, `MenuScene`, `PauseScene`) now check `result.called && Boolean(result.value)` in `routePointer()`. Button handler return values are respected — `false` from `Button.handlePointerUp()` no longer short-circuits the scene's own `pressButton()` logic.
- `[DONE]` **~~🔴 PLAYTEST-002: Player and enemies are visually indistinguishable.~~ Fixed (BUG-024).** Added `renderActorSprite()` with per-type sprite frame mapping, visual scale multipliers (`PLAYER_VISUAL_SCALE`, `ENEMY_VISUAL_SCALE`), and per-type outline colors via `getEnemyOutlineColor()`. Player and enemies now render at different sizes with distinct colored outlines in sprite mode.
- `[DONE]` **~~🟡 PLAYTEST-003: All stats display 0 on Game Over.~~ Fixed (BUG-025).** Three-pronged fix: (1) `ScoreSystem` now subscribes to `wave_start` event and tracks active wave via `_resolveWave()`. (2) `GameScene.buildHudState()` now computes `wave` as `max(currentWave, scoreWave)` and includes `timeSeconds` from `runStartedAtMs`. (3) `GameOverScene.normalizeStats()` now resolves `currentWave` and `waveNumber` as fallback keys.
- `[DONE]` **~~🟡 PLAYTEST-004: Wave counter not visible in HUD.~~ Fixed (BUG-026).** Added `rightInset` to HUD's `DEFAULT_STYLE` (default `0`). `GameScene` sets `rightInset` to offset right panel away from pause button. `pickNumber()` hardened with `Number()` coercion to handle string-typed payload values.

### Design Gap vs. Reference

> Reference: `project overview/game pictures/expectation.png`

`[IN PROGRESS]` — **Versus mode implementation started (Phase 8).** A new `VersusGameScene` is being built as a parallel gameplay path. Existing wave-survival `GameScene` remains untouched.

**Reference requirements (from screenshot):**
- ✅ Split-screen: left player (pink/brown bg) vs. right player (purple bg)
- ✅ Per-player "Bullets Dodged / Deaths / Kills" counters (top corners)
- ✅ Two characters on platforms with center gap
- ✅ Mute button (bottom-right circle)
- ✅ PvP bullet shooting

**New files planned:**
| File | Purpose |
|---|---|
| `src/core/VersusInput.js` | Dual keyboard (P1: WASD+J, P2: Arrows+L) + split touch |
| `src/systems/VersusCollisionSystem.js` | PvP bullet ownership + platform collisions |
| `src/ui/VersusHUD.js` | Per-player stat panels (top-left / top-right) |
| `src/ui/MuteButton.js` | Canvas-drawn speaker icon toggle |
| `src/scenes/VersusRoundManager.js` | Kill/death/dodge tracking + respawn flow |
| `src/scenes/VersusGameScene.js` | Main scene — split viewport, dual cameras, game loop |

---

## Phase 8: Versus Mode (2-Player Split-Screen)

> 🔨 Implementation complete — under review.

### Scope

Full rebuild of gameplay to match reference screenshot. New `VersusGameScene` as parallel path — existing wave-survival `GameScene` preserved.

### Files Reviewed

| File | Lines | Verdict |
|---|---|---|
| `src/scenes/VersusGameScene.js` | 543 | Good — well-structured scene, split rendering with `ctx.clip()`, dual cameras, dual bullet pools |
| `src/core/VersusInput.js` | 425 | Good — comprehensive keyboard + touch with tap-shoot, swipe-jump, hold-shoot |
| `src/systems/VersusCollisionSystem.js` | 328 | Good — platform collision + PvP bullet logic, dodge detection, robust owner parsing |
| `src/scenes/VersusRoundManager.js` | 266 | Good — event-driven stats tracking, respawn timers, permissive payload resolution |
| `src/ui/VersusHUD.js` | 170 | Good — rounded rect panels, multi-key stat lookup, uses `uiUtils.js` |
| `src/ui/MuteButton.js` | 162 | Good — canvas-drawn speaker icon, hit-radius scaling, settings-aware |
| `src/main.js` | 59 | Good — `versus` scene registered at line 38, import clean |
| `src/scenes/MenuScene.js` | 430 | Good — "Play" wired to `game.switchScene("versus")` at line 30 |
| `src/config/constants.js` | 28 | Good — `PLAYER2_COLOR` + `PLAYER2_FACING_MARKER_COLOR` added |
| `src/entities/Player.js` | 144 | Good — constructor accepts `color`/`markerColor`, `canShoot`/`markShot`/`takeDamage` properly wired |

### Acceptance Criteria Status

| # | Criterion | Status |
|---|---|---|
| 1 | Two players visible and active simultaneously | ✅ P1 and P2 created with distinct colors, both rendered in `renderWorld()` |
| 2 | Split-screen with vertical divider | ✅ `ctx.clip()` + `ctx.translate()` + 6px purple divider (`VersusGameScene.js:456-472`) |
| 3 | Two independent stat blocks | ✅ `VersusHUD` renders P1 top-left, P2 top-right with BULLETS DODGED / DEATHS / KILLS |
| 4 | PvP hits/deaths/kills update correctly | ✅ VERSUS-007 fixed — respawn scheduling idempotent, stats not double-counted |
| 5 | Bottom-right mute button works | ✅ Toggle + settings persistence + audio manager wiring |
| 6 | Respawn after death (1.5s delay) | ✅ `VersusRoundManager` timers + `respawnPlayer()` |
| 7 | Runs on Windows browser + Android without crashes | `[RUNTIME]` Build passes. Needs live test. |

### Pre-existing Risks — Updated

- `[DONE]` **~~VERSUS-001: P2 keyboard bindings conflict.~~** `VersusGameScene.onEnter()` calls `game.input.setTouchControlsEnabled(false)` (L93). `VersusInput` uses its own `keydown`/`keyup` listeners — they run in parallel with `Input.js` but the old handler only feeds the single-player `Input` state which no scene reads during versus. No functional conflict. Verified.
- `[TBD]` **VERSUS-002: Touch input zones.** P1 = left 25%, P2 = right 25%, center 50% dead zone. Needs live test on small Android screens. The touch system is comprehensive (swipe-to-jump, tap-to-shoot, hold-to-shoot) but the 50% dead zone is large.
- `[DONE]` **~~VERSUS-003: Split-screen camera clipping.~~** Both halves use `ctx.save() → ctx.beginPath() → ctx.rect() → ctx.clip() → renderWorld() → ctx.restore()` (`VersusGameScene.js:456-469`). Clip regions are properly scoped. Verified safe.
- `[TBD]` **VERSUS-004: No game-over condition.** Still infinite play. No round timer, no first-to-N-kills, no end screen. Players can only return to menu by reloading.
- `[TBD]` **VERSUS-005: No audio assets.** Content gap unchanged. Mute button toggles state correctly but nothing audible plays.
- `[DONE]` **~~VERSUS-006: Sprite rendering.~~** Players render as colored rectangles with facing markers. Distinct P1 (blue `#4fc3f7`) vs P2 (green `#81a84d`). Functional — matches screenshot style (dark characters on platforms). Visual polish can come later.

### New Findings

#### Logic Bugs

- `[DONE]` **~~🟡 VERSUS-007: Double respawn scheduling.~~ Fixed.** `#scheduleRespawn()` now returns early if a timer is already active (`VersusRoundManager.js:186-188`). Idempotent — duplicate calls from `versus:kill` and `versus:player_hit` are harmless.

- `[DONE]` **~~🟡 VERSUS-008: `Player.update()` resets `onGround` on nonzero `vy`.~~ Fixed.** The `Math.abs(vy) > EPSILON` guard removed from `Player.update()` (`Player.js:102-113`). Animation state now checks `!this.onGround` without overriding the collision system's `onGround` assignment.

- `[DONE]` **~~🟡 VERSUS-009: Bullet direction hardcoded to player index.~~ Fixed.** `fireBullet()` now uses `player.facing` with fallback: `const directionX = player.facing < 0 ? -1 : player.facing > 0 ? 1 : fallbackDirection` (`VersusGameScene.js:398`). Bullet shoots in the direction the player is facing.

#### Design Risks

- `[DONE]` **~~🟡 VERSUS-010: No pause or back-to-menu flow.~~ Fixed.** Exit via Escape / KeyP / Backspace added (`VersusGameScene.js:82-90`). `update()` checks `exitRequested` flag and calls `game.switchScene("menu")` (`VersusGameScene.js:307-311`). Keyboard listener properly cleaned up in `onExit()` (`VersusGameScene.js:136-139`).

- `[DONE]` **~~🟡 VERSUS-011: `Input.js` listeners remain active during versus.~~ Fixed.** `onEnter()` detaches old `Input` (`VersusGameScene.js:106-108`), `onExit()` reattaches it (`VersusGameScene.js:141-143`). Tracks whether input was previously attached via `gameInputWasAttached` flag. Clean symmetric lifecycle.

- `[DONE]` **~~🟢 VERSUS-012: Preallocated 100 bullets per pool.~~ Fixed.** Reduced to 24 per side (`VersusGameScene.js:65-66`). Still comfortably above the ~11 max theoretical active bullets.

#### Tech Debt

- `[DONE]` **~~🟢 VERSUS-013: `parsePlayerIndex` duplicated.~~ Fixed.** Shared module `systems/versusPlayerIndex.js` (121 lines) exports `parseVersusPlayerIndex()`, `resolveVersusPlayerIndexFromPayload()`, `VERSUS_PLAYER_COUNT`, and `VERSUS_INVALID_PLAYER_INDEX`. Imported by both `VersusCollisionSystem.js:3` and `VersusRoundManager.js:1-6`. Duplicate functions removed from both consumers.

- `[DONE]` **~~🟢 VERSUS-014: `clamp()` redefined locally.~~ Fixed.** Local `clamp` function removed. Now imports from `utils/math.js` (`VersusGameScene.js:12`).

#### Extra Stability Fix

- `[DONE]` **VERSUS-015: Mute-button touch isolation.** Mute button pointer events are captured by `mutePointerId` tracking (`VersusGameScene.js:538-543`). The captured pointer is excluded from `VersusInput` routing so it cannot leak into movement/shoot touch handling. Prevents accidental player input on mute tap.

#### Playtest Bug

- `[TBD]` **🔴 VERSUS-016: Bullets cannot reach opponent on wide screens (Bug 4).** User reports bullets disappearing before reaching the other player.

  **Root cause confirmed:** Arena scaling at `VersusGameScene.js:164` — `this.worldWidth = Math.max(WORLD_MIN_WIDTH, Math.round(viewWidth * 2.3))`. On wider screens, worldWidth grows proportionally, pushing P2's platform farther right via `rightX = Math.max(... , this.worldWidth - edgePad - platformWidth)` (L171). Spawn-to-spawn distance exceeds bullet travel range (780px/s × 2.5s = 1950px max).

  | Screen width | worldWidth | Spawn distance | Bullet range | Reaches? |
  |---|---|---|---|---|
  | 1366 | 3142 | ~1240px | 1950px | ✅ |
  | 1920 | 4416 | ~1910px | 1950px | ⚠️ barely |
  | 2560 | 5888 | ~2670px | 1950px | ❌ |

  **Fix plan (builder-owned):**
  1. Cap max duel gap in `layoutWorld()` so platform distance never exceeds ~1400px regardless of viewport width
  2. Add runtime assertion that spawn distance stays within 85% of bullet range
  3. Keep full-height divider (matches reference) but consider thinner/more translucent to reduce "wall" perception
  4. Validate at 1366/1600/1920/2560 widths

---

## External Audit — Full Codebase Review (2026-02-16 14:49)

> **Original grade: 6/10. Post-fix grade: 8/10 — Production viable with caveats.** All 12 findings addressed and verified by Final Boss.

### Final Boss Verification — Fix Round (2026-02-16 15:31)

All 12 fixes verified against source. Build, tests, and cap:sync pass.

| # | Severity | Finding | Fix Verified |
|---|---|---|---|
| 1 | 🔴→✅ | Audio unlock false-positive | `unlockAudioProbe` now passes `success` boolean to callback (`audioUtils.js:57,72`). Both `AudioManager.unlock()` (L103-104) and `MusicManager.unlock()` (L101-102) check `!success` before setting `unlocked = true`. Reject path no longer marks unlocked. |
| 2 | 🔴→✅ | Audio assets + naming mismatch | Alias system added (`audioUtils.js:81-104`) maps between code names and doc names. `.wav` fallback candidates auto-generated for all aliases (L141-145). 25 placeholder `.wav` files in `public/audio/`. |
| 3 | 🔴→✅ | Capacitor CLI missing | `@capacitor/cli: ^7.0.0` added to devDependencies (`package.json:19`). `capacitor.config.json` present in repo root. `cap:sync` passes. |
| 4 | 🔴→✅ | No test infrastructure | `vitest: ^2.1.8` in devDependencies (`package.json:21`). `test` and `test:watch` scripts added (L8-9). 3 real test files: `settings.test.js`, `storage.test.js`, `background.test.js` (6 tests, all pass). |
| 5 | 🟡→✅ | Versus music routing missing | `versus: "bgm_battle"` added to `DEFAULT_SCENE_TRACK_MAP` (`MusicManager.js:12`). Versus mode now gets battle music. |
| 6 | 🟡→✅ | Pause double `ui_click` | `handlePointerUp` pause branch (L555) no longer emits `ui_click` — only sets `pauseRequested`. Update loop at L296 emits once. Single emit confirmed. |
| 7 | 🟡→✅ | Enemy pool reactivation | Release callback (L65-70) now calls `enemy.deactivate()` instead of `configure()`. Pooled enemies stay `active = false`. |
| 8 | 🟡→✅ | Versus SFX unwired | AudioManager now subscribes to `versus:player_hit`, `versus:dodge`, `versus:kill` (L58-60) with corresponding sound map entries. |
| 9 | 🟡→✅ | No versus game-over flow | `VERSUS_KILLS_TO_WIN = 5` (L54). `getTerminalResult()` (L545-580) checks kill threshold with tiebreakers (deaths → dodges). `finishMatch()` (L582-642) transitions to `game_over` scene with full stats. `GameOverScene` (L154-157) handles `isVersus` retry → `versus` scene. |
| 10 | 🟢→✅ | WorldWidth never shrinks | `GameScene.layout` L289 now uses `Math.max(WORLD_MIN_WIDTH, w * WORLD_MULT)` without referencing `this.worldWidth`. World can shrink on resize. |
| 11 | 🟢→✅ | Settings/storage unvalidated | `normalizeSettings()` (L72-85) with typed coercers (`coerceBoolean`, `coerceVolume`, `coerceControlScheme`). `storage.js` L7-23 adds `safeWarn()` for error reporting. |
| 12 | 🟢→✅ | Background cache unbounded | `#trimImageCache()` (L142-150) auto-evicts oldest entries via Map iteration order. Called after every cache set (L138). |

### Updated Final Boss Notes

**Revised grade: 8/10.** All 12 findings fixed. The codebase now has:
- ✅ Working audio pipeline (unlock race fixed, alias resolution, placeholder assets)
- ✅ Android packaging (Capacitor CLI + config)
- ✅ Test infrastructure (vitest + 3 test suites)
- ✅ Versus terminal flow (first-to-5 kills)
- ✅ All lifecycle bugs fixed (pool, events, worldWidth)

**Remaining caveats for production:**
- Audio assets are placeholders (silent `.wav` files) — need real content
- Test coverage is minimal (3 files, 6 tests) — needs expansion
- VERSUS-016 (bullet range on wide screens) still open
- VERSUS-002 (touch zones on small Android) needs live validation

## Pre-Launch Readiness Assessment (Post Phase 7)

> **Status as of 2026-02-16 11:22:** All PLAYTEST issues fixed. All 27 original bugs resolved. All 17 AUDIT findings from Round 2 resolved. All XPHASE items resolved. Settings UI added. GameOver timeSeconds wired. Entity zero-size fixed. CollisionSystem onGround fixed. Physics clamp unified. Audio/system/scene/entity/UI helper duplication all extracted to shared modules. **Only remaining TBDs:** no audio assets (content gap), RUNTIME-001/002/004/005/006 (need live testing), constants.js thinness, Input.js touch-vs-Joystick future concern.

### Confidence Levels

| Area | Confidence | Notes |
|---|---|---|
| Desktop keyboard controls | ~90% | All controls + scene buttons fixed. Settings toggles added in MenuScene. |
| Mobile/touch controls | ~70% | All pointer routing, button handling, and scene transitions fixed. Multi-touch still untested on real devices. |
| Sprite rendering path | ~80% | SVG assets exist. `renderActorSprite()` with scale + outlines (BUG-024). Sprite branch still **never exercised at runtime**. |
| Audio playback | ~45% | **No audio assets exist.** Code now warns once per missing sound. Settings toggles wired. |
| Performance | ~90% | All hot-loop O(n²) patterns (splice/indexOf) replaced with O(n) compaction. Per-frame allocations eliminated with scratch arrays. Image churn on resize resolved via cache. |
| Error resilience | ~90% | Game loop error boundary, EventBus handler error boundary, SpriteSheet load race guard, preload graceful fallback all in place. |

### Runtime Concerns (Cannot Be Caught by Static Review)

- `[TBD]` **🟡 RUNTIME-001: Zero runtime testing.** The entire codebase has only been verified via static code review. ~70-80% of bugs are catchable this way, but timing issues, race conditions, visual glitches, and "feels wrong" problems (~20-30%) require actually booting the game and playing it.
- `[TBD]` **🟡 RUNTIME-002: `bullet_dodged` heuristic is fragile.** `CollisionSystem.#emitBulletDodged()` checks if an enemy bullet's X crossed the player's center between frames. At 760 px/s and 60 UPS, that's ~12.7px per tick — player is 28px wide, so it *should* trigger. But edge cases with diagonal bullets, multiple simultaneous enemy fire, or frame drops could cause missed or double-counted dodges.
- `[DONE]` **~~🟡 RUNTIME-003: `callAny()` is a debugging landmine.~~ Fixed.** `callAny()` extracted to `scenePointerUtils.js:39-65`. Now logs `console.error()` in dev mode when all signature variants fail for a method. Real bugs are no longer silently swallowed.
- `[TBD]` **🟡 RUNTIME-004: Multi-touch pointer ownership untested.** The `pointerOwners` Map in `GameScene` is the correct pattern for preventing touch events from leaking between UI elements. But real-world multi-touch scenarios (two fingers down, one lifts, the other moves to a different element) are notoriously tricky and can only be validated on actual mobile devices.
- `[TBD]` **🟢 RUNTIME-005: Enemy spawn positions may be offscreen.** `SpawnSystem` uses hardcoded spawn points and `GameScene.spawnPoints` which are set relative to `groundY` and `worldWidth`. If viewport size is very small or very large, enemies could spawn in invisible areas. Visual confirmation needed.
- `[TBD]` **🟢 RUNTIME-006: Wave pacing feel is unknown.** `SpawnSystem.buildWaveDefinition()` calculates enemy counts and intervals mathematically, but whether the pacing *feels* right (too fast? too slow? overwhelming?) can only be judged by playing.

### Recommended First Test

> Boot on `localhost:5173`. First fix PLAYTEST-001 (button routing). Then play one full round on desktop (keyboard) to end screen and back. Then one on a phone (touch). That 15-minute test will validate the remaining ~30% of unknowns.

### Newly Found Issues (2026-02-16 08:35 re-audit)

- `[DONE]` **~~🟡 AUDIT-001: `preloadAssets()` throws in dev mode, killing the game loop.~~ Fixed.** `GameScene.preloadAssets()` (`GameScene.js:130-159`) now wraps loads in try/catch. On failure: sets `fallbackMode = true`, logs `console.error()` in dev mode, sets `assetsReady = true` via `finally`. No longer throws — game continues with shape rendering.
- `[DONE]` **~~🟡 AUDIT-002: `recycleBullets()` uses `Array.splice()` + `Array.indexOf()` in a hot loop.~~ Fixed.** `GameScene.recycleBullets()` (`GameScene.js:334-361`) now uses O(n) partition-and-truncate via `compactOwnedBullets()` inner function — single forward pass with write pointer, then `list.length = writeIndex`. No `splice()` or `indexOf()`.
- `[DONE]` **~~🟡 AUDIT-003: `buildHudState()` key naming inconsistency.~~ Fixed (BUG-025).** `buildHudState()` now computes `wave = Math.max(currentWave, scoreWave)` and includes both `wave` and `currentWave`. `normalizeStats()` now checks `currentWave` and `waveNumber` as fallback keys. `ScoreSystem` tracks `wave_start` events.
- `[DONE]` **~~🟢 AUDIT-004: Platforms are recreated on every `onResize()`.~~ Fixed.** `GameScene.applyPlatformLayout()` (`GameScene.js:207-231`) now reuses existing platform objects — updates `x`, `y`, `width`, `height` in-place. Only creates new `Platform` instances when the array is shorter than the layout. `onResize()` calls `updateStaticLevelGeometry()` which delegates to `applyPlatformLayout()`.

---

## Cross-Phase Concerns

| ID | Risk | Severity | Status |
|---|---|---|---|
| XPHASE-001 | ~~`Game.js` becoming a god object if simulation logic isn't extracted~~ | ~~🔴 High~~ | `[DONE]` — BUG-006 fixed |
| XPHASE-002 | ~~Touch input system needs clean handoff to Joystick component~~ | ~~🔴 High~~ | `[DONE]` — `Input.setTouchControlsEnabled()` added. `GameScene` disables raw touch on enter, restores on exit. |
| XPHASE-003 | ~~No error boundary / crash recovery in game loop~~ | ~~🟡 Medium~~ | `[DONE]` — `Game.handleLoopError()` (`Game.js:212`) catches errors in update/render, emits `game:error`, and gracefully stops the loop. |
| XPHASE-004 | ~~No asset loading / preloading strategy defined~~ | ~~🟡 Medium~~ | `[DONE]` — `GameScene.preloadAssets()` handles SpriteSheet loading. No generic AssetLoader, but functional for current needs. |
| XPHASE-005 | ~~Canvas CSS rule dead code in index.html~~ | ~~🟢 Low~~ | `[DONE]` — Dead `width`/`height` CSS removed. `#game-canvas` now only sets `display: block`. |
| XPHASE-006 | ~~`bullet_dodged` event still has no emitter~~ | ~~🟡 Medium~~ | `[DONE]` — `CollisionSystem.#emitBulletDodged()` emits when enemy bullet crosses player X within vertical window. `Bullet.js` tracks `previousX`/`previousY` and `dodgeCounted` flag. |
| XPHASE-007 | ~~Helper function duplication across UI scenes and components~~ | ~~🟢 Low~~ | `[DONE]` — All duplication resolved. Scene helpers → `scenePointerUtils.js`. System helpers → `systemUtils.js`. Entity projection → `Entity.projectToScreen()`. UI component helpers → `ui/uiUtils.js` (imported by `Button.js`, `HUD.js`, `Joystick.js`, `ScoreBoard.js`). Audio helpers → `audioUtils.js`. |
| XPHASE-008 | ~~`routePointer` + `callAny` pattern breaks scene buttons~~ | ~~🔴 High~~ | `[DONE]` — All 3 scenes (`GameOverScene`, `MenuScene`, `PauseScene`) now check `Boolean(result.value)` (BUG-023 + BUG-027). |

---

## Deep Audit — Round 2 (2026-02-16, full 37-file read-through)

> Full static read of every source file. Verified all 27 bugs still resolved. Found 14 new issues not previously documented.

### Performance

- `[DONE]` **~~🟡 AUDIT-005: `SpawnSystem.#recycleInactiveEnemies()` uses `.splice()` in a hot loop.~~ Fixed.** Replaced with O(n) compact pass (`SpawnSystem.js:250-266`): forward scan with write pointer, `enemies.length = writeIndex`. Same pattern as AUDIT-002 fix.
- `[DONE]` **~~🟡 AUDIT-006: `CollisionSystem.update()` creates new arrays every frame.~~ Fixed.** Uses reusable scratch arrays (`_activePlayers`, `_activeEnemies`, `_activePlatforms`, `_activeBullets` at `CollisionSystem.js:85-88`). `#collectActiveEntities()` fills the scratch array in-place (`CollisionSystem.js:92-95`). Zero per-frame allocations.
- `[DONE]` **~~🟢 AUDIT-007: `Bullet.render()` uses `beginPath()/arc()/fill()` per bullet.~~ Fixed.** Default render path now uses `fillRect` (`Bullet.js:143`). Circle rendering only activates when `this.shape === "circle"` is explicitly set (`Bullet.js:133`).

### Logic Bugs

- `[DONE]` **~~🟡 AUDIT-008: `HUD._drawHealthBar()` clips incorrectly at very low HP.~~ Fixed.** Health bar Y position now clamped between `padding` and `view.height - padding - height` (`HUD.js:154-156`). Label placement uses top-label-or-bottom-label fallback (`HUD.js:173-176`). Radius clamped to `height * 0.5` via `clamp()` (`HUD.js:158`).
- `[DONE]` **~~🟡 AUDIT-009: `ScoreSystem` wave count off-by-one on `wave_cleared`.~~ Fixed.** `wave_cleared` handler now uses `this._resolveWave(payload, this.state.wave)` (`ScoreSystem.js:41`) — fallback is current wave (not `+1`). Same `_resolveWave` used by both `wave_start` and `wave_cleared`.
- `[DONE]` **~~🟢 AUDIT-010: `Player.update()` `onGround` flicker.~~ Fixed.** `CollisionSystem.#resolveEntitiesAgainstPlatforms()` now uses grounded aggregation (`CollisionSystem.js:109,136,140`). Sets `entity.onGround = grounded` once after all platform checks. `CollisionSystem` is the sole owner of `onGround` state.

### Resource Leaks

- `[DONE]` **🟡 AUDIT-011: `MusicManager.fadeTo()` timer not cleared on `dispose()`.** False alarm — `dispose()` calls `stop()` which calls `#clearFadeTimer()`. Verified safe. _(Retracted.)_
- `[DONE]` **~~🟡 AUDIT-012: `Background.setLayers()` leaks old Image objects.~~ Fixed.** `Background` now maintains `_imageCache` Map (`Background.js:8`). `#getCachedImage()` (`Background.js:120-130`) deduplicates Image objects by `src`. Repeated `setLayers()` calls reuse cached Images — no orphaned elements.
- `[DONE]` **~~🟡 AUDIT-013: `GameScene.onResize()` re-creates `Background` layers on every resize.~~ Fixed.** Combined with AUDIT-012: `_imageCache` ensures Images are reused across resize calls. No unbounded allocation.

### Defensive Gaps

- `[DONE]` **~~🟡 AUDIT-014: `EventBus.emit()` does not catch handler errors.~~ Fixed.** `EventBus.emit()` now wraps each handler in try/catch (`EventBus.js:35-38`). Errors routed to `#reportHandlerError()` (`EventBus.js:42-53`) which emits `eventbus:error` event. Recursion guard via `_handlingError` flag prevents infinite error loops (`EventBus.js:43,61,70`). Fallback to `console.error()` when no error handlers are registered.
- `[DONE]` **~~🟢 AUDIT-015: `SpriteSheet.load()` race condition.~~ Fixed.** Added `_loadToken` counter (`SpriteSheet.js:33`) incremented on each `load()` call. Token checked at `SpriteSheet.js:47,52` — stale callbacks from earlier load cycles are ignored. `_loadingSource` guard (`SpriteSheet.js:43`) prevents duplicate in-flight loads for the same source.

### Tech Debt

- `[DONE]` **~~🟡 AUDIT-016: `AudioManager` and `MusicManager` share ~150 lines of duplicate code.~~ Fixed.** Shared functions extracted to `audio/audioUtils.js:1-98` (`clampVolume`, `canUseHtmlAudio`, `unlockAudioProbe`, `getAudioCandidates`, `resolveAudioSource`, `UNLOCK_AUDIO_DATA_URI`). Both `AudioManager.js:1` and `MusicManager.js:1` now import from it.
- `[DONE]` **~~🟢 AUDIT-017: `GameScene.update()` line density is very high.~~ Fixed.** Extracted into named sub-methods: `buildSystemContext()` (`GameScene.js:391`), `buildHudState()` (`GameScene.js:408`), `firePlayerBullet()` (`GameScene.js:432`), `fireEnemyBullet()` (`GameScene.js:440`), `recycleBullets()` (`GameScene.js:447`). Context and HUD state objects reused via instance fields to avoid per-frame allocations.
