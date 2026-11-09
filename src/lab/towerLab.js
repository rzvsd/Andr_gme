import * as THREE from "three";
import { PUDD, CHONK, NINJA } from "../hero/characterDef.js";
import { buildCharacter } from "../hero/buildCharacter.js";
import { AliveLayer } from "../hero/aliveLayer.js";
import { COLORS, DESIGN_BOX, displayFont, textFont, trackingPx, withAlpha } from "../theme/tokens.js";
import { loadGameFonts } from "../theme/fonts.js";
import { TOWER, FLOORS, LADDERS, LOCKERS, CRATES, LAMPS, PICKUPS, SPAWNS, WEAPONS, ARENA_COLORS } from "./towerData.js";

// Tower lab: a playable look at direction B "Tower" with the real hero rigs.
// Dev-only (like hero-lab.html). It is a mockup that runs, not the game: the rules here are a first
// guess for T-29 to T-38 and nothing in src/scenes depends on this file.

// Screen px per world unit at the 891 x 411 design box. FAR is the planned match scale (a fighter is
// about 40 px tall); NEAR is for a close look at the fighters and weapons.
const ZOOMS = [{ name: "FAR", px: 21 }, { name: "NEAR", px: 34 }];
let zoomIndex = 0;
let PX = ZOOMS[0].px;
let VIEW_W = DESIGN_BOX.width / PX;
let VIEW_H = DESIGN_BOX.height / PX;
const RUN = 7, WALK = 2.6, ACCEL = 45, GRAVITY = 30, JUMP = 11, CLIMB = 5;
const BODY_H = 1.9, BODY_HALF = 0.55;
const HEROES = [PUDD, CHONK, NINJA];
const TEAM = [COLORS.p1, COLORS.p2];

const worldCanvas = document.getElementById("world");
const hudCanvas = document.getElementById("hud");
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas: worldCanvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(DESIGN_BOX.width, DESIGN_BOX.height, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
const camera = new THREE.OrthographicCamera(-VIEW_W / 2, VIEW_W / 2, VIEW_H / 2, -VIEW_H / 2, 0.1, 100);
const cam = { x: 0, y: 6 };
function setZoom(index) {
  zoomIndex = index % ZOOMS.length;
  PX = ZOOMS[zoomIndex].px;
  VIEW_W = DESIGN_BOX.width / PX;
  VIEW_H = DESIGN_BOX.height / PX;
  Object.assign(camera, { left: -VIEW_W / 2, right: VIEW_W / 2, top: VIEW_H / 2, bottom: -VIEW_H / 2 });
  camera.updateProjectionMatrix();
}

const hemi = new THREE.HemisphereLight("#dfe8ff", "#3a3f4a", 0.9);
const sun = new THREE.DirectionalLight("#ffffff", 1.2);
sun.position.set(4, 10, 12);
scene.add(hemi, sun);

const toon = (color) => new THREE.MeshToonMaterial({ color });
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
function box(w, h, d, material, x, y, z = 0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function barrel(radius, length, material, x, y, parent, radiusEnd = radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radius, length, 14), material);
  mesh.rotation.z = -Math.PI / 2; // lie along +x
  mesh.position.set(x, y, 0);
  parent.add(mesh);
  return mesh;
}

