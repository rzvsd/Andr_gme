# T-20 Shot limit: 3 shots, refill, 3-hit kills (2026-11-02)

Owner rule: "no character should be able to continuously shoot, 3 shots then 3 sec pause".
Owner accepted: the shots refill 3 s after the last shot, 3 hits kill, shots stay straight.

## Change
- `src/scenes/versus/versusShots.js` (new): a clip of 3 shots per fighter, all back 3000 ms after the
  fighter's last shot; tries while empty do not delay the refill; bullet damage = ceil(100 / 3) = 34;
  refill progress for the HUD (used by T-21); pause shift.
- `src/scenes/versus/versusProjectiles.js`: the fire path needs a shot in the clip as well as the old
  220 ms gap, spends it, and uses the versus damage. Players and the bot all fire through it.
- `src/scenes/versus/versusPlayers.js`: a respawn gives all three shots back.
- `src/scenes/VersusGameScene.js`: resuming from pause shifts the last-shot time, so pausing does not refill.
- The bot controller is unchanged: its presses go through the same fire path.
- The wave mode's `PLAYER_BULLET_DAMAGE` (25) is untouched.

## Checks
| Check | Result | Evidence |
|---|---|---|
| `npm test` | pass, 25 files / 151 tests (8 new in `tests/versusShots.test.js`) | `vitest.txt` |
| `npm run build` | pass | `build.txt` |
| Headless real scene, human vs bot, P1 holds fire 20 s | P1 18 shots in bursts of 3; tightest 4-shot span P1 3467 ms, bot 3567 ms (rule > 3000); P1 visible 28.9 % of frames (rule < 50 %) | `sim_shots.mjs`, `sim_shots.txt` |
| Browser 891x411, bot match, J held 6 s | bot burst of 3, P1 burst of 3, then P1 dark while J is still held; no console errors | `browser-hold-*.jpg` |

## Not done here
- The shots-left pips in the HUD are designed in T-19 and get built in T-21 after the owner's pick.
- The phone APK still has the old rule until the next Android build.
