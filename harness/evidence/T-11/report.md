# T-11 evidence: owner phone, agent-side part (2026-10-30 23:00)

Device appeared on wireless adb: Samsung SM-S928B (Galaxy S24 Ultra), Android 17 (SDK 37),
Snapdragon 8 Gen 3 (SM8650), 1440x3120, density 560, 120 Hz panel.

Done by the agent:
- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` -> Success (APK built 20:31, no source newer).
- `pm list packages --user 0 com.andr.gme` -> package present.
- Cold start run 1 (`cold-start-run1.log`): `am start -W` returned after 534 ms. Frame captures were
  started at 582 ms; the first 11 captures (0.6 s to 3.6 s) are high-entropy animated frames, which fits
  the menu with its gradient and breathing hero preview and not the static splash. The raw frames were
  deleted before viewing, so this is NOT recorded as a first-frame pass. The 32-bit shell arithmetic
  wrapped at 4.29 s; `phone_boot2.sh` (scratchpad) fixes that with /proc/uptime but was not run.
- Run aborted: the owner was using the phone (the final screencap shows another app with the keyboard
  open). The game was force-stopped and /data/local/tmp/bda removed.

Still open for A-08 / A-09 on the phone: first-frame time viewed on frames, 10-minute duel fps average,
one PVP round. Needs the phone idle or the owner playing.

## Run 2 (2026-10-31), agent side
- 10:57 `adb install -r` of the direction A debug APK (built 09:19, no newer source) -> Success
  (`install-run2.log`, package lastUpdateTime 2026-10-31 10:57:36).
- Not measured yet: the phone has a secure lock (the agent never enters a PIN). After the owner
  unlocked it, they kept using it (WhatsApp, Instagram), and it locked again before any idle window.
  A second wait (game open, unlocked, 15 s idle) timed out after about 35 minutes.
- Wireless adb moved to 192.168.8.3:42989 (mDNS); `adb connect` worked with the old pairing.
- Ready to run: `harness/evidence/T-11/scripts/` `phone_cold.sh` (cold start, epoch-ns stamps, PNG frames),
  `cdp.mjs` (WebView DevTools: paint timings, FPS overlay toggle, console capture) and
  `soak_drive.sh` (10 min of bot matches through `adb shell input`).

## Run 3 (2026-11-02), agent side, owner asked: "install play and test"
- 18:22 `adb install -r` of the 09:19 debug APK (no newer source) -> Success (`install-run3.log`).
- Cold start (`cold-start-run2.log`, frames in `cold-run2/`): `am start -W` LaunchState COLD, TotalTime 470 ms
  (activity drawn). WebView navigation began 465 ms after launch; first-contentful-paint (first canvas frame)
  at +960 ms = 1.43 s after launch. Frame 1 (0.63-1.72 s) is dark, frame 2 (1.74-2.48 s) shows the full menu.
  A-08 first frame under 2 s: pass.
- Bot-match soak (`soak-run2/`): FPS overlay on through WebView DevTools, `adb shell input` drove PLAY/REMATCH
  and P1 holds. 8 matches in 6 min, `[FPS]` log avg 119.7 (120 Hz panel), play windows 105-120; one 4 fps
  window at 143 s is the owner switching to the Claude app (logcat 18:25:37 appStopped, `s01.png`). No FATAL,
  ANR or renderer crash in `logcat.txt`. Stopped at 434 s at the owner's request, so not a 10-minute run.
- Incident: the first stop missed the driver loop (Git Bash `ps` hides script arguments), so taps went on into
  the Claude app for a few minutes (`s03.png` shows selected words) until a PowerShell Win32_Process kill.
- Owner feedback after the run is Phase 3 in `harness/PRD.md` (A-18..A-20, T-19..T-21).
