# Design — Bullet Dodge Arena

Game-specific rules. They add to `~/.claude/design.md` and win where they are more specific.
Full visual spec: `docs/GAME_DESIGN.md` §4.

## Platform
- Landscape only, phone first. Design for a short screen (about 390 px tall).
- Touch is the main input. Keyboard is for desktop testing only.
- Controls: movement joystick on the left, jump and shoot on the right (`docs/GAME_DESIGN.md` §3.1).

## Look: direction A "Blackout Arena" (owner approved 2026-10-31)
Reference mockups: `harness/evidence/T-13/mockups/a-*.jpg`. Rationale and research: `docs/VISUAL_DIRECTION.md`.
- Tokens: `src/theme/tokens.js` is the only source of colours, fonts, type sizes, spacing, hit sizes
  and motion. No hex colours, rgba strings or font strings in scenes or UI. Fonts are bundled
  (`src/theme/fonts.js`): Chakra Petch for display and big numbers, Inter for everything else.
- Type: four sizes, `TYPE.d1 32 / d2 24 / t1 16 / t2 12` (d0 56 only for the result title). Caps
  labels get `trackingPx()`. Nothing under 11 px.
- Layout: design in the 891x411 box and scale with `designBoxTransform()`; hit rects use the same
  transform as drawing. Check 891x411 and 844x390.
- Touch: targets at least 48 px with 8 px gaps, 16 px inside the insets, nothing tappable within
  40 px of the left or right edge. One primary button per screen (64 px, accent, glow).
- Colour roles: arena black, structure grey for outlines, one mint accent for the primary action and
  selection, P1 red always left, P2 blue always right, white for impacts. Only bullets, hits and the
  primary button reach full saturation.
- Motion: press scale 0.96 for 90 ms; fighter switch and reveals flicker 300 ms; transitions through
  black 150 ms; all timers from dt, never per frame.
- Theme: hero-lab fighters (Pudd, Chonk, Ninja, Vector) in a dark arena. Character palettes live in
  `src/hero/characterDef.js` (mirrored in `src/theme/playerRoster.js` for 2D fallbacks and menu
  discs); team colours come from `TEAM_COLORS` in `src/theme/tokens.js`.
- Fighters are Three.js rigs on the `#hero-canvas` overlay. Anything that must sit above a fighter
  (HUD, dialogs) is drawn on the 2D canvas, so keep fighters out of the HUD band.
- The arena is black (`ARENA_BLACK`). Nothing is drawn that the rules say is hidden: no sky,
  no scenery, no divider line, no fighter without a running reveal timer.
- Platforms are faint outlines (`PLATFORM_OUTLINE_COLOR`). They must stay visible on a phone
  at full brightness and in a dim room; test both.
- A revealed fighter must be readable in one frame: P1 and P2 differ by team glow, headband
  and bullet colour (regression: BUG-024).
- Bullets and tracers must read against black. Keep the glow; never draw a bullet in a dark colour.
- HUD panels never dim and never overlap the bridges.

## Screens
- One main action per screen: Menu → PLAY, Result → REMATCH, Pause → RESUME.
  That button is the biggest and brightest thing on the screen.
- No help text, control hints, taglines or meta text on any screen. If a screen needs them, fix the
  layout.
- Menu: hero stage left under a spotlight, mode and roster right, PLAY at the bottom, one tap from
  cold start to a match with the saved defaults. VS FRIEND shows two stages so both players pick.
- Match: HUD is two pills under 8 percent of the height at the top corners; mute button bottom right.
  Reveals carry a team rim light and a floor spill; kills get a freeze frame with the bullet path.
- Result: halves in team colours, winner spotlit, loser dimmed, three stat tiles, REMATCH primary.
- Every shown button works. No dead buttons (regression: BUG-023).
- Every HUD label shows its value (regression: BUG-026).

## Check before you call UI work done
1. Run the game in a landscape viewport.
2. Compare with `project overview/game pictures/expectation.png`.
3. Go through each rule above and in `~/.claude/design.md`. Say which rule fails, if any.