// ---------- arena ----------
const floorMat = toon(ARENA_COLORS.floor);
const edgeMat = glow(COLORS.structure, 0.5);
const ladderMat = glow(COLORS.structure, 0.32);
box(TOWER.half * 2 + 2, TOWER.top + 1, 0.2, toon(ARENA_COLORS.wall), 0, TOWER.top / 2 - 0.5, -1.4);
for (const side of [-1, 1]) box(1, TOWER.top + 1, 1.6, floorMat, side * (TOWER.half + 0.5), TOWER.top / 2 - 0.5);
box(TOWER.half * 2 + 2, 0.5, 1.6, floorMat, 0, TOWER.top + 0.25);
for (const f of FLOORS) {
  const len = f.x1 - f.x0;
  box(len, 0.35, 1.6, floorMat, (f.x0 + f.x1) / 2, f.y - 0.175);
  box(len, 0.05, 1.62, edgeMat, (f.x0 + f.x1) / 2, f.y);
}
for (const l of LADDERS) {
  const h = l.y1 - l.y0;
  for (const side of [-1, 1]) box(0.07, h, 0.07, ladderMat, l.x + side * 0.35, l.y0 + h / 2, -0.55);
  for (let y = l.y0 + 0.5; y < l.y1; y += 0.6) box(0.7, 0.06, 0.06, ladderMat, l.x, y, -0.55);
}
const lockers = LOCKERS.map((l) => {
  const group = new THREE.Group();
  group.position.set(l.x, l.y, -0.5);
  scene.add(group);
  box(1.3, 2.5, 0.9, toon(ARENA_COLORS.locker), 0, 1.25, 0, group);
  for (const y of [1.95, 2.1, 2.25]) box(0.7, 0.05, 0.02, edgeMat, 0, y, 0.46, group);
  box(0.04, 2.3, 0.02, edgeMat, 0.55, 1.25, 0.46, group);
  return { ...l, group, occupant: null, shake: 0 };
});
const crateBoxes = [];
for (const c of CRATES) {
  for (let i = 0; i < c.stack; i += 1) {
    const mesh = box(1.1, 1.1, 1.1, toon(ARENA_COLORS.crate), c.x, c.y + 0.55 + i * 1.1, -0.2);
    mesh.rotation.y = 0.12;
    box(1.12, 0.06, 1.12, edgeMat, c.x, c.y + 1.1 + i * 1.1, -0.2);
  }
  crateBoxes.push({ x0: c.x - 0.55, x1: c.x + 0.55, y0: c.y, y1: c.y + c.stack * 1.1 });
}
const lamps = LAMPS.map((l) => {
  const pivot = new THREE.Group();
  pivot.position.set(l.x, l.y + TOWER.floorGap - 0.35, 0.3);
  scene.add(pivot);
  box(0.04, 1.1, 0.04, glow(COLORS.structure, 0.6), 0, -0.55, 0, pivot);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 16, 1, true), toon(ARENA_COLORS.gunMetal));
  shade.position.y = -1.15;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), glow(ARENA_COLORS.lampGlow));
  bulb.position.y = -1.3;
  const light = new THREE.PointLight(ARENA_COLORS.lampGlow, 26, 8.5, 1.6);
  light.position.set(0, -1.4, 1.2);
  pivot.add(shade, bulb, light);
  return { ...l, pivot, angle: 0, vel: 0 };
});

// ---------- weapons ----------
function buildWeapon(id) {
  const group = new THREE.Group();
  const color = toon(WEAPONS[id].color);
  const metal = toon(ARENA_COLORS.gunMetal);
  if (id === "wide") {
    box(0.2, 0.22, 0.12, color, -0.1, -0.03, 0, group);
    barrel(0.065, 0.46, metal, 0.2, 0.07, group);
    barrel(0.065, 0.46, metal, 0.2, -0.07, group);
    box(0.06, 0.3, 0.16, color, 0.3, 0, 0, group);
  } else if (id === "quiet") {
    box(0.1, 0.2, 0.1, metal, -0.1, -0.1, 0, group);
    box(0.28, 0.1, 0.1, color, 0, 0, 0, group);
    barrel(0.03, 0.26, metal, 0.26, 0, group);
    barrel(0.075, 0.3, color, 0.52, 0, group);
  } else if (id === "flare") {
    box(0.1, 0.22, 0.1, metal, -0.06, -0.11, 0, group);
    barrel(0.1, 0.28, color, 0.08, 0, group);
    barrel(0.1, 0.12, toon("#ff7a2f"), 0.27, 0, group, 0.16);
  } else if (id === "trap") {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 20), color);
    disc.rotation.x = Math.PI / 2;
    group.add(disc);
    for (let i = 0; i < 8; i += 1) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 6), metal);
      const a = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0);
      tooth.rotation.z = a - Math.PI / 2;
      group.add(tooth);
    }
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), glow(COLORS.impact));
    dot.position.z = 0.05;
    group.add(dot);
  }
  return group;
}
const pickups = PICKUPS.map((p) => {
  const group = new THREE.Group();
  group.position.set(p.x, p.y, 0.25);
  scene.add(group);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20), glow(WEAPONS[p.weapon].color, 0.55));
  pad.position.y = 0.04;
  const model = buildWeapon(p.weapon);
  model.scale.setScalar(2.4);
  model.position.y = 1.15;
  group.add(pad, model);
  return { ...p, group, model, wait: 0 };
});

