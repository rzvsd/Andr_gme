// The three screens (title, atlas, plate) and the routing between them. Plain DOM, no framework.
import {
  atlasPlate,
  dailyPlate,
  CHAPTERS,
  PER_CHAPTER,
  NEED,
  COUNT,
  SHOTS,
  chapterOf,
  chapterOpen,
  solvedIn,
  nextPlate,
  totals,
  dayKey,
} from "../data/atlas.js";
import { store } from "../game/store.js";
import { createPlay } from "../game/play.js";
import { audio } from "../audio/synth.js";
import { compile, trace, WIN, W, H, A_STEPS, P_STEPS } from "../sim/physics.js";
import { makeView, begin, drawSheet, drawFixed, drawMoving, drawLine, drawHead, drawStill } from "../render/plate.js";
import { roman, GOLD, INK, rgba, display, serif } from "../render/theme.js";

const app = document.getElementById("app");
let screen = null;

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) {
    if (k === "class") node.className = val;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), val);
    else if (val === true) node.setAttribute(k, "");
    else if (val !== false && val != null) node.setAttribute(k, val);
  }
  node.append(...kids.flat().filter((k) => k != null && k !== false));
  return node;
}

const go = (hash) => {
  if (location.hash.slice(1) === hash) route();
  else location.hash = hash;
};
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const plural = (n) => (n === 1 ? "1 line" : `${n} lines`);
const STAR = "M8 0.6 9.9 6.1 15.4 8 9.9 9.9 8 15.4 6.1 9.9 0.6 8 6.1 6.1Z";

// Three stardust marks; `mask` says which are taken.
function stars(mask) {
  const box = el("span", { class: "stars", role: "img" });
  const NS = "http://www.w3.org/2000/svg";
  const marks = [0, 1, 2].map(() => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", STAR);
    svg.append(path);
    box.append(svg);
    return svg;
  });
  box.set = (m) => {
    box.setAttribute("aria-label", `${(m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1)} of 3 stardust`);
    marks.forEach((svg, i) => svg.classList.toggle("on", ((m >> i) & 1) === 1));
  };
  box.set(mask);
  return box;
}
const maskOf = (count) => [0, 1, 3, 7][count] || 0;

function soundButton() {
  const label = () => (store.data.sound ? "Sound on" : "Sound off");
  const b = el(
    "button",
    {
      class: "btn",
      onclick: () => {
        store.data.sound = !store.data.sound;
        store.save();
        audio.unlock();
        audio.setOn(store.data.sound);
        if (store.data.sound) audio.tick();
        b.textContent = label();
      },
    },
    label(),
  );
  return b;
}

function sheetLines(plate, aims) {
  const c = compile(plate);
  return aims.map(([a, p]) => {
    const tr = trace(c, a, p);
    return { pts: tr.pts, result: tr.f.result, dust: tr.f.dust };
  });
}

// Largest 3:4 sheet that fits the stage.
function fitWidth(stage) {
  return Math.max(120, Math.floor(Math.min(stage.clientWidth, stage.clientHeight * (W / H))));
}

/* ---------------------------------------------------------------- title */

