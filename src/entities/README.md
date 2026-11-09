# 🎮 entities/ — Game Entities

All game objects that exist in the world. Each entity knows how to update itself and render itself.

## Files

| File | Purpose |
|---|---|
| `Entity.js` | Base class — position (x,y), velocity (vx,vy), dimensions (w,h), active flag, update/render stubs |
| `Player.js` | Player character — movement, jumping, shooting, animation states, health |
| `Bullet.js` | Projectile — direction, speed, owner (the player who fired), damage, poolable |
| `Platform.js` | Static ground — rectangular collision body, renders as green block tile |

## Entity Lifecycle

```
1. SPAWN  → entity.active = true, set position
2. UPDATE → entity.update(dt) each frame
3. RENDER → entity.render(ctx, camera) each frame
4. DEATH  → entity.active = false, return to pool (or destroy)
```

## Base Entity Interface

Every entity implements:
```javascript
class Entity {
    x, y            // World position
    vx, vy          // Velocity
    width, height   // Bounding box
    active           // Is alive/visible
    
    update(dt) {}    // Per-frame logic
    render(ctx, camera) {} // Draw to canvas
    getBounds() {}   // Returns {x, y, w, h} for collision
}
```
