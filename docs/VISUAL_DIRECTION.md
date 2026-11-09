# Visual Direction — Bullet Dodge Arena

Status: **proposal, 2026-10-30.** The owner picks a direction (section 4) before any screen is rebuilt.
Evidence: `harness/evidence/T-13/` (audit screenshots, reference moodboard, mockups).

## 1. Honest audit of the current build

Viewport 891x411 CSS px (Galaxy S24 Ultra in landscape). Screenshots in `harness/evidence/T-13/audit/`.

The game is functionally complete, but it looks like a prototype. The menu fails four of the six
global design rules (one main action, no explaining, no help text, eyes go where they need to).

| Screen | What is wrong |
|---|---|
| Menu | MATCH MODE label touches the buttons; HUMAN VS BOT and its BOT DUEL sub-label overlap; three equal boxes at the bottom so START DUEL does not stand out; every element is the same flat navy box with the same 2 px border; roster grid is 3 + 1 with an empty slot; preview panel has an unused grey strip and crops the rig; keyboard help line on a phone, inside the gesture-bar zone, at 11 px; meta text (4 / 4, BUCKET HAT) explains nothing; title is a plain system sans. |
| Match | Two pastel HUD slabs take 40 percent of the height, in Comic Sans; the arena is two grey rectangles on black with no depth, light or atmosphere; help text again at the bottom edge; revealed rigs are flat and small (about 60 px). |
| Result | Readable but generic: one bordered box, two flat buttons, no winner moment. |

## 2. What top-rated games do (research summary)

Three research passes (mobile arena games on Google Play, indie duel games on Steam, platform UI
guidelines). Full notes with sources: `harness/evidence/T-13/research-*.md`. The rules below are the
ones that apply to a landscape 2D duel game on a phone.

### Layout and touch
- Read safe insets at runtime (`env(safe-area-inset-*)`), keep every control 16 px inside them, and
  nothing tappable within 40 px of the left and right edges (Android back gesture) or in the bottom
  gesture strip.
- Hit areas 48 x 48 px with 8 px gaps; 64 to 72 px for anything near an edge or corner.
- One primary button per screen, 56 to 64 px tall; secondary 48; compact 40.
- Primary action at the lower right or centre, where the thumb rests; settings along the top.
- Depth at most 2 taps; at most 7 choices on a screen; the system Back key always works.

### Type and spacing
- Two typefaces: a display face for titles and big numbers (Chakra Petch, Rajdhani, Oxanium,
  Michroma or Russo One) and a text face for everything else (Inter, Barlow, Exo 2). All are OFL
  and can be bundled as woff2 for the offline APK. Best pairs: Chakra Petch + Inter, Rajdhani + Barlow.
- Four sizes only at 390 px height: 28 / 20 / 16 / 12 px. Floor 11 px. Caps get +0.06 to +0.12 em
  tracking. Multi-word lines in sentence case.
- 8 px spacing scale (4, 8, 12, 16, 24, 32, 48). Panel padding 16 or 24. Outer margin 16.

### Colour
- Five colour roles: near-black background, one desaturated structure hue, P1 accent, P2 accent,
  impact white. Only bullets, hits and the primary button reach full saturation.
- P1 and P2 colours opposite on the wheel, equal luminance, colour-blind safe (amber vs cyan, or
  clear red vs blue), P1 always left, P2 always right, on every screen. The environment never uses
  either hue.
- Dark surfaces are not pure black; elevation is a lighter surface. Text at 4.5:1 on the lightest
  gradient stop; state cues at 3:1; states are never colour alone (outline + weight + icon).

### Motion and feel
- Press: scale 0.96 for 80 to 100 ms, release 150 to 200 ms; panel open 250 to 300 ms
  decelerate; screen change 300 to 400 ms, never over 600. Cross-fade through black 150 ms.
- Time-based animation from the frame timestamp, transforms and opacity only, same speed at 60 and
  120 Hz, honours reduced-motion.
- Idle animation on the character select is mandatory; the hero preview takes 35 to 45 percent of
  the width.
