# Progress — Bullet Dodge Arena

Keep under 60 lines. Move old entries to `harness/archive.md`.
Milestone history before the harness: `docs/AGENT_STATE.md`.

- **Updated:** 2026-11-10
- **Current task:** none in work. Phase 6 (delivery) started: T-40 done, the tower is the match. Phase 5 tasks T-29 to T-39 are dropped (replaced by Phase 6).
- **Done today:** T-20 shot limit (3 shots, refill 3 s after the last shot, 3 hits kill, bot included): tests 25 files / 151 pass, build passes, real-scene sim and browser check in `harness/evidence/T-20/`. BUG-037 solved.
- **Phone test 2026-11-02 (T-11 run 3):** first frame 1.43 s after launch (A-08 first-frame pass); 6 min of bot matches at avg 119.7 fps, no crash or ANR; the run was stopped at the owner's request before 10 min. Owner feedback became Phase 3 (A-18..A-20) in `harness/PRD.md`.
- **Owner decisions 2026-11-02:** 3-shot rule with refill after 3 s, 3 hits per kill, straight shots (levels act as cover), arena mockup before building zoom and ledges. Round 2: a richer course ("think Mario"), more platforms and places to hide; owner picked layout C (two forts).
- **Phase 1 (playable on Android):** T-01..T-07, T-09, T-10, T-12 done. T-08 blocked on the environment. T-11 partial: still missing a full 10-minute run, one PVP round and the owner's own play and verdict.
- **Phase 2 (5-star look):** T-13..T-18 done, A-12..A-17 pass.
- **Notes for Android builds:** `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug` (JAVA_HOME = Android Studio jbr). The debug APK on the phone has T-20 and T-21 (installed 2026-11-02 21:04). Phone over wireless adb: the address changes, use `adb mdns services` then `adb connect`; `MSYS_NO_PATHCONV=1` in Git Bash. Phone test scripts: `harness/evidence/T-11/scripts/`; kill a driver loop from PowerShell by command line (see LEARNINGS Proposed).
- **Broken / blocked:** none open. BUG-038 solved by T-21. Watch in play: a full-speed hop over a ground block can land on the ledge above.
- **Owner play test 2026-11-02:** "Not clear when and how it shoots. Maybe we should have shoot button on right side." Cause: any held finger fires, so moving also shoots (BUG-039). T-22 mockup: `harness/evidence/T-22/mockups/shoot-*.jpg`.
- **Owner 2026-11-02:** VS FRIEND means two phones, one per player (PRD decision row). The same-phone mode no longer matches; how the phones connect is still open.
- **T-22 SHOOT button (2026-11-02):** built for VS BOT and installed on the phone (21:59): the right side fires, the left side only moves, jumps and drops; the ring shows shots left; mute moved to the top band. Seen in the browser at 891x411 on 2026-11-03 (`harness/evidence/T-28/browser-891-match.jpg`); 844x390 and the owner's phone play still open.
- **Phase 4 (online, anyone, anywhere, Google Play):** planned in `harness/PRD.md` (A-22..A-26) and `harness/TASKS.md` (T-23..T-27): lobby mockup, Cloudflare match server, online sync, deploy, store readiness.
- **T-28 cleanup (2026-11-03):** removed the retired single-player mode (12 modules), 2 unused HUD modules, 3 tests, the unused sprites folder and the merged hero-lab worktree; tests 22 files / 158 pass, build passes, every remaining module is used. Report: `harness/evidence/T-28/report.md`.
- **Owner 2026-11-09:** this game is the one project to take to Google Play. The game feels "too simple" to hook a player; ideas E-01..E-07 are in `harness/ENHANCEMENTS.md` (from the 2026-11-09 research; ideas, not tasks yet; nothing that needs legal work).
- **Phase 5 (2026-11-09):** the owner chose direction B "Tower" from three mockups (https://claude.ai/artifact/MJuoNrYKtBaSBGaLF4astH): side view, several floors, follow camera, mini map with sound marks. Planned without an interview at the owner's request; planner defaults are marked in the PRD. Checks A-27..A-37, tasks T-29..T-39. The look stays as built; every new part gets a mockup first.
- **Next action:** T-41 (menu and result screen show only what works), then T-42 (remove the old match code). T-43 phone run needs a phone on adb and a person to play.
- **Branch:** `main_2` (owner, 2026-11-09: Phase 5 is built here). `main` stays as it was on 2026-11-09 (commit d1b73db) and is the way back if the tower is dropped. `main_2` also holds the two CI fixes of PR 3.
- **Owner 2026-11-10:** the owner gave the project to Claude: "make it a delivery ready game for this new generation of kids". Claude decides from now on; decisions are in `harness/PRD.md` Phase 6.
- **T-40 (2026-11-10):** the tower lab became the match (`src/tower/`, `src/scenes/TowerScene.js`); crates are solid; rounds, first to 5, lights on at intro, knockout and after 60 s; the bot uses ladders, hears the player and takes pickups. Tests 22 files / 158 pass, build passes, browser run in `harness/evidence/T-40/report.md`. The old match modules are still in the repo, unused (T-42). Not checked on a phone.