// ---------- fighters ----------
const tmp = new THREE.Vector3();
function makeFighter(def, team) {
  const spawn = SPAWNS[team];
  const f = {
    team, spawn, x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: true, facing: spawn.facing,
    climbing: null, locker: null, hp: 3, shots: 3, refill: 0, weapon: "base", uses: Infinity,
    reveal: 0, ko: 0, score: 0, stepT: 0, cool: 0, prevUp: false, model: null,
  };
  setHero(f, def);
  return f;
}
function setHero(f, def) {
  if (f.rig) scene.remove(f.rig.root, ...f.rig.worldParts);
  f.def = def;
  f.rig = buildCharacter(def);
  f.alive = new AliveLayer(f.rig);
  f.model = null;
  scene.add(f.rig.root, ...f.rig.worldParts);
  f.rig.root.position.set(f.x, f.y, 0);
  resetArms(f);
  equip(f, f.weapon);
}
// The noodle arms are Verlet chains in world space; after a teleport they must start at the body.
function resetArms(f) {
  const len = f.def.shape.arm.segmentLength;
  f.alive.chains.forEach((chain, side) => {
    const s = f.rig.shoulderLocal[side];
    chain.forEach((point, i) => {
      point.pos.set(f.x + s.x * f.facing, f.y + s.y - i * len, s.z);
      point.prev.copy(point.pos);
    });
  });
}
function equip(f, id) {
  const hand = f.rig.blaster;
  if (f.model) hand.remove(f.model);
  f.model = id === "base" ? null : buildWeapon(id);
  if (f.model) {
    f.model.scale.setScalar(1.35);
    hand.add(f.model);
  }
  hand.material.visible = id === "base";
  f.weapon = id;
  f.uses = WEAPONS[id].uses;
}
const p1 = makeFighter(PUDD, 0);
const p2 = makeFighter(NINJA, 1);
const fighters = [p1, p2];
const rival = (f) => (f === p1 ? p2 : p1);

// ---------- effects ----------
const bullets = [];
const flares = [];
const traps = [];
const flashes = [];
const events = []; // sounds: drawn as ripples in the world and as marks on the mini map
const sound = (x, y, kind, who, loud) => events.push({ x, y, kind, who, loud, t: 0 });

function flash(x, y, power) {
  const light = new THREE.PointLight("#ffffff", power, 7, 1.4);
  light.position.set(x, y, 1.5);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), glow(COLORS.impact));
  spark.position.set(x, y, 0.6);
  scene.add(light, spark);
  flashes.push({ light, spark, t: 0.11 });
}

function fire(f) {
  const w = WEAPONS[f.weapon];
  if (f.weapon === "base") {
    if (f.shots <= 0) return;
    f.shots -= 1;
    f.refill = 3;
  } else {
    f.uses -= 1;
  }
  f.cool = 0.25;
  f.reveal = Math.max(f.reveal, w.revealMs / 1000);
  f.alive.onShoot(f.facing);
  f.alive.muzzleWorld(tmp, f.facing);
  if (f.weapon === "trap") {
    const mesh = buildWeapon("trap");
    mesh.rotation.x = -Math.PI / 2 + 0.25;
    mesh.position.set(f.x + f.facing * 0.7, f.y + 0.08, 0.5);
    scene.add(mesh);
    traps.push({ x: mesh.position.x, y: f.y, owner: f, mesh });
    sound(f.x, f.y, "step", f, false);
  } else {
    const isFlare = f.weapon === "flare";
    for (let i = 0; i < w.pellets; i += 1) {
      const quiet = f.weapon === "quiet";
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(isFlare ? 0.17 : quiet ? 0.06 : 0.11, 10, 10),
        glow(f.weapon === "base" ? TEAM[f.team] : w.color, quiet ? 0.6 : 1)
      );
      mesh.scale.x = isFlare ? 1 : quiet ? 4 : 2.4;
      mesh.position.set(tmp.x, tmp.y, 0.4);
      scene.add(mesh);
      if (isFlare) mesh.add(new THREE.PointLight(w.color, 14, 6, 1.4));
      bullets.push({
        mesh, owner: f, flare: isFlare, x: tmp.x, y: tmp.y, range: w.range, gone: 0,
        vx: f.facing * w.speed, vy: isFlare ? 6.5 : (i - (w.pellets - 1) / 2) * w.spread,
      });
    }
    flash(tmp.x + f.facing * 0.2, tmp.y, w.revealMs >= 500 ? 60 : w.revealMs >= 200 ? 30 : 5);
    sound(f.x, f.y + 1, "shot", f, w.revealMs >= 200);
  }
  if (f.weapon !== "base" && f.uses <= 0) equip(f, "base");
}

