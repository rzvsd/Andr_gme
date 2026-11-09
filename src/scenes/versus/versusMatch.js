import { HIT_FLASH_DURATION, emit, nowMs } from "./versusConfig.js";

// World centre of the killing bullet, or null when the payload carries no positioned bullet.
function bulletCentre(bullet) {
  const x = Number(bullet?.x);
  const y = Number(bullet?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x: x + (Number(bullet.width) || 0) * 0.5, y: y + (Number(bullet.height) || 0) * 0.5 };
}

export class VersusMatch {
  constructor(scene) {
    this.s = scene;
  }

  bindEvents(eventBus) {
    this.unbindEvents();
    if (!eventBus?.on) {
      return;
    }

    this.s.eventOff.push(
      eventBus.on("versus:player_hit", (payload) => {
        const target = payload?.target ?? payload?.player ?? null;
        const targetIndex = this.s.playersCtl.resolvePlayerIndex(target, payload?.targetIndex);
        if (targetIndex >= 0) {
          this.s.hitFlashTimers[targetIndex] = HIT_FLASH_DURATION;
        }
        if (payload?.source === "fall") {
          return;
        }
        const now = this.s.cachedNowMs || nowMs();
        const dirX = Number(payload?.bullet?.directionX) || (targetIndex === 0 ? -1 : 1);
        if (target) {
          this.s.effects.spawnDustPuff(target.x + target.width * 0.5, target.y + target.height);
          const slab = this.s.platforms.indexOf(target.supportingPlatform);
          this.s.effects.flashSlab(slab >= 0 ? slab : targetIndex, now);
        }
        // A fatal hit gets the kill feedback from versus:kill instead.
        if (!payload?.isFatal) {
          this.s.effects.trigger("hit", now, dirX);
        }
      })
    );
    this.s.eventOff.push(
      eventBus.on("versus:kill", (payload) => {
        const shooterIndex = this.s.playersCtl.resolvePlayerIndex(payload?.killer ?? payload?.shooter ?? null, payload?.killerIndex);
        const victimIndex = this.s.playersCtl.resolvePlayerIndex(payload?.victim ?? payload?.target ?? null, payload?.victimIndex);
        const now = this.s.cachedNowMs || nowMs();
        const dirX = Number(payload?.bullet?.directionX) || (shooterIndex === 1 ? -1 : 1);
        this.s.effects.trigger("kill", now, dirX);
        if (shooterIndex >= 0 && victimIndex >= 0) {
          // The bullet is deactivated but not yet recycled, so its position is the impact point.
          this.s.effects.startKillFrame(shooterIndex, victimIndex, now, bulletCentre(payload?.bullet), dirX);
        }
      })
    );
    this.s.eventOff.push(
      eventBus.on("versus:bullet_blocked", (payload) => {
        const slab = this.s.platforms.indexOf(payload?.platform);
        if (slab >= 0) {
          this.s.effects.flashSlab(slab, this.s.cachedNowMs || nowMs());
        }
      })
    );
  }

  unbindEvents() {
    for (const off of this.s.eventOff) {
      off?.();
    }
    this.s.eventOff.length = 0;
  }


  syncHudFromRoundManager() {
    const p1Stats = this.s.roundManager?.getStats?.(0) ?? { kills: 0, deaths: 0, dodges: 0 };
    const p2Stats = this.s.roundManager?.getStats?.(1) ?? { kills: 0, deaths: 0, dodges: 0 };

    this.s.versusHUD.setState(0, {
      bulletsDodged: p1Stats.dodges,
      deaths: p1Stats.deaths,
      kills: p1Stats.kills,
    });
    this.s.versusHUD.setState(1, {
      bulletsDodged: p2Stats.dodges,
      deaths: p2Stats.deaths,
      kills: p2Stats.kills,
    });
  }

