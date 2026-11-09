# T-15 evidence: menu rebuilt in direction A (2026-10-31)

Implemented by the `implement-direction-a` workflow (implementer + correctness reviewer + design
reviewer + fixer). Files: `src/scenes/MenuScene.js` (rewritten), `src/theme/playerRoster.js`
(P2 pick helpers), `src/config/versusMatchMode.js`, `tests/menuLayout.test.js` (18 tests).

Screenshots (dev server, real rigs):
- `menu-default-891x411.jpg`, `menu-default-844x390.jpg`: hero stage with spotlight, wordmark,
  sound button, segmented VS BOT / VS FRIEND, four chips, one PLAY button, no help text.
- `menu-friend-891x411.jpg`, `menu-friend-844x390.jpg`: two stages (P1 red left, P2 blue right)
  with a chip row each; PLAY centred.

Checks: tap targets 48 px with 8 px gaps inside the insets (unit test from the design box);
no literal colours or fonts in the scene (grep); per-pointer presses so two players can tap at
once; static glows pre-rendered (no per-frame shadowBlur except the 300 ms reveal ring);
P2 pick travels as `player2CharacterKey` to the match. Reviewer findings (2 medium) fixed.
