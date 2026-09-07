import { HIT_FLASH_DURATION, TEAM_STYLES, center, emit, nowMs } from "./versusConfig.js";

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
        const targetIndex = this.s.playersCtl.resolvePlayerIndex(payload?.target ?? payload?.player ?? null, payload?.targetIndex);
        if (targetIndex >= 0) {
          this.s.hitFlashTimers[targetIndex] = HIT_FLASH_DURATION;
        }
        if (payload?.source !== "fall") {
          const target = payload?.target ?? payload?.player ?? null;
          const hitPoint = target ? center(target) : null;
          if (hitPoint) {
            // M2: impact palette follows the VICTIM team so hits read instantly like expectation.png.
            const victimIndex = targetIndex >= 0 ? targetIndex : 0;
            const palette = TEAM_STYLES[victimIndex]?.hitColors ?? ["#ffffff"];
            this.s.effects.spawnFruitBurst(hitPoint.x, hitPoint.y, payload?.isFatal ? 14 : 8, palette, {
              lifeMin: 0.14,
              lifeMax: 0.32,
              speedMin: 30,
              speedMax: payload?.isFatal ? 130 : 80,
              sizeMin: 1.2,
              sizeMax: 3,
            });
          }
        }
      })
    );
    this.s.eventOff.push(
      eventBus.on("versus:bullet_blocked", (payload) => {
        const bullet = payload?.bullet;
        if (!bullet) {
          return;
        }
        const hitPoint = center(bullet);
        const ownerIndex = bullet?.owner === this.s.p2 ? 1 : 0;
        const style = TEAM_STYLES[ownerIndex];
        this.s.effects.spawnFruitBurst(hitPoint.x, hitPoint.y, 5, [style.bulletAccent, style.bulletCore, "#ffffff"], {
          lifeMin: 0.1,
          lifeMax: 0.22,
          speedMin: 20,
          speedMax: 70,
          sizeMin: 1,
          sizeMax: 2.2,
        });
      })
    );
  }

  unbindEvents() {
    for (const off of this.s.eventOff) {
      off?.();
    }
    this.s.eventOff.length = 0;
  }

  applyFallDeaths(eventBus) {
    for (let index = 0; index < this.s.players.length; index += 1) {
      const player = this.s.players[index];
      if (!player || player.active === false) {
        continue;
      }
      if (player.y <= this.s.deathY) {
        continue;
      }

      this.handleRingOut(index, eventBus);
    }
  }

  handleRingOut(playerIndex, eventBus) {
    const target = this.s.players[playerIndex];
    if (!target || target.active === false) {
      return false;
    }

    const killerIndex = playerIndex === 0 ? 1 : 0;
    const killer = this.s.players[killerIndex] ?? null;

    target.deactivate();
    target.vx = 0;
    target.vy = 0;
    target.onGround = false;
    target.invulnerable = false;
    target.moveIntent = 0;
    target.jumpRequested = false;
    this.s.hitFlashTimers[playerIndex] = HIT_FLASH_DURATION;
    this.s.spawnProtectionMs[playerIndex] = 0;

    emit(eventBus, "versus:player_hit", {
      target,
      targetIndex: playerIndex,
      shooter: killer,
      shooterIndex: killerIndex,
      damage: target.maxHealth,
      source: "fall",
      isFatal: true,
      death: true,
      dead: true,
    });

    emit(eventBus, "versus:kill", {
      killer,
      killerIndex,
      victim: target,
      victimIndex: playerIndex,
      source: "fall",
      damage: target.maxHealth,
    });

    return true;
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
