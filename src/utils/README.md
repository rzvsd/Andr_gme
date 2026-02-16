# 🔨 utils/ — Utility Helpers

Standalone utility functions with zero game-specific dependencies. Any module can import these.

## Files

| File | Purpose |
|---|---|
| `math.js` | Math helpers — `clamp()`, `lerp()`, `randomRange()`, `distance()`, `angleBetween()` |
| `pool.js` | Generic object pool — pre-allocate N objects, `acquire()` and `release()`, zero GC |
| `storage.js` | LocalStorage wrapper — `save(key, data)`, `load(key)`, JSON serialization, fallback handling |

## Object Pool Usage

```javascript
import { ObjectPool } from '../utils/pool.js';
import { Bullet } from '../entities/Bullet.js';

const bulletPool = new ObjectPool(() => new Bullet(), 200);

// Get a bullet from pool
const bullet = bulletPool.acquire();
bullet.init(x, y, direction, speed);

// Return when done
bulletPool.release(bullet);
```

## Why Pool?

Without pooling, firing 10 bullets/second = 600 object allocations per minute = GC stutters on mobile. With pooling: 0 allocations during gameplay.
