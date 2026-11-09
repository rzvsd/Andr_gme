# 🧪 tests/

Unit + behavioral tests (Vitest). 22 files, 158 tests.

## What Is Covered

| File | Covers |
|---|---|
| `gameCore.test.js` | `Game` construction, scene register/switch, `scene:switch` payloads, `Menu -> game -> pause -> game` resume flow, `EventBus` decoupling |
| `versusInput.test.js` | Keyboard maps per player, 2-finger touch, steering promote on release, tap-shoot, swipe-jump, dead zone |
| `audioPools.test.js` | `AudioManager` no-throw guards without audio hardware, mute gating, `ObjectPool` reuse + double-release safety |
| `versusArena.test.js` | Fixed duel layout, spawn placement, bullet-range diagnostics, ring-out flow |
| `versusCollisionSystem.test.js` | Platform grounding masks, bullet-vs-platform blocking |
| `versusBotController.test.js` | Bot decisions |
| `physicsSystem.test.js` | Gravity/friction integration |
| `playerRoster.test.js` | Roster integrity, persistence, sheet generation |
| `settings/storage/camera/versusMatchMode` | Config, persistence, camera |

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
