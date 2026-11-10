# PRD — Bullet Dodge Arena

Design detail lives in `docs/GAME_DESIGN.md` (rewritten in T-10 to match this PRD).
This file is the source of truth for scope and for what "done" means.

## Goal
Bring Bullet Dodge Arena to end-user playable status on Android: a versus-only duel game
(local PVP and Human vs Bot) in a dark arena, shipped as a release APK the owner signs and
plays for 10 minutes on a real phone without a crash.

## Users
- One or two people on one Android phone, landscape, touch only.
- Human vs Bot for solo play; local PVP shares the screen.
- Proof runs on the `GafferApi36` emulator (agents) and the owner's phone (owner).

## Out of scope
- Single-player wave mode. Its code was removed on 2026-11-03 (T-28); it is still in git history on `main`.
- Release signing by agents, monetization. (Online play and the Google Play release came into scope on 2026-11-02: Phase 4.)
- Hero-lab sandbox pages (`hero-lab.html`, `hero-gallery.html`) stay dev-only; they are not part of the Android app.
- Lit (classic) arena mode. Dark arena is the only mode.

## Acceptance checks
Each check must be provable. "How to prove" names a command, a screenshot, or a log.

| ID | Check | How to prove | Status |
|---|---|---|---|
| A-01 | Menu offers versus only (PVP, Bot duel); Play starts the selected mode | emulator screenshot of menu + console log of scene switch | pass (harness/evidence/T-04/verify-menu.png, emu-menu2.png) |
| A-02 | Dark arena: fighters hidden; revealed 0.3 s after firing and 0.5 s after being hit; platforms faint outlines; bullets and HUD always visible | unit test on reveal timers + three emulator screenshots (idle, firing, hit) | pass (browser: T-02, T-12; emulator: harness/evidence/T-12/emu-*.png) |
| A-03 | No fall deaths: a player walking to a bridge end stops there; no death line | unit test on edge clamp + 2-minute emulator log with zero fall events | pass in browser (harness/evidence/T-03/); emulator confirm in T-04 |
| A-04 | Fighters render as hero-lab characters (Pudd, Chonk, Ninja, Vector) within 2 s of match start, never placeholder boxes; no centre divider line | emulator screenshot compared with `project overview/game pictures/expectation.png` | pass (hero-lab rigs render in browser and on emulator: harness/evidence/T-12/, emu-firing2.png) |
| A-05 | After a match with hits, HUD values and Game Over stats are non-zero; Retry and Menu buttons work | emulator screenshots of HUD and Game Over + tap log | pass (harness/evidence/T-04/: verify-hud.png, emu2-gameover.png, retry-restarts-match.jpg, menu-button-returns.jpg) |
| A-06 | Immersive fullscreen (no status or nav bar), custom launcher icon and splash, hardware back = pause / exit confirm | emulator screenshots (launcher, splash, in-game) + `adb shell input keyevent 4` log | pass (harness/evidence/T-05/) |
| A-07 | SFX play after first touch; a music loop plays in menu and battle; mute silences both; owner picked the samples | WebView console log lines from audio managers + decision row below | pass (browser: harness/evidence/T-07/; emulator logcat: harness/evidence/T-08/logcat-soak.log) |
| A-08 | 10-minute bot duel on emulator: no crash or ANR, FPS overlay average 55+, first frame under 2 s after splash | `adb logcat` excerpt + overlay screenshot + timestamps | partial: emulator crash-free 10 min pass (harness/evidence/T-08/). Phone (S24 Ultra, 2026-11-02): first frame 1.43 s after launch, pass (harness/evidence/T-11/cold-start-run2.log, cold-run2/); fps avg 119.7, min window 105 in play, no crash or ANR over 6 min of bot matches (harness/evidence/T-11/soak-run2/); run stopped at the owner's request before 10 min |
| A-09 | `assembleRelease` yields an unsigned APK under 15 MB; `docs/RELEASE.md` explains signing; owner signed, installed, played 10 min on phone | build log + file size + owner's pass report recorded below | partial (unsigned APK 3.7 MB built, recipe written: harness/evidence/T-09/; owner phone test pending T-11) |
| A-10 | Docs match the product; new bugs logged in BUGS.md; `npm test` runs each test file once | doc diff + `npm test` summary (16 files, not 32) | pass (tests once: T-01; docs: T-10; BUG-032..036 logged: T-04) |
| A-11 | `npm test`, `npm run build` and CI pass | command output | pass (harness/evidence/T-01/) |

