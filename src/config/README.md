# ⚙️ config/ — Game Configuration

All tunable game constants and user settings live here. No logic — just data.

## Files

| File | Purpose |
|---|---|
| `constants.js` | Immutable game constants (canvas size, gravity, speeds, colors, wave definitions) |
| `settings.js` | Mutable user settings (sound on/off, music volume, control scheme) loaded from localStorage |

## Usage

```javascript
import { CANVAS_WIDTH, GRAVITY, PLAYER_SPEED } from '../config/constants.js';
import { Settings } from '../config/settings.js';
```

## Why Separate?

Centralizing all magic numbers here means:
- Easy balancing/tuning without touching game logic
- Settings can be saved/loaded from device storage
- Agent 2 (Gameplay) tweaks `constants.js` to balance difficulty without touching Agent 1's code
