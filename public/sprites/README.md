# sprites/

Phase 6 placeholder sprite assets for Phase 7 wiring.

These files are temporary and exist only to keep loading/rendering contracts stable until final art is delivered.

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
