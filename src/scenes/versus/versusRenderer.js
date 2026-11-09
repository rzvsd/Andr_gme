import { PLAYER_CHARACTER_FEET_RATIO } from "../../theme/playerRoster.js";
import { isVersusBotMatchMode } from "../../config/versusMatchMode.js";
import { COLORS, DESIGN_BOX, TEAM_COLORS, TYPE, textFont, withAlpha } from "../../theme/tokens.js";
import { HERO_RIG_HEIGHT_UNITS, heroLayer } from "./versusHeroLayer.js";
import { trailPoint } from "./versusProjectiles.js";
import { VERSUS_SHOTS_PER_CLIP, refillShotClip, shotClipOf, shotRefillProgress } from "./versusShots.js";
import {
  ARENA_BLACK,
  ATMOSPHERE,
  BLOCK,
  BULLET_FX,
  DUST_MOTES,
  FEEDBACK,
  HIT_FLASH_DURATION,
  PLATFORM_FILL_COLOR,
  PLATFORM_OUTLINE_COLOR,
  PLATFORM_OUTLINE_TOP_COLOR,
  PLAYER_DRAW_HEIGHT,
  PLAYER_DRAW_WIDTH,
  REVEAL_FX,
  SLAB,
  clampAlpha,
  getDesignWorldRect,
  shotLineY,
} from "./versusConfig.js";

// Direction A "Blackout Arena" match renderer. Every gradient is pre-rendered once per viewport
// size into offscreen sprites (backdrop, overlay, bullet halos, spills, flashes); the per-frame
// path only blits sprites and strokes a few shapes. Fighters are Three.js rigs on the hero layer
// above this canvas; without WebGL a simple 2D fallback stands in.

const TRANSPARENT = withAlpha(COLORS.bg, 0);
const STAGE_LIGHT_COLOR = withAlpha(COLORS.structure, ATMOSPHERE.stageAlpha);
const STAGE_LIGHT_EDGE = withAlpha(COLORS.structure, 0);
const SHAFT_COLOR = withAlpha(COLORS.impact, ATMOSPHERE.shaftAlpha);
const SHAFT_EDGE = withAlpha(COLORS.impact, 0);
const SLAB_GLOW_COLOR = withAlpha(COLORS.structure, SLAB.glowAlpha);
const BLOCK_OUTLINE_COLOR = withAlpha(COLORS.structure, BLOCK.outlineAlpha);
const BLOCK_FILL_COLOR = withAlpha(COLORS.structure, BLOCK.fillAlpha);
const BLOCK_TOP_COLOR = withAlpha(COLORS.structure, BLOCK.topAlpha);
const BLOCK_INNER_COLOR = withAlpha(COLORS.structure, BLOCK.innerAlpha);
const VIGNETTE_COLOR = withAlpha(COLORS.bg, ATMOSPHERE.vignetteAlpha);
const DIM_COLOR = withAlpha(COLORS.bg, FEEDBACK.dimAlpha);
const SPILL_EDGE = TEAM_COLORS.map((team) => withAlpha(team.main, 0));
const SPILL_COLOR = TEAM_COLORS.map((team) => withAlpha(team.main, REVEAL_FX.spillAlpha));
const HIT_FLASH_COLOR = withAlpha(COLORS.impact, REVEAL_FX.hitFlashAlpha);
const MUZZLE_CORE = withAlpha(COLORS.impact, 0.9);
const MUZZLE_MID = withAlpha(COLORS.impact, 0.4);
const IMPACT_EDGE = withAlpha(COLORS.impact, 0);
const DEBUG_COLORS = Object.freeze({
  platformLine: withAlpha(COLORS.accent, 0.45),
  platformFill: withAlpha(COLORS.accent, 0.06),
  supportFill: withAlpha(COLORS.accent, 0.16),
  spriteLine: withAlpha(COLORS.impact, 0.55),
  teamFill: TEAM_COLORS.map((team) => withAlpha(team.main, 0.13)),
});

function createSprite(cssWidth, cssHeight, dpr) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(cssWidth * dpr));
  canvas.height = Math.max(1, Math.ceil(cssHeight * dpr));
  const ctx = canvas.getContext?.("2d");
  if (!ctx) {
    return null;
  }
  ctx.scale(dpr, dpr);
  return { canvas, ctx, width: cssWidth, height: cssHeight };
}

