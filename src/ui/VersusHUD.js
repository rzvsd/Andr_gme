import {
  COLORS,
  DESIGN_BOX,
  HIT,
  MOTION,
  RADII,
  SPACE,
  TEAM_COLORS,
  TYPE,
  designBoxTransform,
  displayFont,
  textFont,
  trackingPx,
  withAlpha,
} from "../theme/tokens.js";
import { normalizePointerInput, pickNumber, resolveViewportSize, toNumber } from "./uiUtils.js";

// Match HUD, direction A: two pills in the top corners inside the 28 px side inset, 32 px tall
// (the mockup draws 33; the rule is under 8 percent of the 411 px design height, so 32), a
// centred goal label and a 48 px mute button bottom-right. All geometry is in design px
// (harness/evidence/T-13/mockups/a-match.html) and drawn through the design-box transform.
// Labels from setPlayerLabels are kept but not drawn: the team colour identifies the side
// (P1 red, left; P2 blue, right).
export const HUD_LAYOUT = Object.freeze({
  top: SPACE.insetTop,
  height: 32,
  minWidth: 232,
  padOuter: SPACE.s2 * 2 + 2, // 18: room for the 2 px team bar 8 px in
  padInner: SPACE.s3,
  gap: SPACE.s2,
  statsMargin: SPACE.s2,
  statsGap: SPACE.s3,
  barInset: SPACE.s2,
  barWidth: 2,
  barHeight: 16, // height - 2 * barInset
  goalCenterY: 30, // "FIRST TO 5": centred in the 14..46 band
});

// Mute in the top band, right of FIRST TO 5 (T-22: the SHOOT button took the bottom-right corner).
// Drawn as a 32 px circle (the pills' height) centred at x 513; x, y, size are its 48 px hit area.
export const MUTE_LAYOUT = Object.freeze({
  size: HIT.min,
  drawSize: HUD_LAYOUT.height,
  x: 513 - HIT.min / 2,
  y: HUD_LAYOUT.top + HUD_LAYOUT.height / 2 - HIT.min / 2,
});

// SHOOT button (VS BOT, T-22): 60 px bottom right, 16 px inside the side and bottom insets
// (x 787..847, y 313..373), clear of the ledges and the ground. Its edge is a ring of one arc per
// shot (harness/evidence/T-22/mockups/controls.html).
export const SHOOT_BUTTON_LAYOUT = Object.freeze({
  size: 60,
  x: DESIGN_BOX.width - SPACE.insetX - SPACE.s4 - 60,
  y: DESIGN_BOX.height - SPACE.insetBottom - SPACE.s4 - 60,
  ringRadius: 27,
  ringWidth: 4,
  gapDeg: 12,
});
const RING_SPENT_COLOR = withAlpha(COLORS.structure, 0.35);

// Shots left: one pip per shot under each pill, 6 px below it and lined up with the team bar
// (x 36 from the outer edge). Full = team colour with glow; spent = outline; a spent pip fills
// with dim team colour while the clip refills (harness/evidence/T-19/mockups/arena-v2.html).
export const SHOT_PIPS_LAYOUT = Object.freeze({
  top: HUD_LAYOUT.top + HUD_LAYOUT.height + 6,
  inset: SPACE.insetX + HUD_LAYOUT.barInset,
  width: 14,
  height: 5,
  gap: 4,
});
const PIP_OUTLINE_COLOR = withAlpha(COLORS.structure, 0.45);
const PIP_REFILL_ALPHA = 0.55;
const PIP_GLOW_ALPHA = 0.35;

const KEYS = {
  kills: ["kills"],
  deaths: ["deaths"],
  dodged: ["bulletsDodged", "dodges", "dodged"],
};

export class VersusHUD {
  constructor() {
    this._state = [{}, {}];
    this.titles = ["P1", "P2"];
    this.killsToWin = 5;
  }

  setPlayerLabels(labels = []) {
    const nextLabels = Array.isArray(labels) ? labels : [labels];
    this.titles = [
      typeof nextLabels[0] === "string" && nextLabels[0].trim().length > 0 ? nextLabels[0].trim() : "P1",
      typeof nextLabels[1] === "string" && nextLabels[1].trim().length > 0 ? nextLabels[1].trim() : "P2",
    ];
  }

