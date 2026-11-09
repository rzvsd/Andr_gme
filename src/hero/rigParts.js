import * as THREE from "three";

// Small parts shared by every rig builder.

// landing puff (only shown as a tell); faces the side camera
export function makeFeetRing(palette) {
  const feetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.44, 32),
    new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  feetRing.name = "feetRing";
  feetRing.scale.set(1, 0.35, 1);
  feetRing.position.set(0, 0.06, 0.3);
  feetRing.visible = false;
  return feetRing;
}
