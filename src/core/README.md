# 🔧 core/ — Game Engine Core

The foundational engine layer. Everything else is built on top of these modules.

## Files

| File | Purpose |
|---|---|
| `Game.js` | Master game class — owns canvas, game loop (fixed timestep), scene manager, asset loading |
| `Input.js` | Abstracted input handler — translates touch events and keyboard into game actions |
| `Physics.js` | Physics engine — gravity, velocity integration, friction, AABB overlap tests |
| `Camera.js` | Viewport camera — follows target entity with smooth lerp, handles world-to-screen coords |
| `EventBus.js` | Pub/sub event system — decouples all modules; any module can emit/listen |

## Dependency Rule

**Core depends ONLY on `config/`.** Nothing in `core/` imports from `entities/`, `systems/`, `scenes/`, or `ui/`.

## Key Contracts

### Game Loop
```
Every frame:
  1. Input.poll()
  2. activeScene.update(dt)
  3. activeScene.render(ctx)
```

### EventBus API
```javascript
EventBus.on('event_name', callback)
EventBus.off('event_name', callback)
EventBus.emit('event_name', data)
```

### Input API
```javascript
Input.isDown('left')    // true while held
Input.isPressed('jump') // true once per press
Input.joystick          // { x: -1..1, y: -1..1 }
```
