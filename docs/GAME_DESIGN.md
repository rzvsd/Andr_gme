# Game Design — Bullet Dodge Arena

Scope and acceptance checks live in `harness/PRD.md`. This document describes the game as
built on 2026-10-30. The earlier single-player wave design is retired. Its code was removed on
2026-11-03 and is still in git history on `main`.

## 1. Overview

| | |
|---|---|
| Title | Bullet Dodge Arena |
| Genre | 2D duel shooter in the dark |
| Platform | Android phones, landscape, touch. Desktop browser for development only. |
| Players | 1 (Human vs Bot) or 2 on one phone (Human vs Human) |
| Session | One match to 5 kills, about 2–4 minutes |

### Elevator pitch
Two fighters stand on two bridges in a pitch-black arena. Nobody can see anybody. A fighter
shows for a split second when they fire and for half a second when they are hit. Listen,
watch the tracers, guess where the other one is, and shoot first.

## 2. Core loop

```
pick mode + fighter -> START DUEL
   -> both fighters spawn hidden on their own bridge
   -> move, jump, fire: a shot reveals you (0.3 s) and shows a glowing tracer
   -> a hit reveals the victim (0.5 s); 4 hits kill; the victim respawns hidden after 1.35 s
   -> first to 5 kills wins -> Game Over with stats -> Retry or Menu
```

## 3. Mechanics

### 3.1 Dark arena rules
- Background is black (`#05060a`). No sky, no scenery.
- Platforms are drawn as faint outlines so players know where they can stand.
- Bullets and their glow trails are always visible.
- Both fighters are hidden by default, including your own. A fighter is drawn only while a
  reveal timer runs: 0.3 s after firing, 0.5 s after being hit. The reveal fades over its
  last 0.1 s. A new reveal never shortens one already running.
- HUD panels are always visible.

### 3.2 Arena (v3, layout C "two forts", owner pick 2026-11-02)
- World 1440 x 760 units, one fixed camera. Two sides, each fighter keeps to its own: P1 left,
  P2 right. The right side mirrors the left (`src/scenes/versusArena.js`).
- Per side: a ground (left `x 80..584`, right `x 856..1360`, top `y 688`), five jump-through
  ledges on three rows above it, and three solid blocks. Levels are 115 units apart
  (y 688, 573, 458, 343).
- Ledges: jump up through them and land on top; swipe down (S / ↓) drops through the one underfoot.
- Blocks: 44 units, half a fighter. Solid on every side. They stop a shot fired standing on their
  level; a shot fired from on top of a block passes over other blocks.
- Invisible walls at both ends of each ground. A fighter cannot leave their side and cannot
  fall. There is no death line.
- Spawn points: P1 at 87% of the left ground, P2 at 13% of the right ground, under the open end
  of the first ledge, facing each other.

### 3.3 Fighters
- Body box (hit area and collision box) 40 x 84 under a rig 89.6 units tall (48 design px).
  Health 100, bullet damage 34 (3 hits to kill).
- Three shots, all back 3 s after the last shot (`src/scenes/versus/versusShots.js`); the pips
  under each score panel show the shots left and the refill.
- Move speed 330 u/s, jump 725 u/s (apex 142: one level up, never into the HUD band), no boost.
  Gravity 1850 u/s².
- Spawn protection 1 s (blinking while revealed, immune to hits, grants no dodges).
- A non-fatal hit knocks the victim back (260 u/s) with a small hop and turns them to face
  the shooter.
- Four selectable fighters from the hero lab (`src/hero/characterDef.js`, keys in
  `src/theme/playerRoster.js`): Pudd, Chonk, Ninja, Vector. Cosmetic only. They are Three.js toon
  rigs drawn on a transparent WebGL canvas over the 2D game (`src/scenes/versus/versusHeroLayer.js`),
  with breathing, squash-and-stretch, lagging hats and swinging arms. Without WebGL the game falls
  back to flat 2D sprites in the same palettes. See `docs/HERO_LAB.md` for the character sandbox.

### 3.4 Bullets
- Speed 760 u/s, lifetime 1.5 s, fired horizontally in the facing direction at blaster height,
  31 units above the feet.
- Team colours (`TEAM_STYLES`): P1 red core with warm glow, P2 blue core with yellow glow.
- A bullet dies on hitting a fighter, a ground, ledge or block body, or when it leaves the world.
- A bullet that crosses a fighter without hitting counts as a dodge for that fighter.

