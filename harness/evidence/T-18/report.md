# T-18 evidence: pause screen (2026-10-31)

Implemented by the `implement-pause-a` workflow (implementer + design reviewer); the correctness
reviewer and the fixer were cut off by a usage limit, so the main session applied the fixes:
- mute button not drawn while paused (it was a dead button under the overlay; BUG-023 rule);
- WebGL rigs hidden once the pause fade completes (the hero canvas draws above the 2D canvas, so a
  revealed fighter could cover RESUME);
- effects and bot timers shifted by the pause length on resume (a kill freeze or bot burst no
  longer ends or fires at once after a long pause);
- toggle click emitted after the toggle is applied; primary base shade aligned across screens;
- GAME_DESIGN.md controls row: Back / Esc toggle pause, quit through QUIT TO MENU.

Behaviour checked in the browser (dev server): Escape (Android Back arrives as Escape) opens the
pause screen, music switches to `bgm_pause` and back to `bgm_battle` on RESUME (console log),
SFX toggle writes settings, RESUME returns to the match, QUIT TO MENU returns to the menu.
Screenshots: `pause-891x411.jpg`, `pause-844x390.jpg`, `after-resume-891x411.jpg`,
`quit-to-menu-844x390.jpg`. Tests and build: `vitest.txt` (tests/versusPause.test.js, 9 tests).

Also fixed while verifying: in VS FRIEND the wordmark is hidden, because Ninja's and Vector's
headband ribbons reached up through the text (`harness/evidence/T-15/menu-friend-no-wordmark-891x411.jpg`).
