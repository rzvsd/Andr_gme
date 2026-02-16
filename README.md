# 🎮 Bullet Dodge Arena

> A fast-paced 2D action shooter for Android — dodge bullets, shoot enemies, survive the arena.

## Tech Stack

| Layer | Technology |
|---|---|
| Game Engine | HTML5 Canvas (custom) |
| Language | JavaScript (ES Modules) |
| Build Tool | Vite |
| Android Wrapper | Capacitor |
| Art Style | Pixel-art / Cartoon sprites |

## Quick Start

```bash
npm install
npm run dev        # Launch dev server at localhost:5173
npm run build      # Production build
npx cap sync       # Sync to Android
npx cap open android  # Open in Android Studio
```

## Game Concept

Two warriors face off on platforms. Bullets fly from all directions. Dodge, jump, shoot — last one standing wins. Progressive waves increase difficulty with faster bullets, smarter AI, and tighter arenas.

## Project Structure

```
Andr_gme/
├── docs/           # Design docs, architecture, agent roles
├── src/            # All game source code
│   ├── config/     # Constants & settings
│   ├── core/       # Game loop, physics, input, camera
│   ├── entities/   # Player, enemy, bullet, platform
│   ├── systems/    # Render, collision, AI, scoring
│   ├── scenes/     # Menu, gameplay, pause, game over
│   ├── ui/         # HUD, buttons, joystick
│   ├── rendering/  # Sprites, animation, particles
│   ├── audio/      # Sound & music managers
│   └── utils/      # Math, pooling, storage helpers
├── public/         # Static assets (sprites, audio, fonts)
├── android/        # Capacitor-generated Android project
└── tests/          # Integration & unit tests
```

## Parallel Agent Roles

This project is architected so independent agents can work simultaneously:

| Agent | Owns | Folder |
|---|---|---|
| 🔧 Engine Agent | Game loop, physics, input | `src/core/` |
| 🎮 Gameplay Agent | Entities, AI, scoring | `src/entities/` + `src/systems/` |
| 🎨 Render Agent | Sprites, animation, particles | `src/rendering/` |
| 🖥️ UI Agent | HUD, menus, touch controls | `src/ui/` + `src/scenes/` |
| 🔊 Audio Agent | SFX, music, volume | `src/audio/` |
| 📱 Platform Agent | Android build, optimization | `android/` |
| 🖼️ Art Agent | Sprites, backgrounds, fonts | `public/` |

## License

Private project.
