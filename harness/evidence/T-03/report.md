# T-03 Edge walls, remove fall deaths — verification report

Acceptance check proved: A-03 (no fall deaths; player stops at bridge end).

| Check | How run | Result | Evidence |
|---|---|---|---|
| A-03 / unit: 3 named edge-wall tests exist and pass | `npx vitest run tests/versusCollisionSystem.test.js tests/versusArena.test.js --reporter=verbose` (2 files, 8 tests, exit 0) | pass | harness/evidence/T-03/unit-walls.log |
| A-03 / no fall path: grep applyFallDeaths\|handleRingOut in src tests | `grep -rn ...` -> only tests/versusArena.test.js:110 (asserts method undefined) | pass | harness/evidence/T-03/no-fall-path.log |
| npm test (17 files, 59 tests) | `npm test` exit 0, 17 files / 59 tests passed | pass | harness/evidence/T-03/npm-test.log |
| npm run build | `npm run build` exit 0, 61 modules | pass | harness/evidence/T-03/npm-build.log |
| A-03 / runtime: hold left 8s, P1 at LEFT END of left bridge | built-in browser 844x390, HUMAN VS BOT, Enter to start, synthetic KeyA 8s, KeyJ, screenshot | pass | harness/evidence/T-03/wall-left.png |
| A-03 / runtime: hold right 8s, P1 at RIGHT END of left bridge, no gap crossing | synthetic KeyD 8s, KeyJ, screenshot | pass | harness/evidence/T-03/wall-right.png |
| A-03 / runtime: P1 DEATHS stays 0 unless bot shot P1 | HUD read from screenshots; DEATHS 1 matched by BOT KILLS 1 (bot bullets visible) | pass | harness/evidence/T-03/hud-values.log |
| runtime: console errors / "fall" messages | read_console_messages onlyErrors and pattern "fall" | pass (none) | harness/evidence/T-03/console.log, fall-events.log |

Deviation: the START DUEL pointer click did not register in the emulated viewport (screenshot frame 800x692 vs viewport 844x390); the duel was started with a synthetic Enter keydown, which MenuScene handles as start. This does not affect A-03.
