# T-07 verification report (independent verifier, 2026-10-30)

| Check | How run | Result | Evidence |
|---|---|---|---|
| 1. `npm test` passes (19 files / 68 tests) | `npm test` | pass (19 files, 68 tests) | harness/evidence/T-07/verify-npm-test.log |
| 1. Audio unit tests cover menu->versus (bgm_menu then bgm_battle), disable stops / re-enable restarts, bullet_fired SFX only after unlock and not when disabled | `npx vitest run tests/audioMusic.test.js tests/audioPools.test.js --reporter=verbose`; read tests/audioMusic.test.js | pass (8/8; all three behaviours asserted) | harness/evidence/T-07/verify-unit-audio.log |
| 2. `npm run build` passes | `npm run build` | pass (built in 14.24s; 500 kB chunk warning only) | harness/evidence/T-07/verify-npm-build.log |
| 2. No file probing left in src/audio; public/audio has only silence.wav + README.md | `grep -rn "\.webm\|\.mp3\|No playable sources" src/audio`; `ls public/audio` | pass (grep: no matches; ls: README.md, silence.wav) | harness/evidence/T-07/verify-no-files.log |
| 3a. A-07 menu loop after first gesture: "[MusicManager] playing bgm_menu" + "[AudioManager] synth SFX ready", no errors | Browser tab-3, 844x390, click ">" arrow, wait 2 s, read console | pass | harness/evidence/T-07/verify-console-menu.log |
| 3b. Environment: AudioContext available, game canvas present | javascript_tool | pass (`ctxs: function`, `hasCanvas: true`) | harness/evidence/T-07/verify-audio-state.log |
| 3c. A-07 battle loop: "[MusicManager] playing bgm_battle"; press J, no errors | Click HUMAN VS BOT, START DUEL, wait 3 s, key "j", read console | pass | harness/evidence/T-07/verify-console-battle.log |
| 3d. A-07 mute silences, unmute restarts music; icon shows muted | Click speaker (768,340), screenshot; click again, read console | pass (muted icon red/slashed; new "playing bgm_battle" after unmute; no errors) | verify-muted.jpg, verify-muted.png, verify-unmuted.png, verify-console-mute.log |
| 3e. No console errors across the whole flow | read_console_messages onlyErrors | pass (empty) | harness/evidence/T-07/verify-console-errors.log |
| 4. Emulator / logcat proof | not run by verifier (another process owns the emulator) | deferred to T-08 evidence | harness/evidence/T-08/logcat-soak.log (pending) |

Notes: audio cannot be heard by the verifier; proof is console lines plus absence of errors. Viewport reset to desktop and tab-3 closed after the run.
