import * as THREE from "three";

// Procedural life on top of gameplay state: breathing, squash/stretch,
// lean, lagging hat, Verlet noodle arms, blinks. No baked animation needed.

const tmpVec = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

function makeChain(count, origin, length) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      pos: new THREE.Vector3(origin.x, origin.y - i * length, origin.z),
      prev: new THREE.Vector3(origin.x, origin.y - i * length, origin.z),
    });
  }
  return points;
}

export class AliveLayer {
  constructor(rig) {
    this.rig = rig;
    this.m = rig.def.motion;
    this.time = 0;
    this.stretch = 1;
    this.stretchVel = 0;
    this.lean = 0;
    this.hatOffset = 0;
    this.hatVel = 0;
    this.lastVy = 0;
    this.blinkTimer = this.nextBlink();
    this.blinkLeft = 0;
    this.anticipation = 0;
    this.recoil = 0;
    this.face = "deadpan";
    this.chains = rig.shoulderLocal.map((s) =>
      makeChain(rig.def.shape.arm.segments, s, rig.def.shape.arm.segmentLength)
    );
    // live tunables, exposed as sliders in the lab
    this.tune = { wobble: 1, breathing: 1, squash: 1 };
  }

  nextBlink() {
    const [min, max] = this.m.blinkEverySeconds;
    return min + Math.random() * (max - min);
  }

  // --- gameplay events ---
  onLand(impactVy) {
    const force = Math.min(1, Math.abs(impactVy) / 8);
    this.stretchVel -= (1 - this.m.squashOnLand) * 18 * force * this.tune.squash;
    this.hatVel -= 1.6 * force;
  }

  onJump() {
    this.stretchVel += (this.m.stretchAtApex - 1) * 10 * this.tune.squash;
  }

  onShoot(facing) {
    this.anticipation = this.m.anticipationMs / 1000;
    this.recoil = this.m.recoil * facing;
    // whip the arms backwards a little
    for (const chain of this.chains) {
      const hand = chain[chain.length - 1];
      hand.prev.x += facing * 0.12;
    }
  }

  onHit(fromDir) {
    this.face = "surprised";
    this.faceTimer = 0.4;
    this.lean += fromDir * 0.5;
    this.stretchVel += 3;
    this.hatVel += 2.5;
    for (const chain of this.chains) {
      for (const p of chain) p.prev.x -= fromDir * 0.15;
    }
  }

  setFace(face) {
    this.face = face;
    this.faceTimer = 0;
  }

  // --- per frame ---
  update(dt, state) {
    const { rig, m } = this;
    this.time += dt;

    // volume-preserving squash/stretch spring at the feet
    const target = !state.onGround && Math.abs(state.vy) < 1.5 ? 1 + (m.stretchAtApex - 1) * this.tune.squash : 1;
    const accel = (target - this.stretch) * m.springStiffness - this.stretchVel * m.springDamping;
    this.stretchVel += accel * dt;
    this.stretch += this.stretchVel * dt;
    const s = THREE.MathUtils.clamp(this.stretch, 0.6, 1.4);
    const breathe = 1 + Math.sin(this.time * Math.PI * 2 * m.breatheHz) * m.breatheAmplitude * this.tune.breathing
      + Math.sin(this.time * 7.3) * 0.003 * this.tune.breathing;
    const ant = this.anticipation > 0 ? m.anticipationScale : 1;
    this.anticipation = Math.max(0, this.anticipation - dt);
    rig.root.scale.set(state.facing / Math.sqrt(s) * ant, s * breathe * ant, 1 / Math.sqrt(s));

    // lean into velocity, recoil kicks the body back
    const targetLean = -state.vx * m.leanPerVelocity * this.tune.wobble + this.recoil * 6;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 12);
    this.recoil *= Math.max(0, 1 - dt * 14);
    rig.root.rotation.z = this.lean;

    // hat lags the body vertically (spring driven by vertical acceleration)
    const vyChange = (state.vy - this.lastVy) / Math.max(dt, 1e-4);
    this.lastVy = state.vy;
    const hs = m.hatSpring;
    this.hatVel += (-hs.stiffness * this.hatOffset - hs.damping * this.hatVel - vyChange * hs.lag * 0.02) * dt;
    this.hatOffset += this.hatVel * dt;
    rig.hat.position.y = rig.hat.userData.restY + THREE.MathUtils.clamp(this.hatOffset, -0.12, 0.25) * this.tune.wobble;
    rig.hat.rotation.z = -this.lean * 0.6 - state.vx * 0.01 * this.tune.wobble;

