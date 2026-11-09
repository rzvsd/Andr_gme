import * as THREE from "three";
import { PUDD, ROSTER } from "./characterDef.js";
import { HATS, PALETTES, composeDef, wearableLayers } from "./cosmetics.js";
import { buildCharacter } from "./buildCharacter.js";
import { AliveLayer } from "./aliveLayer.js";
import { TellSystem } from "./tells.js";
import { playSound } from "./sounds.js";
import { renderBible } from "./bible.js";

const VIEW_W = 800;
const VIEW_H = 360;
const WORLD_H = 4.2;
const GRAVITY = -22;
const JUMP_VY = 8.2;
const MAX_SPEED = 4;
const ACCEL = 22;
const FRICTION = 16;
const PLATFORM_HALF = 1.6;
const BULLET_POOL = 32;

// ?hero=<body>&hat=<hat>&colors=<palette>; Pudd in its own clothes by default
const params = new URLSearchParams(location.search);
const equipped = {
  body: ROSTER.find((d) => d.id === params.get("hero"))?.id ?? PUDD.id,
  hat: HATS[params.get("hat")] ? params.get("hat") : null,
  palette: PALETTES[params.get("colors")] ? params.get("colors") : null,
};
let def = PUDD; // replaced by setHero() before the first frame
const canvas = document.getElementById("lab-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(VIEW_W, VIEW_H, false);

const scene = new THREE.Scene();
const LIT_BG = new THREE.Color("#2a3140");
const DARK_BG = new THREE.Color("#000000");
scene.background = LIT_BG;

const aspect = VIEW_W / VIEW_H;
const camera = new THREE.OrthographicCamera(-WORLD_H * aspect * 0.5, WORLD_H * aspect * 0.5, WORLD_H * 0.5, -WORLD_H * 0.5, 0.1, 50);
camera.position.set(0, WORLD_H * 0.5 - 0.7, 10);
camera.lookAt(0, WORLD_H * 0.5 - 0.7, 0);

scene.add(new THREE.HemisphereLight("#dfe8ff", "#3a3f4a", 0.9));
const sun = new THREE.DirectionalLight("#ffffff", 1.4);
sun.position.set(2, 5, 6);
scene.add(sun);

// --- stage: one platform with an edge glow that stays visible in the dark ---
const platform = new THREE.Mesh(
  new THREE.BoxGeometry(PLATFORM_HALF * 2 + 0.6, 0.26, 1.2),
  new THREE.MeshToonMaterial({ color: "#1b2030" })
);
platform.position.y = -0.13;
const edge = new THREE.Mesh(
  new THREE.BoxGeometry(PLATFORM_HALF * 2 + 0.6, 0.02, 1.2),
  new THREE.MeshBasicMaterial({ color: def.palette.body, transparent: true, opacity: 0.35 })
);
edge.position.y = 0.01;
scene.add(platform, edge);

// --- hero (rebuilt by setHero() whenever body, hat or colors change) ---
let rig;
let alive;
let tells;
let dark = false;
const tune = { wobble: 1, breathing: 1, squash: 1 };
const hero = { x: 0, y: 0, vx: 0, vy: 0, onGround: true, facing: 1, mode: "play", floorY: 0 };

// --- bullets ---
const bulletGeo = new THREE.CapsuleGeometry(def.bullet.radius, def.bullet.length, 4, 8).rotateZ(Math.PI / 2);
const bullets = new THREE.InstancedMesh(bulletGeo, new THREE.MeshBasicMaterial({ color: def.bullet.color }), BULLET_POOL);
const trail = new THREE.InstancedMesh(
  new THREE.SphereGeometry(def.bullet.radius * 0.7, 6, 6),
  new THREE.MeshBasicMaterial({ color: def.bullet.color, transparent: true, opacity: 0.5 }),
  BULLET_POOL * def.bullet.trail
);
scene.add(bullets, trail);
const bulletState = Array.from({ length: BULLET_POOL }, () => ({ alive: false, x: 0, y: 0, dir: 1 }));
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpMat = new THREE.Matrix4();
const tmpVec = new THREE.Vector3();

const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: def.palette.glow }));
flash.visible = false;
scene.add(flash);
let flashLeft = 0;

