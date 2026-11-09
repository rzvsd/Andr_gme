import * as THREE from "three";

// In the dark the hero is invisible. A tell lights specific parts for a few
// frames so position leaks only when the player acts (shoot, land, get hit).

export class TellSystem {
  constructor(rig) {
    this.rig = rig;
    this.active = new Map(); // tellName -> remaining seconds
    this.dark = false;
    this.glow = new THREE.Color(rig.def.palette.glow);
    this.outlineColor = new THREE.Color(rig.def.palette.outline);
    this.eyeColor = new THREE.Color(rig.def.palette.eye);
    this.setDark(false);
  }

  setDark(dark) {
    this.dark = dark;
    this.applyVisibility();
  }

  trigger(name) {
    const tell = this.rig.def.tells[name];
    if (!tell) return;
    this.active.set(name, tell.ms / 1000);
    this.applyVisibility();
  }

  update(dt) {
    let changed = false;
    for (const [name, left] of this.active) {
      const next = left - dt;
      if (next <= 0) {
        this.active.delete(name);
        changed = true;
      } else {
        this.active.set(name, next);
      }
    }
    if (changed || this.dark) this.applyVisibility();
  }

  litParts() {
    const lit = new Set();
    for (const name of this.active.keys()) {
      for (const part of this.rig.def.tells[name].parts) lit.add(part);
    }
    return lit;
  }

  applyVisibility() {
    const { rig } = this;
    const lit = this.litParts();
    const showAll = !this.dark || lit.has("all");

    for (const obj of rig.parts.all) obj.visible = showAll;
    rig.feetRing.visible = lit.has("feetRing") || lit.has("all");

    if (!showAll) {
      for (const part of lit) {
        for (const obj of rig.parts[part] ?? []) obj.visible = true;
      }
    }

    // outlines flash bright when they are the tell, otherwise stay charcoal
    const outlineLit = lit.has("outline") || (this.dark && lit.has("all"));
    for (const hull of rig.parts.outline) {
      hull.material.color.copy(outlineLit ? this.glow : this.outlineColor);
    }
    // eyes glow when they are the tell in the dark
    const eyesLit = this.dark && (lit.has("eyes") || lit.has("all"));
    for (const eye of rig.eyes) {
      eye.getObjectByName("ball").material.color.copy(eyesLit ? this.glow : this.eyeColor);
    }
    // body parts shown alone in the dark render unlit so they read as a flash
    rig.toonMaterial.emissive.copy(this.dark && lit.size > 0 ? this.glow : new THREE.Color(0x000000));
    rig.toonMaterial.emissiveIntensity = this.dark && lit.size > 0 ? 0.35 : 0;
  }
}