## Decisions
| Date | Decision | Why |
|---|---|---|
| 2026-10-30 | Harness set up; `docs/GAME_DESIGN.md` stays the design doc | Avoid two copies of the design |
| 2026-10-30 | Versus only; single-player wave mode cut | No menu entry, no recent work, keeps goal provable |
| 2026-10-30 | Dark arena is the only mode; reveal 0.3 s on fire, 0.5 s on hit; own fighter hidden too | Shared screen: hiding both is what makes "they don't see each other" true |
| 2026-10-30 | No falling: invisible walls at bridge ends, death line removed | Owner rule |
| 2026-10-30 | Divider line removed | expectation.png has none; bug4.png circles it |
| 2026-10-30 | Artifact = unsigned release APK + signing recipe; owner signs | Secrets stay with the owner |
| 2026-10-30 | Agents prove on emulator; owner does final 10-min phone test | Only the owner has the phone |
| 2026-10-30 | Quality bar: no crash in 10 min, 55+ fps avg on emulator, first frame < 2 s | Owner accepted suggestion |
| 2026-10-30 | Audio: research task, 2–3 samples, owner picks, then implement; WebAudio-generated first, CC0 files as fallback | No licence risk, no APK growth |
| 2026-10-30 | Old bug screenshots (bug1–3) belong to the cut scene; versus bugs get new BUG ids after emulator repro | Owner: "reproduce and log new bugs" |
| 2026-10-30 | Tasks may add unit test files under `tests/` for new mechanics | Owner approved |
| 2026-10-30 | Audio pick: loop C "Heartbeat Stalker" for battle, loop A "Dark Pulse" for menu (pause = A quieter, game over = C pad only), shared WebAudio SFX set from `dev/audio-lab.html` | Owner picked from the T-06 samples |
| 2026-10-30 | Fighters are the hero-lab roster (Pudd, Chonk, Ninja, Vector) rendered as a Three.js WebGL layer over the 2D duel canvas; the six fruit ninjas are retired. Branch `worktree-design-hero-character` is brought into the work branch. | Owner: "use the characters you built and showed earlier like Chonk, not the fruit ones"; WebGL layer keeps the approved look |