function hit(g, dir) {
  if (g.ko > 0) return;
  g.hp -= 1;
  g.reveal = Math.max(g.reveal, 0.5);
  g.vx += dir * 3;
  g.alive.onHit(dir || 1);
  flash(g.x, g.y + 1, 40);
  sound(g.x, g.y + 1, "hit", g, true);
  if (g.locker) leaveLocker(g);
  if (g.hp <= 0) {
    g.ko = 1.7;
    g.climbing = null;
    g.alive.setFace("ko");
    rival(g).score += 1;
  }
}
function respawn(f) {
  Object.assign(f, { x: f.spawn.x, y: f.spawn.y, vx: 0, vy: 0, onGround: true, facing: f.spawn.facing, hp: 3, shots: 3, ko: 0, reveal: 0.6 });
  f.rig.root.rotation.z = 0;
  f.rig.root.position.set(f.x, f.y, 0);
  resetArms(f);
  f.alive.setFace("deadpan");
  equip(f, "base");
}
function leaveLocker(f) {
  f.locker.occupant = null;
  f.locker.shake = 0.25;
  f.locker = null;
}
function igniteFlare(x, y) {
  const w = WEAPONS.flare;
  const light = new THREE.PointLight(w.color, 70, w.lightRadius, 1.2);
  light.position.set(x, y + 0.8, 1.6);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), glow(w.color));
  mesh.position.set(x, y + 0.25, 0.5);
  scene.add(light, mesh);
  flares.push({ x, y, t: w.lightSeconds, light, mesh });
  sound(x, y, "shot", null, true);
}
const floorUnder = (x, y) => FLOORS.find((s) => Math.abs(s.y - y) < 0.02 && x >= s.x0 - 0.3 && x <= s.x1 + 0.3);
const landing = (x, prevY, y) => FLOORS.find((s) => prevY >= s.y && y <= s.y && x >= s.x0 - 0.3 && x <= s.x1 + 0.3);

// ---------- input ----------
const keys = new Set();
const touch = { stickX: 0, stickY: 0, jump: false, shoot: false };
const prev = { jump: false, shoot: false };
const STICK = { x: 106, y: 334, r: 44 };
const BTN_SHOOT = { x: 806, y: 322, r: 34 };
const BTN_JUMP = { x: 730, y: 356, r: 24 };
const BTN_LIGHTS = { x: 291.5, y: 366, w: 96, h: 36 };
const BTN_HERO = { x: 397.5, y: 366, w: 96, h: 36 };
const BTN_ZOOM = { x: 503.5, y: 366, w: 96, h: 36 };
let dark = false;
let heroIndex = 0;

function toggleLights() {
  dark = !dark;
  hemi.intensity = dark ? 0.03 : 0.9;
  sun.intensity = dark ? 0 : 1.2;
}
function nextHero() {
  heroIndex = (heroIndex + 1) % HEROES.length;
  setHero(p1, HEROES[heroIndex]);
}
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "KeyL") toggleLights();
  if (e.code === "KeyH") nextHero();
  if (e.code === "KeyZ") setZoom(zoomIndex + 1);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

const pointers = new Map();
const inCircle = (p, c, pad = 8) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + pad;
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 6 && p.y <= r.y + r.h + 6;
function designPoint(e) {
  const rect = stage.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * DESIGN_BOX.width, y: ((e.clientY - rect.top) / rect.height) * DESIGN_BOX.height };
}
function moveStick(p) {
  const dx = (p.x - STICK.x) / STICK.r;
  const dy = (p.y - STICK.y) / STICK.r;
  const len = Math.max(1, Math.hypot(dx, dy));
  touch.stickX = dx / len;
  touch.stickY = dy / len;
}
stage.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = designPoint(e);
  let role = null;
  if (inCircle(p, BTN_SHOOT)) role = "shoot";
  else if (inCircle(p, BTN_JUMP)) role = "jump";
  else if (inRect(p, BTN_LIGHTS)) toggleLights();
  else if (inRect(p, BTN_HERO)) nextHero();
  else if (inRect(p, BTN_ZOOM)) setZoom(zoomIndex + 1);
  else if (p.x < 330) role = "stick";
  if (!role) return;
  pointers.set(e.pointerId, role);
  if (role === "stick") moveStick(p);
  else touch[role] = true;
});
stage.addEventListener("pointermove", (e) => {
  if (pointers.get(e.pointerId) === "stick") moveStick(designPoint(e));
});
function release(e) {
  const role = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (role === "stick") touch.stickX = touch.stickY = 0;
  else if (role) touch[role] = false;
}
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

function playerInput() {
  const keyX = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  const slow = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const stickX = Math.abs(touch.stickX) > 0.25 ? touch.stickX : 0;
  const jump = keys.has("Space") || touch.jump;
  const shoot = keys.has("KeyF") || keys.has("KeyK") || keys.has("Enter") || touch.shoot;
  const input = {
    moveX: keyX !== 0 ? keyX * (slow ? 0.5 : 1) : stickX,
    up: keys.has("ArrowUp") || keys.has("KeyW") || touch.stickY < -0.6,
    down: keys.has("ArrowDown") || keys.has("KeyS") || touch.stickY > 0.6,
    jumpEdge: jump && !prev.jump,
    shootEdge: shoot && !prev.shoot,
  };
  prev.jump = jump;
  prev.shoot = shoot;
  return input;
}

