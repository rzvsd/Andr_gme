import { PLAYER_CHARACTER_FEET_RATIO } from "../../theme/playerRoster.js";
import { isVersusBotMatchMode } from "../../config/versusMatchMode.js";
import {
  DECOR_STRIP_COLOR,
  DECOR_STRIP_TOP,
  DIVIDER_CORE,
  DIVIDER_GLOW,
  HAZE_COLOR,
  HIT_FLASH_DURATION,
  PLATFORM_EDGE_COLOR,
  PLATFORM_FACE_COLOR,
  PLATFORM_TOP_COLOR,
  PLAYER_DRAW_HEIGHT,
  PLAYER_DRAW_WIDTH,
  SCARF_SWAY_AMPLITUDE,
  SKY_BOTTOM,
  SKY_TOP,
  TEAM_STYLES,
  clampAlpha,
  getWorldRect,
} from "./versusConfig.js";

export class VersusRenderer {
  constructor(scene) {
    this.s = scene;
  }

  render(ctx, _alpha, game) {
    const fullWidth = Math.max(1, Number(game?.viewWidth) || this.s.width);
    const fullHeight = Math.max(1, Number(game?.viewHeight) || this.s.height);
    const worldRect = getWorldRect(fullWidth, fullHeight, this.s.worldWidth, this.s.worldHeight);

    this.renderBackdrop(ctx, fullWidth, fullHeight);
    this.renderScaledBackdropWorld(ctx, worldRect);
    this.renderWorldScreen(ctx, worldRect);

    this.renderDivider(ctx, fullWidth, fullHeight);
    this.s.versusHUD.render(ctx, fullWidth, fullHeight);
    this.s.muteButton.render(ctx, fullWidth, fullHeight);
    this.renderExitConfirmHint(ctx, fullWidth, fullHeight);
  }

