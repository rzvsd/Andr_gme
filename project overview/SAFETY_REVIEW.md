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
- `[TBD]` **Dead CSS rule.** `#game-canvas { width: 100vw; height: 100vh }` in `index.html` is overridden by inline styles set by `Game.js`. Dead code — should be removed to avoid confusion.

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
- `[TBD]` **Physics.clamp() duplication.** `Physics.js` has `clamp()`. `utils/math.js` will also have `clamp()`. Minor duplication — decide on canonical source and remove the other.

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
- `[TBD]` **🟡 settings.js and storage.js overlap.** `settings.js` has its own `localStorage` logic with key `'bullet-dodge-arena:settings'`. `storage.js` wraps `localStorage` with prefix `'bullet-dodge-arena:'`. If someone later saves settings via `storage.save('settings', data)`, the key would be `'bullet-dodge-arena:settings'` — identical to what `settings.js` writes directly. This is a collision risk. Either `settings.js` should use `storage.js` under the hood, or use a different key convention to avoid ambiguity.
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
- `[TBD]` **`[MEDIUM]` Render methods are copy-pasted across Player, Enemy, and Bullet.** All three have identical camera transform logic (lines ~150-170 in each): check `worldToScreen`, else subtract `camera.x/y`, else raw position. This should be a shared helper or live in the base `Entity.render()`. Right now if you fix a render bug, you fix it in 3 places. This will get worse when you add more entity types.
- `[DONE]` **~~`[MEDIUM]` Player.js inlined `clamp()`.~~ Fixed.** Now imports `clamp` from `utils/math.js`. Local `toNumberOr` helper remains (acceptable — too small/specific for a shared util).
- `[TBD]` **`[LOW]` Player/Enemy colors hardcoded in entities.** Player is `#4fc3f7`, enemies have per-type colors in `ENEMY_DEFAULTS`. These should eventually move to a theme/palette in `constants.js` so a future skin system or theme switch doesn't require editing entity files.
- `[TBD]` **`[LOW]` Entity.js `width`/`height` default to `0`.** A zero-size entity passes no AABB collision checks (zero area). Any entity constructed without explicit dimensions is effectively a ghost. Not a bug if all subclasses always set dimensions, but a potential foot-gun.

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
- `[TBD]` **`[MEDIUM]` CollisionSystem resets `onGround = false` at line 110 before checking platforms.** If collision resolution happens AFTER PhysicsSystem applies gravity (correct order), this is fine. But if order is reversed, or if an entity touches multiple platforms, `onGround` could flicker. The system currently iterates ALL platforms per entity and only sets `onGround = true` on the last resolution — this is correct. But the reset-before-check pattern means **execution order between systems matters and is not enforced anywhere**.
- `[TBD]` **`[MEDIUM]` `bullet_dodged` event has no emitter.** `ScoreSystem` listens for `'bullet_dodged'` events (line 27), but nobody emits this event. Not `CollisionSystem`, not `AISystem`, not `PhysicsSystem`. The dodge counter will always be 0 unless something emits this event later. **Needs a system or logic that detects "bullet passed near player without hitting" and emits `bullet_dodged`.** This could be a simple check in CollisionSystem or a separate proximity check.
- `[TBD]` **`[MEDIUM]` System execution order is undefined.** The scene (Phase 7) will need to call systems in a specific order: `AISystem → PhysicsSystem → CollisionSystem → SpawnSystem → ScoreSystem`. Wrong order = bugs. For example, if CollisionSystem runs before PhysicsSystem, entities haven't moved yet so collisions check stale positions. **This isn't a bug in Phase 5 code, but a mandatory constraint for Phase 7 integration.** Log it.
- `[TBD]` **`[LOW]` `toNumber`, `asArray`, `isActiveEntity`, `emitEvent` helpers are duplicated across systems.** PhysicsSystem, CollisionSystem, AISystem, and SpawnSystem each define their own versions. Should be shared in `utils/` — same concern as the render method duplication from Phase 4.

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
- `[TBD]` **🟡 Massive code duplication across `MenuScene`, `PauseScene`, `GameOverScene`.** The following functions are copy-pasted verbatim in all 3 files (~80 lines each): `asNumber()`, `isObject()`, `asPointer()`, `rectContains()`, `callAny()`, `pointerAliases()`, `createButton()`, `setButtonRect()`, `getButtonRect()`, `setPressed()`, `findButtonAt()`, `pressButton()`, `renderButton()`, `routePointer()`. That's ~240 lines of duplicated code. These should live in a shared `ui/SceneButtonMixin.js` or similar. Maintenance cost is high — any bug fix must be applied in 3 places.
- `[TBD]` **🟡 `callAny()` silently swallows exceptions.** In `MenuScene`, `PauseScene`, `GameOverScene`, `callAny()` wraps every method call in try/catch and silently moves on to the next argument pattern. If `Button.handlePointerDown()` throws a real bug (not a signature mismatch), it will be silently eaten. This makes debugging harder. Consider logging caught errors in dev mode.
- `[DONE]` **~~🟡 Touch input conflict between `Input.js` and Joystick.~~ Fixed.** Added `Input.setTouchControlsEnabled(enabled)` method (`Input.js:58`). `GameScene.onEnter()` calls `setTouchControlsEnabled(false)` to disable raw touch handlers while Joystick/Buttons are active. `onExit()` restores by calling `setTouchControlsEnabled(true)`. All touch handlers early-return when disabled. `clearTouchState()` zeroes touch state on disable.
- `[DONE]` **~~🟡 No health bar in HUD.~~ Fixed.** Added `HUD._drawHealthBar()` method (`HUD.js:200-235`). Renders centered health bar below stat panels with rounded rect, background fill, stroke, proportional fill bar, critical color (red) when HP ≤ 30%, and `HP` + `current/max` labels. Style is configurable via `DEFAULT_STYLE` object.
- `[TBD]` **🟢 No settings UI.** `settings.js` implements `loadSettings()`, `saveSettings()`, and `resetSettings()`, but no scene or UI element exposes these. Sound/music volume cannot be changed by the player. The `MenuScene` has no settings button despite the README listing one.
- `[TBD]` **🟢 No audio assets exist.** `AudioManager` and `MusicManager` expect files at `/audio/*.webm` and `/audio/*.mp3`, but the `public/` directory likely has no audio files. All sounds will silently fail and be added to `failedSounds`. Not a code bug — just means audio is muted until real assets are added.
- `[TBD]` **🟢 `GameOverScene` `timeSeconds` is always 0.** `normalizeStats()` looks for `timeSeconds`, `durationSeconds`, or `time` in the stats payload, but `GameScene` never tracks elapsed game time. `ScoreSystem.getState()` does not include a time field. The "Time: 0s" row on the game over screen will always show 0.
- `[TBD]` **🟢 `MusicManager.fadeTo()` uses `setInterval(50ms)`.** On mobile, `setInterval` in background tabs may be throttled to 1000ms or suspended entirely. The fade will appear to jump from start to end volume. Not critical — cosmetic only.