const bot = { dir: -1, pause: 0, think: 1, shootT: 1.2, slow: false, saw: false };
function botInput(f, dt) {
  const input = { moveX: 0, up: false, down: false, jumpEdge: false, shootEdge: false };
  const seg = floorUnder(f.x, f.y);
  if (seg && f.x < seg.x0 + 1.4) bot.dir = 1;
  if (seg && f.x > seg.x1 - 1.4) bot.dir = -1;
  bot.think -= dt;
  if (bot.think <= 0) {
    bot.think = 1;
    if (Math.random() < 0.25) bot.pause = 0.9;
    bot.slow = Math.random() < 0.3;
  }
  bot.pause -= dt;
  bot.shootT -= dt;
  const dx = p1.x - f.x;
  const sees = Math.abs(p1.y - f.y) < 0.7 && Math.abs(dx) < 16 && !p1.locker && p1.ko <= 0 && (!dark || p1.reveal > 0 || Math.abs(dx) < 5);
  if (sees) {
    // Slow on purpose: the lab is for looking around, not for losing to the bot.
    if (!bot.saw) bot.shootT = 1.4;
    f.facing = Math.sign(dx) || 1;
    if (bot.shootT <= 0) {
      input.shootEdge = true;
      bot.shootT = 2.2;
    }
  } else if (bot.pause <= 0) {
    input.moveX = bot.dir * (bot.slow ? 0.5 : 1);
  }
  bot.saw = sees;
  return input;
}

// ---------- simulation ----------
function updateFighter(f, input, dt) {
  f.cool -= dt;
  f.reveal -= dt;
  if (f.shots < 3) {
    f.refill -= dt;
    if (f.refill <= 0) f.shots = 3;
  }
  const rigState = { vx: f.vx * 0.45, vy: f.vy * 0.45, onGround: f.onGround || !!f.climbing, facing: f.facing };
  if (f.ko > 0) {
    f.ko -= dt;
    f.rig.root.rotation.z += (-f.facing * 1.45 - f.rig.root.rotation.z) * Math.min(1, dt * 10);
    f.alive.updateFace(dt);
    f.alive.updateArms(dt, rigState);
    if (f.ko <= 0) respawn(f);
    return;
  }
  if (f.locker) {
    if (input.moveX !== 0 || input.jumpEdge || input.up) leaveLocker(f);
    return;
  }
  const ladder = LADDERS.find((l) => Math.abs(f.x - l.x) < 0.8 && f.y >= l.y0 - 0.1 && f.y <= l.y1 + 0.1);
  if (!f.climbing) {
    if (input.up && ladder && f.y < ladder.y1 - 0.1) f.climbing = ladder;
    else if (input.down && f.onGround && ladder && f.y > ladder.y0 + 0.1) f.climbing = ladder;
    else if (input.down && f.onGround) {
      const locker = lockers.find((l) => !l.occupant && Math.abs(l.x - f.x) < 0.9 && Math.abs(l.y - f.y) < 0.1);
      if (locker) {
        locker.occupant = f;
        locker.shake = 0.25;
        f.locker = locker;
        f.x = locker.x;
        f.vx = 0;
        return;
      }
    }
  }
  if (f.climbing) {
    const l = f.climbing;
    const dir = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    f.x += (l.x - f.x) * Math.min(1, dt * 14);
    f.vx = 0;
    f.vy = 0;
    f.y += dir * CLIMB * dt;
    f.onGround = false;
    if (f.y >= l.y1 || f.y <= l.y0) {
      f.y = f.y >= l.y1 ? l.y1 : l.y0;
      f.climbing = null;
      f.onGround = true;
    } else if (input.jumpEdge || (dir === 0 && input.moveX !== 0)) {
      f.climbing = null;
      f.vy = input.jumpEdge ? JUMP * 0.75 : 0;
      f.vx = Math.sign(input.moveX) * WALK;
    }
  } else {
    const top = Math.abs(input.moveX) < 0.6 ? WALK : RUN;
    const target = Math.sign(input.moveX) * top;
    f.vx += Math.sign(target - f.vx) * Math.min(Math.abs(target - f.vx), ACCEL * dt);
    if (input.moveX !== 0) f.facing = Math.sign(input.moveX);
    const upTap = input.up && !f.prevUp && !ladder;
    if ((input.jumpEdge || upTap) && f.onGround) {
      f.vy = JUMP;
      f.onGround = false;
      f.alive.onJump();
    }
    const prevY = f.y;
    f.x = THREE.MathUtils.clamp(f.x + f.vx * dt, -TOWER.half + 0.6, TOWER.half - 0.6);
    if (f.onGround) {
      if (!floorUnder(f.x, f.y)) f.onGround = false;
    } else {
      f.vy -= GRAVITY * dt;
      f.y += f.vy * dt;
      const seg = f.vy <= 0 ? landing(f.x, prevY, f.y) : null;
      if (seg) {
        f.y = seg.y;
        f.alive.onLand(f.vy * 0.5);
        if (f.vy < -7) sound(f.x, f.y, "land", f, true);
        f.vy = 0;
        f.onGround = true;
      }
    }
    if (f.onGround && Math.abs(f.vx) > 4) {
      f.stepT -= dt;
      if (f.stepT <= 0) {
        f.stepT = 0.3;
        sound(f.x, f.y, "step", f, false);
      }
    }
  }
  if (input.shootEdge && f.cool <= 0) fire(f);
  f.prevUp = input.up;
  f.rig.root.position.set(f.x, f.y, 0);
  f.alive.update(dt, { vx: f.vx * 0.45, vy: f.vy * 0.45, onGround: f.onGround || !!f.climbing, facing: f.facing });
}

