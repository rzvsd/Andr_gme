# 🎬 scenes/ — Game Scenes (Screens)

Each scene is a self-contained game state. Only one scene is active at a time. The `Game` class manages transitions.

## Files

| File | Purpose |
|---|---|
| `MenuScene.js` | Title screen — logo, "Play" button, settings button, high scores |
| `GameScene.js` | Main gameplay — creates entities, runs systems, renders world + HUD |
| `PauseScene.js` | Pause overlay — semi-transparent overlay with Resume/Restart/Menu buttons |
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
MenuScene ──[tap Play]──► GameScene ──[tap Pause]──► PauseScene
                              │                          │
                              │ [player dies]        [tap Resume]
                              ▼                          │
                         GameOverScene ◄─────────────────┘
                              │
                         [tap Retry]──► GameScene
                         [tap Menu]──► MenuScene
```

## Important

`GameScene` is the heavyweight — it instantiates all entities, all systems, and orchestrates the gameplay loop. All other scenes are lightweight UI screens.