### Runtime Testing Bugs (2026-02-16 live playtest)

> First live test on `localhost:5173` (desktop, Chrome). Colored-rectangle fallback mode (no sprite assets).

- `[DONE]` **~~🔴 PLAYTEST-001: Retry button does not work on Game Over screen.~~ Fixed (BUG-023, BUG-027).** All three UI scenes (`GameOverScene`, `MenuScene`, `PauseScene`) now check `result.called && Boolean(result.value)` in `routePointer()`. Button handler return values are respected — `false` from `Button.handlePointerUp()` no longer short-circuits the scene's own `pressButton()` logic.
- `[DONE]` **~~🔴 PLAYTEST-002: Player and enemies are visually indistinguishable.~~ Fixed (BUG-024).** Added `renderActorSprite()` with per-type sprite frame mapping, visual scale multipliers (`PLAYER_VISUAL_SCALE`, `ENEMY_VISUAL_SCALE`), and per-type outline colors via `getEnemyOutlineColor()`. Player and enemies now render at different sizes with distinct colored outlines in sprite mode.
- `[DONE]` **~~🟡 PLAYTEST-003: All stats display 0 on Game Over.~~ Fixed (BUG-025).** Three-pronged fix: (1) `ScoreSystem` now subscribes to `wave_start` event and tracks active wave via `_resolveWave()`. (2) `GameScene.buildHudState()` now computes `wave` as `max(currentWave, scoreWave)` and includes `timeSeconds` from `runStartedAtMs`. (3) `GameOverScene.normalizeStats()` now resolves `currentWave` and `waveNumber` as fallback keys.
- `[DONE]` **~~🟡 PLAYTEST-004: Wave counter not visible in HUD.~~ Fixed (BUG-026).** Added `rightInset` to HUD's `DEFAULT_STYLE` (default `0`). `GameScene` sets `rightInset` to offset right panel away from pause button. `pickNumber()` hardened with `Number()` coercion to handle string-typed payload values.