  renderExitConfirmHint(ctx, fullWidth, fullHeight) {
    // M6: only visible during the 2s armed window after first Esc/Back press.
    if (!ctx || typeof ctx.save !== "function") {
      return;
    }
    if (Number(this.s.exitArmedUntilMs) <= Number(this.s.cachedNowMs)) {
      return;
    }
    const label = "Press ESC again to quit to menu";
    ctx.save();
    ctx.font = "600 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const padX = 18;
    const textW = ctx.measureText ? ctx.measureText(label).width : label.length * 9;
    const pillW = Math.min(fullWidth - 32, textW + padX * 2);
    const pillH = 34;
    const pillX = Math.round((fullWidth - pillW) * 0.5);
    const pillY = Math.round(fullHeight - pillH - 76);
    ctx.fillStyle = "rgba(10, 16, 28, 0.82)";
    ctx.strokeStyle = "rgba(181, 156, 214, 0.9)";
    ctx.lineWidth = 2;
    if (typeof ctx.beginPath === "function" && typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 17);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(pillX, pillY, pillW, pillH);
    }
    ctx.fillStyle = "#f2ecff";
    ctx.fillText(label, Math.round(fullWidth * 0.5), Math.round(pillY + pillH * 0.5 + 1), Math.max(0, pillW - 16));
    ctx.restore();
  }

  getDebugLines() {
    const worldRect = getWorldRect(this.s.width, this.s.height, this.s.worldWidth, this.s.worldHeight);
    const lines = [];
    if (this.s.p1) {
      lines.push(`P1 x=${this.s.p1.x.toFixed(2)} y=${this.s.p1.y.toFixed(2)}`);
      lines.push(`P1 frac x=${(this.s.p1.x % 1).toFixed(2)} y=${(this.s.p1.y % 1).toFixed(2)}`);
      const metrics = this.getPlayerDrawMetrics(this.s.p1, worldRect);
      lines.push(`P1 draw x=${metrics.screenX} y=${metrics.screenY} snapped=${Number.isInteger(metrics.screenX) && Number.isInteger(metrics.screenY)}`);
      lines.push(`P1 grounded=${Boolean(this.s.p1.onGround)} support=${this.s.p1.supportingPlatformName ?? "none"}`);
      if (this.s.p1.supportingPlatform) {
        const supportTop = Number(this.s.p1.supportingPlatform.y) + Number(this.s.p1.supportingPlatform.playerCollisionOffsetY || 0);
        const gap = supportTop - (this.s.p1.y + this.s.p1.height);
        lines.push(`P1 support gap=${gap.toFixed(2)} top=${supportTop.toFixed(2)}`);
      }
    }
    if (this.s.p2) {
      lines.push(`P2 x=${this.s.p2.x.toFixed(2)} y=${this.s.p2.y.toFixed(2)}`);
      lines.push(`P2 frac x=${(this.s.p2.x % 1).toFixed(2)} y=${(this.s.p2.y % 1).toFixed(2)}`);
      const metrics = this.getPlayerDrawMetrics(this.s.p2, worldRect);
      lines.push(`P2 draw x=${metrics.screenX} y=${metrics.screenY} snapped=${Number.isInteger(metrics.screenX) && Number.isInteger(metrics.screenY)}`);
      lines.push(`P2 grounded=${Boolean(this.s.p2.onGround)} support=${this.s.p2.supportingPlatformName ?? "none"}`);
      if (this.s.p2.supportingPlatform) {
        const supportTop = Number(this.s.p2.supportingPlatform.y) + Number(this.s.p2.supportingPlatform.playerCollisionOffsetY || 0);
        const gap = supportTop - (this.s.p2.y + this.s.p2.height);
        lines.push(`P2 support gap=${gap.toFixed(2)} top=${supportTop.toFixed(2)}`);
      }
    }
    lines.push(`WorldCam x=${Number(this.s.worldCamera.x).toFixed(2)} y=${Number(this.s.worldCamera.y).toFixed(2)}`);
    lines.push(`WorldCam raw x=${Number(this.s.worldCamera.rawX ?? this.s.worldCamera.x).toFixed(2)} y=${Number(this.s.worldCamera.rawY ?? this.s.worldCamera.y).toFixed(2)}`);
    lines.push(`Match mode=${this.s.matchModeKey}`);
    if (isVersusBotMatchMode(this.s.matchModeKey) && this.s.botController.lastDecision) {
      lines.push(`Bot reason=${this.s.botController.lastDecision.reason}`);
      if (this.s.botController.lastDecision.threatTimeToImpact !== null) {
        lines.push(`Bot threat t=${this.s.botController.lastDecision.threatTimeToImpact.toFixed(2)}s`);
      }
    }
    return lines;
  }

  renderDebugOverlay(ctx, game) {
    const worldRect = getWorldRect(
      Math.max(1, Number(game?.viewWidth) || this.s.width),
      Math.max(1, Number(game?.viewHeight) || this.s.height),
      this.s.worldWidth,
      this.s.worldHeight
    );

    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);

    for (const platform of this.s.platforms) {
      if (!platform) {
        continue;
      }
      const bodyRect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
      const collisionBounds = platform.getPlayerCollisionBounds?.() ?? platform;
      const supportRect = this.projectWorldRectToScreen(
        worldRect,
        collisionBounds.x,
        collisionBounds.y,
        collisionBounds.width,
        collisionBounds.height
      );
      ctx.strokeStyle = "rgba(255, 183, 3, 0.45)";
      ctx.strokeRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      ctx.fillStyle = "rgba(255, 183, 3, 0.06)";
      ctx.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      ctx.strokeStyle = "#ffb703";
      ctx.strokeRect(supportRect.x, supportRect.y, supportRect.width, supportRect.height);
      ctx.fillStyle = "rgba(255, 183, 3, 0.16)";
      ctx.fillRect(supportRect.x, supportRect.y, supportRect.width, supportRect.height);
      ctx.fillStyle = "#fff4cc";
      ctx.font = "11px monospace";
      ctx.fillText(platform.name ?? platform.id ?? "platform", bodyRect.x + 4, bodyRect.y - 4);
    }

    ctx.setLineDash([]);
    this.renderPlayerDebug(ctx, worldRect, this.s.p1, "#7ae582");
    this.renderPlayerDebug(ctx, worldRect, this.s.p2, "#7ab6ff");
    ctx.restore();
  }

  renderPlayerDebug(ctx, worldRect, player, color) {
    if (!player) {
      return;
    }

    const bodyRect = this.projectWorldRectToScreen(worldRect, player.x, player.y, player.width, player.height);
    const metrics = this.getPlayerDrawMetrics(player, worldRect);
    const spriteRect = {
      x: metrics.screenX,
      y: metrics.screenY,
      width: metrics.screenWidth,
      height: metrics.screenHeight,
    };

    ctx.strokeStyle = color;
    ctx.strokeRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
    ctx.fillStyle = `${color}22`;
    ctx.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.strokeRect(spriteRect.x, spriteRect.y, spriteRect.width, spriteRect.height);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(metrics.originX, metrics.originY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(metrics.originX - 6, metrics.originY);
    ctx.lineTo(metrics.originX + 6, metrics.originY);
    ctx.moveTo(metrics.originX, metrics.originY - 6);
    ctx.lineTo(metrics.originX, metrics.originY + 6);
    ctx.stroke();
  }

  projectWorldRectToScreen(worldRect, x, y, width, height) {
    const screenPos = this.projectWorldPointToScreen(worldRect, x, y);
    return {
      x: screenPos.x,
      y: screenPos.y,
      width: Math.round(width * worldRect.scale),
      height: Math.round(height * worldRect.scale),
    };
  }

  projectWorldPointToScreen(worldRect, x, y) {
    return {
      x: Math.round(worldRect.drawX + (Number(x) - this.s.worldCamera.x) * worldRect.scale),
      y: Math.round(worldRect.drawY + (Number(y) - this.s.worldCamera.y) * worldRect.scale),
    };
  }

  getPlayerDrawMetrics(player, worldRect = null) {
    const drawX = player.x + player.width * 0.5 - PLAYER_DRAW_WIDTH * 0.5;
    const drawY = player.y + player.height - PLAYER_DRAW_HEIGHT * PLAYER_CHARACTER_FEET_RATIO;
    const screenPos = worldRect
      ? this.projectWorldPointToScreen(worldRect, drawX, drawY)
      : this.s.worldCamera.worldToScreen(drawX, drawY);
    const scaledWidth = worldRect
      ? Math.max(1, Math.round(PLAYER_DRAW_WIDTH * worldRect.scale))
      : PLAYER_DRAW_WIDTH;
    const scaledHeight = worldRect
      ? Math.max(1, Math.round(PLAYER_DRAW_HEIGHT * worldRect.scale))
      : PLAYER_DRAW_HEIGHT;
    return {
      drawX,
      drawY,
      drawWidth: PLAYER_DRAW_WIDTH,
      drawHeight: PLAYER_DRAW_HEIGHT,
      screenWidth: scaledWidth,
      screenHeight: scaledHeight,
      screenX: Number(screenPos?.x) || 0,
      screenY: Number(screenPos?.y) || 0,
      originX: Number(screenPos?.x) || 0,
      originY: Number(screenPos?.y) || 0,
    };
  }

  renderBackdrop(ctx, fullWidth, fullHeight) {
    // M1: flat sky like expectation.png — no team tints, HUD panels carry the color.
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, fullHeight);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, fullWidth, fullHeight);
    ctx.restore();
  }

  renderScaledBackdropWorld(ctx, worldRect) {
    ctx.save();
    ctx.translate(worldRect.drawX, worldRect.drawY);
    ctx.scale(worldRect.scale, worldRect.scale);
    this.renderSky(ctx);
    this.s.background.render(ctx, this.s.worldCamera, this.s.worldWidth, this.s.worldHeight);
    this.renderAtmosphere(ctx);
    this.renderDecorStrip(ctx, this.s.worldCamera);
    ctx.restore();
  }

  renderWorldScreen(ctx, worldRect) {
    for (const platform of this.s.platforms) {
      this.renderPlatformScreen(ctx, worldRect, platform);
    }
    for (const bullet of this.s.bullets) {
      if (bullet?.active !== false) {
        this.renderBulletScreen(ctx, worldRect, bullet);
      }
    }
    this.renderPlayerScreen(ctx, worldRect, this.s.p1, 0);
    this.renderPlayerScreen(ctx, worldRect, this.s.p2, 1);
    this.renderParticlesScreen(ctx, worldRect);
  }

  renderSky(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.s.worldHeight);
    gradient.addColorStop(0, SKY_TOP);
    gradient.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.s.worldWidth, this.s.worldHeight);
  }

  renderAtmosphere(ctx) {
    // M1: expectation.png has a flat sky — keep haze extremely subtle.
    ctx.save();
    ctx.fillStyle = HAZE_COLOR;
    ctx.beginPath();
    ctx.ellipse(this.s.worldWidth * 0.2, 140, 110, 26, -0.1, 0, Math.PI * 2);
    ctx.ellipse(this.s.worldWidth * 0.8, 155, 96, 24, 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderDecorStrip(ctx, camera) {
    const stripPos = camera.worldToScreen(0, this.s.decorStripY);
    const topY = stripPos.y;
    ctx.save();
    ctx.fillStyle = DECOR_STRIP_COLOR;
    ctx.fillRect(stripPos.x, topY, this.s.worldWidth, this.s.decorStripHeight);
    ctx.fillStyle = DECOR_STRIP_TOP;
    ctx.fillRect(stripPos.x, topY, this.s.worldWidth, 6);
    ctx.restore();
  }

  renderPlatformScreen(ctx, worldRect, platform) {
    if (!platform) {
      return;
    }

    const rect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
    const topHeight = Math.max(2, Math.round(6 * worldRect.scale));
    const edgeHeight = Math.max(2, Math.round(4 * worldRect.scale));

    ctx.save();
    ctx.fillStyle = PLATFORM_FACE_COLOR;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = PLATFORM_TOP_COLOR;
    ctx.fillRect(rect.x, rect.y, rect.width, topHeight);
    ctx.fillStyle = PLATFORM_EDGE_COLOR;
    ctx.fillRect(rect.x, rect.y + rect.height - edgeHeight, rect.width, edgeHeight);
    ctx.restore();
  }

  renderBulletScreen(ctx, worldRect, bullet) {
    // M2: picture-style slugs — solid core + soft glow trail, no fruit leaf.
    const ownerIndex = bullet?.owner === this.s.p2 ? 1 : 0;
    const style = TEAM_STYLES[ownerIndex];
    const rect = this.projectWorldRectToScreen(worldRect, bullet.x, bullet.y, bullet.width, bullet.height);

    const centerX = rect.x + rect.width * 0.5;
    const centerY = rect.y + rect.height * 0.5;
    const dir = (Number(bullet.directionX) || 0) >= 0 ? 1 : -1;
    const trailLen = Math.max(12, Math.round(22 * worldRect.scale));
    const trailX = dir >= 0 ? Math.round(centerX - trailLen) : Math.round(centerX);
    const coreW = Math.max(6, Math.round(12 * worldRect.scale));
    const coreH = Math.max(4, Math.round(7 * worldRect.scale));

    ctx.save();
    // Glow trail
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = style.bulletGlow;
    ctx.fillRect(trailX, Math.round(centerY - coreH * 0.35), trailLen, Math.max(2, Math.round(coreH * 0.7)));
    // Core slug
    ctx.globalAlpha = 1;
    ctx.shadowColor = style.bulletGlow;
    ctx.shadowBlur = 6;
    ctx.fillStyle = style.bulletCore;
    const coreX = Math.round(centerX - coreW * 0.5);
    const coreY = Math.round(centerY - coreH * 0.5);
    ctx.fillRect(coreX, coreY, coreW, coreH);
    // Hot highlight dot (yellow-white like expectation.png)
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.bulletAccent;
    ctx.fillRect(dir >= 0 ? coreX + 1 : coreX + coreW - 3, coreY + 1, 2, Math.max(1, coreH - 2));
    ctx.restore();
  }

  renderPlayerScreen(ctx, worldRect, player, index) {
    if (!player || player.active === false) {
      return;
    }

    // M3: spawn-protection blink — 8Hz, so protection reads without hiding the fighter.
    const protectedMs = Number(this.s.spawnProtectionMs[index]) || 0;
    if (protectedMs > 0 && Math.floor(this.s.cachedNowMs / 125) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      const metricsBlink = this.getPlayerDrawMetrics(player, worldRect);
      this.renderPlayerShadowScreen(ctx, worldRect, player);
      const frameBlink = this.s.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
      const flashingBlink = clampAlpha(this.s.hitFlashTimers[index] / HIT_FLASH_DURATION);
      const sheetBlink = this.s.assets.getPlayerSheet(player.characterKey);
      if (sheetBlink?.isReady?.()) {
        this.renderSheetFighterScreen(ctx, sheetBlink, metricsBlink.screenX, metricsBlink.screenY, metricsBlink.screenWidth, metricsBlink.screenHeight, player, frameBlink, flashingBlink, TEAM_STYLES[index]);
      } else {
        this.renderProceduralFighter(ctx, metricsBlink.screenX, metricsBlink.screenY, player, flashingBlink, TEAM_STYLES[index]);
      }
      ctx.restore();
      return;
    }

    const metrics = this.getPlayerDrawMetrics(player, worldRect);
    this.renderPlayerShadowScreen(ctx, worldRect, player);

    const frame = this.s.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
    const flashing = clampAlpha(this.s.hitFlashTimers[index] / HIT_FLASH_DURATION);

    const playerSheet = this.s.assets.getPlayerSheet(player.characterKey);
    if (playerSheet?.isReady?.()) {
      this.renderSheetFighterScreen(ctx, playerSheet, metrics.screenX, metrics.screenY, metrics.screenWidth, metrics.screenHeight, player, frame, flashing, TEAM_STYLES[index]);
      return;
    }

    this.renderProceduralFighter(ctx, metrics.screenX, metrics.screenY, player, flashing, TEAM_STYLES[index]);
  }

  renderPlayerShadowScreen(ctx, worldRect, player) {
    const screenPos = this.projectWorldPointToScreen(worldRect, player.x + player.width * 0.5, player.y + player.height - 7);
    const radiusX = Math.max(8, Math.round(18 * worldRect.scale));
    const radiusY = Math.max(3, Math.round(6 * worldRect.scale));

    ctx.save();
    ctx.fillStyle = "rgba(23, 29, 33, 0.26)";
    ctx.beginPath();
    ctx.ellipse(screenPos.x, screenPos.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderSheetFighterScreen(ctx, sheet, x, y, drawWidth, drawHeight, player, frame, flashAlpha, teamStyle) {
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(x + drawWidth, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    sheet.drawFrame(ctx, x, y, frame, drawWidth, drawHeight);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = teamStyle.accent;
    ctx.fillRect(
      x + drawWidth * 0.22,
      y + drawHeight * 0.24,
      drawWidth * 0.07,
      drawHeight * 0.08
    );
    ctx.fillRect(
      x + drawWidth * 0.5,
      y + drawHeight * 0.36,
      drawWidth * 0.1,
      drawHeight * 0.045
    );

    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.48;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, drawWidth, drawHeight);
    }

    ctx.restore();
  }

  renderParticlesScreen(ctx, worldRect) {
    const previousAlpha = ctx.globalAlpha;
    const previousFillStyle = ctx.fillStyle;

    for (let index = 0; index < this.s.particles.activeCount; index += 1) {
      const particle = this.s.particles.particles[this.s.particles.activeIndices[index]];
      if (!particle?.active) {
        continue;
      }

      const alpha = particle.maxLife > 0 ? particle.life / particle.maxLife : 0;
      if (alpha <= this.s.particles.alphaCutoff) {
        continue;
      }

      const point = this.projectWorldPointToScreen(worldRect, particle.position.x, particle.position.y);
      const size = Math.max(1, Math.round(particle.size * worldRect.scale));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;

      if (particle.shape === "circle") {
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(point.x - size, point.y - size, size * 2, size * 2);
      }
    }

    ctx.globalAlpha = previousAlpha;
    ctx.fillStyle = previousFillStyle;
  }

  renderProceduralFighter(ctx, x, y, player, flashAlpha, teamStyle) {
    // M2: mini-ninja like expectation.png — dark mask, headband tails in team color,
    // readable at small scale, distinct P1/P2 by headband + outline.
    const state = player.animationState || "idle";
    const facing = player.facing < 0 ? -1 : 1;
    const runPhase = Math.sin(this.s.cachedNowMs * 0.018);
    const stride = state === "run" ? runPhase * 10 : 0;
    const crouch = state === "idle" ? 2 : 0;
    const airOffset = state === "jump" ? -10 : state === "fall" ? 6 : 0;
    const scarfWave = Math.sin(this.s.cachedNowMs * 0.012) * SCARF_SWAY_AMPLITUDE;
    const body = teamStyle.fallbackBody || "#2e3a24";
    const headband = teamStyle.headband || teamStyle.scarf || "#e8a13c";

    ctx.save();
    ctx.translate(x + PLAYER_DRAW_WIDTH * 0.5, y + PLAYER_DRAW_HEIGHT);
    ctx.scale(facing, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Team outline so P1/P2 never blend (fixes PLAYTEST-002 at sprite level).
    // M5: blur 6 — 10 is ~2x fill cost on mobile WebView for same readability.
    ctx.shadowColor = headband;
    ctx.shadowBlur = 6;

    // Legs — run cycle, jump tuck, crouch idle like picture right fighter.
    ctx.strokeStyle = "#1c2416";
    ctx.lineWidth = 9;
    ctx.beginPath();
    if (state === "jump") {
      ctx.moveTo(-4, -26 + airOffset);
      ctx.lineTo(-12, -8);
      ctx.moveTo(4, -26 + airOffset);
      ctx.lineTo(12, -10);
    } else if (state === "fall") {
      ctx.moveTo(-4, -26 + airOffset);
      ctx.lineTo(-14, -4);
      ctx.moveTo(4, -26 + airOffset);
      ctx.lineTo(14, -6);
    } else {
      ctx.moveTo(-4, -26);
      ctx.lineTo(-8 + stride * 0.8, 0 - crouch);
      ctx.moveTo(4, -26);
      ctx.lineTo(10 - stride * 0.8, 0 - crouch);
    }
    ctx.stroke();
    // Pants highlight
    ctx.strokeStyle = "#4a5d33";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, -26 + airOffset * 0.5);
    ctx.lineTo(-7 + stride * 0.5, -8);
    ctx.moveTo(4, -26 + airOffset * 0.5);
    ctx.lineTo(8 - stride * 0.5, -8);
    ctx.stroke();

    // Torso — dark tunic
    ctx.shadowBlur = 6;
    ctx.fillStyle = body;
    ctx.strokeStyle = "#141a10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-13, -24 + airOffset);
    ctx.lineTo(13, -24 + airOffset);
    ctx.lineTo(10, -58 + airOffset);
    ctx.lineTo(-10, -58 + airOffset);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Belt + blaster hint (facing gun)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10140d";
    ctx.fillRect(-13, -34 + airOffset, 26, 5);
    ctx.fillStyle = "#5c2e1c";
    ctx.fillRect(8, -46 + airOffset, 14, 7);
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(18, -44 + airOffset, 8, 4);

    // Arms — forward aim when running/shooting, tucked when jumping
    ctx.strokeStyle = body;
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (state === "jump" || state === "fall") {
      ctx.moveTo(-6, -52 + airOffset);
      ctx.lineTo(-14, -38 + airOffset);
      ctx.moveTo(6, -52 + airOffset);
      ctx.lineTo(20, -44 + airOffset);
    } else {
      ctx.moveTo(-6, -52);
      ctx.lineTo(-12 + stride * 0.2, -36);
      ctx.moveTo(6, -52);
      ctx.lineTo(22, -42 + stride * 0.15);
    }
    ctx.stroke();

    // Head — dark mask with skin eye slit like expectation ninjas
    ctx.fillStyle = "#d9b896";
    ctx.beginPath();
    ctx.arc(1, -70 + airOffset, 13, 0, Math.PI * 2);
    ctx.fill();
    // Mask top + eye band
    ctx.fillStyle = "#202826";
    ctx.beginPath();
    ctx.arc(1, -73 + airOffset, 13.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(-12, -74 + airOffset, 27, 9);
    // White eye slit (facing direction reads instantly)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, -72 + airOffset, 9, 4);
    ctx.fillStyle = "#111111";
    ctx.fillRect(9, -72 + airOffset, 3, 4);

    // Headband + tails in team color — the P1/P2 distinguisher from distance
    ctx.strokeStyle = headband;
    ctx.fillStyle = headband;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-12, -78 + airOffset);
    ctx.lineTo(14, -78 + airOffset);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, -77 + airOffset);
    ctx.lineTo(-26 + scarfWave * 0.6, -70 + airOffset);
    ctx.lineTo(-32 + scarfWave, -58 + airOffset);
    ctx.stroke();

    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-PLAYER_DRAW_WIDTH * 0.4, -PLAYER_DRAW_HEIGHT, PLAYER_DRAW_WIDTH * 0.8, PLAYER_DRAW_HEIGHT);
    }

    ctx.restore();
  }

  renderDivider(ctx, fullWidth, fullHeight) {
    // M1: match expectation.png — short split in the top HUD + thin full-height center line.
    const dividerX = Math.round(fullWidth * 0.5);
    const dividerTop = 8;
    const dividerHeight = Math.min(150, Math.max(96, fullHeight * 0.19));
    ctx.save();
    // Faint full-height center line (like bug4.png reference, but subtle so it doesn't read as a wall).
    ctx.fillStyle = "rgba(150, 131, 191, 0.35)";
    ctx.fillRect(dividerX - 2, 0, 4, fullHeight);
    // Stronger top segment where the two HUD panels meet.
    ctx.fillStyle = DIVIDER_GLOW;
    ctx.fillRect(dividerX - 14, dividerTop, 28, dividerHeight);
    ctx.fillStyle = DIVIDER_CORE;
    ctx.fillRect(dividerX - 4, dividerTop + 8, 8, dividerHeight - 14);
    ctx.restore();
  }
}
