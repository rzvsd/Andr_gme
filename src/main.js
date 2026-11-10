import { Game } from "./core/Game.js";
import { loadSettings } from "./config/settings.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { TowerScene } from "./scenes/TowerScene.js";
import { GameOverScene } from "./scenes/GameOverScene.js";
import { AudioManager } from "./audio/AudioManager.js";
import { MusicManager } from "./audio/MusicManager.js";
import { loadGameFonts } from "./theme/fonts.js";

function boot() {
  const canvas = document.getElementById("game-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Expected a <canvas id="game-canvas"> element.');
  }

  const game = new Game(canvas);
  // Dev FPS overlay (A-08): http://localhost:5173/?fps=1, or triple-tap the top-left corner.
  game.fpsOverlayVisible = new URLSearchParams(window.location.search).has("fps");
  const settings = loadSettings();

  const audioManager = new AudioManager(game.eventBus, {
    enabled: settings.soundEnabled,
    volume: settings.sfxVolume,
  });
  audioManager.subscribe();

  const musicManager = new MusicManager(game.eventBus, {
    enabled: settings.musicEnabled,
    volume: settings.musicVolume,
  });
  musicManager.subscribe();

  game.audioManager = audioManager;
  game.musicManager = musicManager;
  game.sceneData = {};
  // Dev handle for checks from the browser console.
  if (import.meta.env.DEV) window.__game = game;

  game.registerScene("menu", new MenuScene());
  game.registerScene("versus", new TowerScene());
  game.registerScene("game_over", new GameOverScene());
  // Bounded wait for the bundled fonts so the first frame is not drawn in a fallback face.
  loadGameFonts(800).then(() => {
    game.switchScene("menu", { restart: true });
    game.start();
  });

  window.addEventListener(
    "beforeunload",
    () => {
      audioManager.dispose();
      musicManager.dispose();
    },
    { once: true }
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