// The frontispiece: a plate that keeps drawing lines by itself.
function frontis(canvas) {
  const plate = atlasPlate(7);
  const c = compile(plate);
  const ctx = canvas.getContext("2d");
  const fixed = document.createElement("canvas");
  let v = makeView(300, 1);
  let lines = [];
  let clock = 0;
  let nextAt = 0.5;
  let k = 0;

  function spawn() {
    const base = k % 2 ? plate.sol : plate.best;
    const wild = k % 3 === 2;
    const a = base[0] + (wild ? (((k * 37) % 13) - 6) * 14 : 0);
    const p = Math.max(40, Math.min(P_STEPS, base[1] + (wild ? (((k * 53) % 11) - 5) * 16 : 0)));
    k++;
    const tr = trace(c, (a + A_STEPS) % A_STEPS, p, 1);
    lines.push({ pts: tr.pts, win: tr.f.result === WIN, born: clock });
    if (lines.length > 8) lines.shift();
  }

  return {
    resize(width) {
      v = makeView(width, dpr());
      for (const cv of [canvas, fixed]) {
        cv.width = Math.round(width * dpr());
        cv.height = Math.round((width * dpr() * H) / W);
      }
      canvas.style.width = `${width}px`;
      canvas.style.height = `${(width * H) / W}px`;
      const g = fixed.getContext("2d");
      begin(g, v);
      drawSheet(g, plate, v, true);
      drawFixed(g, plate, v, { labels: true });
    },
    frame(dt) {
      clock += dt;
      if (clock >= nextAt) {
        spawn();
        nextAt = clock + 3.4;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fixed, 0, 0);
      begin(ctx, v);
      drawMoving(ctx, plate, v, 0, { clock, labels: true });
      for (const ln of lines) {
        const age = clock - ln.born;
        const upto = Math.min(ln.pts.length, Math.floor(age * 190) * 2);
        const fade = Math.max(0, 1 - Math.max(0, age - 16) / 8);
        if (ln.win) {
          drawLine(ctx, ln.pts, v, rgba(GOLD, 0.2 * fade), 6, upto);
          drawLine(ctx, ln.pts, v, rgba(GOLD, fade), 2, upto);
        } else {
          drawLine(ctx, ln.pts, v, rgba(INK, 0.32 * fade), 1, upto);
        }
        if (upto >= 2 && upto < ln.pts.length && ln.pts[upto - 2] === ln.pts[upto - 2]) {
          drawHead(ctx, ln.pts[upto - 2], ln.pts[upto - 1], v);
        }
      }
    },
  };
}

function titleScreen() {
  const canvas = el("canvas", { class: "sheet", "aria-hidden": "true" });
  const stage = el("div", { class: "stage" }, canvas);
  const last = store.data.last ?? -1;
  const n = last >= 0 && !store.peek(`a${last}`)?.s ? last : nextPlate(last);
  const started = Object.keys(store.data.plates).length > 0;
  const main =
    n >= 0
      ? el("button", { class: "btn primary", onclick: () => go(`p/${n + 1}`) }, started ? `Continue · Plate ${roman(n + 1)}` : "Begin")
      : el("button", { class: "btn primary", onclick: () => go("atlas") }, "Atlas");
  app.append(
    el(
      "section",
      { class: "screen title" },
      el("header", { class: "masthead" }, el("h1", {}, "Inkfall")),
      stage,
      el(
        "nav",
        { class: "actions" },
        main,
        el(
          "div",
          { class: "row" },
          n >= 0 && el("button", { class: "btn", onclick: () => go("atlas") }, "Atlas"),
          el("button", { class: "btn", onclick: () => go("today") }, "Today"),
          soundButton(),
        ),
      ),
    ),
  );
  const fr = frontis(canvas);
  const resize = () => fr.resize(fitWidth(stage));
  resize();
  return {
    frame: fr.frame,
    resize,
    key(e) {
      if (e.key === "Enter") main.click();
    },
  };
}

/* ---------------------------------------------------------------- atlas */

