# Agent State

## Current Milestone
- `Milestone`: Hardening M10–M18 (CI, pause timer, outline, untracked output, behavioral tests, docs, audio cleanup, scene split)
- `Branch`: `test`
- `Status`: `in_progress` (M10, M12–M18 done; M11 scene split pending)

## Shipped Before This Round
- Phase 1–7: engine, entities, systems, rendering, UI scenes, audio managers.
- Versus mode + M1–M9 (Sept 6): arena visual lock, ninja fighters, picture-style
  bullets, spawn protection, touch zones, WebAudio synth SFX, landscape Android,
  DPR/perf caps, exit-confirm, 2-finger input, roster reskin, knockback + dodge tune.

## Worker Assignments (M10–M18, disjoint files per milestone)
| Milestone | Ownership | Deliverable | Status |
|---|---|---|---|
| M10 | `.github/workflows/`, Android test packages | CI gate + appId fix | done |
| M18 | `README.md` | License wording clarified | done (visibility toggle is owner's click) |
| M12 | `src/scenes/GameScene.js` timer section | Pause-time compensation | done |
| M15 | `src/scenes/GameScene.js` render section | BUG-024 outline restored | done |
| M13 | git index only | Untracked generated Capacitor output | done |
| M14 | `tests/` (new files) | 19 behavioral tests (50 total) | done |
| M17 | `docs/AGENT_STATE.md`, `project overview/BUGS.md`, `tests/README.md` | Docs match the tree | in_progress |
| M16 | `public/audio/` | Placeholder cleanup | pending |
| M11 | `src/scenes/VersusGameScene.js` + `src/scenes/versus/*` | Scene split | pending |

## Rules
- Strict one-agent-per-file/folder ownership (see table; M12/M15 share
  `GameScene.js` but different sections, done sequentially).
- Asset loading strategy is Option C: render fallback until assets load; never block runtime.
- GameScene must explicitly call `SpriteSheet.load()` during scene initialization (BUG-015 guard).
- BUG-028–031 logged in `project overview/BUGS.md`.
- No edits to `project overview/SAFETY_REVIEW.md`.

## Verification Gates
- `npm test` green (15 files, 50 tests). ✅
- `npm run build` succeeds. ✅
- `npx cap sync android` regenerates untracked output with clean `git status`. ✅
- `:app:testDebugUnitTest` passes. ✅
- Scene flow works: `Menu -> Game -> Pause -> Resume -> GameOver -> Retry/Menu`. ✅
- Pause excludes paused time (regression test). ✅
- Audio managers initialize without runtime errors when assets are missing. ✅