    this.updateFace(dt);
    this.updateArms(dt, state);
  }

  updateFace(dt) {
    const { rig } = this;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkLeft = 0.12;
      this.blinkTimer = this.nextBlink();
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    if (this.faceTimer > 0) {
      this.faceTimer -= dt;
      if (this.faceTimer <= 0) this.face = "deadpan";
    }
    const eyeScaleY = this.blinkLeft > 0 ? 0.12 : this.face === "surprised" ? 1.5 : this.face === "slowblink" ? 0.3 : 1;
    const eyeScaleX = this.face === "surprised" ? 1.4 : 1;
    for (const eye of rig.eyes) {
      const ball = eye.getObjectByName("ball");
      const x = eye.getObjectByName("x");
      const ko = this.face === "ko";
      ball.visible = !ko;
      x.visible = ko;
      ball.scale.set(eyeScaleX, eyeScaleY, 1);
    }
    rig.mouth.scale.set(this.face === "surprised" ? 0.4 : this.face === "smile" ? 1.3 : 1, this.face === "surprised" ? 4 : 1, 1);
  }

  updateArms(dt, state) {
    const { rig } = this;
    const { arm } = rig.def.shape;
    const gravity = this.m.armGravity;
    const damping = this.m.armDamping;
    let bead = 0;
    rig.root.updateMatrixWorld();

    this.chains.forEach((chain, armIndex) => {
      // anchor follows the shoulder in world space
      tmpVec.copy(rig.shoulderLocal[armIndex]).applyMatrix4(rig.root.matrixWorld);
      chain[0].pos.copy(tmpVec);
      chain[0].prev.copy(tmpVec);

      for (let i = 1; i < chain.length; i += 1) {
        const p = chain[i];
        const vx = (p.pos.x - p.prev.x) * damping;
        const vy = (p.pos.y - p.prev.y) * damping;
        p.prev.copy(p.pos);
        p.pos.x += vx;
        p.pos.y += vy + gravity * dt * dt * this.tune.wobble;
        // hands never sink through the floor the hero stands on
        if (state.floorY !== undefined) p.pos.y = Math.max(p.pos.y, state.floorY + arm.radius);
        // keep the arm slightly in front of the body
        p.pos.z = tmpVec.z + 0.02 * i;
      }
      for (let iter = 0; iter < 3; iter += 1) {
        for (let i = 1; i < chain.length; i += 1) {
          const a = chain[i - 1].pos;
          const b = chain[i].pos;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1e-4;
          const diff = (dist - arm.segmentLength) / dist;
          const wa = i === 1 ? 0 : 0.5;
          const wb = i === 1 ? 1 : 0.5;
          a.x += dx * diff * wa;
          a.y += dy * diff * wa;
          b.x -= dx * diff * wb;
          b.y -= dy * diff * wb;
        }
        // front hand reaches forward with the blaster; back hand hangs behind
        const hand = chain[chain.length - 1].pos;
        const reach = state.facing * (armIndex === 1 ? 0.42 : -0.14);
        const drop = armIndex === 1 ? 0.15 : 0.45;
        hand.x += (tmpVec.x + reach - hand.x) * 0.08;
        hand.y += (tmpVec.y - drop - hand.y) * 0.06;
      }

      chain.forEach((p, i) => {
        const r = i === chain.length - 1 ? arm.handRadius : arm.radius * (1 - i * 0.04);
        tmpMat.compose(p.pos, tmpQuat, tmpScale.setScalar(r));
        rig.arms.setMatrixAt(bead, tmpMat);
        tmpMat.compose(p.pos, tmpQuat, tmpScale.setScalar(r * 1.18));
        rig.armsOutline.setMatrixAt(bead, tmpMat);
        bead += 1;
      });
    });
    rig.arms.instanceMatrix.needsUpdate = true;
    rig.armsOutline.instanceMatrix.needsUpdate = true;

    // blaster sits in the front hand
    const front = this.chains[1][this.chains[1].length - 1].pos;
    rig.blaster.position.set(front.x + state.facing * 0.12, front.y, front.z + 0.02);
    rig.blaster.rotation.z = this.recoil * -8;
    rig.blaster.scale.x = state.facing; // world-space part, so it flips on its own
  }

  // world position the bullet leaves from
  muzzleWorld(out, facing) {
    const front = this.chains[1][this.chains[1].length - 1].pos;
    return out.set(front.x + facing * 0.26, front.y, front.z);
  }
}
