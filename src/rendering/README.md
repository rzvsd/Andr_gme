# 🎨 rendering/ — Rendering Pipeline

All visual rendering utilities. These handle sprites, animation, particles, and backgrounds — but NOT game logic.

## Files

| File | Purpose |
|---|---|
| `SpriteSheet.js` | Loads an image, slices it into frames by grid (rows × cols), returns frame rectangles |
| `Animator.js` | Plays frame sequences at defined FPS — supports play, loop, stop, onComplete callback |
| `ParticleEmitter.js` | Lightweight particle system — creates short-lived particles for explosions, smoke, sparks |
| `Background.js` | Multi-layer parallax scrolling background — layers move at different speeds |

## Rendering Order (Back to Front)

```
1. Background.render()      — sky, clouds (parallax layers)
2. Platform.render()        — ground blocks
3. Entity.render()          — enemies, bullets, player (sorted by y if needed)
4. ParticleEmitter.render() — effects on top of entities
5. HUD.render()             — UI overlay (always on top)
```

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
- Bullet sprites: 16×8 pixels
- Particle sprites: 8×8 pixels