function shoot() {
  if (hero.mode !== "play") return;
  const slot = bulletState.find((b) => !b.alive);
  if (!slot) return;
  alive.muzzleWorld(tmpVec, hero.facing);
  Object.assign(slot, { alive: true, x: tmpVec.x, y: tmpVec.y, dir: hero.facing });
  flash.position.copy(tmpVec);
  flash.visible = true;
  flashLeft = 0.08;
  alive.onShoot(hero.facing);
  tells.trigger("shoot");
  playSound(def.sounds.shoot);
}

function updateBullets(dt) {
  bulletState.forEach((b, i) => {
    if (b.alive) {
      b.x += b.dir * def.bullet.speed * dt;
      if (Math.abs(b.x) > WORLD_H * aspect * 0.5 + 1) b.alive = false;
    }
    bullets.setMatrixAt(i, b.alive ? tmpMat.makeTranslation(b.x, b.y, 0.05) : hidden);
    for (let t = 0; t < def.bullet.trail; t += 1) {
      const k = i * def.bullet.trail + t;
      if (b.alive) {
        const back = (t + 1) * 0.14;
        tmpMat.makeTranslation(b.x - b.dir * back, b.y - t * 0.012, 0.05);
        tmpMat.scale(tmpVec.setScalar(1 - t * 0.25));
        trail.setMatrixAt(k, tmpMat);
      } else {
        trail.setMatrixAt(k, hidden);
      }
    }
  });
  bullets.instanceMatrix.needsUpdate = true;
  trail.instanceMatrix.needsUpdate = true;
  flashLeft -= dt;
  flash.visible = flashLeft > 0;
}

// --- moments: hit, KO (hit-stop + slow-mo + flop), win ---
let timeScale = 1;
let slowmo = null; // { stopLeft, slowLeft }
const ko = { active: false, angle: 0, angVel: 0, hat: null };

function hit() {
  if (hero.mode !== "play") return;
  const fromDir = hero.facing; // bullet came from the front
  alive.onHit(fromDir);
  hero.vx -= fromDir * 3;
  tells.trigger("hit");
  playSound(def.sounds.hit);
}

function knockOut() {
  if (hero.mode !== "play") return;
  hero.mode = "ko";
  slowmo = { stopLeft: 0.15, slowLeft: 0.35 };
  tells.trigger("ko");
  alive.setFace("ko");
  playSound(def.sounds.ko);
  ko.active = true;
  ko.angle = 0;
  ko.angVel = -hero.facing * 6;
  // hat flies off into world space
  rig.hat.updateMatrixWorld();
  const hat = rig.hat;
  scene.attach(hat);
  ko.hat = { obj: hat, vx: -hero.facing * 1.1, vy: 5.5, spin: hero.facing * 7, landed: false };
}

function updateKo(dt) {
  if (!ko.active) return;
  // flop at the feet with a bounce, then rest on the side
  const target = -hero.facing * Math.PI * 0.5;
  const accel = (target - ko.angle) * 60 - ko.angVel * 7;
  ko.angVel += accel * dt;
  ko.angle += ko.angVel * dt;
  rig.root.rotation.z = ko.angle;
  rig.root.scale.set(hero.facing, 1, 1);
  // pivot is at the feet, so lift the body as it tips over to rest on the platform
  const tipped = Math.sin(Math.min(Math.abs(ko.angle), Math.PI / 2));
  rig.root.position.y = hero.y + tipped * def.shape.bodyRadius;
  const h = ko.hat;
  if (h && !h.landed) {
    h.vy += GRAVITY * dt;
    h.obj.position.x += h.vx * dt;
    h.obj.position.y += h.vy * dt;
    h.obj.rotation.z += h.spin * dt;
    const restY = def.shape.hat.brimHeight * 0.5;
    if (h.obj.position.y <= restY) {
      h.obj.position.y = restY;
      h.obj.rotation.z = Math.round(h.obj.rotation.z / Math.PI) * Math.PI; // lands flat, maybe upside down
      h.landed = true;
      playSound(def.sounds.land);
    }
  }
}

function win() {
  if (hero.mode !== "play") return;
  alive.onJump();
  hero.vy = 3.5;
  hero.onGround = false;
  playSound(def.sounds.win);
  setTimeout(() => alive.setFace("slowblink"), 600);
  setTimeout(() => alive.setFace("deadpan"), 1300);
}

