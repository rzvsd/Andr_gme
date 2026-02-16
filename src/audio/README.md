# 🔊 audio/ — Audio Management

Sound effects and music playback. This module is fully decoupled — it only listens to EventBus events.

## Files

| File | Purpose |
|---|---|
| `AudioManager.js` | SFX playback — loads sound files, plays them on events, pools Audio elements to avoid lag |
| `MusicManager.js` | Background music — loops BGM tracks, handles fade in/out, responds to scene changes |

## Event-Driven Design

Audio never imports game entities or systems. It reacts to events:

```javascript
// AudioManager listens for gameplay events:
EventBus.on('bullet_fired', () => AudioManager.play('pew'));
EventBus.on('player_hit', () => AudioManager.play('hit'));
EventBus.on('enemy_killed', () => AudioManager.play('explosion'));
EventBus.on('bullet_dodged', () => AudioManager.play('whoosh'));
EventBus.on('wave_cleared', () => AudioManager.play('fanfare'));

// MusicManager listens for scene changes:
EventBus.on('scene_enter', (scene) => {
    if (scene === 'game') MusicManager.play('battle_bgm');
    if (scene === 'menu') MusicManager.play('menu_bgm');
});
```

## Audio Format

- **SFX:** `.webm` (Opus codec) with `.mp3` fallback
- **BGM:** `.webm` (Opus) with `.mp3` fallback
- All audio files stored in `public/audio/`
- Mobile browsers require a user gesture before playing audio — handled by first touch on menu
