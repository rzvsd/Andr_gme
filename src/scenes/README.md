# 🎬 scenes/ — Game Scenes (Screens)

Each scene is a self-contained game state. Only one scene is active at a time. The `Game` class manages transitions.

## Files

| File | Purpose |
|---|---|
| `MenuScene.js` | Title screen — logo, "Play" button, settings button, high scores |
| `VersusGameScene.js` | Versus match — creates fighters and systems, runs the match, owns the pause overlay |
| `GameOverScene.js` | Death screen — final score, stats summary, Retry and Menu buttons |

## Scene Interface

Every scene implements:
```javascript
class Scene {
    enter()           // Called when scene becomes active (setup)
    exit()            // Called when leaving scene (cleanup)
    update(dt)        // Per-frame logic
    render(ctx)       // Per-frame drawing
    handleInput(input) // Process input state
}
```

## Scene Flow

```
MenuScene ──[tap Play]──► VersusGameScene ──[5 kills]──► GameOverScene
                                 │                            │
                                 │ [Back / Esc]         [tap Rematch]──► VersusGameScene
                                 ▼                      [tap Menu]──► MenuScene
                        VersusPauseOverlay (overlay, not a scene)
                          [tap Resume]──► VersusGameScene
                          [tap Quit to Menu]──► MenuScene
```

## Important

`VersusGameScene` is the heavyweight — it creates the fighters, bullets and systems, and runs the match. It splits the work across the modules in `versus/`. Pause is an overlay inside it (`src/ui/VersusPauseOverlay.js`), not a scene. All other scenes are lightweight UI screens.
