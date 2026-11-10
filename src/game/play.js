// One plate on one canvas: aiming, the flight of a line, and what is left on the sheet afterwards.
// The page around it (buttons, read-outs) talks to this through the returned object.
import { compile, createFlight, step, trace, DT, WIN, CRASH, LOST, DRY, DARK, A_STEPS, P_STEPS, W, H } from "../sim/physics.js";
import { makeView, begin, drawSheet, drawFixed, drawMoving, drawLine, drawGhost, drawAim, drawHead, drawGold } from "../render/plate.js";
import { INK, GOLD, RED, TEAL, rgba } from "../render/theme.js";

const SPEED = 1.3; // flight time runs a little faster than the clock
const DEAD = 12; // px a finger must travel before it counts as an aim
const KEEP = 40; // lines kept on a sheet
const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
// The browser only allows a vibration after a real tap.
const buzz = (pattern) => {
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(pattern);
};
const ease = (u) => u * u * (3 - 2 * u);

export function createPlay(canvas, { plate, rec, audio, save, onChange, onDone, teach = false }) {
  const ctx = canvas.getContext("2d");
  const fixed = document.createElement("canvas");
  const ghost = document.createElement("canvas");
  let v = makeView(300, 1);
  let cssW = 300;

  const c = compile(plate);
  let cSeen = c; // the plate as the player knows it: unseen bodies are left out of the aim preview
  const hidden = () => {
    let m = 0;
    plate.bodies.forEach((b, i) => {
      if (b.k === DARK && !((rec.rev >> i) & 1)) m |= 1 << i;
    });
    return m;
  };

  const home = Math.round((Math.atan2(plate.start.y - plate.target.y, plate.target.x - plate.start.x) * 1800) / Math.PI / 5) * 5;
  const aim = { a: (home + A_STEPS) % A_STEPS, p: 620 };
  if (rec.cur.length) [aim.a, aim.p] = rec.cur[rec.cur.length - 1];

  let phase = "aim"; // aim | fly | done
  let f = null;
  let path = [];
  let acc = 0;
  let clock = 0;
  let lines = rec.cur.map(([a, p]) => {
    const tr = trace(c, a, p);
    return { pts: tr.pts, result: tr.f.result };
  });
  let dots = [];
  let drag = null;
  let seen = 0;
  let hintLevel = 0;
  let teaching = teach;
  let fx = [];
  let near = { i: -1, d: 1e9, falling: false };
  let result = null;
  let gold = null;
  let endT = 0;
  let told = true;
  let tellAt = 0; // the page hears about a win a moment after it happens, so the gold line gets its moment

  function paintFixed() {
    const g = fixed.getContext("2d");
    begin(g, v);
    drawSheet(g, plate, v, true);
    drawFixed(g, plate, v, { rev: rec.rev, labels: true });
  }

  function paintGhosts() {
    const g = ghost.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, ghost.width, ghost.height);
    begin(g, v);
    lines.forEach((ln, i) => drawGhost(g, ln, v, i === lines.length - 1 && phase !== "done" ? 0.55 : 0.26));
  }

  function preview() {
    const p = createFlight(cSeen, aim.a, aim.p);
    dots = [];
    for (let i = 1; i <= 108; i++) {
      if (step(cSeen, p)) break;
      if (i % 6 === 0) dots.push(p.x, p.y);
    }
  }

  function refresh() {
    cSeen = compile(plate, hidden());
    preview();
  }

  function setAim(a, p) {
    aim.a = ((Math.round(a) % A_STEPS) + A_STEPS) % A_STEPS;
    aim.p = Math.max(40, Math.min(P_STEPS, Math.round(p)));
    preview();
    onChange();
  }

  function launch() {
    if (phase !== "aim") return;
    phase = "fly";
    teaching = false;
    hintLevel = 0;
    f = createFlight(c, aim.a, aim.p);
    path = [f.x, f.y];
    acc = 0;
    seen = 0;
    near = { i: -1, d: 1e9, falling: false };
    audio.launch(aim.p / P_STEPS);
    buzz(8);
    onChange();
  }

  function stepOnce() {
    const had = f.dust;
    step(c, f);
    if (f.jumped) {
      path.push(NaN, NaN);
      fx.push({ kind: "ring", x: f.x, y: f.y, t: clock, color: TEAL, r: 30 });
      audio.jump();
    }
    path.push(f.x, f.y);
    if (f.dust !== had) {
      const i = Math.log2(f.dust ^ had) | 0;
      fx.push({ kind: "ring", x: plate.dust[i].x, y: plate.dust[i].y, t: clock, color: GOLD, r: 14 });
      audio.dust(bits(f.dust));
    }
    let ni = -1;
    let nd = 1e9;
    for (let i = 0; i < c.n; i++) {
      const d = Math.hypot(c.px[i] - f.x, c.py[i] - f.y) - plate.bodies[i].r;
      if (plate.bodies[i].k === DARK && d < 90) seen |= 1 << i;
      if (c.mu[i] > 0 && d < nd) {
        nd = d;
        ni = i;
      }
    }
    // The closest pass of a body sounds a note.
    if (ni === near.i) {
      if (nd < near.d) near.falling = true;
      else if (near.falling && nd < 150) {
        near.falling = false;
        audio.pass(ni, 1 - nd / 150);
      }
    } else {
      near.i = ni;
      near.falling = false;
    }
    near.d = nd;
  }

  function finish() {
    const res = f.result;
    audio.tone(0);
    rec.k = (rec.k || 0) + 1;
    rec.cur.push([aim.a, aim.p]);
    if (rec.cur.length > KEEP) rec.cur.shift();
    if (res === WIN) {
      const got = bits(f.dust);
      if (!rec.sheet || got > rec.sd || (got === rec.sd && rec.k < rec.sk)) {
        rec.sheet = rec.cur.slice();
        rec.sd = got;
        rec.sk = rec.k;
      }
      result = { lines: rec.k, dust: got, mask: f.dust, first: !rec.s };
      rec.s = 1;
      rec.d = Math.max(rec.d, got);
      rec.n = rec.n ? Math.min(rec.n, rec.k) : rec.k;
      rec.cur = [];
      rec.k = 0;
      phase = "done";
      gold = path;
      endT = f.n * DT;
      told = false;
      tellAt = clock + 0.95;
      fx.push({ kind: "ring", x: f.x, y: f.y, t: clock, color: GOLD, r: plate.target.r });
      fx.push({ kind: "ring", x: f.x, y: f.y, t: clock + 0.22, color: GOLD, r: plate.target.r });
      audio.win(got);
      buzz([14, 60, 14, 60, 30]);
    } else {
      lines.push({ pts: path, result: res });
      if (lines.length > KEEP) lines.shift();
      if (res === CRASH) {
        fx.push({ kind: "splat", x: f.x, y: f.y, t: clock });
        audio.crash();
        buzz(24);
      } else if (res === LOST) audio.lost();
      else audio.dry();
      const found = seen & hidden();
      if (found) {
        rec.rev |= found;
        plate.bodies.forEach((b, i) => {
          if ((found >> i) & 1) fx.push({ kind: "ring", x: b.x, y: b.y, t: clock + 0.1, color: INK, r: b.r });
        });
        cSeen = compile(plate, hidden());
        paintFixed();
        audio.found();
      }
      phase = "aim";
      f = null;
      preview();
    }
    paintGhosts();
    save();
    onChange();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fixed, 0, 0);
    ctx.drawImage(ghost, 0, 0);
    begin(ctx, v);
    const t = phase === "fly" ? f.n * DT : phase === "done" ? endT : 0;
    const dust = phase === "fly" ? f.dust : phase === "done" ? result.mask : 0;
    drawMoving(ctx, plate, v, t, { dust, clock, labels: true });

    if (phase === "aim") {
      if (hintLevel && plate.sol) {
        const th = (plate.sol[0] * Math.PI) / 1800;
        const s = plate.start;
        ctx.strokeStyle = rgba(GOLD, 0.75);
        ctx.lineWidth = 1.2 * v.hair;
        ctx.setLineDash([2 * v.hair, 6 * v.hair]);
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(th) * 26, s.y - Math.sin(th) * 26);
        ctx.lineTo(s.x + Math.cos(th) * 300, s.y - Math.sin(th) * 300);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (teaching && !drag) {
        // A finger shows the move once: drag anywhere, the arrow follows.
        const u = clock % 3.4;
        const k = u < 0.5 ? 0 : u < 1.7 ? ease((u - 0.5) / 1.2) : u < 2.6 ? 1 : 0;
        drawAim(ctx, plate, v, aim.a, Math.max(40, aim.p * k), null, 0.95);
        if (u > 0.25 && u < 2.6) {
          const th = (aim.a * Math.PI) / 1800;
          const reach = dmax() * v.hair * (aim.p / P_STEPS) * k;
          const x0 = plate.start.x < W / 2 ? W * 0.66 : W * 0.34;
          const y0 = H * 0.8;
          const x1 = x0 + Math.cos(th) * reach;
          const y1 = y0 - Math.sin(th) * reach;
          ctx.strokeStyle = rgba(INK, 0.4);
          ctx.lineWidth = 1 * v.hair;
          ctx.setLineDash([3 * v.hair, 4 * v.hair]);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = rgba(INK, 0.16);
          ctx.strokeStyle = rgba(INK, 0.6);
          ctx.lineWidth = 1.2 * v.hair;
          ctx.beginPath();
          ctx.arc(x1, y1, 19 * v.hair, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        drawAim(ctx, plate, v, aim.a, aim.p, dots);
      }
    } else if (phase === "fly") {
      drawLine(ctx, path, v, INK, 1.9);
      drawHead(ctx, f.x, f.y, v);
    } else {
      drawGold(ctx, gold, v);
    }

    fx = fx.filter((e) => clock - e.t < 0.9);
    for (const e of fx) {
      const u = (clock - e.t) / 0.9;
      if (u < 0) continue;
      if (e.kind === "ring") {
        ctx.strokeStyle = rgba(e.color, 0.8 * (1 - u));
        ctx.lineWidth = 1.4 * v.hair;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 80 * ease(u), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(RED, 1 - u);
        for (let k = 0; k < 9; k++) {
          const a = k * 0.7 + e.x;
          const d = (16 + (k % 3) * 14) * ease(Math.min(1, u * 1.6));
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, (2.6 - (k % 3) * 0.6) * v.hair * (1 - u), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /** Advance by dt seconds and draw. */
  function frame(dt) {
    clock += dt;
    if (phase === "fly") {
      acc += dt * SPEED;
      while (acc >= DT && !f.result) {
        acc -= DT;
        stepOnce();
      }
      if (f.result) finish();
      else {
        audio.tone(Math.hypot(f.vx, f.vy));
        onChange(true);
      }
    } else if (phase === "done" && !told && clock >= tellAt) {
      told = true;
      onDone(result);
    }
    render();
  }

  const dmax = () => Math.max(120, Math.min(190, cssW * 0.42));

  function down(e) {
    if (phase !== "aim" || e.button > 0) return;
    audio.unlock();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not every pointer can be captured; the drag still works while it stays on the sheet.
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: aim.a, p: aim.p, live: false };
  }
  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const d = Math.hypot(dx, dy);
    if (d < DEAD) {
      if (drag.live) setAim(drag.a, drag.p);
      drag.live = false;
      return;
    }
    drag.live = true;
    setAim(Math.round((Math.atan2(-dy, dx) * 1800) / Math.PI / 5) * 5, Math.round(Math.min(1, d / dmax()) * 100) * 10);
  }
  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const live = drag.live;
    drag = null;
    if (live) launch();
  }
  function cancel() {
    if (!drag) return;
    setAim(drag.a, drag.p);
    drag = null;
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);

  refresh();

  return {
    plate,
    frame,
    launch,
    get aim() {
      return aim;
    },
    get phase() {
      return phase;
    },
    get result() {
      return result;
    },
    get lines() {
      return phase === "done" ? result.lines : rec.k || 0;
    },
    get dust() {
      return phase === "fly" ? f.dust : phase === "done" ? result.mask : 0;
    },
    get ink() {
      return phase === "fly" ? Math.max(0, 1 - f.len / c.ink) : phase === "done" ? 0 : 1;
    },
    get hinted() {
      return hintLevel;
    },
    nudge(da, dp) {
      if (phase === "aim") setAim(aim.a + da, aim.p + dp);
    },
    /** End the line now, where it is. */
    lift() {
      if (phase !== "fly") return;
      f.result = DRY;
      finish();
    },
    /** First call shows the direction of an answer, the second sets the whole aim. */
    hint() {
      if (phase !== "aim" || !plate.sol) return;
      hintLevel = Math.min(2, hintLevel + 1);
      if (hintLevel === 2) setAim(plate.sol[0], plate.sol[1]);
      else onChange();
    },
    /** A clean sheet: the old lines go, the plate stays. */
    fresh() {
      lines = [];
      rec.cur = [];
      rec.k = 0;
      phase = "aim";
      f = null;
      gold = null;
      result = null;
      told = true;
      paintGhosts();
      preview();
      save();
      onChange();
    },
    resize(width, dpr) {
      cssW = width;
      v = makeView(width, dpr);
      for (const cv of [canvas, fixed, ghost]) {
        cv.width = Math.round(width * dpr);
        cv.height = Math.round((width * dpr * H) / W);
      }
      canvas.style.width = `${width}px`;
      canvas.style.height = `${(width * H) / W}px`;
      paintFixed();
      paintGhosts();
    },
    repaint() {
      paintFixed();
      paintGhosts();
    },
    destroy() {
      audio.tone(0);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
    },
  };
}
