import * as THREE from "three";
import { makeFeetRing } from "./rigParts.js";

// The screenshot fighter (expectation.png) redrawn as flat vector shapes:
// resolution independent, no textures, every part its own mesh so the
// headband can lag, the arms can swing, the eyes can blink and flash.
// Drawn facing +x; root.scale.x flips it. Depth is faked with small z steps.

const OUTLINE = 0.025;

function ellipse(cx, cy, rx, ry) {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
}

function roundRect(x, y, w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Filled shape, geometry centred on its own bounding box so outlines can scale around it.
function flat(shape, color, z) {
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(new THREE.Vector3());
  const half = {
    x: (geo.boundingBox.max.x - geo.boundingBox.min.x) / 2,
    y: (geo.boundingBox.max.y - geo.boundingBox.min.y) / 2,
  };
  geo.translate(-c.x, -c.y, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(c.x, c.y, z);
  mesh.userData.half = half;
  return mesh;
}

// Same geometry, grown by a fixed thickness, drawn just behind.
function outlineOf(mesh, color) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color }));
  o.position.copy(mesh.position);
  o.position.z -= 0.004;
  o.scale.set(1 + OUTLINE / mesh.userData.half.x, 1 + OUTLINE / mesh.userData.half.y, 1);
  o.renderOrder = -1;
  return o;
}

function bar(len, thick, color, x, y, z, angle) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, thick), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  m.rotation.z = angle;
  return m;
}

export function buildVectorFighter(def) {
  const { palette: p, shape } = def;
  const root = new THREE.Group();
  root.name = def.id;
  const outlines = [];
  const add = (mesh, outlined = true) => {
    if (outlined) {
      const o = outlineOf(mesh, p.outline);
      outlines.push(o);
      root.add(o);
    }
    root.add(mesh);
    return mesh;
  };

  // legs and shoes (back pair first)
  add(flat(roundRect(-0.19, 0.1, 0.15, 0.46, 0.05), p.skin, 0.01));
  add(flat(roundRect(-0.24, 0, 0.34, 0.15, 0.06), p.shoes, 0.02));
  add(flat(roundRect(0.0, 0.1, 0.15, 0.46, 0.05), p.skin, 0.03));
  add(flat(roundRect(-0.05, 0, 0.34, 0.15, 0.06), p.shoes, 0.04));

  // torso, belt, collar
  const torso = add(flat(roundRect(-0.27, 0.5, 0.54, 0.52, 0.12), p.torso, 0.05));
  add(flat(roundRect(-0.27, 0.6, 0.54, 0.09, 0.03), p.belt, 0.06), false);
  add(flat(ellipse(0.04, 0.99, 0.2, 0.06), p.belt, 0.06), false);

  // head: hood (dark base + lighter front), face, mask across the eyes
  add(flat(ellipse(0.02, 1.38, 0.44, 0.44), p.hoodShade, 0.07));
  add(flat(ellipse(0.1, 1.42, 0.34, 0.38), p.hood, 0.075), false);
  add(flat(ellipse(0.14, 1.27, 0.3, 0.27), p.face, 0.08), false);
  add(flat(roundRect(-0.02, 1.33, 0.48, 0.15, 0.04), p.mask, 0.09), false);

  // eyes: white almond, pupil, angry brow; "x" marks for KO
  const eyes = [0.13, 0.32].map((x, i) => {
    const eye = new THREE.Group();
    eye.name = "eye";
    eye.position.set(x, 1.405, 0.1);
    const ball = flat(ellipse(0, 0, 0.075, 0.05), p.eye, 0);
    ball.name = "ball";
    ball.add(flat(ellipse(0.02, 0, 0.028, 0.028), p.pupil, 0.005));
    const brow = bar(0.17, 0.035, p.pupil, 0.0, 0.075, 0.006, i === 1 ? -0.35 : -0.15);
    const xMark = new THREE.Group();
    xMark.name = "x";
    xMark.visible = false;
    for (const angle of [Math.PI / 4, -Math.PI / 4]) xMark.add(bar(0.16, 0.035, p.pupil, 0, 0, 0.005, angle));
    eye.add(ball, brow, xMark);
    return eye;
  });
  root.add(...eyes);

  // headband, knot and two-piece ribbon = the "hat": lags the head, flies off on KO.
  // Group stays at z 0 so the shared reset code (position.set(0, restY, 0)) keeps depth.
  const hat = new THREE.Group();
  hat.name = "hat";
  hat.userData.restY = 1.555;
  hat.position.y = hat.userData.restY;
  const band = flat(roundRect(-0.44, -0.055, 0.9, 0.11, 0.04), p.band, 0.1);
  band.name = "hatBrim";
  const bandOutline = outlineOf(band, p.outline);
  outlines.push(bandOutline);
  const knot = flat(ellipse(-0.43, 0, 0.065, 0.065), p.band, 0.101);
  const tail = [];
  let sx = -0.47;
  let sy = 0;
  for (const seg of [{ len: 0.28, angle: Math.PI - 0.5 }, { len: 0.3, angle: Math.PI + 0.85 }]) {
    tail.push(bar(seg.len, 0.06, p.band, sx + (Math.cos(seg.angle) * seg.len) / 2, sy + (Math.sin(seg.angle) * seg.len) / 2, 0.095, seg.angle));
    sx += Math.cos(seg.angle) * seg.len;
    sy += Math.sin(seg.angle) * seg.len;
  }
  hat.add(bandOutline, band, knot, ...tail);
  root.add(hat);

  // arms: flat beads driven by the alive layer (wrapped-bandage look)
  const beadCount = shape.arm.segments * 2;
  const arms = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: p.arms }), beadCount);
  arms.name = "arms";
  const armsOutline = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: p.outline }), beadCount);
  armsOutline.renderOrder = -1;

  // gun in the front hand
  const blaster = new THREE.Group();
  blaster.name = "blaster";
  const gunBody = flat(roundRect(-0.1, -0.06, 0.36, 0.13, 0.04), p.gun, 0);
  const grip = flat(roundRect(-0.06, -0.15, 0.09, 0.12, 0.02), p.mask, -0.001);
  const gunOutline = outlineOf(gunBody, p.outline);
  outlines.push(gunOutline);
  blaster.add(gunOutline, grip, gunBody);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({ visible: false }));
  mouth.name = "mouth";
  const feetRing = makeFeetRing(p);
  root.add(mouth, feetRing);

  // every leaf the tell system may hide; eye internals stay under their eye group
  const eyeInternals = new Set();
  for (const eye of eyes) eye.traverse((o) => eyeInternals.add(o));
  const all = [];
  root.traverse((o) => {
    if (o.isMesh && !eyeInternals.has(o) && o !== mouth && o !== feetRing) all.push(o);
  });
  all.push(...eyes, arms, armsOutline, gunOutline, grip, gunBody);

  return {
    def,
    root,
    body: torso,
    bodyOutline: null,
    hat,
    brim: band,
    eyes,
    mouth,
    feetRing,
    arms,
    armsOutline,
    blaster,
    toonMaterial: new THREE.MeshToonMaterial(), // unused stand-in for the tell glow
    worldParts: [arms, armsOutline, blaster],
    shoulderLocal: [-1, 1].map((side) => new THREE.Vector3(side * 0.2, shape.shoulderHeight, 0.12)),
    parts: { eyes, hatBrim: [band], feetRing: [feetRing], outline: outlines, all },
  };
}
