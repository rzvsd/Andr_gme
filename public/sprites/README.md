# sprites/

Active sprite assets for the current fruit-combat theme.

## Option C Loading Behavior

Option C should attempt to load assets from `manifest.json` first.
If any sprite fails to load or is missing, fallback rendering should be used (primitive shapes/colors) so gameplay remains functional.

## Player Animation Contract

`player_sheet.svg` currently reserves frames for these animation names:

- `idle`
- `run`
- `jump`
- `fall`

## Manifest

Use `manifest.json` as the source of truth for sprite names, paths, and intended usage.
