# Tasks — Bullet Dodge Arena

Historical build checklist: `task.md` (Phases 1–8) and `docs/BUILD_PHASES.md`. Context only.

Status: `todo` | `doing` | `done` | `blocked`.
A task is ready when every task in `depends` is `done`.
Tasks with no shared `owns` files can run in parallel.
Every task also runs `npm test` and `npm run build` (A-11) and saves output in `harness/evidence/T-xx/`.
Emulator: `GafferApi36` (start with `emulator -avd GafferApi36`); `adb` lives in `%LOCALAPPDATA%\Android\Sdk\platform-tools`.
Landscape viewport for browser checks: 844x390.

## T-01 Land pending menu and bot edits; stop vitest scanning the worktree
- status: done
- depends: —
- owns: `src/scenes/MenuScene.js`, `src/ai/VersusBotController.js`, `vite.config.js`, `tests/versusBotController.test.js`
- proves: A-10 (tests run once), A-11
- check: `npm test` shows 16 test files; dev server at 844x390: menu shows two columns, PVP and BOT DUEL buttons, Play visible, no clipped text (screenshot); bot burst behaviour covered by a test or a 60 s dev-server run where the bot moves between bursts.

## T-02 Dark arena rendering, reveal timers, divider removed
- status: done
- depends: T-01
- owns: `src/scenes/versus/versusRenderer.js`, `src/scenes/versus/versusConfig.js`, `src/scenes/versus/versusPlayers.js`, `src/scenes/versus/versusProjectiles.js`, `tests/versusDarkArena.test.js` (new)
- proves: A-02, A-04 (divider)
- check: unit test: reveal timer is 0.3 s after fire and 0.5 s after hit, 0 otherwise; dev server at 844x390: three screenshots (idle black with faint platforms and HUD, firing shows shooter, hit shows victim); no divider line; `npm test`, `npm run build`.

## T-03 Edge walls, remove fall deaths
- status: done
- depends: T-01
- owns: `src/systems/VersusCollisionSystem.js`, `src/scenes/versusArena.js`, `src/scenes/versus/versusMatch.js`, `tests/versusCollisionSystem.test.js`, `tests/versusArena.test.js`
- proves: A-03
- check: unit test: a player moving past a bridge end is clamped to the edge and stays grounded; no fall-death path remains; dev server 2-minute run holding left and right: zero fall events in console; `npm test`, `npm run build`.

## T-04 Bug reproduction pass on emulator, log and fix
- status: done
- depends: T-02, T-03, T-05
- owns: `project overview/BUGS.md`, `src/ui/VersusHUD.js`, `src/scenes/GameOverScene.js`, `src/scenes/versus/versusAssets.js`, `src/scenes/VersusGameScene.js`
- proves: A-01, A-04 (ninjas not boxes), A-05
- check: run the debug APK on the emulator; for each of: placeholder boxes, blank HUD values, zero Game Over stats, dead Retry or Menu: reproduce or mark not reproducible; new BUG-032+ rows for what reproduces, fixed in the same task; screenshots of menu, HUD and Game Over after a match with hits; console log of scene switch.