| 2026-10-30 | Phase 2 opened: the owner judged the build not user-ready visually (overlapping text, flat boxes, no hierarchy). Research top-rated games, redesign the menu first, then match HUD/arena and result, target a 5-star look. Three directions mocked up in `harness/evidence/T-13/mockups/`; owner picks one before any screen is rebuilt. | Owner message 2026-10-30 23:05 |
| 2026-10-30 | Phase 2 direction: A (Blackout Arena) for menu and match, C-style split halves for the result screen. Owner approves every screen from mockups before it is built. Defaults to confirm on the mockups: mint accent, red/blue teams kept, Chakra Petch + Inter. | Owner: "mergi spre propunerea ta A si C, arata-mi inainte designul" |
| 2026-11-02 | Shooting: every fighter (players and bot) has 3 shots; the shots refill 3 s after its last shot; 3 hits win a kill; shots stay straight, so a fighter on another level is safe | Owner phone test: "no character should be able to continuously shoot, 3 shots then 3 sec pause"; owner accepted the refill, 3-hit and straight-shot recommendations |
| 2026-11-02 | Arena v2: zoom out (fighters about 56 of 411 px, hit area = drawn body) and ledges above each bridge, layout A (two levels) or B (three levels); shown as a mockup first, the owner picks before it is built | Owner: "characters and arena are too close", wants smaller platforms above to jump on and back down |
| 2026-11-02 | Arena v3 replaces A/B: fighters about 48 of 411 px (hit area = drawn body), four levels 62 px apart, five jump-through ledges and three solid blocks per side; blocks are half a fighter tall and stop shots (cover; a fighter on a block or in mid-jump shoots over it); jump about 76 px, never into the HUD band; layout C (two forts, each fighter keeps to its side) or D (open course, one floor and a middle bridge, fighters go anywhere). Mockup first, the owner picks C or D. | Owner on the A/B mockup: "the map should be a bit more complex. Think Mario. More platforms to jump on. To hide." |
| 2026-11-02 | Arena v3 layout C (two forts): each fighter keeps to its side; built in T-21 | Owner: "C, two forts" |
| 2026-11-02 | VS FRIEND means each player on their own phone (online or local network), not two players on one phone. How to connect the phones is not decided yet. | Owner: "me my phone - friend his phone. Not both from same phone." |
| 2026-11-02 | The game ships on Google Play and is played online by anyone, anywhere: QUICK MATCH against a random opponent and a friend invite by room code. | Owner: "This will be a Google Market game, so it should be playable online from any part of the world." and "Now let's prepare it for online game for anyone to play from any part of the world." |
| 2026-11-02 | Online server: Cloudflare Workers with Durable Objects (one object per match room, one for the quick-match queue), on the owner's own Cloudflare account. The owner creates the account and logs in; agents write, test and deploy the code. The free plan covers the start (about 100,000 billed requests a day, 20 incoming WebSocket messages per request). | Owner asked the agent to choose ("dai tu"); global edge network, no server machine to run, WebSockets built in. |
| 2026-11-02 | Online netcode: each phone moves its own fighter and sends its state and shots about 20 times a second; the phone that is hit decides the hit; the other fighter is drawn about 100 ms in the past and smoothed. Fighters never touch in layout C, so no shared physics is needed. | Simple, fair to the dodger, works at intercontinental delay. |
| 2026-11-03 | Delete old, unused code and files (T-28): the retired single-player wave mode (12 modules), 2 unused HUD modules, the 3 tests of that code, the unused sprites folder, and the `design-hero-character` worktree (all its work is already in the main folder; its branch stays as a backup). This replaces "code stays" for the wave mode. | Owner: "delete what is old - no longer used, like tests, worktrees, etc" and "i need the space" |

## Phase 2 (proposed 2026-10-30): 5-star look
Goal: a player who installs the game rates the menu and the match as polished, not as a prototype.
Direction proposal and research summary: `docs/VISUAL_DIRECTION.md`. Owner picked direction A (menu, match) with C-style split result on 2026-10-31; checks are active.

