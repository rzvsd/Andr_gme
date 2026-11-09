# T-12 verification report (hero-lab roster in the duel, WebGL layer) - 2026-10-30

| Check | How run | Result | Evidence |
|---|---|---|---|
| `npm test` passes (18 files, 64 tests) | `npm test` | pass: 18 files, 64 tests | harness/evidence/T-12/npm-test.log |
| Hero unit tests cover roster->hero id map, shoot/hit/jump/land derivation, no-DOM fallback false | `npx vitest run tests/versusHeroLayer.test.js tests/playerRoster.test.js --reporter=verbose` | pass: 9 tests; all three behaviours asserted | harness/evidence/T-12/unit-hero.log |
| `npm run build` passes; lab pages excluded from dist | `npm run build`; `ls dist dist/assets`; find hero-lab*/hero-gallery* | pass: main bundle dist/assets/index-Ii6vCWOn.js 803.11 kB (gzip 211.13 kB); 0 lab pages in dist | npm-build.log, dist-check.log |
| A-04 menu: 3D toon hero in preview, 4 cards PUDD/CHONK/NINJA/VECTOR with emblems, START DUEL/SFX/MUSIC, arrows | browser tab-1, 844x390, screenshot after 3 s | pass (Chonk rig in preview, all buttons visible) | menu.png |
| A-04 menu: ">" changes preview hero and name | click next arrow, screenshot | pass: Pudd 1/4 -> Chonk 2/4 | menu-next.png |
| A-02 idle: black arena, platform outlines, HUD, no idle fighter lit | HUMAN VS BOT + START DUEL, screenshot after 2 s; Retry, screenshot after 2 s | pass: only fighters with bullets leaving them are lit; after Retry P1 dark=true while bot fires | idle.png, idle-retry.png, state.log |
| A-04/A-02 firing: P1 3D rig visible on left bridge with bullets while holding J | keydown KeyJ via JS, screenshot at +0.4 s and +0.9 s | pass: Chonk rig lit on left bridge, bullets in flight | firing.png, firing-2.png |
| A-02 state: two actors slot 0/1 with roster hero ids, slot 0 dark=false while firing | `window.__heroLayer.actors` dump during hold, and 1 s after keyup | pass: chonk/ninja; slot 0 dark=false while firing, dark=true 1 s after release | state.log, after-release.png |
| A-02 hit: hits register and reveal (HUD changed / fighter lit without own bullet) | screenshots 1 s apart during duel | pass: HUD P1 DEATHS 0->1, P2 KILLS 0->1; first duel ended 5 kills | hit.png, hit-2.png, gameover-first-duel.png |
| No console errors, no "[HeroLayer] render failed" | read_console_messages onlyErrors / pattern HeroLayer | pass: empty | console.log |
| Emulator screenshot of a match with a hero visible (TASKS.md check) | not run in this verification (later task per brief) | unproven here; emu-*.png in this folder were produced by another process, not checked by me | - |

Observations outside T-12 scope (not failures): (1) in the first duel P1 scored 5 kills with no keyboard input after the START DUEL click, which suggests the canvas tap that starts the match leaves fire held; (2) the GAME OVER panel showed Deaths 0 while the HUD had shown P1 DEATHS 1. Also: the browser pane's click frame was non-uniform at first (800x692 frame -> 844x390 viewport), so the suggested coordinates needed remapping; menu.png/menu-next.png/idle.png are therefore 800x692 crops with the game in the top-left.