function step(dt) {
  updateFighter(p1, playerInput(), dt);
  updateFighter(p2, botInput(p2, dt), dt);

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    const prevY = b.y;
    if (b.flare) b.vy -= 14 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.gone += Math.abs(b.vx) * dt;
    b.mesh.position.set(b.x, b.y, 0.4);
    const target = fighters.find((g) => g !== b.owner && g.ko <= 0 && Math.abs(b.x - g.x) < BODY_HALF && b.y > g.y && b.y < g.y + BODY_H);
    const blocked = crateBoxes.some((c) => b.x > c.x0 && b.x < c.x1 && b.y > c.y0 && b.y < c.y1);
    const landed = b.flare && b.vy < 0 && landing(b.x, prevY, b.y);
    if (target) hit(target, Math.sign(b.vx));
    if (target || blocked || landed || b.gone > b.range || Math.abs(b.x) > TOWER.half) {
      if (b.flare) igniteFlare(b.x, landed ? landed.y : b.y);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }
  for (let i = flares.length - 1; i >= 0; i -= 1) {
    const fl = flares[i];
    fl.t -= dt;
    fl.light.intensity = 70 * Math.min(1, fl.t) * (0.85 + Math.random() * 0.3);
    for (const g of fighters) if (Math.hypot(g.x - fl.x, g.y - fl.y) < WEAPONS.flare.lightRadius * 0.7) g.reveal = Math.max(g.reveal, 0.1);
    if (fl.t <= 0) {
      scene.remove(fl.light, fl.mesh);
      flares.splice(i, 1);
    }
  }
  for (let i = traps.length - 1; i >= 0; i -= 1) {
    const t = traps[i];
    const g = fighters.find((f) => f !== t.owner && f.ko <= 0 && !f.climbing && Math.abs(f.x - t.x) < 0.7 && Math.abs(f.y - t.y) < 0.2);
    if (!g) continue;
    hit(g, 0);
    g.reveal = Math.max(g.reveal, WEAPONS.trap.revealSeconds);
    scene.remove(t.mesh);
    traps.splice(i, 1);
  }
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    const fl = flashes[i];
    fl.t -= dt;
    fl.spark.scale.setScalar(1 + (0.11 - fl.t) * 22);
    if (fl.t <= 0) {
      scene.remove(fl.light, fl.spark);
      flashes.splice(i, 1);
    }
  }
  for (const p of pickups) {
    p.model.rotation.y += dt * 1.6;
    if (p.wait > 0) {
      p.wait -= dt;
      p.group.visible = p.wait <= 0;
      continue;
    }
    const taker = fighters.find((f) => f.weapon === "base" && f.ko <= 0 && !f.locker && Math.abs(f.x - p.x) < 0.8 && Math.abs(f.y - p.y) < 0.4);
    if (taker) {
      equip(taker, p.weapon);
      p.wait = 8;
      p.group.visible = false;
    }
  }
  for (const lamp of lamps) {
    for (const f of fighters) {
      if (Math.abs(f.x - lamp.x) < 1 && Math.abs(f.y - lamp.y) < 0.6 && Math.abs(f.vx) > 1) lamp.vel += Math.sign(f.vx) * dt * 9;
    }
    lamp.vel += (-lamp.angle * 16 - lamp.vel * 0.9) * dt;
    lamp.angle += lamp.vel * dt;
    lamp.pivot.rotation.z = lamp.angle;
  }
  for (const l of lockers) {
    l.shake = Math.max(0, l.shake - dt);
    l.group.rotation.z = Math.sin(l.shake * 60) * l.shake * 0.25;
  }
  for (let i = events.length - 1; i >= 0; i -= 1) {
    events[i].t += dt;
    if (events[i].t > 2.5) events.splice(i, 1);
  }
  // In the dark the rival shows only for a reason: a shot, a hit, a flare, a lamp overhead.
  for (const f of fighters) {
    const underLamp = lamps.some((l) => Math.abs(f.x - l.x) < 3 && Math.abs(f.y - l.y) < 0.6);
    const visible = !f.locker && (!dark || f === p1 || f.reveal > 0 || f.ko > 0 || underLamp);
    f.rig.root.visible = visible;
    for (const part of f.rig.worldParts) part.visible = visible;
  }
  const maxX = TOWER.half + 1 - VIEW_W / 2;
  const targetX = THREE.MathUtils.clamp(p1.x, -maxX, maxX);
  const targetY = THREE.MathUtils.clamp(p1.y + VIEW_H * 0.16, VIEW_H / 2 - 1.2, TOWER.top + 0.8 - VIEW_H / 2);
  cam.x += (targetX - cam.x) * Math.min(1, dt * 6);
  cam.y += (targetY - cam.y) * Math.min(1, dt * 6);
  camera.position.set(cam.x, cam.y, 20);
}

