# T-13 evidence: visual audit of the current build (2026-10-30 23:20)

Viewport 891x411 CSS px = Galaxy S24 Ultra in landscape at dpr 3.5. Screenshots in `audit/`.

## Menu (`audit/menu-891x411.jpg`)
1. Text collides: the MATCH MODE label sits on the top edge of the mode buttons; HUMAN VS BOT and its
   BOT DUEL sub-label overlap by a few px; PVP crowds HUMAN VS HUMAN. (owner: "scrisul e incalecat")
2. No hierarchy: START DUEL, SFX and MUSIC are three equal boxes. The primary action is not the
   biggest or brightest thing on screen (DESIGN.md "one main action per screen" fails).
3. Every element is the same flat navy box with the same 2 px border. No depth, no glow, no
   selected-state beyond a thin green outline.
4. Roster grid is 3 + 1: Vector sits alone on a second row next to an empty slot.
5. Hero preview panel has an empty grey strip at the top (placeholder never filled), heavy border,
   and floating < > buttons. The rig is cropped by the panel bottom at this height.
6. Helper line at the bottom (P1: A/D move ... Touch: drag move ...) is keyboard help on a phone,
   sits in the gesture-bar zone, and is the smallest text on screen (~11 px).
7. Meta text "4 / 4 . FLAT SHAPES" and hat names (BUCKET HAT, BEANIE) explain nothing a player needs.
8. Title is a plain bold system sans, no identity, no relation to the dark-arena theme.
9. Spacing is uneven: 8 px card gaps, 12 px panel margins, 6 px label offsets, title not aligned to
   either column.

## Match (`audit/match-891x411-*.jpg`)
1. HUD panels are two pastel slabs (pink and lavender) that take 40 percent of the screen height, in
   Comic Sans; the labels are longer than the numbers are important.
2. Arena is two thin grey rectangles on black with nothing else: no depth, no atmosphere, no
   ambient particles or vignette. The intended "dark arena" reads as "unfinished".
3. Help text (Drag: move . Swipe up: jump ...) sits in the gesture-bar zone again.
4. Revealed rigs look flat (orthographic camera, unlit toon shading) and small (about 60 px tall on a
   411 px screen).

## Result (`audit/emulator-result-1280x720.png`)
1. Readable, but generic: one bordered box, two flat buttons, no winner moment (no hero, no colour,
   no motion).

## Verdict
The game is functionally complete (A-01 to A-07) but visually at prototype level. The menu is the
first thing a player sees and it fails four of the six global design rules (one main action, no
explaining, no help text, eyes go where they need to). This is the gap between "playable" and
"5 stars".