function atlasScreen() {
  const jobs = [];
  const t = totals();

  const cell = (n) => {
    const plate = atlasPlate(n);
    const rec = store.peek(plate.id);
    const canvas = el("canvas", {});
    jobs.push(() => {
      const width = canvas.clientWidth || 80;
      canvas.width = Math.round(width * dpr());
      canvas.height = Math.round((width * dpr() * H) / W);
      const lines = rec?.sheet ? sheetLines(plate, rec.sheet.slice(-10)) : [];
      const gold = lines.pop();
      drawStill(canvas.getContext("2d"), plate, makeView(width, dpr()), {
        rev: rec?.rev || 0,
        ghosts: lines,
        gold: gold?.pts,
        dust: gold?.dust || 0,
      });
    });
    const state = rec?.s ? `solved, ${rec.d} of 3 stardust` : "not solved";
    return el(
      "button",
      { class: `cell${rec?.s ? " solved" : ""}`, "aria-label": `Plate ${n + 1}, ${plate.title}, ${state}`, onclick: () => go(`p/${n + 1}`) },
      canvas,
      el("span", { class: "meta" }, el("b", {}, roman(n + 1)), rec?.s ? stars(maskOf(rec.d)) : null),
    );
  };

  const chapter = (name, ch) => {
    const open = chapterOpen(ch);
    const note = open ? `${solvedIn(ch)} / ${PER_CHAPTER}` : `Opens after ${NEED} plates of ${CHAPTERS[ch - 1]}`;
    return el(
      "section",
      { class: `chapter${open ? "" : " shut"}` },
      el("h2", {}, el("span", {}, roman(ch + 1)), name, el("small", {}, note)),
      open && el("div", { class: "grid" }, Array.from({ length: PER_CHAPTER }, (_, i) => cell(ch * PER_CHAPTER + i))),
    );
  };

  app.append(
    el(
      "section",
      { class: "screen atlas" },
      el(
        "header",
        { class: "bar" },
        el("button", { class: "link", onclick: () => go("") }, "‹ Inkfall"),
        el("div", { class: "heading" }, el("em", {}, "Atlas")),
        el("div", { class: "tally" }, el("span", {}, `${t.solved} / ${COUNT} plates`), el("span", {}, `${t.dust} / ${COUNT * 3} stardust`)),
      ),
      el(
        "div",
        { class: "scroll" },
        CHAPTERS.map(chapter),
        el(
          "footer",
          { class: "colophon" },
          el("p", {}, `The skies in this atlas were chosen by a program that drew ${SHOTS.toLocaleString("en")} test lines and kept the ones with an answer. The charts and the sounds are made by code. There is no picture and no recording in it.`),
          el("p", {}, "Made by Claude."),
        ),
      ),
    ),
  );

  return {
    // Thumbnails are painted a few per frame so the page opens at once.
    frame() {
      for (let i = 0; i < 3 && jobs.length; i++) jobs.shift()();
    },
    key(e) {
      if (e.key === "Escape") go("");
    },
  };
}

/* ---------------------------------------------------------------- plate */

// The finished sheet as a picture, with a caption under it.
function picture(plate, text) {
  const rec = store.rec(plate.id);
  const cv = document.createElement("canvas");
  cv.width = 1080;
  cv.height = 1440 + 130;
  const g = cv.getContext("2d");
  g.fillStyle = "#070b18";
  g.fillRect(0, 0, cv.width, cv.height);
  const lines = sheetLines(plate, rec.sheet || []);
  const gold = lines.pop();
  drawStill(g, plate, makeView(1080, 1), { rich: true, labels: true, rev: rec.rev, ghosts: lines, gold: gold?.pts, dust: gold?.dust || 0 });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.textBaseline = "middle";
  g.fillStyle = INK;
  g.font = display(46, "600");
  g.textAlign = "left";
  g.fillText("I N K F A L L", 40, 1440 + 68);
  g.font = serif(32, "italic");
  g.textAlign = "right";
  g.fillStyle = rgba(INK, 0.8);
  g.fillText(text, 1040, 1440 + 68);
  return cv;
}