### 3.5 Bot (Human vs Bot)
- With shots left it climbs, leaps or drops to the human's level and fights from the stretch
  nearest them (`src/ai/versusBotCourse.js`). With none it hides behind a block until they refill.
- Dodges incoming bullets sideways when there is room, jumps when there is not.
- Fires in bursts of 2–4 shots, then holds fire for 0.5–1.2 s while it wanders,
  so it does not stand still as a turret.

### 3.6 Scoring and match end
- HUD per player: Bullets Dodged, Deaths, Kills.
- First to 5 kills wins. Ties on kills break on fewer deaths, then more dodges.
- Game Over shows winner, kills, deaths, dodges and match time. Buttons: Retry, Menu.

## 4. Controls

| Input | P1 | P2 |
|---|---|---|
| Keyboard move | A / D | ← / → |
| Keyboard jump | W | ↑ |
| Keyboard drop through a ledge | S | ↓ |
| Keyboard shoot | J | L |
| Touch move | drag in the left zone | drag in the right zone |
| Touch jump | swipe up | swipe up |
| Touch drop through a ledge | swipe down | swipe down |
| Touch shoot | tap or hold | tap or hold |
| Pause / resume | Esc or hardware Back toggles the pause screen; quit with QUIT TO MENU there | |

Touch zones split the screen left and right. Any finger in a zone can shoot or jump while
another drags to move.

## 5. Screens
Visual direction A "Blackout Arena" (owner approved 2026-10-31 from `harness/evidence/T-13/mockups/`;
rules in `DESIGN.md`, rationale in `docs/VISUAL_DIRECTION.md`). Every screen is laid out in a 891x411
design box and scaled to the viewport.
1. Menu: hero stage on the left under a spotlight (Three.js rig, idle animation), name and 4 dots,
   chevrons; wordmark top-left, sound button top-right; segmented mode control (VS BOT, VS FRIEND),
   four fighter chips, one PLAY button. VS FRIEND shows two stages (P1 red left, P2 blue right) with
   a chip row each, so both players pick on the same phone. Switching a fighter plays a 300 ms
   reveal flicker. Defaults are remembered, so a returning player taps once.
2. Match: black arena with stage light, two light shafts, dust and vignette; bridges as outlined
   slabs with a lit top edge that flashes on landings and bullet hits; bullets with pre-rendered
   halos and trails; HUD as two pills under 8 percent of the height (kills big, deaths and dodged
   small) plus "FIRST TO 5"; mute button bottom right. Reveals carry a team rim light, a floor spill
   and a muzzle flash; hits add a flash and a dust puff; a kill freezes the frame (dim arena, white
   victim silhouette, bullet path in the shooter colour) with a short shake.
3. Pause (Back or Esc): the scene recolours, RESUME primary, QUIT TO MENU, SFX and MUSIC toggles.
4. Result: halves in team colours with a tilted seam, winner spotlit, loser dimmed, "<NAME> WINS"
   in the winner colour, score line, three stat tiles (kills, dodged, time), REMATCH primary, MENU.

## 6. Visual rules
See `DESIGN.md`. Tokens (`src/theme/tokens.js`) hold every colour, font, size and duration; fonts
are bundled (Chakra Petch for display, Inter for text). Black arena, faint platform outlines,
fighters readable the instant they appear, bullets readable against black, HUD never hidden. Hero
rigs are lit by a hemisphere light and one directional light, plus a per-fighter rim light in the
team colour while revealed and a spotlight on the menu and result stages.

## 7. Audio
SFX and music are generated with WebAudio in `src/audio/synthAudio.js`; there are no audio files.
Music: menu plays loop A "Dark Pulse" (slow sawtooth drone, 90 bpm), battle plays loop C
"Heartbeat Stalker" (heartbeat under a D-minor pad, 50 bpm), pause is A at half gain, game over is
C without the heartbeat. SFX: shoot, hit, kill, dodge, jump, click, all under 300 ms through a
short feedback-delay room. Audio starts on the first touch (autoplay rule); the mute button and
the SFX / Music toggles silence both at once. Candidates: `harness/evidence/T-06/research.md`.

## 8. Performance targets

| Metric | Target |
|---|---|
| Frame rate | 55+ fps average on the emulator, 60 fps target on phones |
| First frame | under 2 s after the splash |
| Crash-free | 10-minute match without a crash or ANR |
| APK size | under 15 MB |
| Min Android | API 23 (Android 6.0) |
