# 🎮 GAME DESIGN DOCUMENT — Bullet Dodge Arena

## 1. Game Overview

**Title:** Bullet Dodge Arena  
**Genre:** 2D Action Shooter / Platformer  
**Platform:** Android (mobile-first)  
**Target Audience:** Casual gamers, ages 12+  
**Session Length:** 2–5 minutes per round  

### Elevator Pitch
A fast-paced 2D arena shooter where you dodge a relentless hail of bullets while trying to eliminate AI opponents. Jump between platforms, time your shots, and survive increasingly brutal waves. Simple to learn, hard to master.

---

## 2. Core Gameplay Loop

```
┌──────────────┐
│  SPAWN IN    │
│  ARENA       │
└──────┬───────┘
       ▼
┌──────────────┐
│  DODGE       │◄──────────────┐
│  BULLETS     │               │
└──────┬───────┘               │
       ▼                       │
┌──────────────┐               │
│  SHOOT AT    │               │
│  ENEMIES     │               │
└──────┬───────┘               │
       ▼                       │
┌──────────────┐    YES        │
│  WAVE        ├───────────────┘
│  CLEARED?    │
└──────┬───────┘
       │ DEAD
       ▼
┌──────────────┐
│  GAME OVER   │
│  SCORE BOARD │
└──────────────┘
```

---

## 3. Game Mechanics

### 3.1 Player Controls (Touch)
| Control | Action |
|---|---|
| Left virtual joystick | Move left/right |
| Right button (A) | Jump |
| Right button (B) | Shoot |
| Swipe up | Quick jump |
| Tap anywhere (alt mode) | Shoot toward tap |

### 3.2 Player Abilities
- **Movement:** Run left/right on platforms (speed: 200px/s)
- **Jump:** Single jump with gravity (height: ~3 tiles)
- **Double Jump:** Unlocked after Wave 5
- **Shoot:** Fire horizontal bullet in facing direction (cooldown: 300ms)
- **Dash:** Quick dodge, 0.2s invincibility (unlocked Wave 10)

### 3.3 Physics
- **Gravity:** 980 px/s² (Earth-like feel)
- **Friction:** Ground friction 0.85, air friction 0.98
- **Collision:** AABB rectangle collision detection
- **Platforms:** Solid ground, can't fall through (no drop-through for v1)

### 3.4 Enemies
| Type | Behavior | HP | First Appears |
|---|---|---|---|
| **Grunt** | Walks back and forth, shoots randomly | 1 | Wave 1 |
| **Sniper** | Stands still, aims at player, long-range | 2 | Wave 3 |
| **Rusher** | Charges at player, melee damage | 1 | Wave 5 |
| **Tank** | Slow, heavy, fires spread shots | 5 | Wave 8 |
| **Boss** | Large, pattern-based attacks | 20 | Wave 10, 20, 30 |

### 3.5 Bullets
- **Player bullets:** Speed 500px/s, damage 1, blue color
- **Enemy bullets:** Speed 300px/s, damage 1, red/yellow color
- **Spread shot:** 3 bullets in a fan pattern (Tank enemy)
- **All bullets despawn** when off-screen or hitting a surface

### 3.6 Scoring
| Event | Points |
|---|---|
| Bullet dodged (near miss) | +10 |
| Enemy killed | +100 |
| Wave cleared | +500 |
| No-damage wave bonus | +1000 |
| Death | -0 (just ends game) |

### 3.7 HUD Display
- **Top-left:** Bullets Dodged counter, Deaths, Kills (as shown in reference)
- **Top-right:** Wave number, Score
- **Bottom-left:** Virtual joystick
- **Bottom-right:** Jump (A) and Shoot (B) buttons
- **Center:** Wave announcement text (fades in/out)

---

## 4. Visual Design

### 4.1 Art Style
- **2D pixel art / cartoon hybrid** (matching reference screenshot)
- **Characters:** ~32x48px sprites with idle, run, jump, shoot, death animations
- **Color palette:** Muted background (sky blues, soft pinks) with vibrant character/bullet colors
- **Platforms:** Solid dark green blocks (as in reference)
- **Background:** Gradient sky with subtle parallax clouds

### 4.2 Screen Layout
```
┌─────────────────────────────────────────────┐
│ [STATS P1]              [WAVE] [SCORE]      │
│  Bullets: 6              Wave 3   4500      │
│  Deaths: 0                                   │
│  Kills: 2                                    │
│                                              │
│         ☁                    ☁               │
│                                              │
│              🧍←→         →💨  🧟            │
│         ████████████    ████████████         │
│                                              │
│    ████████                    ████████      │
│                                              │
│ ████████████████████████████████████████████ │
│                                              │
│  [JOYSTICK]              [A jump] [B shoot] │
└─────────────────────────────────────────────┘
```

### 4.3 Animations
| Entity | Animations |
|---|---|
| Player | idle (4f), run (6f), jump (2f), shoot (3f), hit (2f), death (4f) |
| Grunt | idle (4f), walk (6f), shoot (3f), death (4f) |
| Sniper | idle (4f), aim (2f), shoot (3f), death (4f) |
| Bullet | fly (2f), impact (3f) |
| Effects | explosion (5f), smoke (4f), muzzle flash (2f) |

---

## 5. Game Flow

### 5.1 Screens
1. **Splash Screen** → Logo + "Tap to Start"
2. **Main Menu** → Play, Settings, High Scores
3. **Gameplay** → The arena with HUD
4. **Pause Overlay** → Resume, Restart, Main Menu
5. **Game Over** → Score summary, Retry, Main Menu
6. **Settings** → Sound on/off, Music on/off, Controls layout

### 5.2 Wave Progression
- **Waves 1-3:** 1 Grunt per wave, slow bullets
- **Waves 4-6:** 2 Grunts + 1 Sniper, medium bullets
- **Waves 7-9:** 3 enemies mixed, fast bullets
- **Wave 10:** BOSS wave (mini-boss)
- **Waves 11+:** Escalating difficulty, every 10th wave = boss
- **Endless mode:** No cap, difficulty asymptotes

---

## 6. Audio Design

| Type | Description |
|---|---|
| **BGM** | Upbeat chiptune/electronic loop, ~120bpm |
| **Jump SFX** | Short bouncy "boing" |
| **Shoot SFX** | Quick "pew" laser sound |
| **Hit SFX** | Dull impact thud |
| **Death SFX** | Dramatic explosion + defeat jingle |
| **Wave Clear** | Victory fanfare (short) |
| **Near Miss** | Quick "whoosh" when bullet passes close |
| **Menu Click** | Soft UI click |

---

## 7. Monetization (Future)

- **None for v1** — pure gameplay
- Potential: rewarded ads for extra lives, cosmetic skins

---

## 8. Performance Targets

| Metric | Target |
|---|---|
| Frame Rate | 60 FPS |
| Draw Calls | < 50 per frame |
| Memory | < 100MB |
| Load Time | < 2 seconds |
| APK Size | < 15MB |
| Min Android | API 24 (Android 7.0) |