| ID | Check | Evidence | Status |
|---|---|---|---|
| A-12 | Menu follows the chosen direction: one primary PLAY button (56 to 64 px) that is the brightest element, no overlapping text at 891x411 and 844x390, no help line, hero preview idles with a reveal animation on switch, defaults preselected (one tap to play) | screenshots at both viewports + tap count | pass (menu T-15, result T-17, pause T-18: one primary each, no overlaps at 891x411 and 844x390) |
| A-13 | Every tap target is at least 48 x 48 px with 8 px gaps and sits 16 px inside the safe insets; nothing tappable within 40 px of the left or right edge | DOM/canvas hit-rect dump + screenshot overlay | pass (tests/menuLayout.test.js, tests/resultLayout.test.js check 48 px targets, gaps, insets, 40 px edge strips) |
| A-14 | Shared tokens (colours, 4-size type scale, 8 px spacing, motion durations) in one module; no hard-coded colours or font strings left in scenes | grep + unit test on the token module | pass (src/theme/tokens.js, tests/tokens.test.js; grep clean in scenes and ui) |
| A-15 | Match: HUD strip under 8 percent of the height, team-sided; arena has stage light, lit platform edges and vignette; reveal has rim light and floor spill; kill frame and tiered shake | emulator or phone screenshots idle / reveal / kill | pass (harness/evidence/T-16/: idle, reveal, kill frame; headless sim of kills and respawns) |
| A-16 | Result screen: split halves in team colours, winner named in its colour, one primary REMATCH | screenshot | pass (harness/evidence/T-17/result-p2wins-844x390.jpg) |
| A-17 | Menu sounds (tick, confirm, back) and press feedback (scale 0.96, 80 to 100 ms) on every button; fonts bundled offline (woff2) and loaded before first paint | console log + screenshot after cold start without network | partial: fonts bundled and loaded before first paint (T-14), press feedback on every button (T-15..T-17); pass: fonts bundled and loaded before first paint (T-14); press feedback on every button; menu sound family tick / confirm (PLAY, RESUME, REMATCH) / back (QUIT, MENU) in src/audio/synthAudio.js, mapped in AudioManager, tested in tests/audioMusic.test.js |

