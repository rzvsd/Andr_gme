import { Game } from "./core/Game.js";
import { loadSettings } from "./config/settings.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { PauseScene } from "./scenes/PauseScene.js";
import { GameOverScene } from "./scenes/GameOverScene.js";
import { AudioManager } from "./audio/AudioManager.js";
import { MusicManager } from "./audio/MusicManager.js";

function boot() {
  const canvas = document.getElementById("game-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Expected a <canvas id="game-canvas"> element.');
  }

  const game = new Game(canvas);
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

  game.registerScene("menu", new MenuScene());
  game.registerScene("game", new GameScene());
  game.registerScene("pause", new PauseScene());
  game.registerScene("game_over", new GameOverScene());
  game.switchScene("menu", { restart: true });
  game.start();

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
