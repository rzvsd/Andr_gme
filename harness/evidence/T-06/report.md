# T-06 verification report — Audio research: samples page for the owner's pick

Verifier run 2026-10-30, branch harness/android-playable. Acceptance check A-07 (samples exist and play without errors; owner's pick is a later decision).

| Check | How run | Result | Evidence |
|---|---|---|---|
| 1a. `npm run build` passes now | `npm run build` (exit 0, built in 9.13 s) | pass | harness/evidence/T-06/npm-build-rerun.log |
| 1b. `dist/` contains no audio-lab file | `find dist -iname "*audio-lab*"` printed nothing (0 matches) | pass | harness/evidence/T-06/dist-check.log |
| 2. research.md exists, <80 lines, 3 candidates, CC0 sources + licence terms, nothing downloaded, recommendation | `wc -l` = 72; grep hits for Kenney (CC0 1.0), OpenGameArt/Freesound CC0, Pixabay licence note, "Nothing was downloaded" (line 3), "## Recommendation" (line 54), A/B/C rows lines 25-27 | pass | harness/evidence/T-06/research-check.log |
| 3a. Page renders at 844x390 with 3 loop Play controls, 6 SFX buttons, "Dev only" note | Built-in browser own tab, resize 844x390, screenshot, read_page interactive + find | pass | harness/evidence/T-06/lab-844x390.png, audio-state.log |
| 3b. Play loop A, shoot + hit SFX; AudioContext running | Clicked Play A, Shoot, Hit; page state span reads "AudioContext: running · 48000 Hz", Play A button toggled to Stop (context not exposed on window, state read from page) | pass | harness/evidence/T-06/audio-state.log |
| 3c. No console errors | read_console_messages onlyErrors after playing: "No console logs."; all-messages shows only vite debug lines | pass | harness/evidence/T-06/console.log |
| 3d. Stop loop A, reset viewport, close tab | Clicked Stop (button back to "Play"), resize_window preset desktop, tabs_close tab-2 | pass | harness/evidence/T-06/audio-state.log |

A-07 (samples half): pass. Note: npm-build.log (older) records the earlier failure from another task; npm-build-rerun.log supersedes it. Screenshot is the pane capture (800x692 image) of the tab emulating 844x390; the layout fits in the top 230 px with no overflow.
