# 🖥️ ui/ — User Interface Components

Touch-friendly UI components for mobile gameplay. All UI renders on top of the game canvas.

## Files

| File | Purpose |
|---|---|
| `VersusHUD.js` | Match HUD — two score pills (kills, deaths, dodged), shot pips, FIRST TO 5 label, mute button, SHOOT button (VS BOT) |
| `VersusPauseOverlay.js` | Pause screen — RESUME, QUIT TO MENU, SFX and MUSIC toggles over the recoloured frame |
| `uiUtils.js` | Shared helpers — number parsing, clamp, pointer input, rounded rects, number format |

## Touch Design Principles

1. **Big touch targets** — minimum 48x48dp (Android accessibility guideline)
2. **Left zone = movement** — drag to move, swipe up to jump, swipe down to drop
3. **Right zone = shooting** — VS BOT draws a SHOOT button bottom-right
4. **Visual feedback** — buttons change opacity/color when pressed
5. **No overlapping zones** — each touch area is exclusive

## Screen Layout

```
┌─────────────────────────────────────────────┐
│ ┌───────────┐                 ┌───────────┐ │
│ │ 3  D1 Dg4 │  FIRST TO 5 (M) │ 1  D3 Dg2 │ │
│ └───────────┘                 └───────────┘ │
│   ■ ■ ■  shots               shots  ■ ■ ■   │
│                                             │
│                [GAME WORLD]                 │
│                                             │
│  move zone                     SHOOT zone   │
│  drag: move                    ┌───────┐    │
│  swipe: jump / drop            │ SHOOT │    │
│                                └───────┘    │
└─────────────────────────────────────────────┘
```

Shown: VS BOT. Pills show kills (big), deaths (D) and dodged (Dg). (M) is the mute button.
In VS FRIEND there is no SHOOT button: the left zone is P1's, the right zone is P2's,
and a tap or hold in a zone fires.
