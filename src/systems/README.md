# ⚡ systems/ — Game Systems

Systems operate on collections of entities each frame. They contain the "verbs" — the logic that makes things happen.

## Files

| File | Purpose |
|---|---|
| `PhysicsSystem.js` | Applies gravity, integrates velocity, applies friction to all entities |
| `CollisionSystem.js` | Checks AABB overlaps, resolves entity-platform collisions, emits hit events |
| `AISystem.js` | Updates enemy behavior per frame (patrol, aim, chase, shoot decisions) |
| `SpawnSystem.js` | Manages waves — what enemies spawn, when, where. Escalates difficulty |
| `ScoreSystem.js` | Listens to events (kills, dodges, waves) and maintains the score state |

## System Update Order

Order matters! Each frame in gameplay:
```
1. AISystem.update(dt)        — enemies decide actions
2. PhysicsSystem.update(dt)   — apply forces & movement
3. CollisionSystem.update(dt) — detect & resolve overlaps
4. SpawnSystem.update(dt)     — check wave state, spawn enemies
5. ScoreSystem.update(dt)     — tally score from events
```

## Communication

Systems communicate through **EventBus**, never by directly calling each other:
```javascript
// CollisionSystem detects a hit:
EventBus.emit('player_hit', { damage: 1 });

// ScoreSystem listens:
EventBus.on('enemy_killed', (data) => { this.kills++; });
```