// Elliptical radial gradient fill: the unit circle is scaled to (rx, ry) about (cx, cy).
function fillRadialEllipse(ctx, cx, cy, rx, ry, stops) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(1e-3, rx), Math.max(1e-3, ry));
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.rect(x, y, width, height);
}

function drawSpriteCentered(ctx, sprite, cx, cy) {
  ctx.drawImage(sprite.canvas, cx - sprite.width * 0.5, cy - sprite.height * 0.5, sprite.width, sprite.height);
}

// Pure: world end point of the kill path. It sits on the killing bullet's line, at the bullet
// centre but no deeper than the victim's near body edge: the victim's rig on the hero layer sits
// above this canvas and would hide anything further in. Without a positioned bullet the path ends
// at that edge on the shooter's shot line.
export function killPathEndWorld(killFrame, victim, shooter) {
  const fromLeft = killFrame.dirX >= 0;
  const edge = fromLeft ? victim.x : victim.x + victim.width;
  let x = edge;
  if (Number.isFinite(killFrame.x)) {
    x = fromLeft ? Math.min(killFrame.x, edge) : Math.max(killFrame.x, edge);
  }
  const y = Number.isFinite(killFrame.y) ? killFrame.y : shotLineY(shooter);
  return { x, y };
}

export class VersusRenderer {
  constructor(scene) {
    this.s = scene;
    this.heroActors = [];
    this.heroEntries = [this.createHeroEntry(0), this.createHeroEntry(1)];
    this.view = { width: 0, height: 0, dpr: 0 };
    this.worldRect = null;
    this.sprites = { backdrop: null, overlay: null, bullets: [null, null], spills: [null, null], hitFlash: null, muzzle: null };
    this.fx = { x: 0, y: 0, zoom: 1 };
    this._point = { x: 0, y: 0 };
    this._pips = [
      { left: VERSUS_SHOTS_PER_CLIP, total: VERSUS_SHOTS_PER_CLIP, progress: 1 },
      { left: VERSUS_SHOTS_PER_CLIP, total: VERSUS_SHOTS_PER_CLIP, progress: 1 },
    ];
  }

  createHeroEntry(slot) {
    return {
      slot,
      heroId: "pudd",
      x: 0,
      y: 0,
      facing: 1,
      vx: 0,
      vy: 0,
      onGround: true,
      visible: false,
      lastShotAtMs: Number.NEGATIVE_INFINITY,
      hitFlash: 0,
      rimColor: TEAM_COLORS[slot].main,
      silhouette: false,
    };
  }

  onSceneEnter() {
    heroLayer.setLightPreset("match");
    this.heroActors.length = 0;
  }

  onSceneExit() {
    this.heroActors.length = 0;
    heroLayer.clear();
  }

  // ---------------------------------------------------------------------------------------------
  // Frame

  render(ctx, _alpha, game) {
    const fullWidth = Math.max(1, Number(game?.viewWidth) || this.s.width);
    const fullHeight = Math.max(1, Number(game?.viewHeight) || this.s.height);
    const dpr = Math.min(2, Math.max(1, Number(game?.dpr) || 1));
    const worldRect = this.ensureView(fullWidth, fullHeight, dpr);
    const now = this.s.cachedNowMs;
    const fx = this.s.effects.getArenaTransform(now, this.fx);
    const killFrame = this.s.effects.getKillFrame(now);
    const s = worldRect.box.scale;

    this.heroActors.length = 0;

    ctx.save();
    ctx.fillStyle = ARENA_BLACK;
    ctx.fillRect(0, 0, fullWidth, fullHeight);
    // Arena transform: shake (design px) plus the kill zoom about the viewport centre.
    const cx = fullWidth * 0.5;
    const cy = fullHeight * 0.5;
    ctx.translate(fx.x * s + cx, fx.y * s + cy);
    ctx.scale(fx.zoom, fx.zoom);
    ctx.translate(-cx, -cy);

    if (this.sprites.backdrop) {
      ctx.drawImage(this.sprites.backdrop.canvas, 0, 0, fullWidth, fullHeight);
    } else {
      this.drawSlabsDirect(ctx, worldRect);
    }
    this.drawSlabFlashes(ctx, worldRect, now);
    this.drawBullets(ctx, worldRect);
    this.drawFighter(ctx, worldRect, this.s.p1, 0, now, killFrame, fullWidth, fullHeight);
    this.drawFighter(ctx, worldRect, this.s.p2, 1, now, killFrame, fullWidth, fullHeight);
    this.renderParticlesScreen(ctx, worldRect);
    ctx.restore();

    if (this.sprites.overlay) {
      ctx.drawImage(this.sprites.overlay.canvas, 0, 0, fullWidth, fullHeight);
    }

    // The kill dim covers the arena only: HUD panels never dim (DESIGN.md), so they draw after it.
    if (killFrame) {
      this.drawKillFrame(ctx, fullWidth, fullHeight, worldRect, killFrame);
    }

    this.s.versusHUD.render(ctx, fullWidth, fullHeight);
    this.s.versusHUD.renderShotPips(ctx, fullWidth, fullHeight, this.shotPips(now));
    // The pause screen has its own SFX and MUSIC toggles; the mute button would be a dead button there.
    if (!this.s.paused) {
      this.s.versusHUD.renderMuteButton(ctx, fullWidth, fullHeight, this.s.muted, this.s.isMutePressed(now));
      if (this.s.versusInput?.shootButton) {
        this.s.versusHUD.renderShootButton(ctx, fullWidth, fullHeight, this._pips[0], this.s.versusInput.isFireHeld());
      }
    }

    this.flushHeroLayer(game, worldRect, fullWidth, fullHeight, fx.zoom);
  }