- Menu sound: 100 to 300 ms ticks in one family, pre-decoded so they fire on the touch frame.
  One short haptic click on press.

### The dark arena specifically (ROUNDS, Bullet Echo, Downwell, Hyper Light Drifter)
- Black needs value structure: a 6 to 8 percent grey radial stage light, faint light shafts from
  above, 2 to 3 percent grain, vignette to about 35 percent at the corners.
- Platform outlines 1.5 to 2 px at 35 to 45 percent alpha plus a 10 to 15 percent fill; brighten to
  70 percent for 150 ms on landing or bullet hit.
- Glow as three pre-rendered additive halos (1.0 x, 1.5 x at 60 percent, 3 to 4 x at 15 to 20
  percent) and a trail of the last 8 to 12 positions. No per-bullet shadowBlur on Android.
- A fighter reveal is a lighting event: 2-frame fade in, fade out over the last 40 percent of the
  window, player-colour rim light on the model, a floor spill ellipse under the feet.
- Tiered hit stop and shake: hit 0 to 30 ms and 2 to 3 px; kill 100 to 150 ms and 8 to 10 px with
  a 3 to 5 percent zoom. Own a kill frame: freeze, arena to 30 percent, bullet path in shooter colour.
- HUD: one top strip under 8 percent of the height, player-sided, health as pips not bars, no
  sentences on the playfield.
- Result screen is a beat, not a modal: freeze, 600 ms hold, "P1 WINS" in P1 colour, one primary
  REMATCH, arena still visible behind at 30 percent.

### Mobile hub menus (Brawl Stars, Clash Royale, Bullet Echo, Shadow Fight 4, Sideswipe, Zooba)
- Hero stage idles at 55 to 70 percent of the screen height on a glowing floor disc or rim-lit
  platform, idle loop 2 to 4 s; tap the hero for a taunt.
- One primary PLAY at the bottom right, 22 to 28 percent of the width and 12 to 16 percent of the
  height, full-saturation accent; everything else dark glass under 40 percent saturation.
- The mode selector sits next to PLAY as a card with icon, caps name and one sub-line ("vs Bot"),
  never a modal or a deeper menu. Any screen is one tap from the hub.
- Selected state: 2 to 3 px accent border, 8 to 16 px glow at 40 to 60 percent, scale 1.05 to
  1.10; siblings dim to 70 percent. Disabled = desaturate 40 to 50 percent plus a glyph, never
  opacity alone.
- Type scale of 3 with ratios about 1.0 : 0.6 : 0.45, caps labels with 3 to 5 percent tracking,
  flat white on dark panels, a 2 to 3 px dark outline only when text sits over art.
- Background is a scene, not a flat fill: dim bridge silhouettes, 1 to 2 lamp cones, slow
  particles at 10 to 20 percent, vignette. High contrast under the hero, low behind text.
- Motion budget: hero idle, a 3 to 4 s sheen on PLAY, particles; transitions 150 to 250 ms; cards
  stagger 30 to 50 ms. Nothing else moves. Every tap clicks; PLAY hits harder (silent menus get
  called "bland" in reviews).

### What players downrate
Small buttons, buttons at edges and corners that miss, unreadable text, clutter, menu depth.
They praise consistent button placement and sizing and visible feedback on every tap.

## 3. Reference moodboard

`harness/evidence/T-13/refs/moodboard.html` (open through the dev server) shows store screenshots of
Bullet Echo, Brawl Stars, Stumble Guys, Shadow Fight 4 Arena, Mini Militia, Zooba, ROUNDS and Duck
Game. Key frames saved next to it:

- `bullet-echo-dark-arena.jpg`: a dark arena with one light cone, fog of war, thin outlined HUD
  circles, one condensed display font. Closest to our mechanic.
- `rounds-arena-lighting.jpg`: near-black blue with light shafts and dust, warm blocks, two
  characters in orange and blue as the only saturated objects. Closest to our arena.
- `brawl-stars-menu-ui.jpg`: chunky outlined buttons, big posed 3D hero overlapping panels,
  rounded display font. The "toon" alternative.

