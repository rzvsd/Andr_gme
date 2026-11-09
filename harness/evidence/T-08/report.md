# T-08 report (builder; emulator-bound checks could not pass on this host)

| Check | How run | Result | Evidence |
|---|---|---|---|
| FPS overlay exists, toggles by ?fps=1 and triple tap top-left, logs every 30 s | browser ?fps=1 screenshot; on-device triple tap then logcat | pass | fps-overlay.png, logcat-fps.log |
| 10-minute bot duel on emulator: no crash, no ANR | soak.log: 10 min 48 s of play, app topResumed every minute; logcat-soak.log has 0 FATAL, 0 ANR | pass | soak.log, logcat-soak.log, soak-min1..9.png |
| Music and SFX on Android | logcat: playing bgm_menu, synth SFX ready, bgm_battle, bgm_gameover cycling with each match | pass (A-07 emulator half) | logcat-soak.log |
| FPS average 55+ | logcat-fps.log: current 4.1-7.5, avg 7.2-8.0 on emulator GafferApi36 (swiftshader software GPU, 2 GB guest, host under 1 GB free) | fail on emulator; unproven for a phone | logcat-fps.log |
| First frame under 2 s | am start -W TotalTime 13976 ms; menu frame after about 12 s on the emulator | fail on emulator; unproven for a phone | soak.log |

Environment note: the same emulator took 3-14 s per frame on the pre-hero 2D build (T-04 logcat HWUI Davey lines), so the shortfall is the software GPU, not a regression that this task can fix. Measure on the owner's phone in T-11: triple-tap the top-left corner during a match to show the overlay, read avg after 2 minutes.

Second attempt (20:50-20:57): emulator relaunched with `-gpu angle_indirect` to get hardware acceleration. SurfaceFlinger still reported "Android Emulator OpenGL ES Translator (Google SwiftShader)", the app did not reach the menu within 5 minutes and systemui ANR'd four times (`angle-run.log`, `emulator-angle.log`). Conclusion: this host has no usable GPU path for the emulator; fps and first-frame are measured on the owner's phone (T-11).
