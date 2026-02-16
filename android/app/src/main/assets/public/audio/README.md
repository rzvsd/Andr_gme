# audio/

Audio assets for SFX and music.

## Naming Contract

Preferred names used by the code:

- `sfx_shoot`
- `sfx_hit`
- `sfx_explosion`
- `sfx_whoosh`
- `sfx_fanfare`
- `sfx_click`
- `sfx_jump`
- `sfx_death`
- `bgm_menu`
- `bgm_battle`
- `bgm_pause`
- `bgm_gameover`

Legacy aliases are also supported for backward compatibility:

- `pew`, `hit`, `explosion`, `whoosh`, `fanfare`, `ui_click`, `jump`, `death`
- `menu_bgm`, `battle_bgm`, `pause_bgm`, `game_over_bgm`, `bgm_game_over`

## File Formats

The loader tries `.wav`, `.webm`, and `.mp3` for each sound name.

This folder currently includes small placeholder `.wav` files for all names above so the runtime has valid sources even before final audio production assets are added.
