# Learnings — Bullet Dodge Arena

## Kept
Approved by the owner. Agents follow these. Keep under 30 items.

## Proposed
Agents add here. These are NOT rules until the owner keeps them.
Format:
- [date] Mistake: ... | Evidence: harness/evidence/T-xx/... | Suggest: ... | Scope: project or global
- [2026-10-30] Mistake: three multi-line Bash heredocs failed to parse because the text held an unbalanced apostrophe (owner's, shooter's) | Evidence: harness/evidence/T-01 session log, the `unexpected EOF while looking for matching` errors | Suggest: write any edit script longer than a few lines to the scratchpad with the Write tool and run it with `python -I <file>`; keep heredocs for short, quote-free text | Scope: global
- [2026-10-30] Mistake: emulator frames came back pure black or the app got ANR-killed while the host had under 1 GB RAM free, a browser tab ran the game loop, and the guest had 4 GB | Evidence: harness/evidence/T-04/match-60s.png (0,0,0), logcat "ANR in com.andr.gme" | Suggest: on this host run `emulator -avd GafferApi36 -no-window -no-audio -no-snapshot -memory 2048 -cores 2 -gpu swiftshader_indirect`, set `wm size 1280x720` + `wm density 213`, close the browser game tab, wait for a non-trivial screencap before tapping, and expect Android's "Viewing full screen" hint after every reinstall (tap Got it at 893,255) | Scope: project
- [2026-10-30] Mistake: probing a live singleton with `await import('/src/...')` in the dev page returned a fresh module instance after HMR, so the probe lied (camera null) | Evidence: harness/evidence/T-12/state.log vs the first probe | Suggest: expose a `window.__name` debug handle in dev-visible singletons (the hero lab does the same) and read that | Scope: global
- [2026-10-30] Mistake: a verifier dispatched a synthetic keydown and later reported "fire stays held after START DUEL" (BUG-033), which did not reproduce with a real click | Evidence: harness/evidence/T-04/bug033-no-repro.jpg | Suggest: verifier briefs must say "every synthetic keydown gets a matching keyup before the next check"; builders re-test a reported bug with real input before logging it as open | Scope: global

- 2026-10-31 (Phase 2): a usage-limit cut-off kills workflow agents mid-task but leaves their file
  edits on disk. Resume the same run id with the cut agent's prompt changed to "verify what exists,
  do not start over"; unchanged agents replay from cache. Evidence: workflow wf_a38fad2e-e65, the
  match implementer had finished its code and tests when cut, the resumed agent only verified.
- 2026-10-31: a single synthetic `keydown` is a tap, not a hold. `VersusInput` ends a shoot hold
  unless keydown repeats, so a browser probe that dispatches one keydown sees sporadic shots and
  looks like a hit-detection bug. Dispatch repeated keydowns (`repeat: true` every 60 ms) or use the
  headless simulation (`scratchpad/sim_respawn.mjs`) to check match logic. Evidence: T-16 report.
- 2026-10-31: the Browser pane is shared with subagents; a research agent navigated the `seed` tab
  while the main session was reading it. Give agents their own tab (tabs_create) or forbid browser
  use in their brief, and never screenshot while an agent may be navigating.
- 2026-10-31: this host runs at most 2 workflow agents at a time (CPU count), so a 12-agent review
  pipeline takes about 45 minutes; budget wall time accordingly or merge the two review lenses.
- 2026-10-31: `npx cap sync android` while `npm run dev` runs crashed Vite on Windows (EBUSY on
  android/app/src/main/assets/public/index.html). Fixed in `vite.config.js` with
  `server.watch.ignored` for android/ and dist/. Evidence: preview log of the crashed server, T-18.
- 2026-11-02: killing a background input-driver loop with `ps -ef | grep soak_drive | kill` in Git Bash
  silently missed it, because MSYS `ps` shows `/usr/bin/bash` without script arguments; the loop kept
  tapping the owner's phone in another app. Kill by command line from PowerShell
  (`Get-CimInstance Win32_Process | Where-Object CommandLine -match ...`), confirm zero left, and make
  any phone input driver stop itself when the game is not the focused window. Evidence:
  harness/evidence/T-11/soak-run2/s03.png, T-11 report run 3.