// ---------- HUD (2D, design box 891 x 411) ----------
const ctx = hudCanvas.getContext("2d");
function resizeHud() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  hudCanvas.width = Math.round(rect.width * dpr);
  hudCanvas.height = Math.round(rect.height * dpr);
}
window.addEventListener("resize", resizeHud);
const toScreen = (x, y) => [(x - cam.x) * PX + DESIGN_BOX.width / 2, DESIGN_BOX.height / 2 - (y - cam.y) * PX];

function pill(x, y, w, h, fill = COLORS.surface2, stroke = COLORS.line) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}
function label(text, x, y, font, color = COLORS.text, align = "left", caps = 0) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.letterSpacing = `${caps}px`;
  ctx.fillText(text, x, y);
}
function scorePill(f, x, name) {
  pill(x, 10, 150, 28);
  ctx.fillStyle = TEAM[f.team];
  ctx.beginPath();
  ctx.arc(x + 16, 24, 5, 0, Math.PI * 2);
  ctx.fill();
  label(name, x + 28, 24.5, textFont(12, 600));
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < f.hp ? TEAM[f.team] : COLORS.line;
    ctx.fillRect(x + 76 + i * 12, 20, 9, 8);
  }
  label(String(f.score), x + 136, 25, displayFont(16), COLORS.text, "right");
}
function circleButton(b, text, pressed) {
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = pressed ? COLORS.surface2 : withAlpha(COLORS.bg, 0.6);
  ctx.fill();
  ctx.strokeStyle = COLORS.lineStrong;
  ctx.lineWidth = b.r > 30 ? 3 : 1;
  ctx.stroke();
  label(text, b.x, b.y + 1, textFont(11, 600), COLORS.text, "center", trackingPx(11));
}

