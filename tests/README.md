# 🧪 tests/

Unit + behavioral tests (Vitest). 15 files, 50 tests.

## What Is Covered

| File | Covers |
|---|---|
| `gameCore.test.js` | `Game` construction, scene register/switch, `scene:switch` payloads, `Menu -> game -> pause -> game` resume flow, `EventBus` decoupling |
| `gamePauseTimer.test.js` | M12 regression: pause time excluded from run timer; `resetRun` clears compensation |
| `versusInput.test.js` | Keyboard maps per player, 2-finger touch, steering promote on release, tap-shoot, swipe-jump, dead zone |
| `scoreSpawn.test.js` | `ScoreSystem` kills/dodges/waves/fatal hits; `SpawnSystem` wave scaling + boss wave + cleared detection |
| `audioPools.test.js` | `AudioManager` no-throw guards without audio hardware, mute gating, `ObjectPool` reuse + double-release safety |
| `versusArena.test.js` | Fixed duel layout, spawn placement, bullet-range diagnostics, ring-out flow |
| `versusCollisionSystem.test.js` | Platform grounding masks, bullet-vs-platform blocking |
| `versusBotController.test.js` | Bot decisions |
| `physicsSystem.test.js` | Gravity/friction integration |
| `playerRoster.test.js` | Roster integrity, persistence, sheet generation |
| `settings/storage/background/camera/versusMatchMode` | Config, persistence, rendering helpers |

## Running Tests

```bash
npm test            # Single run (CI gate)
npm run test:watch  # Watch mode
```

## Conventions

- Files are named `<area>.test.js` and colocated here.
- Headless-safe: tests never touch real canvas/DOM. `Game` tests install
  `HTMLCanvasElement`/`window`/`localStorage` mocks in `beforeEach`.
- Sprite/audio hardware is absent in Node — tests assert graceful fallback,
  never real playback or image decode.

## What Stays Manual

- Visual parity vs `project overview/game pictures/expectation.png` (eyeball check).
- Touch feel on a real phone (zones, swipe-jump, tap-shoot).
- Frame rate on low-end Android WebView (target 60 FPS).
- Full APK install + playthrough via `npx cap open android`.
