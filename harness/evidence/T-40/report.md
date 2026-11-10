# T-40 Tower match in the game — evidence (2026-11-10)

What changed: the tower lab became the match. `src/tower/towerWorld.js` (arena, fighters, weapons, bot, WebGL),
`src/tower/towerData.js` (layout, weapons, round start points), `src/scenes/TowerScene.js` (rules, HUD, input, pause).
`src/main.js` registers `TowerScene` as the `versus` scene. `tower-lab.html` and `src/lab/` are removed.

## Checks run
| Check | Result |
|---|---|
| `npm test` | 22 files / 158 tests pass (these tests cover the old match modules and shared code; the tower has no unit tests) |
| `npm run build` | pass |
| Browser, 891x411, menu -> PLAY | the match starts; intro "ROUND 1 / FIRST TO 5" with the lights on, then dark play with the round clock |
| All four heroes as the player (pudd, chonk, ninja, vector) | the scene starts for each; the bot gets a different hero |
| Scripted round (dev handle `window.__game`) | a knockout gives "YOU SCORE" with the lights on, then round 2 starts at a new start point |
| Scripted match end | at 5 points the result screen shows "PUDD WINS 5 - 0", REMATCH and MENU |
| Bot alone for 240 s of game time, player idle | the bot visited all 6 floors, was never still for more than 5.5 s, won 3 rounds (after 48 s, 91 s, 58 s) |
| Console | no new error after the blaster fix (a hero's blaster can be a group of parts) |

## Not verified
- Touch controls and frame rate on a real phone (T-43).
- The scripted checks moved the bot next to the player to force a knockout; a full match by hand was not played.
- The preview pane slows animation frames, so time was driven by `scene.update(1/60)` calls.
- The pause screen in the tower scene was not opened in this run.
