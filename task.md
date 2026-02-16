# Bullet Dodge Arena â€” Task Checklist

## Phase 1: Project Initialization
- [x] Create `package.json` with Vite + Capacitor deps
- [x] Create `vite.config.js`
- [x] Create `index.html` (canvas, viewport meta, font loading)
- [x] Create `src/main.js` (entry point)

## Phase 2: Core Engine (`src/core/`)
- [x] `EventBus.js` - pub/sub event system
- [x] `Game.js` - canvas setup, fixed-timestep game loop, scene manager
- [x] `Input.js` - touch + keyboard abstraction
- [x] `Physics.js` - gravity, velocity, AABB helpers
- [x] `Camera.js` - smooth-follow viewport

## Phase 3: Config & Utils
- [x] `src/config/constants.js` - all game constants
- [x] `src/config/settings.js` - mutable user settings + localStorage
- [x] `src/utils/math.js` - clamp, lerp, randomRange, distance
- [x] `src/utils/pool.js` - generic object pool
- [x] `src/utils/storage.js` - localStorage wrapper

## Phase 4: Entities (`src/entities/`)
- [x] `Entity.js` - base class (position, velocity, bounds, lifecycle)
- [x] `Player.js` - movement, jump, shoot, health, animations
- [x] `Enemy.js` - types (Grunt, Sniper, Rusher, Tank, Boss), AI hook
- [x] `Bullet.js` - poolable projectile
- [x] `Platform.js` - static collision body

## Phase 5: Systems (`src/systems/`)
- [x] `PhysicsSystem.js` - apply gravity, integrate velocity, friction
- [x] `CollisionSystem.js` - AABB detection, resolution, hit events
- [x] `AISystem.js` - enemy decision-making per frame
- [x] `SpawnSystem.js` - wave management, enemy spawning
- [x] `ScoreSystem.js` - track kills, dodges, waves, score

## Phase 6: Rendering & Assets
- [x] `src/rendering/SpriteSheet.js` â€” load + slice sprite sheets
- [x] `src/rendering/Animator.js` â€” frame-based animation controller
- [x] `src/rendering/ParticleEmitter.js` â€” explosions, smoke, sparks
- [x] `src/rendering/Background.js` â€” parallax scrolling layers
- [x] Generate/create sprite assets in `public/sprites/`

## Phase 7: UI, Scenes & Audio
- [x] `src/ui/HUD.js` â€” in-game stats overlay
- [x] `src/ui/Button.js` â€” touch button component
- [x] `src/ui/Joystick.js` â€” virtual analog joystick
- [x] `src/ui/ScoreBoard.js` â€” end-game score display
- [x] `src/scenes/MenuScene.js` â€” title screen
- [x] `src/scenes/GameScene.js` â€” main gameplay orchestrator
- [x] `src/scenes/PauseScene.js` â€” pause overlay
- [x] `src/scenes/GameOverScene.js` â€” death/retry screen
- [x] `src/audio/AudioManager.js` â€” SFX playback
- [x] `src/audio/MusicManager.js` â€” BGM loop

## Phase 8: Polish & Android
- [ ] Capacitor integration (`capacitor.config.ts`)
- [ ] Android build config (landscape, fullscreen, min SDK 24)
- [ ] Touch input optimization
- [ ] Performance profiling (target 60 FPS)
- [ ] Level data JSONs in `public/levels/`
- [ ] Final end-to-end testing