  setKillsToWin(value) {
    const parsed = Math.round(toNumber(value, 5));
    this.killsToWin = parsed > 0 ? parsed : 5;
  }

  setState(playerIndex, stats) {
    const normalizedIndex = this._normalizePlayerIndex(playerIndex);
    this._state[normalizedIndex] = stats && typeof stats === "object" ? { ...stats } : {};
  }

  getState(playerIndex) {
    const normalizedIndex = this._normalizePlayerIndex(playerIndex);
    const state = this._state[normalizedIndex];
    return state && typeof state === "object" ? { ...state } : {};
  }

  // Mute hit rect in screen px for the given viewport.
  getMuteRect(viewWidth, viewHeight) {
    const box = designBoxTransform(viewWidth, viewHeight);
    return {
      x: box.offsetX + MUTE_LAYOUT.x * box.scale,
      y: box.offsetY + MUTE_LAYOUT.y * box.scale,
      width: MUTE_LAYOUT.size * box.scale,
      height: MUTE_LAYOUT.size * box.scale,
    };
  }

  muteContains(pointer, viewWidth, viewHeight) {
    const point = normalizePointerInput(pointer);
    const width = toNumber(viewWidth, NaN);
    const height = toNumber(viewHeight, NaN);
    if (!point || !(width > 0) || !(height > 0)) {
      return false;
    }
    const rect = this.getMuteRect(width, height);
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  render(ctx, viewWidth, viewHeight) {
    if (!ctx || typeof ctx.save !== "function") {
      return;
    }
    const view = this._resolveView(ctx, viewWidth, viewHeight);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }

    const box = designBoxTransform(view.width, view.height);
    ctx.save();
    ctx.translate(box.offsetX, box.offsetY);
    ctx.scale(box.scale, box.scale);
    ctx.textBaseline = "middle";

    this._drawPill(ctx, 0, this._state[0]);
    this._drawPill(ctx, 1, this._state[1]);

    ctx.font = textFont(TYPE.t2, 700);
    ctx.letterSpacing = `${trackingPx(TYPE.t2)}px`;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`FIRST TO ${this.killsToWin}`, DESIGN_BOX.width * 0.5, HUD_LAYOUT.goalCenterY);
    ctx.letterSpacing = "0px";
    ctx.restore();
  }

  // pips: [{ left, total, progress }, ...] per side; progress 0..1 is the refill of the spent pips.
  renderShotPips(ctx, viewWidth, viewHeight, pips) {
    if (!ctx || typeof ctx.save !== "function" || !Array.isArray(pips)) {
      return;
    }
    const view = this._resolveView(ctx, viewWidth, viewHeight);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }
    const box = designBoxTransform(view.width, view.height);
    const L = SHOT_PIPS_LAYOUT;
    const radius = L.height * 0.5;
    ctx.save();
    ctx.translate(box.offsetX, box.offsetY);
    ctx.scale(box.scale, box.scale);
    for (let side = 0; side < 2; side += 1) {
      const pip = pips[side];
      if (!pip) {
        continue;
      }
      const team = TEAM_COLORS[side];
      const total = Math.max(0, Math.round(toNumber(pip.total, 0)));
      const left = Math.max(0, Math.min(total, Math.round(toNumber(pip.left, 0))));
      const refill = Math.max(0, Math.min(1, toNumber(pip.progress, 0))) * (total - left);
      for (let index = 0; index < total; index += 1) {
        const step = index * (L.width + L.gap);
        const x = side === 0 ? L.inset + step : DESIGN_BOX.width - L.inset - L.width - step;
        if (index < left) {
          ctx.globalAlpha = PIP_GLOW_ALPHA;
          ctx.fillStyle = team.glow;
          this._roundedRect(ctx, x - 2, L.top - 2, L.width + 4, L.height + 4, radius + 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = team.main;
          this._roundedRect(ctx, x, L.top, L.width, L.height, radius);
          ctx.fill();
          continue;
        }
        const fill = Math.max(0, Math.min(1, refill - (index - left)));
        if (fill > 0) {
          const fillWidth = L.width * fill;
          ctx.globalAlpha = PIP_REFILL_ALPHA;
          ctx.fillStyle = team.main;
          this._roundedRect(ctx, side === 0 ? x : x + L.width - fillWidth, L.top, fillWidth, L.height, Math.min(radius, fillWidth * 0.5));
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = PIP_OUTLINE_COLOR;
        this._roundedRect(ctx, x + 0.5, L.top + 0.5, L.width - 1, L.height - 1, radius - 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // pip: { left, total, progress } for player 1. Each full shot is a lit team arc; a spent one is
  // an outline that fills while the clip refills. Empty, the label dims. `pressed` while held.
  renderShootButton(ctx, viewWidth, viewHeight, pip, pressed = false) {
    if (!ctx || typeof ctx.save !== "function" || !pip) {
      return;
    }
    const view = this._resolveView(ctx, viewWidth, viewHeight);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }
    const box = designBoxTransform(view.width, view.height);
    const L = SHOOT_BUTTON_LAYOUT;
    const team = TEAM_COLORS[0];
    const total = Math.max(1, Math.round(toNumber(pip.total, 1)));
    const left = Math.max(0, Math.min(total, Math.round(toNumber(pip.left, 0))));
    const refill = Math.max(0, Math.min(1, toNumber(pip.progress, 0))) * (total - left);
    const step = (Math.PI * 2) / total;
    const arc = step - (L.gapDeg * Math.PI) / 180;

    ctx.save();
    ctx.translate(box.offsetX, box.offsetY);
    ctx.scale(box.scale, box.scale);
    ctx.translate(L.x + L.size * 0.5, L.y + L.size * 0.5);
    if (pressed) {
      ctx.scale(MOTION.pressScale, MOTION.pressScale);
    }
    ctx.beginPath();
    ctx.arc(0, 0, L.size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    if (pressed) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = team.main;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.lineStrong;
    ctx.stroke();

    ctx.lineCap = "round";
    for (let index = 0; index < total; index += 1) {
      const start = -Math.PI / 2 + (L.gapDeg * Math.PI) / 360 + index * step;
      if (index < left) {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = L.ringWidth + 4;
        ctx.strokeStyle = team.glow;
        ctx.beginPath();
        ctx.arc(0, 0, L.ringRadius, start, start + arc);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = L.ringWidth;
        ctx.strokeStyle = team.main;
        ctx.beginPath();
        ctx.arc(0, 0, L.ringRadius, start, start + arc);
        ctx.stroke();
        continue;
      }
      ctx.lineWidth = L.ringWidth;
      ctx.strokeStyle = RING_SPENT_COLOR;
      ctx.beginPath();
      ctx.arc(0, 0, L.ringRadius, start, start + arc);
      ctx.stroke();
      const fill = Math.max(0, Math.min(1, refill - (index - left)));
      if (fill > 0) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = team.main;
        ctx.beginPath();
        ctx.arc(0, 0, L.ringRadius, start, start + arc * fill);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.font = textFont(TYPE.t2, 700);
    ctx.letterSpacing = `${trackingPx(TYPE.t2)}px`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = left > 0 ? COLORS.text : COLORS.dim;
    ctx.fillText("SHOOT", 0, 1);
    ctx.letterSpacing = "0px";
    ctx.restore();
  }

  // 48 px round icon button. `pressed` scales it by MOTION.pressScale.
  renderMuteButton(ctx, viewWidth, viewHeight, muted, pressed = false) {
    if (!ctx || typeof ctx.save !== "function") {
      return;
    }
    const view = this._resolveView(ctx, viewWidth, viewHeight);
    if (view.width <= 0 || view.height <= 0) {
      return;
    }
    const box = designBoxTransform(view.width, view.height);
    const half = MUTE_LAYOUT.drawSize * 0.5;
    const cx = MUTE_LAYOUT.x + MUTE_LAYOUT.size * 0.5;
    const cy = MUTE_LAYOUT.y + MUTE_LAYOUT.size * 0.5;

    ctx.save();
    ctx.translate(box.offsetX, box.offsetY);
    ctx.scale(box.scale, box.scale);
    ctx.translate(cx, cy);
    if (pressed) {
      ctx.scale(MOTION.pressScale, MOTION.pressScale);
    }
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.lineStrong;
    ctx.stroke();

    ctx.font = textFont(TYPE.t1, 600);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = muted ? COLORS.muted : COLORS.text;
    ctx.fillText("♫", 0, 1);
    if (muted) {
      // Muted reads by shape, not colour alone: a slash through the note.
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = COLORS.text;
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.lineTo(7, -7);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPill(ctx, side, state) {
    const L = HUD_LAYOUT;
    const team = TEAM_COLORS[side];
    const kills = String(Math.max(0, Math.round(pickNumber(state, KEYS.kills, 0))));
    const deaths = `DEATHS ${Math.max(0, Math.round(pickNumber(state, KEYS.deaths, 0)))}`;
    const dodged = `DODGED ${Math.max(0, Math.round(pickNumber(state, KEYS.dodged, 0)))}`;

    ctx.font = displayFont(TYPE.d2);
    ctx.letterSpacing = "0px";
    const numWidth = this._measure(ctx, kills);
    ctx.font = textFont(TYPE.t2, 700);
    ctx.letterSpacing = `${trackingPx(TYPE.t2)}px`;
    const killsWidth = this._measure(ctx, "KILLS");
    const deathsWidth = this._measure(ctx, deaths);
    const dodgedWidth = this._measure(ctx, dodged);

    const content = numWidth + L.gap + killsWidth + L.gap + L.statsMargin + deathsWidth + L.statsGap + dodgedWidth;
    const width = Math.max(L.minWidth, L.padOuter + content + L.padInner);
    const x = side === 0 ? SPACE.insetX : DESIGN_BOX.width - SPACE.insetX - width;
    const y = L.top;
    const cy = y + L.height * 0.5;

    // Panel
    this._roundedRect(ctx, x, y, width, L.height, RADII.panel);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.line;
    ctx.stroke();

    // Team bar on the outer edge with a soft glow (no shadowBlur per frame)
    const barX = side === 0 ? x + L.barInset : x + width - L.barInset - L.barWidth;
    const barY = y + L.barInset;
    ctx.fillStyle = team.glow;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(barX - 3, barY - 3, L.barWidth + 6, L.barHeight + 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = team.main;
    ctx.fillRect(barX, barY, L.barWidth, L.barHeight);

    // Text: P1 reads left to right from the bar; P2 is the mirror (row-reverse).
    if (side === 0) {
      let cursor = x + L.padOuter;
      ctx.textAlign = "left";
      ctx.font = displayFont(TYPE.d2);
      ctx.letterSpacing = "0px";
      ctx.fillStyle = COLORS.text;
      ctx.fillText(kills, cursor, cy + 1);
      cursor += numWidth + L.gap;
      ctx.font = textFont(TYPE.t2, 700);
      ctx.letterSpacing = `${trackingPx(TYPE.t2)}px`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText("KILLS", cursor, cy);
      cursor += killsWidth + L.gap + L.statsMargin;
      ctx.fillText(deaths, cursor, cy);
      cursor += deathsWidth + L.statsGap;
      ctx.fillText(dodged, cursor, cy);
    } else {
      let cursor = x + width - L.padOuter;
      ctx.textAlign = "right";
      ctx.font = displayFont(TYPE.d2);
      ctx.letterSpacing = "0px";
      ctx.fillStyle = COLORS.text;
      ctx.fillText(kills, cursor, cy + 1);
      cursor -= numWidth + L.gap;
      ctx.font = textFont(TYPE.t2, 700);
      ctx.letterSpacing = `${trackingPx(TYPE.t2)}px`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText("KILLS", cursor, cy);
      cursor -= killsWidth + L.gap + L.statsMargin;
      ctx.fillText(dodged, cursor, cy);
      cursor -= dodgedWidth + L.statsGap;
      ctx.fillText(deaths, cursor, cy);
    }
    ctx.letterSpacing = "0px";
  }

  _measure(ctx, text) {
    const metrics = typeof ctx.measureText === "function" ? ctx.measureText(text) : null;
    const width = toNumber(metrics?.width, NaN);
    return Number.isFinite(width) ? width : text.length * TYPE.t2 * 0.6;
  }

  _roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _normalizePlayerIndex(playerIndex) {
    const parsed = toNumber(playerIndex, 0);
    return parsed >= 1 ? 1 : 0;
  }

  _resolveView(ctx, viewWidth, viewHeight) {
    const width = toNumber(viewWidth, NaN);
    const height = toNumber(viewHeight, NaN);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width, height };
    }

    return resolveViewportSize(ctx);
  }
}