  // Shots left and refill progress per fighter for the HUD pips.
  shotPips(now) {
    const players = [this.s.p1, this.s.p2];
    for (let index = 0; index < 2; index += 1) {
      const pip = this._pips[index];
      if (!players[index]) {
        pip.left = VERSUS_SHOTS_PER_CLIP;
        pip.progress = 1;
        continue;
      }
      const clip = shotClipOf(players[index]);
      pip.left = refillShotClip(clip, now);
      pip.progress = shotRefillProgress(clip, now);
    }
    return this._pips;
  }

  // Screen point after the arena transform (what the hero layer and the kill path need).
  arenaX(x, fullWidth) {
    const cx = fullWidth * 0.5;
    return this.fx.x * this.worldRect.box.scale + cx + (x - cx) * this.fx.zoom;
  }

  arenaY(y, fullHeight) {
    const cy = fullHeight * 0.5;
    return this.fx.y * this.worldRect.box.scale + cy + (y - cy) * this.fx.zoom;
  }

  // ---------------------------------------------------------------------------------------------
  // Sprites: rebuilt once per viewport size or DPR change.

  ensureView(fullWidth, fullHeight, dpr) {
    if (this.worldRect && this.view.width === fullWidth && this.view.height === fullHeight && this.view.dpr === dpr) {
      return this.worldRect;
    }
    this.view.width = fullWidth;
    this.view.height = fullHeight;
    this.view.dpr = dpr;
    this.worldRect = getDesignWorldRect(fullWidth, fullHeight, this.s.worldWidth, this.s.worldHeight);
    this.buildSprites(fullWidth, fullHeight, dpr, this.worldRect);
    return this.worldRect;
  }

  buildSprites(fullWidth, fullHeight, dpr, worldRect) {
    const s = worldRect.box.scale;
    this.sprites.backdrop = this.buildBackdrop(fullWidth, fullHeight, dpr, worldRect);
    this.sprites.overlay = this.buildOverlay(fullWidth, fullHeight, dpr);
    for (let team = 0; team < 2; team += 1) {
      this.sprites.bullets[team] = this.buildBulletSprite(team, s, dpr);
      this.sprites.spills[team] = this.buildSpillSprite(team, s, dpr);
    }
    this.sprites.hitFlash = this.buildHitFlashSprite(s, dpr);
    this.sprites.muzzle = this.buildMuzzleSprite(s, dpr);
  }

