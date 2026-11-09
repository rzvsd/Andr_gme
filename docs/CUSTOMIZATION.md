# Customization — Blind Duel characters

Decision (2026-10-30): the roster family is **Pudd, Chonk, Ninja** (one rig, one style).
Players personalize on top of a body. Every layer is data; nothing touches physics.

## Layers

| Layer | What it changes | v1 count | Where it lives |
|---|---|---|---|
| Body | silhouette, face, tells, sound | 3 | `characterDef.js` → `ROSTER` |
| Hat | the silhouette prop; lags the body, flies off on KO | 6 | `cosmetics.js` → `HATS` |
| Colors | body + shade + hat accent + glow; bullet trail follows body color | 6 | `cosmetics.js` → `PALETTES` |
| Face preset | eye/mouth marks (deadpan, grin, shades…) | 2 | planned: `FACES`, merged into `shape` + `palette` |
| Motion preset | wobble, breathing, squash, lean (alive layer only) | 4 | planned: `MOTION`, merged into `motion`; today exposed as lab sliders |
| Taunt | the risk/reward emote; lights the eyes in the dark | 3 | planned: `TAUNTS`, name → face state + sound + tell |
| KO style | how the loser flops; stays on the results screen | 3 | planned: `KOS`, name → flop curve + hat behaviour + sound |

Combinations in v1: 3 × 6 × 6 × 2 × 4 × 3 × 3 = **7 776 looks** from about 25 small data objects.

## Data shape

```js
// what a player owns and wears
Loadout { body: "pudd", hat: "beanie", colors: "lemon", face: "deadpan", motion: "jelly", taunt: "slowblink", ko: "flop" }

// equipping = merging layers onto the body def
def = composeDef(ROSTER[body], { hat, palette: colors })   // today
def = composeDef(ROSTER[body], loadout)                     // once the other layers exist
```

`composeDef` returns a frozen `CharacterDef`; the rig, alive layer and tell system never know a loadout exists.
Flat art (`original` sprite, `vector` redraw) draws its own clothes, so `wearableLayers()` reports hat/colors as not wearable and the lab disables those pickers.

## Guardrails

- **Hitbox is the body's, always.** Hats and arms are cosmetic. Same movement kit for every body.
- **Readable in the dark.** Every palette `body` keeps relative luminance ≥ 0.25, so a tell and the bullet trail read on black. Enforce in a test when palettes become user-made.
- **Tells stay per body.** A hat can change the brim tell's shape, never its timing. Identity in the dark = tells + trail color + one sound.
- **One gag per body.** Cosmetics add to the silhouette; they do not add a second idea. Reject hats taller than the body.
- **No stat effects, ever.** The TowerFall lesson: mechanically different characters cannot be balanced for a casual 1v1.

## Unlock flow (v1)

1. Everyone starts with the 3 bodies, 1 hat each, their own colors, deadpan face, default motion, 1 taunt, 1 KO.
2. Each match pays out **1 token** to the loser and **2** to the winner. A "Blind shot!" KO (shooter had no tell from the target in the last 2 s) pays **+1**.
3. Items cost 5 (colors), 8 (hat, face), 10 (motion, taunt, KO). Nothing is random; the shop shows everything, locked items greyed with their price.
4. Loadout saves locally (one slot per body) and sits on the result screen next to the KO replay, so the look is what gets screenshotted.

Deferred: paid cosmetics, trading, user-made palettes (needs the luminance test), seasonal hats.

## In the lab today

`hero-lab.html?hero=<body>&hat=<hat>&colors=<palette>` — the three pickers rebuild the hero live; the URL follows, so a look is shareable as a link.
Sliders Wobble / Breathing / Squash are the motion layer in raw form.
