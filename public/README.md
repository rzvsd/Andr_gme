# 📦 public/ — Static Assets

All static files served directly to the browser. Organized by asset type.

## Structure

```
public/
├── sprites/    # Character, enemy, bullet, platform sprite sheets (PNG)
├── audio/      # Sound effects and music (WEBM + MP3 fallback)
├── fonts/      # Custom game font files (WOFF2)
└── levels/     # Level configuration JSON files
```

## Asset Naming Convention

- Sprites: `{entity}_{animation}.png` (e.g., `player_run.png`, `grunt_idle.png`)
- Audio SFX: `sfx_{name}.webm` (e.g., `sfx_shoot.webm`, `sfx_explosion.webm`)
- Audio BGM: `bgm_{name}.webm` (e.g., `bgm_battle.webm`, `bgm_menu.webm`)
- Fonts: `{font_name}.woff2` (e.g., `press_start.woff2`)

## Important

These files are loaded at runtime via `fetch()` or `new Image()`. Keep total asset size under 10MB for fast mobile loading. Use compressed PNG for sprites (indexed color where possible).
