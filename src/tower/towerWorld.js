import * as THREE from "three";
import { buildCharacter } from "../hero/buildCharacter.js";
import { AliveLayer } from "../hero/aliveLayer.js";
import { COLORS, designBoxTransform } from "../theme/tokens.js";
import { TOWER, FLOORS, LADDERS, LOCKERS, CRATES, LAMPS, PICKUPS, SPAWNS, WEAPONS, ARENA_COLORS } from "./towerData.js";

// Tower world: the arena, the two fighters, the weapons and the bot of one match, drawn with WebGL
// on its own canvas. The scene (src/scenes/TowerScene.js) owns the match rules, the HUD and the
// input. Fighter 0 is the player, fighter 1 is the bot.

// Screen px per world unit at the 891 x 411 design box: a fighter is about 40 px tall.
const UNIT_PX = 21;
const RUN = 7, WALK = 2.6, ACCEL = 45, GRAVITY = 30, JUMP = 12.5, CLIMB = 5;
const BODY_H = 1.9, BODY_HALF = 0.55, CRATE_PAD = 0.45;
const KO_SECONDS = 1.7;
const TEAM = [COLORS.p1, COLORS.p2];

export const EMPTY_INPUT = Object.freeze({ moveX: 0, up: false, down: false, jumpEdge: false, shootEdge: false });

