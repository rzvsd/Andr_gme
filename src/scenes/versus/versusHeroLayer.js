import * as THREE from "three";
import { PUDD, ROSTER } from "../../hero/characterDef.js";
import { buildCharacter } from "../../hero/buildCharacter.js";
import { AliveLayer } from "../../hero/aliveLayer.js";
import { TellSystem } from "../../hero/tells.js";

// Draws the hero-lab rigs (Pudd, Chonk, Ninja, Vector) on a transparent WebGL canvas that
// sits over the 2D game canvas. Scenes hand it a list of actors in screen pixels every frame;
// nothing here knows about game entities. Without WebGL or a DOM, `render()` returns false
// and the caller keeps its 2D fallback.

export const HERO_CANVAS_ID = "hero-canvas";
// Rig height from feet to hat top is about 1.5 rig units for every roster member.
export const HERO_RIG_HEIGHT_UNITS = 1.5;
// Game velocities are world units per second (run 330, jump 600); the lab tuned its
// alive layer for about 4 and 8 rig units per second.
export const GAME_TO_RIG_VELOCITY = 1 / 80;

export function getHeroDef(heroId) {
  return ROSTER.find((def) => def.id === heroId) ?? PUDD;
}

// Pure: which alive-layer events a state change implies. Game y grows downward, so a jump
// starts with vy < 0 and a landing is onGround going false -> true.
export function deriveActorEvents(previous, next) {
  const events = { shoot: false, hit: false, jump: false, land: false };
  if (!previous) {
    return events;
  }
  if (Number(next.lastShotAtMs) > Number(previous.lastShotAtMs)) {
    events.shoot = true;
  }
  if (Number(next.hitFlash) > Number(previous.hitFlash)) {
    events.hit = true;
  }
  if (previous.onGround && !next.onGround && Number(next.vy) < 0) {
    events.jump = true;
  }
  if (!previous.onGround && next.onGround) {
    events.land = true;
  }
  return events;
}

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

// Kill frame: the victim is drawn as a flat white shape with this shared unlit material.
const SILHOUETTE_MATERIAL = new THREE.MeshBasicMaterial({ color: "#ffffff" });
const FLASH_COLOR = new THREE.Color("#ffffff");

// Global light presets. "match" is the flat toon look; "menu" dims the ambient so a per-actor
// spotlight (entry.spot) reads as the single light source on the hero stage.
export const LIGHT_PRESETS = Object.freeze({
  match: { sky: "#dfe8ff", ground: "#3a3f4a", hemi: 0.9, sun: 1.4 },
  menu: { sky: "#9fb4d8", ground: "#05060a", hemi: 0.35, sun: 0.35 },
});

export class HeroLayer {
  constructor() {
    this.available = null;
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.hemi = null;
    this.sun = null;
    this.lightPreset = "match";
    this.actors = new Map();
    this.lastFrameMs = null;
    this.size = { width: 0, height: 0, dpr: 0 };
  }

