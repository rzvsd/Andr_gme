import { SpriteSheet } from "../../rendering/SpriteSheet.js";
import {
  buildPlayerCharacterSheetDataUrl,
  getPlayerCharacterByKey,
  loadSelectedPlayerCharacterKey,
  pickRandomPlayerCharacterKey,
} from "../../theme/playerRoster.js";
import {
  getVersusMatchMode,
  isVersusBotMatchMode,
  loadSelectedVersusMatchModeKey,
} from "../../config/versusMatchMode.js";
import { isDev } from "./versusConfig.js";

export class VersusAssets {
  constructor(scene) {
    this.s = scene;
  }

  resolvePlayerCharacterKey(payload = {}, game) {
    const candidate = payload?.playerCharacterKey ?? game?.sceneData?.playerCharacterKey;
    return getPlayerCharacterByKey(typeof candidate === "string" ? candidate : loadSelectedPlayerCharacterKey()).key;
  }

  // PVP: the second player's own pick from the menu (payload or sceneData); falls back to P1's key.
  resolvePlayer2CharacterKey(payload = {}, game, fallbackKey) {
    const candidate = payload?.player2CharacterKey ?? game?.sceneData?.player2CharacterKey;
    return getPlayerCharacterByKey(typeof candidate === "string" ? candidate : fallbackKey).key;
  }

  resolveMatchModeKey(payload = {}, game) {
    const candidate = payload?.matchMode ?? game?.sceneData?.matchMode;
    return getVersusMatchMode(typeof candidate === "string" ? candidate : loadSelectedVersusMatchModeKey()).key;
  }

  resolveBotCharacterKey(playerCharacterKey, matchModeKey) {
    if (!isVersusBotMatchMode(matchModeKey)) {
      return getPlayerCharacterByKey(playerCharacterKey).key;
    }
    return pickRandomPlayerCharacterKey(playerCharacterKey);
  }

  getCharacterKeyForPlayer(index) {
    if (index === 1) {
      return isVersusBotMatchMode(this.s.matchModeKey)
        ? getPlayerCharacterByKey(this.s.botCharacterKey).key
        : getPlayerCharacterByKey(this.s.player2CharacterKey ?? this.s.playerCharacterKey).key;
    }
    return getPlayerCharacterByKey(this.s.playerCharacterKey).key;
  }

  getPlayerSheet(characterKey) {
    const normalizedKey = getPlayerCharacterByKey(characterKey).key;
    return this.s.playerSheets.get(normalizedKey) ?? null;
  }

  async preloadAssets() {
    const keysToLoad = [...new Set([
      getPlayerCharacterByKey(this.s.playerCharacterKey).key,
      getPlayerCharacterByKey(this.s.player2CharacterKey ?? this.s.playerCharacterKey).key,
      getPlayerCharacterByKey(this.s.botCharacterKey).key,
    ])];
    const results = await Promise.all(keysToLoad.map((characterKey) => this.preloadCharacterSheet(characterKey)));
    return results.every(Boolean);
  }

  async preloadCharacterSheet(characterKey) {
    const normalizedKey = getPlayerCharacterByKey(characterKey).key;
    let sheet = this.s.playerSheets.get(normalizedKey);
    if (!sheet) {
      sheet = new SpriteSheet(buildPlayerCharacterSheetDataUrl(normalizedKey), {
        frameWidth: 64,
        frameHeight: 64,
        columns: 4,
        rows: 1,
        fallbackColor: "#6f8758",
      });
      this.s.playerSheets.set(normalizedKey, sheet);
    }

    if (sheet.isReady?.()) {
      return true;
    }

    try {
      return await sheet.load();
    } catch (error) {
      if (isDev() && !this.s.playerSheetErrorKeys.has(normalizedKey)) {
        console.error(`[VersusGameScene] sprite preload failed for "${normalizedKey}"; using procedural fighter fallback.`, error);
        this.s.playerSheetErrorKeys.add(normalizedKey);
      }
      return false;
    }
  }
}