  buildBackdrop(fullWidth, fullHeight, dpr, worldRect) {
    const sprite = createSprite(fullWidth, fullHeight, dpr);
    if (!sprite) {
      return null;
    }
    const { ctx } = sprite;
    const { box } = worldRect;
    const s = box.scale;

    ctx.fillStyle = ARENA_BLACK;
    ctx.fillRect(0, 0, fullWidth, fullHeight);

    // Stage light centred on the arena.
    fillRadialEllipse(
      ctx,
      box.offsetX + DESIGN_BOX.width * 0.5 * s,
      box.offsetY + DESIGN_BOX.height * ATMOSPHERE.stageCenterY * s,
      DESIGN_BOX.width * ATMOSPHERE.stageRadiusX * s,
      DESIGN_BOX.height * ATMOSPHERE.stageRadiusY * s,
      [
        [0, STAGE_LIGHT_COLOR],
        [ATMOSPHERE.stageFalloff, STAGE_LIGHT_EDGE],
        [1, STAGE_LIGHT_EDGE],
      ]
    );

    // Light shafts from the top, one over each bridge.
    const shaft = this.buildShaftSprite(s, dpr);
    if (shaft) {
      for (const platform of this.s.platforms) {
        if (!platform || (platform.kind && platform.kind !== "ground")) {
          continue;
        }
        const centre = this.projectWorldPointToScreen(worldRect, platform.x + platform.width * 0.5, platform.y);
        ctx.drawImage(shaft.canvas, centre.x - shaft.width * 0.5, box.offsetY + ATMOSPHERE.shaftTop * s, shaft.width, shaft.height);
      }
    }

    // Static dust field.
    for (const [fx, fy, alpha, radius] of DUST_MOTES) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.impact;
      ctx.beginPath();
      ctx.arc(box.offsetX + fx * DESIGN_BOX.width * s, box.offsetY + fy * DESIGN_BOX.height * s, radius * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Bridges as slabs with a soft under-glow (shadowBlur paid once, here).
    for (const platform of this.s.platforms) {
      if (!platform) {
        continue;
      }
      const rect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
      ctx.save();
      ctx.shadowColor = SLAB_GLOW_COLOR;
      ctx.shadowBlur = SLAB.glowBlur * s;
      ctx.shadowOffsetY = SLAB.glowOffsetY * s;
      ctx.fillStyle = PLATFORM_FILL_COLOR;
      roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, SLAB.radius * s);
      ctx.fill();
      ctx.restore();
      this.drawPlatformBody(ctx, platform, rect, s);
    }
    return sprite;
  }

  drawPlatformBody(ctx, platform, rect, s) {
    if (platform.kind === "block") {
      this.drawBlockBody(ctx, rect, s);
    } else {
      this.drawSlabBody(ctx, rect, s);
    }
  }

