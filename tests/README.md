# 🧪 tests/

Game integration and unit tests.

## Test Strategy

| Type | What | How |
|---|---|---|
| Unit | Math utils, pool, storage | Direct function calls, assert outputs |
| Unit | Physics calculations | Test gravity, friction, collision detection |
| Unit | Entity behavior | Test player movement, enemy AI decisions |
| Integration | Scene transitions | Test menu → game → pause → game over flow |
| Visual | Rendering | Manual browser inspection |
| E2E | Full gameplay | Play in browser, verify all systems work |

## Running Tests

```bash
npm run test          # Run unit tests via Vitest
npm run test:watch    # Watch mode
```

## File Convention

- `test_{module}.js` — tests for a specific module
- Example: `test_physics.js`, `test_pool.js`, `test_collision.js`
