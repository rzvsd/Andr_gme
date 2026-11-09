# ⚡ systems/ — Game Systems

Systems operate on collections of entities each frame. They contain the "verbs" — the logic that makes things happen.

## Files

| File | Purpose |
|---|---|
| `PhysicsSystem.js` | Applies gravity, integrates velocity, applies friction to all entities |
| `VersusCollisionSystem.js` | Grounds fighters on platforms, blocks bullets, detects hits and dodges, emits `versus:*` events |

## System Update Order

Order matters! Each frame of a versus match (`VersusGameScene.stepSimulation`):
```
1. Input                            — fighters move, jump, fire (VS BOT: VersusBotController drives P2)
2. PhysicsSystem.update(dt)         — apply forces & movement
3. VersusCollisionSystem.update(dt) — platforms, bullet hits, dodges; emits events
4. VersusRoundManager.update(dt)    — respawn timers (stats come from the events)
```

## Communication

Systems communicate through **EventBus**, never by directly calling each other:
```javascript
// VersusCollisionSystem detects a hit:
EventBus.emit('versus:player_hit', { shooterIndex, targetIndex, damage, isFatal });

// VersusRoundManager listens:
EventBus.on('versus:kill', (data) => { stats[data.killerIndex].kills++; });
```