  isAvailable() {
    if (this.available !== null) {
      return this.available;
    }
    if (typeof document === "undefined" || typeof window === "undefined") {
      this.available = false;
      return false;
    }
    const canvas = document.getElementById(HERO_CANVAS_ID);
    if (!canvas) {
      this.available = false;
      return false;
    }
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch {
      this.available = false;
      return false;
    }
    this.canvas = canvas;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight("#dfe8ff", "#3a3f4a", 0.9);
    this.sun = new THREE.DirectionalLight("#ffffff", 1.4);
    this.sun.position.set(2, 5, 6);
    this.scene.add(this.hemi, this.sun);
    this.setLightPreset(this.lightPreset);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 50);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    this.available = true;
    return true;
  }

  // "match" (default) or "menu". Safe to call before the layer is available; applied on creation.
  setLightPreset(name) {
    const preset = LIGHT_PRESETS[name] ?? LIGHT_PRESETS.match;
    this.lightPreset = LIGHT_PRESETS[name] ? name : "match";
    if (!this.hemi || !this.sun) {
      return;
    }
    this.hemi.color.set(preset.sky);
    this.hemi.groundColor.set(preset.ground);
    this.hemi.intensity = preset.hemi;
    this.sun.intensity = preset.sun;
  }

  // Screen pixels -> rig units: the camera frustum is the viewport divided by unitPx.
  resize(width, height, dpr, unitPx) {
    const w = Math.max(1, Math.round(toNumber(width, 1)));
    const h = Math.max(1, Math.round(toNumber(height, 1)));
    const ratio = Math.min(2, Math.max(1, toNumber(dpr, 1)));
    if (this.size.width !== w || this.size.height !== h || this.size.dpr !== ratio) {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(w, h, false);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.size = { width: w, height: h, dpr: ratio };
    }
    const units = Math.max(1e-3, toNumber(unitPx, 40));
    this.camera.left = 0;
    this.camera.right = w / units;
    this.camera.top = 0;
    this.camera.bottom = -h / units;
    this.camera.updateProjectionMatrix();
  }

  getActor(slot, heroId) {
    const existing = this.actors.get(slot);
    if (existing && existing.heroId === heroId) {
      return existing;
    }
    if (existing) {
      this.removeActor(existing);
    }
    const def = getHeroDef(heroId);
    const rig = buildCharacter(def);
    // Per-actor lights: a team rim light behind the fighter and a menu spotlight from above.
    // Both start off (intensity 0) and follow entry.rimColor / entry.rimIntensity / entry.spot.
    const rim = new THREE.PointLight("#ffffff", 0, 4, 2);
    const spot = new THREE.SpotLight("#ffffff", 0, 12, Math.PI / 7, 0.6, 1.2);
    const actor = {
      slot,
      heroId: def.id,
      def,
      rig,
      alive: new AliveLayer(rig),
      tells: new TellSystem(rig),
      rim,
      spot,
      previous: null,
    };
    this.scene.add(rig.root, ...rig.worldParts, rim, spot, spot.target);
    this.actors.set(slot, actor);
    return actor;
  }

  removeActor(actor) {
    this.scene.remove(actor.rig.root, ...actor.rig.worldParts, actor.rim, actor.spot, actor.spot.target);
    this.actors.delete(actor.slot);
  }

  // frame: { width, height, dpr, unitPx, nowMs, actors: [entry] }
  // entry: { slot, heroId, x, y (feet, screen px), facing, vx, vy, onGround, visible,
  //          lastShotAtMs, hitFlash,
  //          rimColor ("#rrggbb", team colour), rimIntensity (default 6 when rimColor is set),
  //          spot (true for the menu spotlight), spotIntensity (default 28),
  //          silhouette (true draws the rig as a flat white shape, for the kill frame),
  //          dim (0..1 brightness multiplier, default 1; the result screen dims the loser),
  //          flash (0..1, brightens the rig towards white for the hit frames) }
  render(frame) {
    if (!this.isAvailable()) {
      return false;
    }
    const unitPx = Math.max(1e-3, toNumber(frame?.unitPx, 40));
    this.resize(frame?.width, frame?.height, frame?.dpr, unitPx);

    const nowMs = toNumber(frame?.nowMs, this.lastFrameMs ?? 0);
    const dt = this.lastFrameMs === null ? 1 / 60 : THREE.MathUtils.clamp((nowMs - this.lastFrameMs) / 1000, 0, 0.05);
    this.lastFrameMs = nowMs;

    const seen = new Set();
    for (const entry of frame?.actors ?? []) {
      if (!entry || entry.slot === undefined) {
        continue;
      }
      seen.add(entry.slot);
      this.#updateActor(this.getActor(entry.slot, entry.heroId), entry, dt, unitPx);
    }
    for (const actor of [...this.actors.values()]) {
      if (!seen.has(actor.slot)) {
        this.removeActor(actor);
      }
    }

    this.renderer.render(this.scene, this.camera);
    return true;
  }

  // render() that never throws into the game loop: a broken layer logs once and goes dark.
  safeRender(frame) {
    try {
      return this.render(frame);
    } catch (error) {
      if (!this.failed) {
        this.failed = true;
        console.error("[HeroLayer] render failed; hero layer disabled for this session.", error);
      }
      this.available = false;
      return false;
    }
  }

  // Remove every actor and leave the canvas transparent. Scenes call it from onExit.
  clear() {
    if (!this.available) {
      return;
    }
    for (const actor of [...this.actors.values()]) {
      this.removeActor(actor);
    }
    this.lastFrameMs = null;
    this.renderer.render(this.scene, this.camera);
  }

  #updateActor(actor, entry, dt, unitPx) {
    const { rig, alive, tells } = actor;
    const facing = toNumber(entry.facing, 1) < 0 ? -1 : 1;
    const state = {
      facing,
      vx: toNumber(entry.vx) * GAME_TO_RIG_VELOCITY,
      vy: -toNumber(entry.vy) * GAME_TO_RIG_VELOCITY,
      onGround: entry.onGround !== false,
      lastShotAtMs: toNumber(entry.lastShotAtMs, Number.NEGATIVE_INFINITY),
      hitFlash: toNumber(entry.hitFlash),
    };
    const events = deriveActorEvents(actor.previous, state);
    if (events.shoot) alive.onShoot(facing);
    if (events.hit) alive.onHit(-facing);
    if (events.jump) alive.onJump();
    if (events.land) alive.onLand(Math.abs(actor.previous?.vy ?? 0));
    actor.previous = state;

    // Dark arena: a hidden fighter shows nothing at all, not even a tell.
    tells.setDark(entry.visible === false);
    this.#setSilhouette(actor, entry.silhouette === true);
    this.#setDim(actor, entry.dim === undefined ? 1 : THREE.MathUtils.clamp(toNumber(entry.dim, 1), 0, 1));
    this.#setFlash(actor, THREE.MathUtils.clamp(toNumber(entry.flash, 0), 0, 1));

    const feetX = toNumber(entry.x) / unitPx;
    const feetY = -toNumber(entry.y) / unitPx;
    rig.root.position.set(feetX, feetY, 0);

    // Team rim light sits behind the fighter (opposite to facing); off while hidden.
    const rimIntensity = entry.visible === false ? 0 : toNumber(entry.rimIntensity, entry.rimColor ? 6 : 0);
    actor.rim.intensity = rimIntensity;
    if (entry.rimColor) {
      actor.rim.color.set(entry.rimColor);
    }
    actor.rim.position.set(feetX - facing * 0.9, feetY + 1.0, 1.4);
    // Menu spotlight from above and slightly in front, aimed at the chest.
    actor.spot.intensity = entry.spot ? toNumber(entry.spotIntensity, 28) : 0;
    actor.spot.position.set(feetX - 0.4, feetY + 4.2, 3.2);
    actor.spot.target.position.set(feetX, feetY + 0.7, 0);
    if (!actor.settled) {
      // The arm chains start at the origin; settle them at the rig before the first frame.
      actor.settled = true;
      for (let step = 0; step < 45; step += 1) {
        alive.update(1 / 60, { ...state, vx: 0, vy: 0, floorY: feetY });
      }
    }
    alive.update(dt, { ...state, floorY: feetY });
    tells.update(dt);
  }

  // Darken a rig (entry.dim, 1 = normal, 0.3 = the loser on the result screen) by scaling each
  // material colour from its remembered original; 1 restores the originals.
  #setDim(actor, factor) {
    if (actor.dim === factor) {
      return;
    }
    actor.dim = factor;
    for (const object of [actor.rig.root, ...actor.rig.worldParts]) {
      object.traverse((node) => {
        if (!node.isMesh || !node.material?.color || node.material === SILHOUETTE_MATERIAL) {
          return;
        }
        if (!node.userData.__color) {
          node.userData.__color = node.material.color.clone();
        }
        node.material.color.copy(node.userData.__color).multiplyScalar(factor);
      });
    }
  }

  // Hit flash (entry.flash, 0..1): push every material's emissive towards white so the whole rig
  // brightens for the hit frames, then falls back to the original emissive.
  #setFlash(actor, amount) {
    if (actor.flash === amount) {
      return;
    }
    actor.flash = amount;
    for (const object of [actor.rig.root, ...actor.rig.worldParts]) {
      object.traverse((node) => {
        if (!node.isMesh || !node.material?.emissive || node.material === SILHOUETTE_MATERIAL) {
          return;
        }
        if (!node.userData.__emissive) {
          node.userData.__emissive = node.material.emissive.clone();
        }
        node.material.emissive.copy(node.userData.__emissive).lerp(FLASH_COLOR, amount * 0.85);
      });
    }
  }

  // Swap every mesh material for the white silhouette material (entry.silhouette) and restore
  // the originals when the flag drops. Used for the victim during the kill frame.
  #setSilhouette(actor, on) {
    if (Boolean(actor.silhouette) === on) {
      return;
    }
    actor.silhouette = on;
    for (const object of [actor.rig.root, ...actor.rig.worldParts]) {
      object.traverse((node) => {
        if (!node.isMesh) {
          return;
        }
        if (on) {
          if (!node.userData.__material) {
            node.userData.__material = node.material;
          }
          node.material = SILHOUETTE_MATERIAL;
        } else if (node.userData.__material) {
          node.material = node.userData.__material;
          delete node.userData.__material;
        }
      });
    }
  }
}

export const heroLayer = new HeroLayer();
// Debug handle, like the lab's window.__heroLab: lets a dev console inspect the live layer.
if (typeof window !== "undefined") {
  window.__heroLayer = heroLayer;
}
