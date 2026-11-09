# 🎨 rendering/ — Rendering Pipeline

All visual rendering utilities. These handle sprites, animation, and particles — but NOT game logic.

## Files

| File | Purpose |
|---|---|
| `SpriteSheet.js` | Loads an image, slices it into frames by grid (rows × cols), returns frame rectangles |
| `Animator.js` | Plays frame sequences at defined FPS — supports play, loop, stop, onComplete callback |
| `ParticleEmitter.js` | Lightweight particle system — creates short-lived particles for explosions, smoke, sparks |

## Rendering Order (Back to Front)

The versus match draws in this order (`src/scenes/versus/versusRenderer.js`):
```
1. Backdrop sprite          — black arena, stage light, platforms (pre-rendered)
2. Slab flashes             — platform edges lit by landings and bullet hits
3. Bullets                  — pre-rendered halos and trails
4. Fighters                 — reveal effects; 2D fallback fighter without WebGL
5. Particles                — ParticleEmitter effects on top of fighters
6. Overlay + kill frame     — vignette; arena dim on a kill
7. VersusHUD.render()       — UI overlay (always on top)
```
The Three.js fighter rigs draw on their own canvas above this one.

## Sprite Sheet Convention

All sprite sheets are horizontal strips:
```
┌──────┬──────┬──────┬──────┬──────┬──────┐
│ Idle │ Idle │ Run  │ Run  │ Run  │ Run  │ ...
│  0   │  1   │  0   │  1   │  2   │  3   │
└──────┴──────┴──────┴──────┴──────┴──────┘
  32px   32px   32px   32px   32px   32px
```
- Frame size: 32×48 pixels (character sprites)