### Design Gap vs. Reference

> Reference: `project overview/game.png`

The reference screenshot shows a **split-screen 2-player competitive** layout:
- Two distinct characters (animated sprites with different colors/outfits)
- Split-screen: left player (pink/brown background) vs. right player (purple background)
- Each side has its own "Bullets Dodged / Deaths / Kills" counter
- Characters shoot projectiles at each other
- A mute button in the bottom-right corner

**Current implementation is single-player-vs-AI arena.** One player, multiple AI-controlled enemies that spawn in waves. This is a fundamental design gap that should be resolved at architecture level before Phase 8 polish. The current codebase would need:
- A second player entity (or networked/local multiplayer via split input)
- Split-screen camera rendering
- Per-player HUD and stat tracking
- Player-vs-player bullet collision logic

---

## Phase 8: Polish & Android

> Not started.

---

## Pre-Launch Readiness Assessment (Post Phase 7)

> **Status as of 2026-02-16 08:56:** All PLAYTEST issues fixed (BUG-023–027). XPHASE-008 fully resolved. Remaining open items: AUDIT-001 (dev-mode crash on asset 404), AUDIT-002 (O(n²) recycleBullets), AUDIT-004 (Platform GC on resize), and several low-priority TBDs from earlier phases.

### Confidence Levels

| Area | Confidence | Notes |
|---|---|---|
| Desktop keyboard controls | ~85% | Move/shoot/jump confirmed. All scene buttons (Retry, Menu, Play, Resume, Restart) now fixed across all 3 UI scenes (BUG-023 + BUG-027). |
| Mobile/touch controls | ~65% | Joystick + button pointer ownership works. All scene buttons fixed. Multi-touch edge cases remain untested on real devices. |
| Sprite rendering path | ~80% | SVG assets exist. `renderActorSprite()` with scale + outlines (BUG-024). Sprite branch still **never exercised at runtime**. |
| Audio playback | ~40% | **No audio assets exist.** All sounds silently fail. |

### Runtime Concerns (Cannot Be Caught by Static Review)

- `[TBD]` **🟡 RUNTIME-001: Zero runtime testing.** The entire codebase has only been verified via static code review. ~70-80% of bugs are catchable this way, but timing issues, race conditions, visual glitches, and "feels wrong" problems (~20-30%) require actually booting the game and playing it.
- `[TBD]` **🟡 RUNTIME-002: `bullet_dodged` heuristic is fragile.** `CollisionSystem.#emitBulletDodged()` checks if an enemy bullet's X crossed the player's center between frames. At 760 px/s and 60 UPS, that's ~12.7px per tick — player is 28px wide, so it *should* trigger. But edge cases with diagonal bullets, multiple simultaneous enemy fire, or frame drops could cause missed or double-counted dodges.
- `[TBD]` **🟡 RUNTIME-003: `callAny()` is a debugging landmine.** The `callAny()` helper in `MenuScene`, `PauseScene`, `GameOverScene` wraps every button method call in try/catch and silently swallows errors. If a button handler throws a real bug, developers will see no error — just a non-responsive button. Could waste hours debugging. Should log errors in dev mode at minimum.
- `[TBD]` **🟡 RUNTIME-004: Multi-touch pointer ownership untested.** The `pointerOwners` Map in `GameScene` is the correct pattern for preventing touch events from leaking between UI elements. But real-world multi-touch scenarios (two fingers down, one lifts, the other moves to a different element) are notoriously tricky and can only be validated on actual mobile devices.
- `[TBD]` **🟢 RUNTIME-005: Enemy spawn positions may be offscreen.** `SpawnSystem` uses hardcoded spawn points and `GameScene.spawnPoints` which are set relative to `groundY` and `worldWidth`. If viewport size is very small or very large, enemies could spawn in invisible areas. Visual confirmation needed.
- `[TBD]` **🟢 RUNTIME-006: Wave pacing feel is unknown.** `SpawnSystem.buildWaveDefinition()` calculates enemy counts and intervals mathematically, but whether the pacing *feels* right (too fast? too slow? overwhelming?) can only be judged by playing.