function drawHud() {
  const scale = hudCanvas.width / DESIGN_BOX.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, DESIGN_BOX.width, DESIGN_BOX.height);

  // sounds as ripples in the world
  for (const e of events) {
    if (e.t > 0.8) continue;
    const [sx, sy] = toScreen(e.x, e.y);
    const fade = 1 - e.t / 0.8;
    ctx.strokeStyle = withAlpha(e.who === p2 ? COLORS.p2 : COLORS.text, fade * (e.who === p2 ? 0.85 : 0.35));
    ctx.lineWidth = e.loud ? 2 : 1.2;
    const r = (e.loud ? 10 : 4) + e.t * (e.loud ? 46 : 16);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, e.kind === "step" || e.kind === "land" ? r * 0.35 : r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!dark) {
    for (const p of pickups) {
      if (p.wait > 0) continue;
      const [sx, sy] = toScreen(p.x, p.y + 2.2);
      label(WEAPONS[p.weapon].name, sx, sy, textFont(11, 600), COLORS.muted, "center", trackingPx(11));
    }
  }

  // mini map: the tower, your place, and each loud sound for a moment
  const map = { x: 357.5, y: 8, w: 176, h: 78 };
  ctx.beginPath();
  ctx.roundRect(map.x, map.y, map.w, map.h, 10);
  ctx.fillStyle = withAlpha(COLORS.bg, 0.92);
  ctx.fill();
  ctx.strokeStyle = COLORS.lineStrong;
  ctx.lineWidth = 1;
  ctx.stroke();
  const mx = (x) => map.x + 10 + ((x + TOWER.half) / (TOWER.half * 2)) * (map.w - 20);
  const my = (y) => map.y + map.h - 9 - (y / TOWER.top) * (map.h - 18);
  ctx.strokeStyle = withAlpha(COLORS.structure, 0.75);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const f of FLOORS) {
    ctx.moveTo(mx(f.x0), my(f.y));
    ctx.lineTo(mx(f.x1), my(f.y));
  }
  ctx.stroke();
  ctx.strokeStyle = withAlpha(COLORS.structure, 0.3);
  ctx.beginPath();
  for (const l of LADDERS) {
    ctx.moveTo(mx(l.x), my(l.y0));
    ctx.lineTo(mx(l.x), my(l.y1));
  }
  ctx.stroke();
  ctx.strokeStyle = withAlpha(COLORS.text, 0.45);
  ctx.strokeRect(mx(cam.x - VIEW_W / 2), my(cam.y + VIEW_H / 2), mx(VIEW_W) - mx(0), my(0) - my(VIEW_H));
  for (const e of events) {
    if (e.who !== p2 || !e.loud) continue;
    const fade = 1 - e.t / 2.5;
    ctx.strokeStyle = withAlpha(COLORS.p2, fade);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx(e.x), my(e.y) - 2, 2.5 + e.t * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.p1;
  ctx.beginPath();
  ctx.arc(mx(p1.x), my(p1.y) - 2.5, 3, 0, Math.PI * 2);
  ctx.fill();

  scorePill(p1, 28, "YOU");
  scorePill(p2, DESIGN_BOX.width - 28 - 150, "RIVAL");

  // controls
  ctx.beginPath();
  ctx.arc(STICK.x, STICK.y, STICK.r, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(COLORS.bg, 0.6);
  ctx.fill();
  ctx.strokeStyle = COLORS.lineStrong;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(STICK.x + touch.stickX * 26, STICK.y + touch.stickY * 26, 18, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.surface2;
  ctx.fill();
  ctx.stroke();
  circleButton(BTN_SHOOT, "SHOOT", touch.shoot);
  circleButton(BTN_JUMP, "JUMP", touch.jump);
  // shots left on the SHOOT ring; a picked-up weapon shows its name and uses
  const left = p1.weapon === "base" ? p1.shots : p1.uses;
  const total = p1.weapon === "base" ? 3 : WEAPONS[p1.weapon].uses;
  ctx.strokeStyle = p1.weapon === "base" ? COLORS.text : WEAPONS[p1.weapon].color;
  ctx.lineWidth = 3;
  for (let i = 0; i < left; i += 1) {
    const a0 = -Math.PI / 2 + (i / total) * Math.PI * 2 + 0.12;
    ctx.beginPath();
    ctx.arc(BTN_SHOOT.x, BTN_SHOOT.y, BTN_SHOOT.r, a0, a0 + (Math.PI * 2) / total - 0.24);
    ctx.stroke();
  }
  label(WEAPONS[p1.weapon].name, BTN_SHOOT.x, BTN_SHOOT.y - 50, textFont(12, 600), p1.weapon === "base" ? COLORS.muted : WEAPONS[p1.weapon].color, "center", trackingPx(12));

  pill(BTN_LIGHTS.x, BTN_LIGHTS.y, BTN_LIGHTS.w, BTN_LIGHTS.h, withAlpha(COLORS.bg, 0.6), COLORS.lineStrong);
  label(dark ? "LIGHTS ON" : "LIGHTS OFF", BTN_LIGHTS.x + BTN_LIGHTS.w / 2, BTN_LIGHTS.y + BTN_LIGHTS.h / 2 + 1, textFont(11, 600), COLORS.text, "center", trackingPx(11));
  pill(BTN_HERO.x, BTN_HERO.y, BTN_HERO.w, BTN_HERO.h, withAlpha(COLORS.bg, 0.6), COLORS.lineStrong);
  label(p1.def.name.toUpperCase(), BTN_HERO.x + BTN_HERO.w / 2, BTN_HERO.y + BTN_HERO.h / 2 + 1, textFont(11, 600), COLORS.text, "center", trackingPx(11));
  pill(BTN_ZOOM.x, BTN_ZOOM.y, BTN_ZOOM.w, BTN_ZOOM.h, withAlpha(COLORS.bg, 0.6), COLORS.lineStrong);
  label(ZOOMS[zoomIndex].name, BTN_ZOOM.x + BTN_ZOOM.w / 2, BTN_ZOOM.y + BTN_ZOOM.h / 2 + 1, textFont(11, 600), COLORS.text, "center", trackingPx(11));
}

// ---------- loop ----------
function render() {
  renderer.render(scene, camera);
  drawHud();
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  step(Math.min(0.033, (now - last) / 1000));
  last = now;
  render();
}
loadGameFonts().then(() => {
  setZoom(0);
  resizeHud();
  step(0.001);
  cam.x = THREE.MathUtils.clamp(p1.x, -(TOWER.half + 1 - VIEW_W / 2), TOWER.half + 1 - VIEW_W / 2);
  requestAnimationFrame(frame);
});

// Debug handle for checks from the console or a test page.
window.__towerLab = { fighters, p1, p2, pickups, lamps, lockers, events, cam, step, render, toggleLights, nextHero, setZoom, equip, fire };