function taunt() {
  if (hero.mode !== "play") return;
  tells.trigger("taunt");
  alive.setFace("smile");
  setTimeout(() => alive.setFace("deadpan"), 500);
}

function reset() {
  hero.mode = "play";
  Object.assign(hero, { x: 0, y: 0, vx: 0, vy: 0, onGround: true });
  ko.active = false;
  if (ko.hat) {
    rig.root.attach(ko.hat.obj);
    ko.hat.obj.position.set(0, rig.hat.userData.restY, 0);
    ko.hat.obj.rotation.set(0, 0, 0);
    ko.hat = null;
  }
  rig.root.rotation.z = 0;
  rig.root.position.set(0, 0, 0);
  alive.setFace("deadpan");
  alive.stretch = 1;
  alive.stretchVel = 0;
  alive.lean = 0;
  timeScale = 1;
  slowmo = null;
  bulletState.forEach((b) => (b.alive = false));
}

// --- input ---
const input = { left: false, right: false };
function jump() {
  if (hero.mode !== "play" || !hero.onGround) return;
  hero.vy = JUMP_VY;
  hero.onGround = false;
  alive.onJump();
}

const keyMap = { KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "Space") jump();
  if (e.code === "KeyJ" || e.code === "KeyL") shoot();
});
window.addEventListener("keyup", (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
});

function hold(id, dir) {
  const el = document.getElementById(id);
  const down = (e) => { e.preventDefault(); input[dir] = true; };
  const up = () => { input[dir] = false; };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
}
hold("btn-left", "left");
hold("btn-right", "right");
document.getElementById("btn-jump").addEventListener("pointerdown", jump);
document.getElementById("btn-shoot").addEventListener("pointerdown", shoot);
document.getElementById("btn-hit").addEventListener("click", hit);
document.getElementById("btn-ko").addEventListener("click", knockOut);
document.getElementById("btn-win").addEventListener("click", win);
document.getElementById("btn-taunt").addEventListener("click", taunt);
document.getElementById("btn-reset").addEventListener("click", reset);

const lightsButton = document.getElementById("btn-lights");
lightsButton.addEventListener("click", () => {
  dark = !dark;
  tells.setDark(dark);
  scene.background = dark ? DARK_BG : LIT_BG;
  edge.material.opacity = dark ? 0.35 : 0.15;
  lightsButton.textContent = dark ? "Lights on" : "Lights off";
  lightsButton.classList.toggle("is-dark", dark);
  document.body.classList.toggle("dark-arena", dark);
});

for (const key of ["wobble", "breathing", "squash"]) {
  const slider = document.getElementById(`tune-${key}`);
  const out = document.getElementById(`tune-${key}-out`);
  slider.addEventListener("input", () => {
    tune[key] = Number(slider.value);
    out.textContent = Number(slider.value).toFixed(1);
  });
}

// Inspection handle for devtools and automated checks. setHero fills in rig/alive/tells/def.
window.__heroLab = { scene, hero, ko, shoot, hit, knockOut, win, taunt, reset };

// --- equip: body × hat × colors ---
const bodySelect = document.getElementById("pick-body");
const hatSelect = document.getElementById("pick-hat");
const paletteSelect = document.getElementById("pick-colors");
function fill(select, entries, blankLabel) {
  select.replaceChildren();
  if (blankLabel) select.append(new Option(blankLabel, ""));
  for (const [id, item] of entries) select.append(new Option(item.name, id));
}
fill(bodySelect, ROSTER.map((d) => [d.id, d]));
fill(hatSelect, Object.entries(HATS), "Body's own hat");
fill(paletteSelect, Object.entries(PALETTES), "Body's own colors");
bodySelect.addEventListener("change", () => setHero({ body: bodySelect.value }));
hatSelect.addEventListener("change", () => setHero({ hat: hatSelect.value || null }));
paletteSelect.addEventListener("change", () => setHero({ palette: paletteSelect.value || null }));