## 4. Three directions (mockups at 891x411)

`harness/evidence/T-13/mockups/menu-directions.html` renders the three menus with the real Three.js
rigs. Open with `?only=a`, `?only=b` or `?only=c`. Screenshots: `A-blackout-arena.jpg`,
`B-toon-brawl.jpg`, `C-neon-versus.jpg`.

| | A. Blackout Arena | B. Toon Brawl | C. Neon Versus |
|---|---|---|---|
| Lineage | Bullet Echo, ROUNDS, Hollow Knight menus | Brawl Stars, Stumble Guys | Lethal League, fighting-game posters |
| Look | Black, one spotlight on the hero, one mint-neon accent, thin glass panels, dust and vignette | Saturated purple, chunky outlined buttons, big posed hero on the right edge, confetti | Diagonal red-vs-blue split, condensed tall type, skewed neon FIGHT button, scanlines |
| Fonts | Chakra Petch + Inter | Lilita One + Nunito | Teko + Barlow |
| Fits the dark-arena promise | Yes, the menu is the arena before the lights go out | No, the menu promises a bright party game | Yes, and sells the duel |
| Fits the toon rigs | Yes when spotlit | Best | Yes |
| Art cost | Low: light, gradients, type, particles | High: needs painted backgrounds and posed renders per hero | Medium: two tinted halves, type, one seam |
| Risk | Could feel empty if motion and sound are weak | Generic; looks like every other brawler | Red/blue halves must stay colour-blind safe; diagonal layout is harder to adapt to tablets |

**Recommendation: A for the menu and the match, with C's split-half treatment for the result
screen.** A matches what the game actually is (a duel in the dark), it is cheap enough for a solo
team to finish at 5-star polish, and the reveal mechanic gives it a signature motion: the hero
flickers into the spotlight when you select it, exactly like a reveal in the match.

## 5. What changes if A is chosen

Menu (one screen, one tap to play):
- Left 42 percent: hero stage with spotlight cone, floor glow, rig at about 290 px tall, name in
  display caps 30 px, 4 dots, 44 px chevrons at the stage edges, swipe to switch. Switching plays a
  300 ms reveal flicker.
- Right: wordmark top-left (13 px tracked caps), 44 px sound button top-right; mode segmented
  control 48 px (VS BOT, VS FRIEND) with the sub-label inside; 4 roster chips 118 px tall with
  hero-colour disc and name; one PLAY button 64 px tall, mint fill, glow, "FIRST TO 5 KILLS" inside.
- Removed: the help line, hat names, "4 / 4", the empty preview strip. Defaults preselected, so a
  returning player taps once.

Match:
- Stage light, light shafts, grain and vignette on the black; platforms as outlined slabs with lit
  top edges and under-glow; dust motes.
- HUD as two compact top-corner pills, team colour as a 2 px bar, kills as the big number, deaths
  and dodges small. Under 8 percent of the height. Help text replaced by one-time coach marks.
- Reveals with rim light and floor spill; kill frame; tiered shake; bullet halos pre-rendered.

Result:
- Split halves in team colours, winner hero spotlit, loser dim; "CHONK WINS" in the winner's
  colour; three stat tiles; REMATCH primary, MENU secondary.

Shared:
- Tokens file (colours, type scale, spacing, motion durations) replaces hard-coded values across
  scenes. Fonts bundled as woff2 under `public/fonts/`.
- Menu SFX family (tick, confirm, back) and a haptic click on press.

## 6. Open decisions for the owner
1. Direction: A, B or C (or A with changes).
2. Accent colour for A: mint `#5ef0b8` (ties to Pudd), or electric cyan `#4de3ff`, or amber.
3. Team colours: keep red vs blue, or move to amber vs cyan (colour-blind safe, ROUNDS style).
4. Display font: Chakra Petch (technical) or Rajdhani (softer) or Michroma (wide, premium).
5. Order of work: menu first (owner's call), then match HUD and arena, then result, then motion and
   sound polish.
