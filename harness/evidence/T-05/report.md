# T-05 verification report — Android shell (A-06)

Verifier: independent run on emulator-5554 (GafferApi36), 2026-10-30 17:47-17:53. Builder evidence left untouched; verifier files are prefixed `verify-`.

| Check | How run | Result | Evidence |
|---|---|---|---|
| A-06 static: `hide(WindowInsetsCompat.Type.systemBars())` in MainActivity; `onBackPressed` only calls super when WebView is null, else evaluates Escape JS | grep on MainActivity.java | pass | harness/evidence/T-05/verify-static.log |
| A-06 static: manifest `screenOrientation="sensorLandscape"`; capacitor.config `backgroundColor` `#05060a` (x2); values-v27 styles with shortEdges cutout | grep / cat | pass | verify-static.log |
| A-06 static: launcher icon differs from Capacitor default | md5 working tree fd1d3265... vs HEAD 19569413... | pass | verify-static.log |
| A-06 static: all 11 drawable*/splash.png under 200 KB | find + ls -l (10-71 KB) | pass | verify-static.log |
| Build logs: gradle-assembleDebug BUILD SUCCESSFUL (39m48s, EXIT=0); unit-tests BUILD SUCCESSFUL; app-debug.apk 4,492,111 bytes; package installed, versionCode=1 versionName=1.0 targetSdk=35 | tail/grep/ls, adb pm list, dumpsys package | pass | verify-logs.log |
| A-06 immersive fullscreen (no status/nav bar) | force-stop, am start, dumpsys window: app window frame=[0,0][2400,1080] = display, "Requested non-default-visibility types: statusBars navigationBars", ROTATION_90 landscape; screenshot verify-back.png shows menu edge to edge, no bars | pass | verify-fullscreen.log, verify-back.png |
| A-06 hardware back does not kill app | `input keyevent 4`, wait 2 s, dumpsys activity: topResumedActivity=.MainActivity, state=RESUMED finishing=false, pidof alive (6415); screenshot still shows menu | pass | verify-still-running.log, verify-back.png |
| A-06 back in match = "Press ESC again to quit to menu" hint (pause / exit confirm) | builder's back-key.png viewed: match running, hint pill visible (old lit arena, expected) | pass (builder evidence, not re-driven) | back-key.png, match-before-back.png |
| A-06 custom launcher icon | builder's launcher.png viewed: dark round icon with crossed red/blue slugs, 4th dock slot | pass (builder evidence) | launcher.png |
| A-06 custom splash | builder's splash.png and verifier's 20 s capture both show crossed red/blue slugs on #05060a, no status/nav bar | pass | splash.png, verify-fullscreen.log |
| Observation (not a failure) | Captures taken 17:50-17:53 are solid black (same md5) while activity RESUMED, window focused, WebView renderers alive; logcat shows HWUI frames of 5-6 s and ANR in com.android.systemui (emulator starved). Attributed to emulator load; not reproduced as an app fault. | unproven (black frame cause) | verify-ingame.png, verify-ingame-3.png, verify-fullscreen.log |

Notes
- ingame.png (builder) = menu scene edge to edge; verify-back.png (17:48) = same menu after back key.
- Escape in the menu scene has no visible effect by design; proof of back handling there is "still RESUMED + process alive".
