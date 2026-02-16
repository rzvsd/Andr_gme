# 🗺️ levels/

Level configuration data in JSON format. Defines platform layouts and spawn points per wave.

## Format

```json
{
  "name": "Arena 1",
  "platforms": [
    { "x": 0, "y": 550, "width": 800, "height": 50 },
    { "x": 100, "y": 400, "width": 200, "height": 20 },
    { "x": 500, "y": 350, "width": 200, "height": 20 }
  ],
  "playerSpawn": { "x": 100, "y": 500 },
  "enemySpawns": [
    { "x": 600, "y": 300 },
    { "x": 700, "y": 500 }
  ]
}
```

## Expected Files

- `arena_1.json` — Main arena layout (matching reference screenshot)
- `arena_2.json` — Second arena variant (unlocked at wave 10)
- `arena_3.json` — Third arena (unlocked at wave 20)
