import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeFeetRing } from "./rigParts.js";
import { buildVectorFighter } from "./vectorFighter.js";

// Builds a hero rig from a CharacterDef. Procedural geometry, toon shading,
// inverted-hull outlines. Draw calls per hero: body(+outline), brim(+outline),
// 2 eyes, mouth, arms instanced(+outline), feet ring, blaster = 10.

function gradientMap(steps = 3) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i += 1) {
    data[i] = Math.round((i / (steps - 1)) * 255);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Per-vertex color from a picker (x, y, z) -> hex, so one merged mesh can
// carry several flat colors.
function paintBy(geometry, pick) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    color.set(pick(pos.getX(i), pos.getY(i), pos.getZ(i)));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function paint(geometry, hex) {
  return paintBy(geometry, () => hex);
}

function outlineFor(mesh, outlineColor, scale = 1.06) {
  const hull = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: outlineColor, side: THREE.BackSide })
  );
  hull.scale.setScalar(scale);
  hull.position.copy(mesh.position);
  hull.rotation.copy(mesh.rotation);
  hull.renderOrder = -1;
  return hull;
}

// A flat cutout (pixels from a screenshot) wearing the same rig interface, so
// it moves, squashes and flashes like the procedural heroes. No arms or face
// parts to animate: the whole sprite is the tell.
function buildSpriteCharacter(def) {
  const { sprite, shape, palette } = def;
  const root = new THREE.Group();
  root.name = def.id;

  const h = sprite.heightUnits;
  const w = (h * sprite.width) / sprite.height;
  const tex = new THREE.TextureLoader().load(sprite.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; // keep the source pixels as they are
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 })
  );
  body.name = "body";
  body.position.y = h * 0.5;

  const hat = new THREE.Group(); // empty: lets the shared KO / hat-spring code run unchanged
  hat.name = "hat";
  hat.userData.restY = h;
  hat.position.y = h;

  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), hiddenMat);
  mouth.name = "mouth";
  const beadCount = shape.arm.segments * 2;
  const arms = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 4, 4), hiddenMat, beadCount);
  const armsOutline = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 4, 4), hiddenMat, beadCount);
  const blaster = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), hiddenMat);
  blaster.name = "blaster";
  const feetRing = makeFeetRing(palette);

  root.add(body, hat, mouth, feetRing);

  return {
    def,
    root,
    body,
    bodyOutline: null,
    hat,
    brim: null,
    eyes: [],
    mouth,
    feetRing,
    arms,
    armsOutline,
    blaster,
    toonMaterial: new THREE.MeshToonMaterial(), // unused stand-in for the tell glow
    worldParts: [arms, armsOutline, blaster],
    shoulderLocal: [-1, 1].map((side) => new THREE.Vector3(side * w * 0.3, shape.shoulderHeight, 0.1)),
    parts: { eyes: [], hatBrim: [], feetRing: [feetRing], outline: [], all: [body] },
  };
}

