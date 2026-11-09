import * as THREE from "three";
import { ROSTER } from "./characterDef.js";
import { buildCharacter } from "./buildCharacter.js";
import { AliveLayer } from "./aliveLayer.js";
import { TellSystem } from "./tells.js";

// Side-by-side look at every character in the roster. Idle only: breathing,
// blinks, noodle arms. Lights off shows how each one leaks position.

const VIEW_W = 800;
const VIEW_H = 360;
const SPACING = 2.1;
const aspect = VIEW_W / VIEW_H;
// zoom out just enough for the whole roster to fit
const WORLD_H = Math.max(4.2, (ROSTER.length * SPACING + 1.6) / aspect);

const canvas = document.getElementById("gallery-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(VIEW_W, VIEW_H, false);

const scene = new THREE.Scene();
const LIT_BG = new THREE.Color("#2a3140");
const DARK_BG = new THREE.Color("#000000");
scene.background = LIT_BG;

const camera = new THREE.OrthographicCamera(-WORLD_H * aspect * 0.5, WORLD_H * aspect * 0.5, WORLD_H * 0.5, -WORLD_H * 0.5, 0.1, 50);
camera.position.set(0, WORLD_H * 0.5 - 0.7, 10);
camera.lookAt(0, WORLD_H * 0.5 - 0.7, 0);

scene.add(new THREE.HemisphereLight("#dfe8ff", "#3a3f4a", 0.9));
const sun = new THREE.DirectionalLight("#ffffff", 1.4);
sun.position.set(2, 5, 6);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(WORLD_H * aspect + 1, 1, 1.2),
  new THREE.MeshToonMaterial({ color: "#1b2030" })
);
floor.position.y = -0.5;
scene.add(floor);

const fighters = ROSTER.map((def, i) => {
  const rig = buildCharacter(def);
  scene.add(rig.root, ...rig.worldParts);
  const x = (i - (ROSTER.length - 1) / 2) * SPACING;
  const facing = x <= 0 ? 1 : -1; // face each other
  rig.root.position.x = x;
  const state = { x, y: 0, vx: 0, vy: 0, onGround: true, facing, floorY: 0 };
  return { def, rig, state, alive: new AliveLayer(rig), tells: new TellSystem(rig), nextTell: 1 + i * 0.6 };
});

// name labels under each character
const labels = document.getElementById("labels");
for (const f of fighters) {
  const el = document.createElement("a");
  el.textContent = f.def.name;
  el.href = `/hero-lab.html?hero=${f.def.id}`;
  el.title = `Open ${f.def.name} in the hero lab`;
  el.style.color = f.def.palette.head ?? f.def.palette.body;
  labels.append(el);
}

let dark = false;
const lightsButton = document.getElementById("btn-lights");
lightsButton.addEventListener("click", () => {
  dark = !dark;
  for (const f of fighters) f.tells.setDark(dark);
  scene.background = dark ? DARK_BG : LIT_BG;
  lightsButton.textContent = dark ? "Lights on" : "Lights off";
  document.body.classList.toggle("dark-arena", dark);
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const f of fighters) {
    f.alive.update(dt, f.state);
    // in the dark, each one fires now and then so you can see its tell
    if (dark) {
      f.nextTell -= dt;
      if (f.nextTell <= 0) {
        f.tells.trigger("shoot");
        f.alive.onShoot(f.state.facing);
        f.nextTell = 1.4;
      }
    }
    f.tells.update(dt);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

window.__gallery = { scene, fighters, render: () => renderer.render(scene, camera) };
