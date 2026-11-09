# audio/ — Audio Management

Sound effects and music, all generated with WebAudio at runtime. No audio files.
This module is fully decoupled — it only listens to EventBus events.

## Files

| File | Purpose |
|---|---|
| `synthAudio.js` | Pure generators ported from `dev/audio-lab.html`: `createLoopA` (Dark Pulse), `createLoopC` (Heartbeat Stalker, `{ heartbeat: false }` = pad only), six SFX (`shoot`, `hit`, `kill`, `dodge`, `jump`, `click`), `createSfxBus` (feedback-delay room). Each takes `(audioContext, destination)`. |
| `AudioManager.js` | SFX — maps gameplay events to synth SFX, gates on `enabled` and `volume`, unlocks on the first gesture. |
| `MusicManager.js` | Music — maps scenes to loops, hard-stops between tracks, mutes and resumes. |
| `audioUtils.js` | Unlock probe, shared `AudioContext`, volume clamp. |

## Wiring

| Scene | Track | Loop |
|---|---|---|
| menu | `bgm_menu` | A at full gain |
| game, versus | `bgm_battle` | C |
| pause | `bgm_pause` | A at 0.5 gain |
| game_over | `bgm_gameover` | C pad only, no heartbeat |

| Event | SFX |
|---|---|
| `bullet_fired` | shoot |
| `player_hit`, `versus:player_hit` | hit |
| `enemy_killed`, `versus:kill`, `wave_cleared` | kill |
| `bullet_dodged`, `versus:dodge` | dodge |
| `jump` | jump |
| `ui_click` | click |

## Autoplay rule

Both managers stay locked until `unlockAudioProbe` succeeds, which needs a user
gesture (`ui_click`). Only then is the shared `AudioContext` created or resumed.
A track requested before unlock is kept as `pendingTrack` and starts on unlock.

Console lines for logcat checks: `[AudioManager] synth SFX ready` (once) and
`[MusicManager] playing <track>` (once per track switch).

## Tests

`tests/audioMusic.test.js` injects a fake context through the
`audioContextFactory` option.
