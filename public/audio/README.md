# audio/

Audio assets for SFX and music.

## Playback Policy (synth-first)

- **SFX** (`sfx_shoot`, `sfx_hit`, `sfx_explosion`, `sfx_whoosh`, `sfx_click`,
  `sfx_jump`, `sfx_fanfare`, `sfx_death`) are synthesized at runtime with WebAudio
  (`AudioManager` presets). No audio files are needed for them, and the old zoo
  of 25 identical silent placeholder `.wav` files was deleted in M16.
- **BGM** (`bgm_menu`, `bgm_battle`, `bgm_pause`, `bgm_gameover`) has no synth
  fallback yet: `MusicManager` plays files when present and stays silent
  (one warning per track) when absent.

## The One Placeholder

- `silence.wav` is the single canonical silent file, kept only so the loader
  has a valid source to probe during development. Do not duplicate it per name.

## Adding Real Assets

Drop real files here using the preferred names with any of `.wav`, `.webm`,
or `.mp3` (loader tries them in that order). Legacy aliases still resolve:

- SFX aliases: `pew`, `hit`, `explosion`, `whoosh`, `fanfare`, `ui_click`,
  `jump`, `death`
- BGM aliases: `menu_bgm`, `battle_bgm`, `pause_bgm`, `game_over_bgm`,
  `bgm_game_over`