export function createTowerWorld(heroDefs, onEvent = () => {}) {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: false });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  const view = { w: 42, h: 20, px: UNIT_PX, width: 1, height: 1 };
  const camera = new THREE.OrthographicCamera(-21, 21, 10, -10, 0.1, 100);
  const cam = { x: 0, y: 6 };

  const hemi = new THREE.HemisphereLight("#dfe8ff", "#3a3f4a", 0.03);
  const sun = new THREE.DirectionalLight("#ffffff", 0);
  sun.position.set(4, 10, 12);
  // In the dark the player still sees the own fighter and the floor at its feet.
  const selfLight = new THREE.PointLight("#dfe8ff", 0, 5.5, 1.4);
  scene.add(hemi, sun, selfLight);
  let lit = false;
  function setLit(on) {
    lit = on;
    hemi.intensity = on ? 0.9 : 0.03;
    sun.intensity = on ? 1.2 : 0;
  }

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
  const underLamp = (f) => lamps.some((l) => Math.abs(f.x - l.x) < 3 && Math.abs(f.y - l.y) < 0.6);

  // A fighter stands on floors and on crate tops. Crate sides are solid.
  const SURFACES = [...FLOORS, ...crateBoxes.map((c) => ({ y: c.y1, x0: c.x0, x1: c.x1 }))];
  const floorUnder = (x, y) => SURFACES.find((s) => Math.abs(s.y - y) < 0.02 && x >= s.x0 - 0.3 && x <= s.x1 + 0.3);
  const landing = (x, prevY, y) => SURFACES.find((s) => prevY >= s.y && y <= s.y && x >= s.x0 - 0.3 && x <= s.x1 + 0.3);
  function crateStop(f, prevX) {
    const c = crateBoxes.find((b) => f.y < b.y1 - 0.05 && f.y + BODY_H > b.y0 && f.x > b.x0 - CRATE_PAD && f.x < b.x1 + CRATE_PAD);
    if (!c) return false;
    f.x = prevX < (c.x0 + c.x1) / 2 ? c.x0 - CRATE_PAD : c.x1 + CRATE_PAD;
    f.vx = 0;
    return true;
  }

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
    const spawn = SPAWNS[0][team];
    const f = {
      team, spawn, def, x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: true, facing: spawn.facing,
      climbing: null, locker: null, hp: 3, shots: 3, refill: 0, weapon: "base", uses: Infinity,
      reveal: 0, ko: 0, score: 0, stepT: 0, cool: 0, prevUp: false, blocked: false, model: null,
    };
    f.rig = buildCharacter(def);
    f.alive = new AliveLayer(f.rig);
    scene.add(f.rig.root, ...f.rig.worldParts);
    return f;
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
    // The base blaster is a mesh on some heroes and a group of parts on others.
    if (hand.material) hand.material.visible = id === "base";
    for (const part of hand.children) if (part !== f.model) part.visible = id === "base";
    f.weapon = id;
    f.uses = WEAPONS[id].uses;
  }
  const p1 = makeFighter(heroDefs[0], 0);
  const p2 = makeFighter(heroDefs[1], 1);
  const fighters = [p1, p2];
  const rival = (f) => (f === p1 ? p2 : p1);

  // ---------- effects ----------
  const bullets = [];
  const flares = [];
  const traps = [];
  const flashes = [];
  const events = []; // sounds: the HUD draws them as ripples and as marks on the mini map; the bot hears them
  const sound = (x, y, kind, who, loud) =>
    events.push({ x, y, kind, who, loud, t: 0, fx: who ? who.x : x, fy: who ? who.y : y, heard: false });

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
    onEvent("shot", { team: f.team, weapon: f.weapon });
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
      g.ko = KO_SECONDS;
      g.climbing = null;
      g.alive.setFace("ko");
      rival(g).score += 1;
      onEvent("ko", { winner: rival(g).team });
    } else {
      onEvent("hit", { team: g.team });
    }
  }
  function respawn(f) {
    Object.assign(f, {
      x: f.spawn.x, y: f.spawn.y, vx: 0, vy: 0, onGround: true, facing: f.spawn.facing, climbing: null, locker: null,
      hp: 3, shots: 3, refill: 0, cool: 0, ko: 0, reveal: 0, blocked: false,
    });
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

  // ---------- bot ----------
  // It walks to a goal: the last sound of the player it heard, or a random pickup or floor point.
  const bot = { goal: null, goalT: 0, slow: false, shootT: 0, saw: false, climbDir: 0 };
  function randomGoal() {
    if (Math.random() < 0.4) {
      const p = pickups[Math.floor(Math.random() * pickups.length)];
      return { x: p.x, y: p.y };
    }
    const s = FLOORS[Math.floor(Math.random() * FLOORS.length)];
    return { x: s.x0 + 1 + Math.random() * (s.x1 - s.x0 - 2), y: s.y };
  }
  function botInput(f, dt) {
    const input = { moveX: 0, up: false, down: false, jumpEdge: false, shootEdge: false };
    const foe = rival(f);
    for (const e of events) {
      if (e.who !== foe || e.heard) continue;
      e.heard = true;
      if (e.loud || Math.hypot(e.fx - f.x, e.fy - f.y) < 14) {
        bot.goal = { x: e.fx, y: e.fy };
        bot.goalT = 7;
        bot.slow = false;
      }
    }
    bot.shootT -= dt;
    bot.goalT -= dt;
    const dx = foe.x - f.x;
    const sees = !f.climbing && Math.abs(foe.y - f.y) < 1.5 && Math.abs(dx) < 16 && !foe.locker && foe.ko <= 0 &&
      (lit || foe.reveal > 0 || Math.abs(dx) < 5 || underLamp(foe));
    if (sees) {
      if (!bot.saw) bot.shootT = Math.max(bot.shootT, 0.55);
      bot.saw = true;
      f.facing = Math.sign(dx) || 1;
      if (bot.shootT <= 0) {
        input.shootEdge = true;
        bot.shootT = 1.1;
      }
      bot.goal = { x: foe.x, y: foe.y };
      bot.goalT = 5;
      return input;
    }
    bot.saw = false;
    if (f.weapon === "trap") input.shootEdge = true;
    if (f.climbing) {
      input.up = bot.climbDir > 0;
      input.down = bot.climbDir < 0;
      return input;
    }
    if (!bot.goal || bot.goalT <= 0) {
      bot.goal = randomGoal();
      bot.goalT = 9;
      bot.slow = Math.random() < 0.35;
    }
    const goal = bot.goal;
    const seg = floorUnder(f.x, f.y);
    const dy = goal.y - f.y;
    let tx = goal.x;
    if (seg && Math.abs(dy) > 2.5) {
      const up = dy > 0;
      const ladder = LADDERS
        .filter((l) => Math.abs((up ? l.y0 : l.y1) - f.y) < 0.1 && l.x >= seg.x0 - 0.3 && l.x <= seg.x1 + 0.3)
        .sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
      if (ladder) {
        tx = ladder.x;
        if (Math.abs(f.x - ladder.x) < 0.5) {
          bot.climbDir = up ? 1 : -1;
          input.up = up;
          input.down = !up;
          return input;
        }
      } else if (!up) {
        // No ladder down from here: walk off the nearest hole edge.
        const edges = [seg.x0 - 1, seg.x1 + 1].filter((x) => Math.abs(x) < TOWER.half - 1);
        tx = edges.sort((a, b) => Math.abs(a - goal.x) - Math.abs(b - goal.x))[0] ?? goal.x;
      } else {
        bot.goal = null;
        return input;
      }
    } else if (Math.abs(tx - f.x) < 0.6) {
      bot.goal = null;
      return input;
    }
    const dir = Math.sign(tx - f.x);
    input.moveX = dir * (bot.slow ? 0.5 : 1);
    const atEdge = seg && (dir > 0 ? f.x > seg.x1 - 0.2 : f.x < seg.x0 + 0.2);
    // Jump over a crate, and over a hole when the goal is on this level.
    if (f.onGround && (f.blocked || (atEdge && Math.abs(dy) <= 2.5))) input.jumpEdge = true;
    return input;
  }

  // ---------- simulation ----------
  let roundOver = false;
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
      if (f.ko <= 0) {
        f.ko = 0.001; // stays down until the scene starts the next round
        roundOver = true;
      }
      return;
    }
    if (f.locker) {
      if (input.moveX !== 0 || input.jumpEdge || input.up) leaveLocker(f);
      return;
    }
    const near = (l) => Math.abs(f.x - l.x) < 0.8;
    const upLadder = LADDERS.find((l) => near(l) && f.y >= l.y0 - 0.1 && f.y < l.y1 - 0.1);
    const downLadder = LADDERS.find((l) => near(l) && f.y > l.y0 + 0.1 && f.y <= l.y1 + 0.1);
    if (!f.climbing) {
      if (input.up && upLadder) f.climbing = upLadder;
      else if (input.down && f.onGround && downLadder) f.climbing = downLadder;
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
      const upTap = input.up && !f.prevUp && !upLadder;
      if ((input.jumpEdge || upTap) && f.onGround) {
        f.vy = JUMP;
        f.onGround = false;
        f.alive.onJump();
        onEvent("jump", { team: f.team });
      }
      const prevY = f.y;
      const prevX = f.x;
      f.x = THREE.MathUtils.clamp(f.x + f.vx * dt, -TOWER.half + 0.6, TOWER.half - 0.6);
      f.blocked = crateStop(f, prevX);
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

  function cameraTarget() {
    const maxX = TOWER.half + 1 - view.w / 2;
    return [
      THREE.MathUtils.clamp(p1.x, -maxX, maxX),
      THREE.MathUtils.clamp(p1.y + view.h * 0.16, view.h / 2 - 1.2, TOWER.top + 0.8 - view.h / 2),
    ];
  }

  // `active` false: the fighters stand still (round intro).
  function step(dt, input, active = true) {
    updateFighter(p1, active ? input : EMPTY_INPUT, dt);
    updateFighter(p2, active ? botInput(p2, dt) : EMPTY_INPUT, dt);

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
      // A trap never finishes a fighter: it reveals, and it takes one hit only above 1 hp.
      if (g.hp > 1) hit(g, 0);
      else sound(g.x, g.y + 1, "hit", g, true);
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
        onEvent("pickup", { team: taker.team, weapon: p.weapon });
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
      const visible = !f.locker && (lit || f === p1 || f.reveal > 0 || f.ko > 0 || underLamp(f));
      f.rig.root.visible = visible;
      for (const part of f.rig.worldParts) part.visible = visible;
    }
    selfLight.intensity = lit ? 0 : 10;
    selfLight.position.set(p1.x, p1.y + 1.3, 2.2);
    const [targetX, targetY] = cameraTarget();
    cam.x += (targetX - cam.x) * Math.min(1, dt * 6);
    cam.y += (targetY - cam.y) * Math.min(1, dt * 6);
    camera.position.set(cam.x, cam.y, 20);
    if (roundOver) {
      roundOver = false;
      onEvent("round_end", {});
    }
  }

  // Both fighters go back to a start point with full health; shots, flares and traps are removed.
  function resetRound(index) {
    for (const b of bullets) scene.remove(b.mesh);
    for (const fl of flares) scene.remove(fl.light, fl.mesh);
    for (const t of traps) scene.remove(t.mesh);
    for (const fl of flashes) scene.remove(fl.light, fl.spark);
    bullets.length = flares.length = traps.length = flashes.length = events.length = 0;
    for (const l of lockers) l.occupant = null;
    for (const p of pickups) {
      p.wait = 0;
      p.group.visible = true;
    }
    const pair = SPAWNS[index % SPAWNS.length];
    fighters.forEach((f, team) => {
      f.spawn = pair[team];
      respawn(f);
    });
    Object.assign(bot, { goal: null, goalT: 0, slow: false, shootT: 0, saw: false, climbDir: 0 });
    [cam.x, cam.y] = cameraTarget();
    step(0.001, EMPTY_INPUT, false);
  }

  function resize(width, height, dpr) {
    const { scale } = designBoxTransform(width, height);
    Object.assign(view, { px: UNIT_PX * scale, w: width / (UNIT_PX * scale), h: height / (UNIT_PX * scale), width, height });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    Object.assign(camera, { left: -view.w / 2, right: view.w / 2, top: view.h / 2, bottom: -view.h / 2 });
    camera.updateProjectionMatrix();
    [cam.x, cam.y] = cameraTarget();
    camera.position.set(cam.x, cam.y, 20);
  }
  // World point -> view px.
  const toScreen = (x, y) => [(x - cam.x) * view.px + view.width / 2, view.height / 2 - (y - cam.y) * view.px];

  function dispose() {
    scene.traverse((node) => {
      node.geometry?.dispose();
      node.material?.dispose?.();
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {
    canvas, view, cam, fighters, p1, p2, pickups, lamps, lockers, events,
    step, resetRound, resize, toScreen, setLit, dispose,
    isLit: () => lit,
    render: () => renderer.render(scene, camera),
  };
}