## T-05 Android shell: fullscreen, back key, icon, splash, debug APK on emulator
- status: done
- depends: T-01
- owns: `android/app/src/main/java/`, `android/app/src/main/res/`, `android/app/src/main/AndroidManifest.xml`, `capacitor.config.json`, `android/README.md`, `src/core/Input.js` (only to receive the back key), `.claude/launch.json` (only if an emulator entry helps)
- proves: A-06
- check: `npm run build && npx cap sync android`; `cd android && ./gradlew assembleDebug` (set `JAVA_HOME` to Android Studio's `jbr` if `java` is missing); `adb install`; screenshots: launcher icon, splash, in-game with no status or nav bar; `adb shell input keyevent 4` during a match opens pause or exit confirm (screenshot); `:app:testDebugUnitTest` passes.

## T-06 Audio research: samples page for the owner's pick
- status: done (owner picked C battle / A menu on 2026-10-30)
- depends: T-01
- owns: `dev/audio-lab.html` (new, dev only, not in `dist`), `harness/evidence/T-06/`
- proves: A-07 (owner pick)
- check: a subagent researches options that fit a dark duel game (WebAudio-generated loops first, CC0 sources as fallback with licences noted); the page plays 2–3 loop candidates and a matching SFX set (shoot, hit, kill, dodge, jump, click) in the browser; report lists each candidate with size and licence; task ends `blocked` on the owner's pick, recorded in `harness/PRD.md` Decisions.

## T-07 Audio implementation from the owner's pick
- status: done
- depends: T-06
- owns: `src/audio/`, `public/audio/`, `tests/audioPools.test.js`, `tests/audioMusic.test.js` (new)
- proves: A-07
- check: unit test: music manager switches tracks on scene change and mute stops both; dev server: console lines show SFX after first click and music in menu and battle; mute silences both; emulator: same console lines via `adb logcat`; `npm test`, `npm run build`.

## T-08 FPS overlay and 10-minute soak on emulator
- status: blocked (environment: emulator software GPU gives 4-8 fps and a 14 s cold start; crash-free soak and overlay pass; fps and first-frame to be measured on the owner's phone in T-11)
- depends: T-04, T-07, T-12
- owns: `src/core/Game.js`, `src/main.js`, `index.html`
- proves: A-08
- check: dev-only FPS overlay toggled by `?fps=1` or triple-tap top-left; emulator bot duel for 10 minutes with `adb logcat` saved: no `FATAL`, no ANR; overlay screenshot at minute 9 with average 55+; splash-to-first-frame under 2 s from logcat timestamps.

## T-09 Release APK and signing recipe
- status: done
- depends: T-05, T-12 (final APK size)
- owns: `android/app/build.gradle`, `docs/RELEASE.md` (new), `README.md` (Quick Start section only)
- proves: A-09 (build half)
- check: `./gradlew assembleRelease` produces `app-release-unsigned.apk`; size under 15 MB (`ls -l` saved); `docs/RELEASE.md` gives keystore creation, `keystore.properties` format, signing and `adb install` steps without any secret values; `.gitignore` already excludes keystores.

## T-10 Rewrite GAME_DESIGN.md; update DESIGN.md and README
- status: done
- depends: T-02, T-03
- owns: `docs/GAME_DESIGN.md`, `DESIGN.md`, `README.md` (Game Concept section only), `docs/AGENT_STATE.md`
- proves: A-10
- check: GAME_DESIGN.md describes versus-only, dark arena with reveal rules, no falling, bot duel and local PVP, touch controls as implemented; old wave content removed; DESIGN.md gets dark-arena readability rules; AGENT_STATE.md points to `harness/PROGRESS.md`; `npm run build` still passes.

## T-11 Owner phone test, result recorded
- status: todo
- depends: T-08, T-09, T-10, T-12
- owns: `harness/PRD.md`
- proves: A-09 (phone half); confirms A-01 to A-08 on real hardware
- check: owner installs the release APK (signed per `docs/RELEASE.md`) or sideloads `android/app/build/outputs/apk/debug/app-debug.apk`, plays 10 minutes of bot duel and one PVP round, triple-taps the top-left corner during a match to show the FPS overlay and reads the avg after 2 minutes, notes the time from tap-to-open until the menu appears; reports phone model, Android version, pass or fail per check; result written to PRD Decisions and check statuses.

## T-12 Hero-lab roster in the duel (WebGL layer)
- status: done
- depends: T-02, T-03, T-04
- owns: `src/hero/` (brought in from branch `worktree-design-hero-character`), `src/scenes/versus/versusHeroLayer.js` (new), `src/scenes/versus/versusRenderer.js` (fighter draw path only), `src/scenes/versus/versusAssets.js`, `src/theme/playerRoster.js`, `src/scenes/MenuScene.js` (preview and roster cards), `index.html` (second canvas), `package.json`, `package-lock.json`, `vite.config.js`, `hero-lab.html`, `hero-gallery.html`, `docs/HERO_LAB.md`, `docs/CUSTOMIZATION.md`, `tests/versusHeroLayer.test.js` (new)
- proves: A-04 (hero-lab fighters render), A-02 (reveal rules still hold with the new fighters)
- check: `three` installed; a transparent WebGL canvas sits over the 2D game canvas and resizes with it; in a match each fighter is a hero-lab rig at the fighter's world position, facing, and animation state, visible only while its reveal timer runs (0.3 s fire, 0.5 s hit); menu preview and roster cards show the four heroes; `npm test` (new unit test maps fighter state to layer state), `npm run build` (lab pages excluded from `dist` or kept out of the Android bundle), dev-server screenshots at 844x390 of menu, idle, firing, hit; emulator screenshot of a match with a hero visible.

## T-13 Visual direction: audit, research, three menu mockups
- status: done (research and mockups); owner decision pending
- depends: T-12
- owns: `docs/VISUAL_DIRECTION.md`, `harness/evidence/T-13/`
- proves: none directly; unblocks A-12 to A-17
- check: audit screenshots of menu, match and result at 891x411; research notes with sources for mobile arena games, indie duel games and platform UI rules; reference moodboard; three menu mockups rendered with the real hero rigs; direction document with a recommendation and the open decisions listed.

## T-14 Design tokens and bundled fonts
- status: done (2026-10-31: tokens.js, fonts.js via @fontsource, design box helper, hero layer light presets, rim/spot lights, silhouette and dim; P2 fighter plumbing)
- depends: T-13
- owns: `src/theme/tokens.js` (new), `public/fonts/`, `index.html` (font preload), `tests/tokens.test.js` (new)
- proves: A-14, A-17 (fonts half)
- check: one module exports colours, type scale (4 sizes), spacing scale, motion durations; woff2 files served offline; `grep` finds no hard-coded `#` colours or font strings in `src/scenes/` and `src/ui/`; `npm test` passes.

## T-15 Menu rebuilt in the chosen direction
- status: done (2026-10-31, workflow implement-direction-a; evidence in harness/evidence/T-15/)
- depends: T-14
- owns: `src/scenes/MenuScene.js`, `src/scenes/versus/versusHeroLayer.js` (menu stage lighting only), `src/audio/synthAudio.js` (menu SFX family), `DESIGN.md` (menu rules)
- proves: A-12, A-13, A-17 (sound and press feedback)
- check: screenshots at 891x411 and 844x390 with no overlaps; hit-rect dump shows 48 px targets and 16 px insets; one tap from cold start to a match; reveal flicker on hero switch visible in a 3-frame capture; menu tick/confirm sounds in the console log.

## T-16 Match HUD and arena polish
- status: done (2026-10-31, workflow implement-direction-a; evidence in harness/evidence/T-16/)
- depends: T-14
- owns: `src/ui/VersusHUD.js`, `src/scenes/versus/versusRenderer.js`, `src/scenes/versus/versusEffects.js`, `src/scenes/versus/versusConfig.js`
- proves: A-15
- check: HUD under 8 percent of the height; stage light, lit platform edges, vignette and dust visible on black; reveal rim light and floor spill; kill frame freeze and shake; emulator or phone screenshots idle / reveal / kill; fps on the phone still 55+.

## T-17 Result screen as a beat
- status: done (2026-10-31, workflow implement-direction-a; evidence in harness/evidence/T-17/)
- depends: T-14, T-16
- owns: `src/scenes/GameOverScene.js`
- proves: A-16
- check: split halves in team colours, winner hero spotlit, loser dim, "<NAME> WINS" in the winner colour, REMATCH primary; screenshot at 891x411.

## T-18 Pause screen (Back key) in direction A
- status: done (2026-10-31; evidence in harness/evidence/T-18/)
- depends: T-14, T-16
- owns: `src/scenes/VersusGameScene.js` (pause state and input), `src/ui/VersusPauseOverlay.js` (new), `tests/versusPause.test.js` (new, optional)
- proves: A-12 (one primary per screen), A-17 (press feedback); owner rule: back key = pause / exit confirm
- check: Back or Escape pauses the match (simulation frozen, scene recoloured, HUD still readable), RESUME primary, QUIT TO MENU secondary, SFX and MUSIC toggles; a second Back while paused resumes; screenshot at 891x411 matches `harness/evidence/T-13/mockups/a-pause.jpg`.

## T-19 Arena mockup and owner pick
- status: done (2026-11-02: round 1 A/B too simple; round 2 `mockups/arena-v3.*`, owner picked C, two forts)
- depends: T-16
- owns: `harness/evidence/T-19/`
- proves: A-19 and A-20 (design approval only)
- check: mockup on the 891x411 frame with the real rigs shows the zoomed-out match, layouts C (two forts) and D (open course) with hiding behind a block, shooting over a block, and the shots-left pips; review page published; the owner's pick recorded as a PRD decision row.

## T-20 Shot limit: 3 shots, refill, 3-hit kills
- status: done (2026-11-02; evidence in harness/evidence/T-20/)
- depends: none
- owns: `src/scenes/versus/versusShots.js` (new: clip, refill, damage), `src/scenes/versus/versusProjectiles.js` (fire path), `src/scenes/versus/versusPlayers.js` (respawn refill), `src/scenes/VersusGameScene.js` (pause shifts the refill), `tests/versusShots.test.js` (new, owner-approved for new mechanics). The bot needs no change: its shots go through the same fire path.
- proves: A-18
- check: `npm test` (shot limit, refill timing, 3 hits kill, bot holds the same limit), `npm run build`, headless sim: P1 holds fire 10 s and is visible under half the time; browser check at 891x411.

## T-21 Arena v3 build: zoom out, ledges, blocks, shots-left HUD
- status: done (2026-11-02: layout C built; tests, build, sim, browser and a 1-minute phone run pass. Evidence in harness/evidence/T-21/)
- depends: T-19, T-20
- owns: `src/scenes/versusArena.js`, `src/scenes/versus/versusConfig.js`, `src/scenes/versus/versusPlayers.js` (one-way ledges, drop-down), `src/core/VersusInput.js` (swipe down), `src/systems/VersusCollisionSystem.js` (solid blocks: side and top contact; bullets already stop on platform bodies), `src/ai/VersusBotController.js` (ledge and block use), `src/scenes/versus/versusRenderer.js`, `src/scenes/versus/versusHeroLayer.js` (rig size), `src/ui/VersusHUD.js` (pips), tests for these. Also touched: `src/ai/versusBotCourse.js` (new: bot routes), `src/entities/Player.js` (drop input), `src/scenes/versus/versusEffects.js` (any platform can flash), `src/scenes/VersusGameScene.js` (platform kind, bot platform list)
- proves: A-19, A-20, fixes BUG-038
- check: `npm test`, `npm run build`, browser screenshots at 891x411 and 844x390 compared with the picked layout in `harness/evidence/T-19/mockups/arena-c-*.jpg` or `arena-d-*.jpg`, phone run with the FPS overlay.

## T-22 SHOOT button
- status: doing (2026-11-02: built for VS BOT, owner said go ("dai tu"); tests 25 files / 165, build and a headless scene check pass; left: a visual check (the browser pane was hidden) and the owner's play on the phone, where the APK is installed. The same-phone frame `shoot-friend.jpg` is dropped: VS FRIEND will be online)
- depends: T-21
- owns: `src/core/VersusInput.js` (shoot only from the button; the move zone moves, jumps and drops), `src/ui/VersusHUD.js` (SHOOT button with the shots ring, mute in the top band), `src/scenes/VersusGameScene.js` (button presses), `src/scenes/versus/versusRenderer.js` (button state), tests for these
- proves: A-21, fixes BUG-039
- check: `npm test`, `npm run build`, browser screenshots at 891x411 and 844x390 compared with `harness/evidence/T-22/mockups/shoot-*.jpg`, phone run: holding to move fires nothing, the button fires.

## T-23 Online lobby mockup and owner pick
- status: todo
- depends: T-22
- owns: `harness/evidence/T-23/`
- proves: A-22 (design approval only)
- check: mockups on the 891x411 frame: menu with PLAY ONLINE (QUICK MATCH, INVITE A FRIEND, JOIN), searching with CANCEL, the bot offer after 20 s, host code, join code entry, connection lost; review page published; owner's pick recorded.

## T-24 Match server (Cloudflare Workers + Durable Objects)
- status: todo
- depends: none (can start before T-23)
- owns: `server/` (new: worker, room object, queue object, protocol), `wrangler` dev dependency, `tests/server*.test.js` (new, owner-approved for new mechanics)
- proves: A-23
- check: unit tests on rooms, codes, queue pairing, relay and timeouts; `wrangler dev` run with two scripted clients; no account needed yet.

## T-25 Online match in the game
- status: todo
- depends: T-22, T-23, T-24
- owns: `src/net/` (new: connection, protocol, clock), `src/scenes/VersusGameScene.js` and `src/scenes/versus/*` (online mode: own fighter local, other fighter smoothed, shots relayed, the hit phone decides), menu and lobby screens per T-23, tests for these
- proves: A-24
- check: `npm test`, `npm run build`, phone vs PC browser against the local server: same kills and result on both, rematch, pull the network on one side.

## T-26 Deploy worldwide on the owner's Cloudflare account
- status: blocked (needs the owner's Cloudflare account and login; agents cannot create accounts)
- depends: T-25
- owns: `server/wrangler.toml` (deploy settings), the server address in the app config
- proves: A-25
- check: deploy log; phone vs PC browser over the internet; round-trip times logged; a match with 150 ms added delay stays playable.

## T-27 Google Play readiness for online play
- status: todo
- depends: T-26
- owns: `docs/RELEASE.md`, `docs/PRIVACY.md` (new), `android/app/build.gradle` (version)
- proves: A-26
- check: privacy policy text, Data safety answers, permission list, version bump; owner signs and uploads.

## T-28 Cleanup: old code, tests and worktree
- status: done (2026-11-03)
- depends: none (owner request)
- owns: dead `src/` modules, their tests and sprites, `src/main.js` (scene list), docs that named them, `.claude/worktrees/`
- proves: no unused source module is left; the game still runs
- check: `npm test` (22 files / 158 pass), `npm run build`, usage map from the HTML entry pages (62 of 62 modules used), browser run at 891x411 (menu, match, SHOOT button). Evidence: `harness/evidence/T-28/`.

# Phase 5: direction B "Tower" (planned 2026-11-09)

Order: test on the phone first (T-29), then mockups (T-30), then build. T-23 to T-27 wait until T-39 passes (PRD, Phase 5 decisions).
All Phase 5 work is VS BOT. Colours and fonts come from `src/theme/tokens.js` only.

## T-29 Tower test on the phone (grey box)
- status: todo
- depends: none
- owns: `src/scenes/versusArena.js` (a second, larger test layout behind a dev flag), `src/core/Camera.js` and `src/scenes/versus/versusRenderer.js` (follow camera), `harness/evidence/T-29/`
- proves: A-27
- check: `npm test`, `npm run build`; a grey-box arena 2 screens wide and 2 high with plain floors and gaps; the camera follows the own fighter; browser screenshots at 891x411 and 844x390; debug APK on the owner phone: FPS overlay average, screenshots, and the owner verdict on fighter size. No new art, no mini map yet.

## T-30 Tower mockups and owner pick
- status: todo
- depends: T-29
- owns: `harness/evidence/T-30/`
- proves: A-28
- check: mockups on real screenshots from T-29 for the arena layout (two or three options: floors, gaps, ladders or jump-through ledges, blocks), the mini map, the locker and the four pickups; review page published; the owner pick recorded in the PRD.

## T-31 Tower arena build
- status: todo
- depends: T-30
- owns: `src/scenes/versusArena.js`, `src/scenes/versus/versusConfig.js`, `src/scenes/versus/versusPlayers.js` (movement between floors), `src/scenes/versus/versusProjectiles.js` (shots stop at floors and blocks), `tests/versusArena*.test.js`
- proves: A-29
- check: `npm test` (reachability of every floor, mirror symmetry, no fall deaths, shots stop), `npm run build`, screenshots at 891x411 and 844x390 compared with the T-30 pick.

## T-32 Tells: footsteps, landing, silent walk, own outline
- status: todo
- depends: T-29
- owns: `src/scenes/versus/versusEffects.js`, `src/scenes/versus/versusTells.js` (new), `src/core/VersusInput.js` (walk and run from the stick), `src/audio/synthAudio.js`, `tests/versusTells.test.js` (new)
- proves: A-30
- check: `npm test` (run leaves marks, slow walk leaves none, landing makes a ripple, every sound has a mark), `npm run build`, screenshots of each tell and of the own outline.

## T-33 Mini map with sound marks
- status: todo
- depends: T-31, T-32
- owns: `src/ui/VersusMiniMap.js` (new), `src/ui/VersusHUD.js`, `tests/versusMiniMap.test.js` (new)
- proves: A-31
- check: `npm test` (the mini map data never holds the live position of a hidden fighter; marks fade), `npm run build`, screenshots at 891x411 and 844x390 compared with the T-30 pick; the score pills stay clear.

## T-34 Lockers and reacting objects
- status: todo
- depends: T-31, T-32
- owns: `src/scenes/versus/versusObjects.js` (new), `src/scenes/versusArena.js` (object places only), `tests/versusObjects.test.js` (new)
- proves: A-32
- check: `npm test` (no sound and no shot inside a locker, a shot at the locker hits, the lamp swings 2 s or more), `npm run build`, screenshots.

## T-35 Four weapon pickups
- status: todo
- depends: T-31
- owns: `src/scenes/versus/versusPickups.js` (new), `src/scenes/versus/versusShots.js`, `src/scenes/versus/versusProjectiles.js` (pickup shots only), `tests/versusPickups.test.js` (new)
- proves: A-33
- check: `npm test` (uses, reveal time per weapon, base gun unchanged, the trap never kills from full health), `npm run build`, screenshots of each pickup in use. Not in parallel with T-31: both own `versusProjectiles.js`.

## T-36 Bot for the tower
- status: todo
- depends: T-31, T-32, T-35
- owns: `src/ai/VersusBotController.js`, `src/ai/versusBotCourse.js`, `tests/versusBot*.test.js`
- proves: A-34
- check: `npm test`, `npm run build`, headless sim of 5 matches: the bot changes floors, goes to sound marks, takes pickups, is never stuck over 10 s; log saved.

## T-37 Meeting rules: timer, centre pickup, lights-on overtime
- status: todo
- depends: T-31, T-35
- owns: `src/scenes/VersusRoundManager.js`, `src/scenes/versus/versusMatch.js`, `tests/versusRound*.test.js`
- proves: A-35
- check: `npm test`, `npm run build`, headless sim with two passive fighters: every round ends within 90 s.

## T-38 Reveal replay
- status: todo
- depends: T-31
- owns: `src/scenes/versus/versusReplay.js` (new), `src/scenes/VersusGameScene.js` (replay state), `src/scenes/versus/versusRenderer.js` (lights-on pass), `tests/versusReplay.test.js` (new)
- proves: A-36
- check: `npm test` (recorder keeps positions and shots of one round, playback matches), `npm run build`, screenshots of the replay; a tap skips it. Not in parallel with T-29 or T-37 work on the same files.

## T-39 Owner phone test of the tower
- status: todo
- depends: T-33, T-34, T-36, T-37, T-38
- owns: `harness/evidence/T-39/`
- proves: A-37
- check: debug APK on the owner phone; the owner plays 10 minutes against the bot and reports: crash or not, FPS, and "one more match" yes or no; result written to the PRD.
