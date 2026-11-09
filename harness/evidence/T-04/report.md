# T-04 verification report (independent verifier, 2026-10-30)

| Check | How run | Result | Evidence |
|---|---|---|---|
| 1. BUGS.md rows BUG-032..036 (032 Y, 033 Y/not reproduced, 034 Y, 035 Y, 036 Y) | `grep -n "BUG-03[2-6]" "project overview/BUGS.md"` | pass | harness/evidence/T-04/verify-bugs.log |
| 2. Code: VersusHUD font stack ends `Arial, sans-serif` (no `cursive`); GameOverScene has `renderVersusBoard`, `renderScoreBoard` routes `isVersus` to it before the generic ScoreBoard; `titlePx` = clamp(28..52, height*0.11) | grep + read GameOverScene.js:244-256, 606-613 | pass | harness/evidence/T-04/verify-code.log |
| 3a. `npm test` | ran | pass (18 files, 64 tests, exit 0) | harness/evidence/T-04/npm-test.log |
| 3b. `npm run build` | ran | pass (built in 39.6 s, exit 0; chunk-size warning only) | harness/evidence/T-04/npm-build.log |
| 4a. A-01 menu at 844x390: only HUMAN VS HUMAN / HUMAN VS BOT, START DUEL present; scene switch to versus after click | built-in browser tab-2, screenshot, clicks at (672,100) and (433,320), console read | pass (HUD panels 2 s after START DUEL, no errors) | verify-menu.png, verify-console-start.log |
| 4b. A-05 idle vs bot: P1 DEATHS / BOT KILLS grow; result screen layout | screenshots every ~6 s in match 2; result screenshot | pass: 0/0 -> 1/1 -> 2/2 -> 3/3 -> BOT wins (0-5), Time 27s; title/subtitle separate lines; YOU/BOT columns, Kills/Deaths/Dodged + Time line; YOU Deaths 5, BOT Kills 5; Retry/Menu fully below board | verify-hud.log, verify-hud.png, verify-gameover.png |
| 4c. Retry restarts match (counters 0, dark arena); Menu returns to menu | clicks at (291,296) then (509,296) after match end | pass | verify-retry.png, verify-menu-return.png |
| 4d. Console errors empty | `read_console_messages onlyErrors` | pass ("No console logs") | verify-console.log |
| 5a. Emulator frame T-12/emu-firing2.png: HUD plain sans-serif, hero rigs visible | Read tool | pass: HUD labels in bold Roboto-style sans-serif (not cursive); two 3D hero rigs (hat cactus, goggled fighter) on platforms | harness/evidence/T-12/emu-firing2.png |
| 5b. Game Over fix (BUG-034/035/036) on the emulator | `adb exec-out screencap` of what was on screen (emulator-5554 already booted) | fail on device: screen shows the OLD board (GAME OVER / Score / High Score / Wave, Retry+Menu over the Deaths row, title over subtitle). Installed APK lastUpdateTime 19:18:24 and synced android/app/src/main/assets/public (19:16) contain the font fix but NOT `renderVersusBoard`; GameOverScene.js was edited 19:38. Fix is verified in browser only. Needs `npm run build && npx cap sync android` + reinstall, then re-check. | verify-emu.png, verify-emu-apk-staleness.log |

Notes: P1 never fired while idle (KILLS 0), so BUG-033 did not reproduce with real pointer clicks either. P1's own rig was not seen in the sampled browser frames while idle/respawning; only the bot rig was in frame (observation, not a T-04 check). Viewport reset to desktop and tab-2 closed.

## Builder addendum (2026-10-30 20:01)
Check 5b re-run after `npm run build && npx cap sync android && gradlew assembleDebug` and reinstall: the emulator result screen now shows the two-column YOU/BOT board, separate title/subtitle and buttons below the board. Evidence: `emu2-gameover.png`, `emu-gameover-rerun.log` (build, install, 280 s match). Result: pass.
