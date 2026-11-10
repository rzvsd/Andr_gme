# Inkfall: agent guide

A gravity drawing game. Plain JavaScript (ES modules), Canvas 2D, Web Audio, Vite. No engine, no TypeScript.
Read `README.md` first: it has the module table and explains how plates are generated.

## Commands
| Task | Command |
|---|---|
| Install | `npm ci` |
| Dev server (http://localhost:5173) | `npm run dev` |
| Tests (Vitest) | `npm test` |
| Build | `npm run build` |
| Rebuild the atlas plates | `npm run plates` |
| Rebuild the daily plates (some minutes) | `node tools/generate.mjs daily` |
| Redraw the icons | `npm run icons` |

## Rules
- `src/sim/physics.js` is shared by the game, the generator and the tests. If you change a constant
  or the integrator, every stored answer can become wrong: rebuild both data files and run the tests.
- Never edit `src/data/*.json` by hand. Change `src/gen/generate.js` and rebuild.
- The game must stay free of image and audio files. Draw it or synthesise it.
- UI: one main action per screen, every control has a visible label, no help text. The first plate
  teaches the drag with a moving finger, not with words.
- Done means: `npm test` passes, `npm run build` passes, and you looked at the change in the browser
  at phone size (390 x 844).

## Checking in the preview pane
`.claude/launch.json` defines the `game` server. The pane slows animation frames, so drive the game
by script: in dev builds `window.__ink.debug.screen` is the current screen; call `.frame(1/60)` in a
loop, and on a plate use `.play.nudge(da, dp)`, `.play.launch()`, `.play.aim`, `.play.phase`.
Wait about half a second before a screenshot so the pane paints the new frame.
`window.__ink.measure(rig => rig.pluck(0))` renders a sound offline and returns its peak and level.