async function share(plate, text) {
  const blob = await new Promise((done) => picture(plate, text).toBlob(done, "image/png"));
  const file = new File([blob], "inkfall.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Inkfall", text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  el("a", { href: url, download: `inkfall-${plate.id}.png` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const canShareFiles = () => typeof navigator.canShare === "function" && typeof File === "function";

function plateScreen(plate, daily = false) {
  const rec = store.rec(plate.id);
  const n = plate.n ?? -1;
  const nextWasOpen = daily || chapterOf(n) + 1 >= CHAPTERS.length || chapterOpen(chapterOf(n) + 1);
  if (!daily) store.data.last = n;

  const canvas = el("canvas", { class: "sheet", role: "img", "aria-label": `${plate.title}. Drag on the sheet to aim, release to draw.` });
  const stage = el("div", { class: "stage" }, canvas);
  const live = stars(0);
  const linesOut = el("span", {}, "");
  const inkFill = el("i", {});

  const dial = (name, down, up) => {
    const out = el("b", {}, "");
    const hold = (da, dp) => {
      let timer = 0;
      const stop = () => clearInterval(timer);
      return {
        onpointerdown: (e) => {
          e.preventDefault();
          audio.unlock();
          play.nudge(da, dp);
          audio.tick();
          let wait = 6;
          stop();
          timer = setInterval(() => {
            if (!node.isConnected) stop();
            else if (wait-- <= 0) play.nudge(da, dp);
          }, 55);
        },
        onpointerup: stop,
        onpointerleave: stop,
        onpointercancel: stop,
        onkeydown: (e) => {
          if (e.key === "Enter" || e.key === " ") play.nudge(da, dp);
        },
      };
    };
    const node = el(
      "div",
      { class: "dial" },
      el("button", { "aria-label": `${name} down`, ...hold(...down) }, "‹"),
      el("output", {}, el("small", {}, name), out),
      el("button", { "aria-label": `${name} up`, ...hold(...up) }, "›"),
    );
    node.out = out;
    return node;
  };
  const angle = dial("Angle", [-2, 0], [2, 0]);
  const speed = dial("Speed", [0, -5], [0, 5]);

  const drawBtn = el(
    "button",
    {
      class: "btn primary",
      onclick: () => {
        audio.unlock();
        if (play.phase === "fly") play.lift();
        else play.launch();
      },
    },
    "Draw",
  );
  const hintBtn = el("button", { class: "btn", onclick: () => play.hint() }, "Hint");
  const freshBtn = el("button", { class: "btn", onclick: () => play.fresh() }, "New sheet");
  const controls = el(
    "div",
    { class: "controls" },
    el("div", { class: "dials" }, angle, speed),
    el("div", { class: "row three" }, hintBtn, drawBtn, freshBtn),
  );
  const card = el("div", { class: "card", hidden: true });
  const desk = el("footer", { class: "desk" }, el("div", { class: "ink", "aria-hidden": "true" }, inkFill), controls, card);

  const heading = daily
    ? [el("small", {}, new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" })), el("em", {}, plate.title)]
    : [el("small", {}, `Plate ${roman(n + 1)}`), el("em", {}, plate.title)];
  app.append(
    el(
      "section",
      { class: "screen plate" },
      el(
        "header",
        { class: "bar" },
        el("button", { class: "link", onclick: () => go(daily ? "" : "atlas") }, daily ? "‹ Inkfall" : "‹ Atlas"),
        el("div", { class: "heading" }, heading),
        el("div", { class: "tally" }, live, linesOut),
      ),
      stage,
      desk,
    ),
  );

  let cardUp = false;
  function sync(fast) {
    inkFill.style.transform = `scaleX(${play.ink})`;
    live.set(play.dust);
    if (fast) return;
    angle.out.textContent = `${(play.aim.a / 10).toFixed(1)}°`;
    speed.out.textContent = `${(play.aim.p / 10).toFixed(1)}%`;
    linesOut.textContent = plural(play.lines);
    const flying = play.phase === "fly";
    drawBtn.textContent = flying ? "Lift pen" : "Draw";
    hintBtn.textContent = play.hinted ? "Show aim" : "Hint";
    hintBtn.disabled = flying || play.hinted > 1;
    freshBtn.disabled = flying || play.lines === 0;
    for (const b of controls.querySelectorAll(".dial button")) b.disabled = flying;
    if (flying && !store.data.taught) {
      store.data.taught = true;
      store.save();
    }
  }

  function done(result) {
    cardUp = true;
    const label = daily ? `Today · ${plate.title}` : `Plate ${roman(n + 1)} · ${plate.title}`;
    const text = `${label} · ${plural(result.lines)} · ${result.dust}/3 stardust`;
    const notes = [];
    if (daily) {
      const today = dayKey();
      if (store.data.lastDaily !== today) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        store.data.streak = store.data.lastDaily === dayKey(y) ? store.data.streak + 1 : 1;
        store.data.lastDaily = today;
        store.save();
      }
      if (store.data.streak > 1) notes.push(`${store.data.streak} days in a row`);
    } else if (result.first && totals().solved === COUNT) {
      notes.push("The atlas is complete");
    } else if (!nextWasOpen && chapterOpen(chapterOf(n) + 1)) {
      notes.push(`${CHAPTERS[chapterOf(n) + 1]} is open`);
    }
    const next = daily ? -1 : nextPlate(n);
    const shareBtn = el("button", { class: `btn${daily ? " primary" : ""}`, onclick: () => share(plate, text) }, canShareFiles() ? "Share" : "Save picture");
    const againBtn = el(
      "button",
      {
        class: "btn",
        onclick: () => {
          cardUp = false;
          card.hidden = true;
          controls.hidden = false;
          play.fresh();
        },
      },
      "Redraw",
    );
    const onward = daily
      ? el("button", { class: "btn", onclick: () => go("atlas") }, "Atlas")
      : next >= 0
        ? el("button", { class: "btn primary", onclick: () => go(`p/${next + 1}`) }, "Next plate")
        : el("button", { class: "btn primary", onclick: () => go("atlas") }, "Atlas");
    card.replaceChildren(
      el("p", { class: "verdict" }, stars(result.mask), el("span", {}, `Drawn in ${plural(result.lines)}`)),
      el("p", { class: "note" }, notes.join(" · ")),
      el("div", { class: "row three" }, againBtn, daily ? shareBtn : onward, daily ? onward : shareBtn),
    );
    controls.hidden = true;
    card.hidden = false;
    card.querySelector(".primary").focus({ preventScroll: true });
  }

  const play = createPlay(canvas, {
    plate,
    rec,
    audio,
    save: () => store.save(),
    onChange: sync,
    onDone: done,
    teach: !store.data.taught,
  });
  const resize = () => play.resize(fitWidth(stage), dpr());
  resize();
  sync();
  store.save();

  return {
    play,
    frame: (dt) => play.frame(dt),
    resize,
    destroy: () => play.destroy(),
    key(e) {
      const big = e.shiftKey ? 5 : 1;
      if (e.key === "Escape") go(daily ? "" : "atlas");
      else if (cardUp) return;
      else if (e.key === "ArrowLeft") play.nudge(2 * big, 0);
      else if (e.key === "ArrowRight") play.nudge(-2 * big, 0);
      else if (e.key === "ArrowUp") play.nudge(0, 5 * big);
      else if (e.key === "ArrowDown") play.nudge(0, -5 * big);
      else if ((e.key === "Enter" || e.key === " ") && e.target.tagName !== "BUTTON") drawBtn.click();
      else if (e.key === "h") hintBtn.click();
      else if (e.key === "n") freshBtn.click();
      else return;
      e.preventDefault();
    },
  };
}

/* ---------------------------------------------------------------- routing */

let token = 0;
async function route() {
  const mine = ++token;
  const hash = location.hash.slice(1);
  screen?.destroy?.();
  screen = null;
  app.replaceChildren();
  const m = /^p\/(\d+)$/.exec(hash);
  if (m && +m[1] >= 1 && +m[1] <= COUNT && chapterOpen(chapterOf(+m[1] - 1))) {
    screen = plateScreen(atlasPlate(+m[1] - 1));
  } else if (hash === "atlas") {
    screen = atlasScreen();
  } else if (hash === "today") {
    const plate = await dailyPlate();
    if (mine !== token) return;
    screen = plateScreen(plate, true);
  } else {
    screen = titleScreen();
  }
}

export function start() {
  audio.setOn(store.data.sound);
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => screen?.resize?.());
  window.addEventListener("keydown", (e) => screen?.key?.(e));
  window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    screen?.frame?.(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return route();
}

export const debug = {
  get screen() {
    return screen;
  },
  go,
  picture,
};