  // A block: brighter fill and outline plus an inner square, so it reads as solid, not as a ledge.
  drawBlockBody(ctx, rect, s) {
    const line = SLAB.outlineWidth * s;
    ctx.fillStyle = BLOCK_FILL_COLOR;
    roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, BLOCK.radius * s);
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = BLOCK_OUTLINE_COLOR;
    roundedRectPath(ctx, rect.x + line * 0.5, rect.y + line * 0.5, rect.width - line, rect.height - line, BLOCK.radius * s);
    ctx.stroke();
    ctx.fillStyle = BLOCK_TOP_COLOR;
    ctx.fillRect(rect.x + line, rect.y + line, Math.max(0, rect.width - line * 2), Math.max(1, s));
    const inset = BLOCK.innerInset * s;
    ctx.lineWidth = Math.max(1, s);
    ctx.strokeStyle = BLOCK_INNER_COLOR;
    roundedRectPath(ctx, rect.x + inset, rect.y + inset, rect.width - inset * 2, rect.height - inset * 2, BLOCK.radius * 0.5 * s);
    ctx.stroke();
  }

  drawSlabBody(ctx, rect, s) {
    const line = SLAB.outlineWidth * s;
    ctx.fillStyle = PLATFORM_FILL_COLOR;
    roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, SLAB.radius * s);
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = PLATFORM_OUTLINE_COLOR;
    roundedRectPath(ctx, rect.x + line * 0.5, rect.y + line * 0.5, rect.width - line, rect.height - line, SLAB.radius * s);
    ctx.stroke();
    // 1 px lit top edge just inside the outline.
    ctx.fillStyle = PLATFORM_OUTLINE_TOP_COLOR;
    ctx.fillRect(rect.x + line, rect.y + line, Math.max(0, rect.width - line * 2), Math.max(1, s));
  }

  // Fallback when no offscreen canvas exists (no DOM): slabs only, no atmosphere.
  drawSlabsDirect(ctx, worldRect) {
    for (const platform of this.s.platforms) {
      if (platform) {
        const rect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
        this.drawPlatformBody(ctx, platform, rect, worldRect.box.scale);
      }
    }
  }

  buildShaftSprite(s, dpr) {
    const width = ATMOSPHERE.shaftWidth * s;
    const height = ATMOSPHERE.shaftHeight * s;
    const sprite = createSprite(width, height, dpr);
    if (!sprite) {
      return null;
    }
    const { ctx } = sprite;
    // Soft sides: a horizontal gradient; then the vertical fade keeps only part of it.
    const across = ctx.createLinearGradient(0, 0, width, 0);
    across.addColorStop(0, SHAFT_EDGE);
    across.addColorStop(0.3, SHAFT_COLOR);
    across.addColorStop(0.7, SHAFT_COLOR);
    across.addColorStop(1, SHAFT_EDGE);
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, width, height);
    const down = ctx.createLinearGradient(0, 0, 0, height);
    down.addColorStop(0, COLORS.impact);
    down.addColorStop(ATMOSPHERE.shaftLowAt, withAlpha(COLORS.impact, ATMOSPHERE.shaftAlphaLow / ATMOSPHERE.shaftAlpha));
    down.addColorStop(1, SHAFT_EDGE);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
    return sprite;
  }

  buildOverlay(fullWidth, fullHeight, dpr) {
    const sprite = createSprite(fullWidth, fullHeight, dpr);
    if (!sprite) {
      return null;
    }
    const { ctx } = sprite;
    // Vignette: clear to 45 percent of the way out, 55 percent black at the far corners.
    fillRadialEllipse(ctx, fullWidth * 0.5, fullHeight * 0.5, fullWidth * 0.5 * Math.SQRT2, fullHeight * 0.5 * Math.SQRT2, [
      [0, TRANSPARENT],
      [ATMOSPHERE.vignetteStart, TRANSPARENT],
      [1, VIGNETTE_COLOR],
    ]);
    // Grain: a small deterministic speckle tile at device resolution, 2.5 percent.
    const tile = createSprite(ATMOSPHERE.grainTilePx, ATMOSPHERE.grainTilePx, dpr);
    if (tile && typeof ctx.createPattern === "function") {
      let seed = 1337;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      tile.ctx.fillStyle = COLORS.impact;
      for (let index = 0; index < ATMOSPHERE.grainDots; index += 1) {
        const x = rand() * ATMOSPHERE.grainTilePx;
        const y = rand() * ATMOSPHERE.grainTilePx;
        tile.ctx.beginPath();
        tile.ctx.arc(x, y, 0.5 + rand() * 0.4, 0, Math.PI * 2);
        tile.ctx.fill();
      }
      const pattern = ctx.createPattern(tile.canvas, "repeat");
      if (pattern) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = ATMOSPHERE.grainAlpha;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, sprite.canvas.width, sprite.canvas.height);
        ctx.restore();
      }
    }
    return sprite;
  }

  buildBulletSprite(team, s, dpr) {
    const outer = BULLET_FX.halos[BULLET_FX.halos.length - 1][0];
    const size = Math.ceil(BULLET_FX.radius * outer * 2 * s) + 2;
    const sprite = createSprite(size, size, dpr);
    if (!sprite) {
      return null;
    }
    const { ctx } = sprite;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = TEAM_COLORS[team].main;
    for (const [scale, alpha] of BULLET_FX.halos) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, BULLET_FX.radius * scale * s, 0, Math.PI * 2);
      ctx.fill();
    }
    return sprite;
  }

  buildSpillSprite(team, s, dpr) {
    const width = REVEAL_FX.spillWidth * s;
    const height = REVEAL_FX.spillHeight * s;
    const sprite = createSprite(width, height, dpr);
    if (!sprite) {
      return null;
    }
    fillRadialEllipse(sprite.ctx, width * 0.5, height * 0.5, width * 0.5, height * 0.5, [
      [0, SPILL_COLOR[team]],
      [0.7, SPILL_EDGE[team]],
      [1, SPILL_EDGE[team]],
    ]);
    return sprite;
  }

  buildHitFlashSprite(s, dpr) {
    const width = REVEAL_FX.hitFlashWidth * s;
    const height = REVEAL_FX.hitFlashHeight * s;
    const sprite = createSprite(width, height, dpr);
    if (!sprite) {
      return null;
    }
    fillRadialEllipse(sprite.ctx, width * 0.5, height * 0.5, width * 0.5, height * 0.5, [
      [0, HIT_FLASH_COLOR],
      [0.7, IMPACT_EDGE],
      [1, IMPACT_EDGE],
    ]);
    return sprite;
  }

  buildMuzzleSprite(s, dpr) {
    const size = REVEAL_FX.muzzleSize * s;
    const sprite = createSprite(size, size, dpr);
    if (!sprite) {
      return null;
    }
    fillRadialEllipse(sprite.ctx, size * 0.5, size * 0.5, size * 0.5, size * 0.5, [
      [0, MUZZLE_CORE],
      [0.35, MUZZLE_MID],
      [0.7, IMPACT_EDGE],
      [1, IMPACT_EDGE],
    ]);
    return sprite;
  }

  // ---------------------------------------------------------------------------------------------
  // Arena

  drawSlabFlashes(ctx, worldRect, now) {
    const s = worldRect.box.scale;
    for (let index = 0; index < this.s.platforms.length; index += 1) {
      const platform = this.s.platforms[index];
      const t = this.s.effects.getSlabFlash(index, now);
      if (!platform || t <= 0) {
        continue;
      }
      const rect = this.projectWorldRectToScreen(worldRect, platform.x, platform.y, platform.width, platform.height);
      const line = SLAB.outlineWidth * s;
      // Composes over the 40 percent outline to the 70 percent lit value at full flash.
      ctx.globalAlpha = 0.5 * t;
      ctx.lineWidth = line;
      ctx.strokeStyle = COLORS.structure;
      roundedRectPath(ctx, rect.x + line * 0.5, rect.y + line * 0.5, rect.width - line, rect.height - line, SLAB.radius * s);
      ctx.stroke();
      ctx.globalAlpha = 0.08 * t;
      ctx.fillStyle = COLORS.structure;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawBullets(ctx, worldRect) {
    const s = worldRect.box.scale;
    const bullets = this.s.bullets;
    const point = this._point;
    const steps = BULLET_FX.trailLength;

    // Trails first (normal blend): fading, shrinking dots behind each disc.
    for (const bullet of bullets) {
      if (!bullet || bullet.active === false || !bullet.trail) {
        continue;
      }
      ctx.fillStyle = TEAM_COLORS[bullet.owner === this.s.p2 ? 1 : 0].main;
      for (let k = 2; k <= bullet.trail.count; k += 1) {
        if (!trailPoint(bullet.trail, k, point)) {
          break;
        }
        const j = k - 1;
        const size = BULLET_FX.trailSizeMax - ((BULLET_FX.trailSizeMax - BULLET_FX.trailSizeMin) * (j - 1)) / Math.max(1, steps - 2);
        const screen = this.projectWorldPointToScreen(worldRect, point.x, point.y);
        ctx.globalAlpha = (BULLET_FX.trailAlpha * (steps + 1 - j)) / (steps + 1);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, Math.max(0.5, size * 0.5 * s), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Discs with their additive halos.
    ctx.globalCompositeOperation = "lighter";
    for (const bullet of bullets) {
      if (!bullet || bullet.active === false) {
        continue;
      }
      const team = bullet.owner === this.s.p2 ? 1 : 0;
      const centre = this.projectWorldPointToScreen(worldRect, bullet.x + bullet.width * 0.5, bullet.y + bullet.height * 0.5);
      const sprite = this.sprites.bullets[team];
      if (sprite) {
        drawSpriteCentered(ctx, sprite, centre.x, centre.y);
      } else {
        ctx.fillStyle = TEAM_COLORS[team].main;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, BULLET_FX.radius * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // Where the muzzle flash sits: on the shot line, just ahead of the bullet spawn point.
  muzzlePoint(player, worldRect) {
    const dir = player.facing < 0 ? -1 : 1;
    return this.projectWorldPointToScreen(
      worldRect,
      player.x + player.width * 0.5 + dir * (16 + REVEAL_FX.muzzleForwardWorld),
      shotLineY(player)
    );
  }

  drawFighter(ctx, worldRect, player, index, now, killFrame, fullWidth, fullHeight) {
    if (!player) {
      return;
    }
    const isVictim = killFrame !== null && killFrame.victimIndex === index;
    const isShooter = killFrame !== null && killFrame.shooterIndex === index;
    // A dead fighter is not drawn and its rig is dropped, except as the kill-frame silhouette.
    if (player.active === false && !isVictim) {
      return;
    }

    const revealAlpha = isVictim || isShooter ? 1 : (this.s.playersCtl?.getRevealAlpha?.(index) ?? 1);
    const protectedMs = Number(this.s.spawnProtectionMs[index]) || 0;
    const blinkHidden = !isVictim && !isShooter && protectedMs > 0 && Math.floor(now / 125) % 2 === 1;
    const feet = this.projectWorldPointToScreen(worldRect, player.x + player.width * 0.5, player.y + player.height);
    const rigHeight = PLAYER_DRAW_HEIGHT * worldRect.scale;

    if (revealAlpha > 0) {
      const spill = this.sprites.spills[index];
      if (spill) {
        ctx.globalAlpha = revealAlpha;
        drawSpriteCentered(ctx, spill, feet.x, feet.y);
      }
      const flash = clampAlpha(this.s.hitFlashTimers[index] / HIT_FLASH_DURATION);
      if (flash > 0 && this.sprites.hitFlash) {
        ctx.globalAlpha = flash;
        drawSpriteCentered(ctx, this.sprites.hitFlash, feet.x, feet.y - rigHeight * 0.5);
      }
      const shotAge = now - Number(player.lastShotAtMs);
      if (shotAge >= 0 && shotAge < REVEAL_FX.muzzleMs && this.sprites.muzzle) {
        const muzzle = this.muzzlePoint(player, worldRect);
        ctx.globalAlpha = 1 - shotAge / REVEAL_FX.muzzleMs;
        drawSpriteCentered(ctx, this.sprites.muzzle, muzzle.x, muzzle.y);
      }
      ctx.globalAlpha = 1;
    }

    const visible = isVictim || isShooter || (revealAlpha > 0 && !blinkHidden);
    if (heroLayer.isAvailable()) {
      // Hidden fighters are still tracked so shots and jumps animate when they reappear.
      const entry = this.heroEntries[index];
      entry.heroId = player.characterKey;
      entry.x = this.arenaX(feet.x, fullWidth);
      entry.y = this.arenaY(feet.y, fullHeight);
      entry.facing = player.facing;
      entry.vx = player.vx;
      entry.vy = player.vy;
      entry.onGround = player.onGround;
      // Once the pause fade has finished the rigs are hidden: the WebGL canvas sits above the 2D
      // canvas, so a revealed fighter would otherwise draw over the RESUME button.
      entry.visible = visible && !(this.s.pauseHidesRigs?.() ?? false);
      entry.lastShotAtMs = player.lastShotAtMs;
      // The approved hit state also brightens the rig itself (mockup: brightness 2.2). The hero
      // layer only poses it from hitFlash today; the white flash on the materials is its job.
      entry.hitFlash = this.s.hitFlashTimers[index];
      // Whole-rig brightening for the hit frames (hero layer lerps the materials' emissive to white).
      entry.flash = isVictim ? 0 : clampAlpha(this.s.hitFlashTimers[index] / HIT_FLASH_DURATION);
      entry.silhouette = isVictim;
      this.heroActors.push(entry);
      return;
    }
    if (!visible) {
      return;
    }
    this.renderFallbackFighter(ctx, worldRect, player, index, protectedMs > 0 && !isVictim ? revealAlpha * 0.45 : revealAlpha, isVictim);
  }

  // 2D stand-in when WebGL is missing: the roster sheet, or a team-colour capsule.
  renderFallbackFighter(ctx, worldRect, player, index, alpha, silhouette) {
    const metrics = this.getPlayerDrawMetrics(player, worldRect);
    const frame = this.s.playerAnimators[index]?.getCurrentFrame?.() ?? 0;
    const flash = silhouette ? 1 : clampAlpha(this.s.hitFlashTimers[index] / HIT_FLASH_DURATION) * 0.5;
    const sheet = this.s.assets?.getPlayerSheet?.(player.characterKey);
    const { screenX: x, screenY: y, screenWidth: w, screenHeight: h } = metrics;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (sheet?.isReady?.()) {
      ctx.save();
      if (player.facing < 0) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        sheet.drawFrame(ctx, 0, 0, frame, w, h);
      } else {
        sheet.drawFrame(ctx, x, y, frame, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = TEAM_COLORS[index].main;
      roundedRectPath(ctx, x + w * 0.35, y + h * 0.12, w * 0.3, h * (PLAYER_CHARACTER_FEET_RATIO - 0.12), w * 0.15);
      ctx.fill();
    }
    if (flash > 0) {
      ctx.globalAlpha = alpha * flash;
      ctx.fillStyle = COLORS.impact;
      ctx.fillRect(x + w * 0.3, y + h * 0.08, w * 0.4, h * (PLAYER_CHARACTER_FEET_RATIO - 0.08));
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

  // Kill frame: dim the arena (the HUD draws after, undimmed), then the bullet path from the gun
  // along the shot line to the impact. The heroes (shooter lit, victim as a white silhouette) sit
  // on the hero layer above this canvas, so the path ends at the victim's near edge; the impact
  // disc above the silhouette, as mocked, needs an overlay from the hero layer.
  drawKillFrame(ctx, fullWidth, fullHeight, worldRect, killFrame) {
    ctx.save();
    ctx.fillStyle = DIM_COLOR;
    ctx.fillRect(0, 0, fullWidth, fullHeight);

    const shooter = this.s.players?.[killFrame.shooterIndex];
    const victim = this.s.players?.[killFrame.victimIndex];
    if (shooter && victim) {
      const s = worldRect.box.scale;
      const from = this.muzzlePoint(shooter, worldRect);
      const end = killPathEndWorld(killFrame, victim, shooter);
      const to = this.projectWorldPointToScreen(worldRect, end.x, end.y);
      const toX = to.x;
      const toY = to.y;
      const team = TEAM_COLORS[killFrame.shooterIndex];

      const cx = fullWidth * 0.5;
      const cy = fullHeight * 0.5;
      ctx.translate(this.fx.x * s + cx, this.fx.y * s + cy);
      ctx.scale(this.fx.zoom, this.fx.zoom);
      ctx.translate(-cx, -cy);

      ctx.lineCap = "round";
      ctx.globalAlpha = FEEDBACK.pathGlowAlpha;
      ctx.lineWidth = FEEDBACK.pathGlowWidth * s;
      ctx.strokeStyle = team.glow;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = FEEDBACK.pathWidth * s;
      ctx.strokeStyle = team.main;
      ctx.stroke();

      const impact = this.sprites.bullets[killFrame.shooterIndex];
      if (impact) {
        ctx.globalCompositeOperation = "lighter";
        drawSpriteCentered(ctx, impact, toX, toY);
      }
    }
    ctx.restore();
  }

  flushHeroLayer(game, worldRect, fullWidth, fullHeight, zoom) {
    if (!heroLayer.isAvailable()) {
      return;
    }
    heroLayer.safeRender({
      width: fullWidth,
      height: fullHeight,
      dpr: Number(game?.dpr) || 1,
      unitPx: (PLAYER_DRAW_HEIGHT * worldRect.scale * zoom) / HERO_RIG_HEIGHT_UNITS,
      nowMs: this.s.cachedNowMs,
      actors: this.heroActors,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Projection

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

  // ---------------------------------------------------------------------------------------------
  // Debug (dev overlay)

  getDebugLines() {
    const worldRect = getDesignWorldRect(this.s.width, this.s.height, this.s.worldWidth, this.s.worldHeight);
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
    const worldRect = getDesignWorldRect(
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
      ctx.strokeStyle = DEBUG_COLORS.platformLine;
      ctx.strokeRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      ctx.fillStyle = DEBUG_COLORS.platformFill;
      ctx.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      ctx.strokeStyle = COLORS.accent;
      ctx.strokeRect(supportRect.x, supportRect.y, supportRect.width, supportRect.height);
      ctx.fillStyle = DEBUG_COLORS.supportFill;
      ctx.fillRect(supportRect.x, supportRect.y, supportRect.width, supportRect.height);
      ctx.fillStyle = COLORS.text;
      ctx.font = textFont(TYPE.min);
      ctx.fillText(platform.name ?? platform.id ?? "platform", bodyRect.x + 4, bodyRect.y - 4);
    }

    ctx.setLineDash([]);
    this.renderPlayerDebug(ctx, worldRect, this.s.p1, 0);
    this.renderPlayerDebug(ctx, worldRect, this.s.p2, 1);
    ctx.restore();
  }

  renderPlayerDebug(ctx, worldRect, player, index) {
    if (!player) {
      return;
    }

    const bodyRect = this.projectWorldRectToScreen(worldRect, player.x, player.y, player.width, player.height);
    const metrics = this.getPlayerDrawMetrics(player, worldRect);

    ctx.strokeStyle = TEAM_COLORS[index].main;
    ctx.strokeRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
    ctx.fillStyle = DEBUG_COLORS.teamFill[index];
    ctx.fillRect(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
    ctx.strokeStyle = DEBUG_COLORS.spriteLine;
    ctx.strokeRect(metrics.screenX, metrics.screenY, metrics.screenWidth, metrics.screenHeight);

    ctx.fillStyle = COLORS.impact;
    ctx.beginPath();
    ctx.arc(metrics.originX, metrics.originY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.impact;
    ctx.beginPath();
    ctx.moveTo(metrics.originX - 6, metrics.originY);
    ctx.lineTo(metrics.originX + 6, metrics.originY);
    ctx.moveTo(metrics.originX, metrics.originY - 6);
    ctx.lineTo(metrics.originX, metrics.originY + 6);
    ctx.stroke();
  }
}
