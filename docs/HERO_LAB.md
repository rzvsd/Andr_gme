# Hero Lab — Blind Duel character work

Branch `worktree-design-hero-character`. Isolated from the current game: nothing under
`src/scenes`, `src/core`, `src/entities` or `src/systems` is touched.

## Run
```bash
npm run lab
```
Opens `hero-lab.html` (Vite, port 5173). Keyboard: A/D move, W jump, J shoot.
Buttons: Hit, KO, Win, Taunt, Reset, **Lights off** (the Blind Duel arena).
`hero-lab.html?hero=<id>` loads another roster character (`pudd`, `chonk`, `ninja`, `original`, `vector`).
`&hat=<id>&colors=<id>` equips a hat and a palette from `src/hero/cosmetics.js`; the Body / Hat / Colors pickers do the same live. See `docs/CUSTOMIZATION.md`.
`hero-gallery.html` shows the whole roster side by side; click a name to open it in the lab.

## Roster (all data in `characterDef.js`, same rig code)
| Id | Look |
|---|---|
| `pudd` | Mint pill in a coral bucket hat. The locked hero direction. |
| `chonk` | Wide lavender blob in a mustard beanie. |
| `ninja` | Built towards `project overview/game pictures/expectation.png`: big hooded head, green mask, angry white eyes, headband with tail, wrapped arms, red shoes, yellow-green blaster, blue bullets. |
| `original` | The screenshot fighter itself: `src/hero/assets/ref_fighter.png` (80 × 100 px, sky keyed out) is cut out of `expectation.png` and drawn as a flat sprite on the shared rig. Blurry when large, by nature. |
| `vector` | The screenshot fighter redrawn as flat vector shapes (`src/hero/vectorFighter.js`): sharp at any size, headband and ribbon lag, bead arms swing, eyes blink and flash. |

## Files
| File | Role |
|---|---|
| `src/hero/characterDef.js` | Data-only definitions: palette, shape, motion numbers, tells, bullet, sounds. `ROSTER` lists them. |
| `src/hero/buildCharacter.js` | Procedural Three.js rig from a def: toon material, inverted-hull outlines, instanced noodle arms, optional separate head / headband tail / brows / pupils. ~10 draw calls per hero. |
| `src/hero/gallery.js` | Roster view: every def built once, idle, with the lights toggle. |
| `src/hero/aliveLayer.js` | Procedural life: breathing, squash/stretch spring, lean, lagging hat, Verlet arms, blinks and face states. |
| `src/hero/tells.js` | Dark-arena reveal system. Lights named parts for N ms on shoot / land / hit / KO / taunt. |
| `src/hero/sounds.js` | WebAudio one-shots under 300 ms (pip, blub, boing, splat, pop). |
| `src/hero/bible.js` | Renders the character bible from the def so doc and hero never disagree. |
| `src/hero/heroLab.js` | The sandbox: stage, physics, bullets, moments (hit-stop + slow-mo KO), UI. Exposes `window.__heroLab` with `step(dt)` for deterministic checks. |

## Verified (desktop Chrome, browser pane)
- Lit: 16 draw calls with hero + bullets + stage.
- Dark: hero fully hidden; shoot shows eyes + brim for 120 ms; landing shows a puff for 100 ms; KO lights the whole body during hit-stop.
- KO: body flops onto the platform, hat flies off and lands flat beside it.
- `npm test` and `npm run build` pass (both pages build).

## Not done yet
- Real-device fps (see the perf-spike task).
- Clip export (ring buffer → 9:16 replay → WebCodecs MP4).
- Second `CharacterDef` to prove the roster path.
