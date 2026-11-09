# T-01 verification report

| Check | How run | Result | Evidence |
|---|---|---|---|
| A-10 / 1. `npm test` shows 16 test files passed (not 32) | `npm test` in repo root | pass (Test Files 16 passed (16), Tests 54 passed (54)) | harness/evidence/T-01/npm-test.log |
| A-11 / 2. `npm run build` passes | `npm run build` | pass (built in 4.82s, dist/index.html + assets/index-lLam2n7M.js) | harness/evidence/T-01/npm-build.log |
| 3. Menu at 844x390: two columns, PVP + BOT DUEL buttons, Start Duel visible, no clipped text | Built-in browser: navigate http://localhost:5173, resize_window 844x390, screenshot | pass (preview left; MATCH MODE buttons "HUMAN VS HUMAN / PVP" and "HUMAN VS BOT / BOT DUEL", 6-slot roster grid, START DUEL + SFX: ON + MUSIC: ON on right; no clipped text seen) | harness/evidence/T-01/menu-844x390.png |
| 3b. No console errors on menu load | read_console_messages onlyErrors=true | pass (no console logs) | harness/evidence/T-01/console.log |
| 4. Test "fires in short bursts and repositions between them" present and passes | `npx vitest run tests/versusBotController.test.js` (+ `--reporter=verbose` run for test names) | pass (1 file, 8 tests passed; test at tests/versusBotController.test.js:161, listed as passing in verbose log) | harness/evidence/T-01/bot-burst.log, harness/evidence/T-01/bot-burst-verbose.log |