function setHero(next) {
  Object.assign(equipped, next);
  const base = ROSTER.find((d) => d.id === equipped.body) ?? PUDD;
  const layers = wearableLayers(base);
  def = composeDef(base, { hat: layers.hat ? equipped.hat : null, palette: layers.palette ? equipped.palette : null });

  if (rig) {
    if (ko.hat) scene.remove(ko.hat.obj);
    scene.remove(rig.root, ...rig.worldParts);
  }
  ko.active = false;
  ko.hat = null;
  rig = buildCharacter(def);
  scene.add(rig.root, ...rig.worldParts);
  alive = new AliveLayer(rig);
  alive.tune = tune;
  tells = new TellSystem(rig);
  tells.setDark(dark);
  Object.assign(hero, { x: 0, y: 0, vx: 0, vy: 0, onGround: true, mode: "play" });
  timeScale = 1;
  slowmo = null;
  bulletState.forEach((b) => (b.alive = false));

  // the stage and bullets carry the hero's colors
  edge.material.color.set(def.palette.body);
  bullets.material.color.set(def.bullet.color);
  trail.material.color.set(def.bullet.color);
  flash.material.color.set(def.palette.glow);
  document.title = `Hero Lab — ${def.name}`;
  renderBible(document.getElementById("bible"), def, playSound);
  Object.assign(window.__heroLab, { rig, alive, tells, def, setHero, equipped });

  // selectors mirror the state; flat art cannot wear hats or colors
  bodySelect.value = base.id;
  hatSelect.value = equipped.hat ?? "";
  paletteSelect.value = equipped.palette ?? "";
  hatSelect.disabled = !layers.hat;
  paletteSelect.disabled = !layers.palette;
  const url = new URL(location.href);
  url.searchParams.set("hero", base.id);
  if (equipped.hat) url.searchParams.set("hat", equipped.hat); else url.searchParams.delete("hat");
  if (equipped.palette) url.searchParams.set("colors", equipped.palette); else url.searchParams.delete("colors");
  history.replaceState(null, "", url);
}
setHero({});

// --- loop ---
const fpsOut = document.getElementById("stat-fps");
const callsOut = document.getElementById("stat-calls");
let last = performance.now();
let frames = 0;
let fpsClock = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(rawDt);
  renderer.render(scene, camera);

  frames += 1;
  fpsClock += rawDt;
  if (fpsClock >= 0.5) {
    fpsOut.textContent = Math.round(frames / fpsClock);
    callsOut.textContent = renderer.info.render.calls;
    frames = 0;
    fpsClock = 0;
  }
}

// One simulation tick in real seconds. Deterministic, so it can also be driven
// by tests or a clip replay.
function step(rawDt) {
  if (slowmo) {
    if (slowmo.stopLeft > 0) {
      slowmo.stopLeft -= rawDt;
      timeScale = 0;
    } else if (slowmo.slowLeft > 0) {
      slowmo.slowLeft -= rawDt;
      timeScale = 0.3;
    } else {
      slowmo = null;
      timeScale = 1;
    }
  }
  const dt = rawDt * timeScale;

  if (hero.mode === "play") {
    const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (want !== 0) {
      hero.vx += want * ACCEL * dt;
      hero.facing = want;
    } else {
      hero.vx -= Math.sign(hero.vx) * Math.min(Math.abs(hero.vx), FRICTION * dt);
    }
    hero.vx = THREE.MathUtils.clamp(hero.vx, -MAX_SPEED, MAX_SPEED);
    hero.vy += GRAVITY * dt;
    hero.x = THREE.MathUtils.clamp(hero.x + hero.vx * dt, -PLATFORM_HALF, PLATFORM_HALF);
    hero.y += hero.vy * dt;
    if (hero.y <= 0) {
      if (!hero.onGround) {
        alive.onLand(hero.vy);
        tells.trigger("land");
        playSound(def.sounds.land);
      }
      hero.y = 0;
      hero.vy = 0;
      hero.onGround = true;
    }
    rig.root.position.set(hero.x, hero.y, 0);
    alive.update(dt, hero);
  } else {
    updateKo(dt);
    alive.updateFace(dt);
    alive.updateArms(dt, hero);
  }

  updateBullets(dt);
  tells.update(dt);
}
requestAnimationFrame(frame);
window.__heroLab.step = step;
window.__heroLab.render = () => renderer.render(scene, camera);