## Phase 3 (2026-11-02): owner phone-test feedback
Source: owner message after the 2026-11-02 phone run. Mockup: `harness/evidence/T-19/` (artifact https://claude.ai/artifact/BBNPtJDDfXF19Bi3ZLocTu).

| ID | Check | Evidence | Status |
|---|---|---|---|
| A-18 | Each fighter fires at most 3 shots; the shots refill 3 s after its last shot; 3 hits kill; the bot follows the same rule; holding fire no longer keeps a fighter visible | unit tests on the shot limit and damage + headless sim (P1 holds fire 10 s, visible under half the time) | pass (harness/evidence/T-20/: tests/versusShots.test.js; real-scene sim: bursts of 3, 4-shot spans 3467 ms P1 and 3567 ms bot, P1 visible 28.9 %; browser 891x411) |
| A-19 | HUD shows each fighter's shots left (3 pips under its score panel) and the refill progress | screenshots at 891x411 and 844x390 | pass (harness/evidence/T-21/: pip test in tests/versusDarkArena.test.js; browser-891-*.jpg, browser-844-ledge-fire.jpg) |
| A-21 | Shooting is clear: a SHOOT button bottom right that shows the shots left on its ring (the same layout for any player on their own phone); moving never fires; the mute button moves to the top band | unit tests on input + screenshots at 891x411 and 844x390 + phone run | open (T-22, mockup waiting for the owner) |
| A-20 | Arena v3: fighters about 48 px tall on the 411 px frame with a hit area matching the body; four levels of ledges and solid blocks per the owner's pick (C or D); blocks stop shots and block walking; every level reachable by a jump, no jump into the HUD band; swipe down drops through a ledge; no fall deaths | unit tests on layout and physics + phone screenshots | pass (harness/evidence/T-21/: unit tests, headless sim, browser 891x411 / 844x390, phone run 60 s at avg 119.9 fps with screenshots phone-*.jpg) |

## Phase 4 (2026-11-02): online for anyone, anywhere, on Google Play
Source: owner messages 2026-11-02 (decision rows above). Order: design first, then server, sync, deploy, store.

| ID | Check | How to prove | Status |
|---|---|---|---|
| A-22 | Online lobby: the menu offers QUICK MATCH (anyone) and a friend invite (HOST shows a 4-letter code, JOIN takes one); a searching screen with CANCEL; after 20 s with nobody found it offers the bot; owner approved the mockup first | mockup + browser screenshots at 891x411 and 844x390 | open (T-23) |
| A-23 | Match server: create and join a room by code, pair two players from the quick-match queue, relay messages, close idle or empty rooms | unit tests + a local `wrangler dev` run with two clients | open (T-24) |
| A-24 | Online match: both phones show the same fighters, shots, hits, kills and result; rematch works; a lost connection ends the match with a clear message | two clients (phone + PC browser) against the local server, screenshots + logs | open (T-25) |
| A-25 | Worldwide: the server runs on the owner's Cloudflare account; phone vs PC browser over the internet; round trip measured; still playable with 150 ms added delay | deploy log + latency log + phone screenshots | open (T-26) |
| A-26 | Store ready for online play: privacy policy that covers online play, Data safety answers, INTERNET permission, version code; release signing stays with the owner | files + checklist in `docs/RELEASE.md` | open (T-27) |

## Phase 5 (2026-11-09): direction B "Tower"
Source: owner messages 2026-11-09 ("too simple, users would not get hooked"; "I like B"; "just do and tell me").
Mockup: https://claude.ai/artifact/MJuoNrYKtBaSBGaLF4astH. Ideas and research: `harness/ENHANCEMENTS.md`.
The owner asked for a plan without an interview. Rows marked "default" are the planner's choice; the owner can change them.

| Date | Decision | Why |
|---|---|---|
| 2026-11-09 | Direction B: side view, an arena of several floors larger than one screen, a camera that follows the own fighter, a mini map that marks loud sounds | Owner: "I like B" |
| 2026-11-09 | The look stays as built: Blackout Arena tokens, the 3D fighters, score pills, SHOOT button. New parts get a mockup on a real screenshot before they are built | Owner asked; answer confirmed with "yes" |
| 2026-11-09 | Nothing that needs legal work: no real money, no prizes, no paid random items | Owner: "avoid what is related to legal" |
| 2026-11-09 | default: the first task is a grey-box test on the owner's phone (camera, arena size, fighter size) before any other Phase 5 work | B has the least proof of the three directions; a fighter drops from about 48 px to about 30 px |
| 2026-11-09 | default: 3 shots, 3 hits and first to 5 stay; VS BOT only in Phase 5 | The research supports the format; online is the expensive part |
| 2026-11-09 | default: Phase 4 (T-23 to T-27) waits until T-39 passes. Its netcode decision assumed fighters that keep to their own side; in the tower they meet, and a hidden position must not reach the other phone. Review it before T-24 | Online play on the old arena would be work in the wrong order |
| 2026-11-09 | default: E-03 to E-07 (loser picks, rewards, more arenas, measurement, friend play) and video export stay ideas | Keep Phase 5 small enough to test |

| ID | Check | How to prove | Status |
|---|---|---|---|
| A-27 | Tower test: a grey-box arena at least 2 screens wide and 2 screens high; the camera follows the own fighter; on the owner's phone the average is 55 fps or more, and the owner says the fighter and the floors are readable | phone screenshots + FPS overlay reading + owner's verdict recorded here | open (T-29) |
| A-28 | The owner approved mockups on real screenshots for: the arena layout, the mini map, the locker, the pickups | review page + owner's pick recorded here | open (T-30) |
| A-29 | Tower arena: the approved layout; every floor is reachable from every other floor; both sides are mirror images; no fall deaths; shots stop at floors and blocks | unit tests on reachability and symmetry + screenshots at 891x411 and 844x390 | open (T-31) |
| A-30 | Tells: running leaves footstep marks the other player sees; a slow walk leaves none; a landing makes a ripple; every sound has a visual mark; each player sees a faint outline of their own fighter | unit tests on the tell rules + screenshots of each tell | open (T-32) |
| A-31 | Mini map: top centre; shows the tower, the own position and each loud sound for a short time; never shows the live position of a hidden fighter; no tap target; does not cover the score pills | unit test (no hidden position in the mini map data) + screenshots at 891x411 and 844x390 | open (T-33) |
| A-32 | Locker: a fighter inside makes no sound and cannot shoot, and a shot at the locker hits the fighter. Reacting objects: a lamp swings for at least 2 s after a fighter passes | unit tests + screenshots | open (T-34) |
| A-33 | Four pickups (wide loud shot, quiet exact shot, flare, trap), each with limited uses and its own reveal time; the base gun is unchanged; the trap reveals and does one hit, it never kills from full health | unit tests + screenshots of each pickup in use | open (T-35) |
| A-34 | The bot plays the tower: it changes floors, goes to sound marks, takes pickups and is never stuck for more than 10 s | headless sim of 5 matches + log | open (T-36) |
| A-35 | Meeting rules: a round timer, a pickup point in the centre, and lights on in overtime; no round lasts more than 90 s | unit tests + headless sim (two passive fighters still end the round) | open (T-37) |
| A-36 | Reveal replay: after each kill the round plays again for 3 to 5 s with both fighters visible; a tap skips it | unit tests on the recorder + screenshots | open (T-38) |
| A-37 | The owner plays 10 minutes of the tower against the bot on the phone with no crash, and says if he wants one more match | owner's report recorded here | open (T-39) |

## Phase 6 (2026-11-10): delivery

The owner gave the project to Claude on 2026-11-10 ("this codebase is yours ... make it a delivery ready game for this
new generation of kids playing"). From this date Claude makes the product decisions and records them here.

| Decision (Claude, 2026-11-10) | Why |
|---|---|
| Players: about 10 to 16 years old, on Android phones | The owner's words: the TikTok generation |
| Free game. No ads, no purchases, no real money, no accounts, no chat, no data leaves the phone | Young players; the owner's rule "avoid what is related to legal"; store rules stay simple |
| The tower lab is the match. The phone test and mockup gates of Phase 5 (T-29, T-30) are dropped | The owner saw the lab and said the look is good; a second gate adds no information |
| Rules: first to 5, 3 hits, 3 shots; dark play; lights on in the round intro, after a knockout, and after 60 s of a round | Short rounds; the lights-on moment is the pay-off of a dark round |
| One mode, VS BOT, until online play exists | A mode that does not work must not be on the menu |
| Work stays on `main_2`; nothing is merged into `main` unless a person asks | The earlier owner rule; `main` is still the way back |

| ID | Check | Proof | Status |
|---|---|---|---|
| A-38 | A tower match runs in the app from the menu to the result screen | browser run + `harness/evidence/T-40/report.md` | pass (T-40) |
| A-39 | The menu and the result screen show only things that work | screenshots + tests | open (T-41) |
| A-40 | No unused source module; the docs describe the tower match | usage map | open (T-42) |
| A-41 | Phone: 55 fps or more on average, every touch control works, 10 minutes with no crash | phone run | open (T-43) |
| A-42 | Bot: three levels, never stalls over 10 s | scripted run | open (T-44) |
| A-43 | Reveal replay after each knockout | screenshots | open (T-45) |
| A-44 | The tower has its own sounds; distance changes the volume | tests | open (T-46) |
| A-45 | Wins are saved and unlock heroes or hats; nothing is sold | tests | open (T-47) |
| A-46 | Release build, store text, screenshots and privacy note are ready | `docs/STORE.md` | open (T-48) |

## Open questions
- Phase 5: if T-29 fails (fighter too small or the camera hides too much), the owner picks between a smaller tower that fits one screen and direction A (top view).
- Phase 5: the research says a small arena reads better whole than through a camera and a mini map. T-29 and T-39 are the checks for this.
- Phase 4: the owner needs a Cloudflare account (free) before T-26; agents cannot create accounts.
- Resolved: owner phone is a Samsung Galaxy S24 Ultra (SM-S928B), Android 17, 1440x3120 at dpr 3.5, 120 Hz (seen over adb 2026-10-30 23:00).
- Phase 2: accent colour, team colours and display font are defaults in the mockups until the owner confirms them.