export function buildCharacter(def) {
  if (def.sprite) return buildSpriteCharacter(def);
  if (def.art === "vectorFighter") return buildVectorFighter(def);
  const { shape, palette } = def;
  const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  const root = new THREE.Group(); // origin at the feet
  root.name = def.id;

  // --- body: capsule + legs (+ optional separate head) merged, colored per vertex ---
  const bodyHeight = shape.bodyLength + shape.bodyRadius * 2;
  const bodyCenterY = shape.legLength + shape.legRadius + bodyHeight * 0.5 - 0.05;
  const bodyGeo = paint(
    new THREE.CapsuleGeometry(shape.bodyRadius, shape.bodyLength, 8, 24).translate(0, bodyCenterY, 0),
    palette.body
  );
  const legGeos = [-1, 1].map((side) =>
    paint(
      new THREE.CapsuleGeometry(shape.legRadius, shape.legLength, 4, 12).translate(
        side * shape.legSpread,
        shape.legRadius + shape.legLength * 0.5,
        0
      ),
      palette.legs ?? palette.bodyShade
    )
  );
  const pieces = [bodyGeo, ...legGeos];
  let bodyTopY = bodyCenterY + bodyHeight * 0.5;
  let faceRadius = shape.bodyRadius;
  if (shape.head) {
    // a big round head on a small torso; hood over the top, face below the eyes
    const headCenterY = bodyTopY + shape.head.radius - shape.head.overlap;
    pieces.push(
      paintBy(new THREE.SphereGeometry(shape.head.radius, 24, 18).translate(0, headCenterY, 0), (x, y) =>
        y > headCenterY - 0.08 ? palette.head : palette.face
      )
    );
    bodyTopY = headCenterY + shape.head.radius;
    faceRadius = shape.head.radius;
  }
  const bodyMesh = new THREE.Mesh(mergeGeometries(pieces, false), toon);
  bodyMesh.name = "body";
  const bodyOutline = outlineFor(bodyMesh, palette.outline);

  // Hat is its own group, with its origin at the brim, so it can lag the body
  // and fly off (and spin around itself) on KO. A hat with no crown is a headband.
  const hat = new THREE.Group();
  hat.name = "hat";
  let crown = null;
  let crownOutline = null;
  if (shape.hat.crownHeight > 0) {
    const crownGeo = paint(
      new THREE.CylinderGeometry(shape.hat.crownRadius, shape.hat.crownBase, shape.hat.crownHeight, 24).translate(
        0,
        shape.hat.crownHeight * 0.5,
        0
      ),
      palette.accent
    );
    crown = new THREE.Mesh(crownGeo, toon);
    crownOutline = outlineFor(crown, palette.outline);
  }
  const brimGeo = paint(
    new THREE.CylinderGeometry(shape.hat.brimRadius, shape.hat.brimRadius, shape.hat.brimHeight, 32),
    palette.accentShade
  );
  const brim = new THREE.Mesh(brimGeo, toon);
  brim.name = "hatBrim";
  const brimOutline = outlineFor(brim, palette.outline, 1.04);
  const tail = (shape.hat.tail ?? []).map((seg) => {
    const m = new THREE.Mesh(paint(new THREE.BoxGeometry(seg.length, 0.05, 0.05), palette.accent), toon);
    m.position.set(...seg.at);
    m.rotation.z = seg.angle;
    return m;
  });
  hat.add(...[crown, brim, crownOutline, brimOutline, ...tail].filter(Boolean));
  hat.userData.restY = bodyTopY + (shape.hat.offsetY ?? -0.1);
  hat.position.y = hat.userData.restY;

  // --- face ---
  const eyeMat = new THREE.MeshBasicMaterial({ color: palette.eye });
  const inkMat = new THREE.MeshBasicMaterial({ color: palette.pupil ?? palette.outline });
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Group();
    eye.name = "eye";
    const ball = new THREE.Mesh(new THREE.SphereGeometry(shape.eyeRadius, 12, 12), eyeMat);
    ball.name = "ball";
    if (palette.pupil) {
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(shape.eyeRadius * 0.45, 8, 8), inkMat);
      pupil.position.z = shape.eyeRadius * 0.7;
      ball.add(pupil);
    }
    const xMark = new THREE.Group();
    xMark.name = "x";
    xMark.visible = false;
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(shape.eyeRadius * 2.6, shape.eyeRadius * 0.6, 0.02), inkMat);
      bar.rotation.z = angle;
      xMark.add(bar);
    }
    eye.add(ball, xMark);
    if (shape.brows) {
      // angry: inner end sits lower
      const brow = new THREE.Mesh(new THREE.BoxGeometry(shape.eyeRadius * 2.4, shape.eyeRadius * 0.5, 0.03), inkMat);
      brow.position.y = shape.eyeRadius * 1.3;
      brow.rotation.z = side * 0.5;
      eye.add(brow);
    }
    if (shape.eyeScale) eye.scale.set(shape.eyeScale[0], shape.eyeScale[1], 1);
    // slightly asymmetric on purpose
    eye.position.set(side * shape.eyeSpread, shape.eyeHeight + (side < 0 ? 0.015 : 0), faceRadius - 0.02);
    return eye;
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(shape.mouthWidth, 0.03, 0.03), inkMat);
  mouth.name = "mouth";
  mouth.position.set(0, shape.mouthHeight, faceRadius);

  const feetRing = makeFeetRing(palette);

  // --- arms: beads positioned by the alive layer (world space) ---
  const beadCount = shape.arm.segments * 2;
  const beadGeo = paint(new THREE.SphereGeometry(1, 10, 10), palette.arms ?? palette.bodyShade);
  const arms = new THREE.InstancedMesh(beadGeo, toon, beadCount);
  arms.name = "arms";
  const armsOutline = new THREE.InstancedMesh(
    beadGeo,
    new THREE.MeshBasicMaterial({ color: palette.outline, side: THREE.BackSide }),
    beadCount
  );
  armsOutline.renderOrder = -1;

  const blasterSize = shape.blaster ?? { w: 0.22, h: 0.1 };
  const blaster = new THREE.Mesh(
    new THREE.BoxGeometry(blasterSize.w, blasterSize.h, 0.08),
    new THREE.MeshBasicMaterial({ color: palette.blaster ?? palette.outline })
  );
  blaster.name = "blaster";

  root.add(bodyMesh, bodyOutline, hat, ...eyes, mouth, feetRing);

  return {
    def,
    root,
    body: bodyMesh,
    bodyOutline,
    hat,
    brim,
    eyes,
    mouth,
    feetRing,
    arms,
    armsOutline,
    blaster,
    toonMaterial: toon,
    // world-space attachments the scene must add itself
    worldParts: [arms, armsOutline, blaster],
    shoulderLocal: [-1, 1].map((side) => new THREE.Vector3(side * (shape.bodyRadius + 0.02), shape.shoulderHeight, 0.08)),
    // named groups the tell system can light
    parts: {
      eyes,
      hatBrim: [brim],
      feetRing: [feetRing],
      outline: [bodyOutline, crownOutline, brimOutline, armsOutline].filter(Boolean),
      // leaf meshes only: a hidden parent would also hide a lit tell
      all: [bodyMesh, bodyOutline, crown, brim, crownOutline, brimOutline, ...tail, ...eyes, mouth, arms, armsOutline, blaster].filter(Boolean),
    },
  };
}