  getTerminalResult() {
    const p1Stats = this.s.roundManager?.getStats?.(0) ?? { kills: 0, deaths: 0, dodges: 0 };
    const p2Stats = this.s.roundManager?.getStats?.(1) ?? { kills: 0, deaths: 0, dodges: 0 };
    const p1Kills = Math.max(0, Math.round(Number(p1Stats.kills) || 0));
    const p2Kills = Math.max(0, Math.round(Number(p2Stats.kills) || 0));

    if (p1Kills < this.s.killsToWin && p2Kills < this.s.killsToWin) {
      return null;
    }

    const p1Deaths = Math.max(0, Math.round(Number(p1Stats.deaths) || 0));
    const p2Deaths = Math.max(0, Math.round(Number(p2Stats.deaths) || 0));
    const p1Dodges = Math.max(0, Math.round(Number(p1Stats.dodges) || 0));
    const p2Dodges = Math.max(0, Math.round(Number(p2Stats.dodges) || 0));

    let winnerIndex = 0;
    if (p1Kills !== p2Kills) {
      winnerIndex = p1Kills > p2Kills ? 0 : 1;
    } else if (p1Deaths !== p2Deaths) {
      winnerIndex = p1Deaths < p2Deaths ? 0 : 1;
    } else if (p1Dodges !== p2Dodges) {
      winnerIndex = p1Dodges > p2Dodges ? 0 : 1;
    }

    return {
      winnerIndex,
      loserIndex: winnerIndex === 0 ? 1 : 0,
      killsToWin: this.s.killsToWin,
      p1Kills,
      p2Kills,
      p1Deaths,
      p2Deaths,
      p1Dodges,
      p2Dodges,
    };
  }

  finishMatch(game, result) {
    if (this.s.matchEnded) {
      return;
    }
    this.s.matchEnded = true;

    const elapsedMs = this.s.roundStartedAtMs > 0 ? Math.max(0, nowMs() - this.s.roundStartedAtMs) : 0;
    const timeSeconds = Math.floor(elapsedMs / 1000);
    const winnerKills = result.winnerIndex === 0 ? result.p1Kills : result.p2Kills;
    const winnerDeaths = result.winnerIndex === 0 ? result.p1Deaths : result.p2Deaths;
    const winnerDodges = result.winnerIndex === 0 ? result.p1Dodges : result.p2Dodges;

    const stats = {
      mode: "versus",
      sourceScene: "versus",
      matchMode: this.s.matchModeKey,
      playerCharacterKey: this.s.playerCharacterKey,
      player2CharacterKey: this.s.player2CharacterKey,
      botCharacterKey: this.s.botCharacterKey,
      score: winnerKills,
      kills: winnerKills,
      deaths: winnerDeaths,
      dodges: winnerDodges,
      wave: result.killsToWin,
      highScore: 0,
      timeSeconds,
      winnerIndex: result.winnerIndex,
      loserIndex: result.loserIndex,
      killsToWin: result.killsToWin,
      p1Kills: result.p1Kills,
      p2Kills: result.p2Kills,
      p1Deaths: result.p1Deaths,
      p2Deaths: result.p2Deaths,
      p1Dodges: result.p1Dodges,
      p2Dodges: result.p2Dodges,
    };

    const versus = {
      winnerIndex: result.winnerIndex,
      loserIndex: result.loserIndex,
      killsToWin: result.killsToWin,
      p1Kills: result.p1Kills,
      p2Kills: result.p2Kills,
      p1Deaths: result.p1Deaths,
      p2Deaths: result.p2Deaths,
      p1Dodges: result.p1Dodges,
      p2Dodges: result.p2Dodges,
      timeSeconds,
    };

    game.sceneData = {
      ...game.sceneData,
      mode: "versus",
      sourceScene: "versus",
      playerCharacterKey: this.s.playerCharacterKey,
      matchMode: this.s.matchModeKey,
      stats,
      versusResult: versus,
    };

    game?.switchScene?.("game_over", {
      mode: "versus",
      sourceScene: "versus",
      playerCharacterKey: this.s.playerCharacterKey,
      matchMode: this.s.matchModeKey,
      stats,
      versus,
    });
  }
}