### Recommended First Test

> Boot on `localhost:5173`. First fix PLAYTEST-001 (button routing). Then play one full round on desktop (keyboard) to end screen and back. Then one on a phone (touch). That 15-minute test will validate the remaining ~30% of unknowns.

### Newly Found Issues (2026-02-16 08:35 re-audit)

- `[TBD]` **🟡 AUDIT-001: `preloadAssets()` throws in dev mode, killing the game loop.** `GameScene.preloadAssets()` line 118 throws `new Error("BUG-015 guard")` when sprites fail to load in dev mode. This throw happens inside an `async` function that runs during `onEnter()` — but `Game.switchScene()` wraps `onEnter()` return values with `.catch()` that only emits `scene:error`. The `update()` method at line 175 also re-throws `this.assetsError` in dev mode. If the SVG files 404 during development (e.g., wrong path, missing file), the game loop will crash with an unhandled exception instead of falling back to rectangles. **Should: log the guard error, set fallbackMode, and continue.**
- `[TBD]` **🟡 AUDIT-002: `recycleBullets()` uses `Array.splice()` + `Array.indexOf()` in a hot loop.** `GameScene.recycleBullets()` (lines 221-224) iterates backwards through `playerBullets` and `enemyBullets`, calling `.splice(i, 1)` and then finding the same bullet in `this.bullets` via `.indexOf()` + `.splice()`. With pools of 80 bullets each and `this.bullets` growing unbounded, this is O(n²) per frame. At scale (many bullets on screen), this causes frame drops on mobile. **Should: use swap-remove or partition-and-truncate instead of splice.**
- `[DONE]` **~~🟡 AUDIT-003: `buildHudState()` key naming inconsistency.~~ Fixed (BUG-025).** `buildHudState()` now computes `wave = Math.max(currentWave, scoreWave)` and includes both `wave` and `currentWave`. `normalizeStats()` now checks `currentWave` and `waveNumber` as fallback keys. `ScoreSystem` tracks `wave_start` events.
- `[TBD]` **🟢 AUDIT-004: Platforms are recreated on every `onResize()`.** `GameScene.onResize()` line 105 creates new `Platform` objects on every resize event. Resize events fire frequently on mobile (orientation change, keyboard popup, etc.), creating garbage each time. Should reuse existing platform objects and update their positions/dimensions instead.

---

## Cross-Phase Concerns

| ID | Risk | Severity | Status |
|---|---|---|---|
| XPHASE-001 | ~~`Game.js` becoming a god object if simulation logic isn't extracted~~ | ~~🔴 High~~ | `[DONE]` — BUG-006 fixed |
| XPHASE-002 | ~~Touch input system needs clean handoff to Joystick component~~ | ~~🔴 High~~ | `[DONE]` — `Input.setTouchControlsEnabled()` added. `GameScene` disables raw touch on enter, restores on exit. |
| XPHASE-003 | No error boundary / crash recovery in game loop | 🟡 Medium | `[TBD]` — If `update()` or `render()` throws, the loop dies silently |
| XPHASE-004 | ~~No asset loading / preloading strategy defined~~ | ~~🟡 Medium~~ | `[DONE]` — `GameScene.preloadAssets()` handles SpriteSheet loading. No generic AssetLoader, but functional for current needs. |
| XPHASE-005 | Canvas CSS rule dead code in index.html | 🟢 Low | `[TBD]` — Cleanup when convenient |
| XPHASE-006 | ~~`bullet_dodged` event still has no emitter~~ | ~~🟡 Medium~~ | `[DONE]` — `CollisionSystem.#emitBulletDodged()` emits when enemy bullet crosses player X within vertical window. `Bullet.js` tracks `previousX`/`previousY` and `dodgeCounted` flag. |
| XPHASE-007 | Massive helper function duplication across UI scenes | 🟡 Medium | `[TBD]` — ~240 lines of identical code in `MenuScene`, `PauseScene`, `GameOverScene`. Extract to shared module. |
| XPHASE-008 | ~~`routePointer` + `callAny` pattern breaks scene buttons~~ | ~~🔴 High~~ | `[DONE]` — All 3 scenes (`GameOverScene`, `MenuScene`, `PauseScene`) now check `Boolean(result.value)` (BUG-023 + BUG-027). |
