# 📁 src/ — Source Code

All game source code lives here, organized by responsibility.

## Structure

```
src/
├── main.js          # Entry point — creates Game instance, starts loop
├── config/          # Constants & user settings
├── core/            # Engine fundamentals (loop, input, physics, camera, events)
├── entities/        # Game objects (player, enemies, bullets, platforms)
├── systems/         # Per-frame logic systems (physics, collision, AI, spawning, scoring)
├── scenes/          # Screen states (menu, gameplay, pause, game over)
├── ui/              # Touch controls & HUD components
├── rendering/       # Sprite sheets, animation, particles, backgrounds
├── audio/           # Sound & music managers
└── utils/           # Math helpers, object pooling, local storage
```

## Entry Point

`main.js` is the single entry point. It:
1. Creates the canvas element
2. Instantiates the `Game` class
3. Registers all scenes
4. Starts the game loop

## Module Rules

- Every module uses **ES Module imports/exports**
- No circular dependencies — dependency flow is always: `config → core → entities → systems → scenes`
- Cross-module communication uses **EventBus**, not direct imports between sibling modules
