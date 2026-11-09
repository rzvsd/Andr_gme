# T-28 Cleanup: old code, tests and worktree (2026-11-03)

Owner request: "delete what is old - no longer used, like tests, worktrees, etc" and "i need the space".

## How "unused" was decided
`reach.mjs` follows every import from the HTML entry pages (`index.html`, `hero-lab.html`,
`hero-gallery.html`, `dev/audio-lab.html`). Before the cleanup, 2 of 76 modules had no importer.
With the retired single-player scenes cut off (the menu only starts `versus`), 14 of 76 were unused.
After the cleanup: 62 of 62 modules are used (`reach.txt`).

## Removed (all tracked in git; `git restore <path>` brings any file back until the owner commits)
- Single-player wave mode: `src/scenes/GameScene.js`, `PauseScene.js`, `src/entities/Enemy.js`,
  `src/systems/AISystem.js`, `CollisionSystem.js`, `ScoreSystem.js`, `SpawnSystem.js`,
  `src/rendering/Background.js`, `src/theme/fruitCombatTheme.js`, `src/ui/HUD.js`, `Button.js`, `Joystick.js`.
- Never imported: `src/ui/MuteButton.js`, `src/ui/ScoreBoard.js`.
- Tests of that code: `tests/background.test.js`, `gamePauseTimer.test.js`, `scoreSpawn.test.js` (7 tests).
- `public/sprites/` (whole folder): nothing loads any of its files. `enemy_sheet.svg` and `bullets.svg` were
  for the old mode; `player_sheet.svg`, `platform_tiles.svg`, `particles.svg`, `manifest.json` had no user;
  `background_layer_1/2.svg` were named only by `buildBackgroundLayers()` in `src/scenes/versus/versusAssets.js`,
  which had no caller (the dark arena draws its own backdrop in `versusRenderer.js`). That method is removed too.
- `src/main.js`: no longer registers the `game` and `pause` scenes.
- Docs that named the removed files: `docs/ARCHITECTURE.md`, `docs/AGENT_ROLES.md`, `docs/GAME_DESIGN.md`,
  `src/{entities,rendering,scenes,systems,ui}/README.md`, `tests/README.md`, `public/README.md`.
- Worktree `.claude/worktrees/design-hero-character` (77 MB): all its files are in the main folder
  (same content, CRLF only; `package.json` and `vite.config.js` moved on). The branch
  `worktree-design-hero-character` stays: it is the only committed copy of the hero lab.
- `.ruff_cache/` (lint cache).

## Space
- C: npm download cache (1.4 GB) and the Gradle build cache (246 MB): both refill on demand.
- D: worktree 77 MB.
- C: free 61,938 MB -> 63,562 MB; D: free 10,387 MB -> 10,462 MB (`disk-after.txt`).

## Kept on purpose
- `GafferApi36` emulator (AVD 5 GB on D:, system image 4.4 GB + emulator 1 GB on C:): the PRD names it for agent proof runs.
- Android SDK parts, Gradle 9.6.1 (used today by another project), npm `_npx` tools (plugins run from it), Playwright browsers: shared with other projects or tools.
- `src/scenes/GameOverScene.js` still has a "GAME OVER" fallback for the old mode (title, tiles, rematch to `game`);
  it is unreachable now. Left as is: it is woven into the approved result layout and covered by `tests/resultLayout.test.js`.
- `dist/`, `android/app/src/main/assets/public/` (generated; refreshed by the next build and `cap sync`), `android/app/build/` (build output).
- Harness evidence, `docs/AGENT_STATE.md`, `docs/BUILD_PHASES.md`, `task.md`, `project overview/` (history and owner files).

## Checks
- `vitest.txt`: 22 files / 158 tests pass (was 25 / 165; the 7 removed tests covered removed code).
- `build.txt`: build passes; main bundle 784 KB (was 820 KB).
- `reach.txt`: 62 of 62 modules used. `deleted-files.txt`: 26 tracked files removed.
- `browser-891-menu.jpg`, `browser-891-match.jpg`: menu and a VS BOT match run at 891x411, no console errors.
