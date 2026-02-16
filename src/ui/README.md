# 🖥️ ui/ — User Interface Components

Touch-friendly UI components for mobile gameplay. All UI renders on top of the game canvas.

## Files

| File | Purpose |
|---|---|
| `HUD.js` | In-game heads-up display — shows Bullets Dodged, Deaths, Kills, Wave, Score |
| `Button.js` | Touch button component — supports press/release states, touch areas, visual feedback |
| `Joystick.js` | Virtual analog joystick — renders a draggable circle, outputs x/y direction (-1 to 1) |
| `ScoreBoard.js` | End-game score panel — displays final stats, high score, formatted text |

## Touch Design Principles

1. **Big touch targets** — minimum 48x48dp (Android accessibility guideline)
2. **Left side = movement** — joystick in bottom-left (thumb-friendly for right-handed)
3. **Right side = actions** — jump and shoot buttons in bottom-right
4. **Visual feedback** — buttons change opacity/color when pressed
5. **No overlapping zones** — each touch area is exclusive

## Screen Layout

```
┌─────────────────────────────────────────────┐
│  HUD (top strip)                             │
│  ┌───────────┐              ┌──────────┐    │
│  │Dodged: 12 │              │ Wave: 3  │    │
│  │Deaths: 0  │              │Score:4500│    │
│  │Kills:  5  │              │          │    │
│  └───────────┘              └──────────┘    │
│                                              │
│            [GAME WORLD]                      │
│                                              │
│  ┌─────┐                      ┌───┐ ┌───┐  │
│  │  ◉  │  Joystick            │ A │ │ B │  │
│  │     │                      │JMP│ │SHT│  │
│  └─────┘                      └───┘ └───┘  │
└─────────────────────────────────────────────┘
```
