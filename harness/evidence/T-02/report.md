# T-02 verification: dark arena rendering, reveal timers, divider removed

Verified 2026-10-30 on branch harness/android-playable. Runtime: Vite dev server http://localhost:5173, built-in browser tab-3, viewport 844x390.

| Check | How run | Result | Evidence |
|---|---|---|---|
| A-02 unit: hidden by default, 0.3 s reveal on fire, 0.5 s reveal on hit, no re-trigger while flash decays, fade over last 0.1 s | `npx vitest run tests/versusDarkArena.test.js` (4 tests; test names and asserts cover all four rules) | pass | unit-reveal.log |
| Full suite | `npm test` | pass (17 files, 58 tests) | npm-test.log |
| Production build | `npm run build` | pass (61 modules, 220 kB js) | npm-build.log |
| A-02 runtime idle: black arena, platforms only as faint outlines, HUD visible, no idle fighter shown | Menu -> HUMAN VS BOT -> START DUEL, wait 2 s, screenshot | pass: only the bot is drawn and it has bullets leaving it; P1 is not drawn | idle.png, dark-both-hidden.png (both fighters hidden, one bullet in flight) |
| A-02 runtime firing: P1 visible with bullet right after shoot | key "j", screenshot immediately | pass: green pear ninja on left platform lit with a bullet at the muzzle | firing.png |
| A-02 runtime hit: hit registers and reveals | screenshots 1 s apart | pass: hit-flash.png shows P1 lit with the hit-flash box while bot bullets pass; hit.png shows HUD changed to P1 DEATHS 1 / bot KILLS 1 (was 0/0 in idle.png) | hit-flash.png, hit.png |
| A-04 partial: no vertical centre divider; fighters are ninjas, not boxes | visual check of every arena screenshot | pass: no centre line in any frame; both fighters render as goggled fruit ninjas | idle.png, firing.png, hit-flash.png, frame-00-after-start.png |
| Console errors | read_console_messages onlyErrors on tab-3 | pass: none | console.log |

Notes
- Screenshot frame was 800x692 for the first arena frame (pane not yet resized); clicks had to be mapped x*844/800, y*390/692. Later frames were 800x369 (uniform x1.055). This is a browser-pane quirk, not a game bug.
- frame-00-after-start.png shows P1 drawn with no bullet of its own while bot bullets had just passed its position; consistent with the 0.5 s hit reveal but not proven by that single frame. The clean idle proof is idle.png and dark-both-hidden.png.
- match1-gameover.png: first match ended after ~35 s with the result overlay; kept for context only.
- Viewport reset to desktop and tab-3 closed after capture.
