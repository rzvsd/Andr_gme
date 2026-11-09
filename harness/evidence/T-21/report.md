# T-21 Arena v3 build, layout C "two forts" (2026-11-02)

Owner pick: "C, two forts" (mockup `harness/evidence/T-19/mockups/arena-v3.html`, shots `arena-c-*.jpg`).

## Change
- `src/scenes/versusArena.js`: layout C. Per side a ground (504 wide, edge walls kept), five
  jump-through ledges on three rows (levels 115 world px apart = 62 design px) and three solid
  44 px blocks; the right side mirrors the left. Spawns moved to the front of the ground, under the
  open end of the first ledge. Diagnostics now check jump reach and the HUD band instead of fall depth.
- `src/scenes/versus/versusConfig.js`: rig 48 design px (`PLAYER_DRAW_SCALE` 1.4); body box =
  hit area = collision box 40 x 84 world (fixes BUG-038); shot line at blaster height, 31 above the
  feet, under a block's top; jump 725 (apex 142: clears a level, never reaches the HUD band from the
  top level), boost off; reveal sprites sized to the smaller rig; block style tokens.
- `src/systems/VersusCollisionSystem.js`: one-way landing (feet must have been on or above the
  top strip one step ago), drop-through of the ledge underfoot, solid blocks (land on top, head bump,
  side stop). Bullets already stopped on every platform body, blocks included.
- `src/entities/Player.js`, `src/core/VersusInput.js`, `src/scenes/versus/versusPlayers.js`: drop
  input (swipe down, S / ArrowDown), cleared on respawn.
- `src/ai/versusBotCourse.js` (new) and `src/ai/VersusBotController.js`: the bot's side as a graph
  of segments (hop, climb, running leap, drop); with shots it goes to the opponent's level and fights
  from the segment nearest them; with none it hides behind a block until the clip refills.
- `src/scenes/versus/versusRenderer.js`, `src/ui/VersusHUD.js`: blocks drawn as crates, light shafts
  over the grounds only, shots-left pips under each pill (full, spent, refilling).
- `src/scenes/versus/versusEffects.js`: every platform can flash (a block hit lights the block).
- `src/scenes/VersusGameScene.js`: platform kind, the bot gets the platform list, rig height for the
  diagnostics (590 lines, under the 600 limit).

## Checks
| Check | Result | Evidence |
|---|---|---|
| `npm test` | pass, 25 files / 162 tests (11 new: layout, ledges, drop, blocks, shots vs blocks, swipe down, bot routes, pips) | `vitest.txt` |
| `npm run build` | pass (chunk-size warning as before) | `build.txt` |
| Headless real scene, P1 placed on each level for 6 s, bot free | bot reaches P1's level on every spot (0.02 to 4.6 s over runs); hides behind blocks while reloading; no fighter ever inside a block | `sim_course.mjs`, `sim_course.txt` |
| Browser 891x411 and 844x390, bot match | layout matches the C mockup; red jumps onto a ledge and fires at blaster height; pips show shots left; no console errors | `browser-*.jpg` |
| Mutation check | removing the one-way rule fails the ledge test | run by hand, see this report |
| Phone run with the FPS overlay (S24 Ultra, 2026-11-02 21:05, owner asked for 1 min) | pass: cold start 0.45 s to the activity, first contentful paint 0.92 s; 60 s of bot matches with real touch input (14 drive cycles) at avg 119.9 fps, worst 30 s window 105.3; one match ended (bot 5, red 2) and a rematch started; no crash, ANR or restart of the game process | `phone-install.log`, `phone-cold-start.log`, `phone-console.txt`, `phone-drive.txt`, `phone-logcat-game.txt`, `phone-*.jpg`, `scripts/match_drive.sh` |

## Notes
- A full-speed hop over a ground block can land on the ledge above (the jump clears a level). The
  bot then drops back; a player can too. Watch for it in the owner's play test.
- APK built at 20:52 and installed on the phone at 21:04 (`phone-install.log`).
- The 7 "has died" lines in the full logcat were other apps' cached processes closed by the system; the game's own lines (`phone-logcat-game.txt`) hold no crash, and its pid stayed 29496 for the whole run.
- The touch driver stops at its deadline or when the game leaves the screen; after the run no driver process was left on the PC.
