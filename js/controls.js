/* ============================================================================
   controls.js -- camera rig: OrbitControls, pointer-locked 6-DOF inertial
   flight (WASD/QE, boost, brake, dampers), cinematic loop and the four
   view presets.
   The rig lives in Boyer-Lindquist coordinates (signed r, theta, phi) plus an
   orientation quaternion in the flat embedding, so r < 0 (the antiverse behind
   the ring) is a first-class state and never has to be faked by mirroring the
   world.  Motion is intentionally semi-Newtonian -- this is a ship, not a
   geodesic -- while every photon the ship sees is a full KN geodesic.
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from '../vendor/jsm/controls/OrbitControls.js';
import { horizons, ergoRadius, omega, shadowAim } from './kn.js';

export const PRESETS = [
  { id: 0, name: 'ORBIT PANORAMA \u73af\u7ed5\u5168\u666f', r: 26, th: 1.300, ph: 0.60, fov: 62, vel: [0, 0, 0], mode: 'orbit' },
  { id: 1, name: 'DISK SKIM \u76d8\u9762\u64e6\u8fb9',      r: 12.5, th: 1.5065, ph: 1.20, fov: 55, vel: [0, 0, 0.0], mode: 'orbit' },
  { id: 2, name: 'POLAR DIVE \u5782\u76f4\u4fef\u51b2',     r: 16, th: 0.42, ph: 2.40, fov: 72, vel: [-0.10, 0, 0], mode: 'flight' },
  { id: 3, name: 'RING TRAVERSAL \u5947\u73af\u7a7f\u8d8a', r: 3.6, th: 1.5605, ph: 4.00, fov: 78, vel: [-0.20, 0, 0], mode: 'flight' },
];

/* cinematic keyframes -- r runs through 0 at the end, i.e. through the ring */
const CINE = [
  { t: 0,    r: 30.0, th: 1.28,  ph: -0.3 },
  { t: 12,   r: 23.0, th: 1.34,  ph: 0.5 },
  { t: 24,   r: 17.0, th: 1.40,  ph: 1.4 },
  { t: 36,   r: 12.0, th: 1.50,  ph: 2.3 },
  { t: 48,   r: 8.5,  th: 1.545, ph: 3.2 },
  { t: 60,   r: 6.0,  th: 1.556, ph: 4.1 },
  { t: 72,   r: 3.4,  th: 1.562, ph: 5.0 },
  { t: 82,   r: 1.1,  th: 1.569, ph: 5.9 },
  { t: 92,   r: -3.5, th: 1.570, ph: 6.8 },
  { t: 102,  r: -9.0, th: 1.565, ph: 7.7 },
  { t: 114,  r: -18.0, th: 1.40, ph: 9.6 },
  { t: 126,  r: 30.0, th: 1.28,  ph: 2 * Math.PI - 0.3 },
  { t: 138,  r: 30.0, th: 1.28,  ph: 2 * Math.PI - 0.3 },
];
export const CINE_LEN = 138;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* Scratch objects: the camera rig runs every frame and used to allocate a dozen
   Vector3/Quaternion/Matrix4 per update, which is pure GC pressure at 60 Hz. */
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
const _v7 = new THREE.Vector3(0, 0, 0), _v8 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
const wrapPi = (x) => { x = (x + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };

export function embed(r, th, ph, out) {
  const s = Math.sin(th);
  if (out) return out.set(r * s * Math.cos(ph), r * s * Math.sin(ph), r * Math.cos(th));
  return new THREE.Vector3(r * s * Math.cos(ph), r * s * Math.sin(ph), r * Math.cos(th));
}

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.dx = 0; this.dy = 0;
    this.locked = false;
    this.onFirstLock = null;
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked && this.onFirstLock) this.onFirstLock();
    });
  }
  requestLock() { if (this.dom.requestPointerLock) this.dom.requestPointerLock(); }
  exitLock() { if (document.exitPointerLock) document.exitPointerLock(); }
  consumeMouse() { const r = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return r; }
  clearMouse() { this.dx = 0; this.dy = 0; }
}

export class CameraRig {
  constructor(dom, params) {
    this.dom = dom;
    this.params = params;
    this.r = 24; this.th = 1.30; this.ph = 0.6;
    /* universe side.  OrbitControls works with a Cartesian position whose
       length is always >= 0, so the sign of r (which is what distinguishes the
       r < 0 antiverse sheet behind the ring singularity) has to be carried
       explicitly -- otherwise any orbit interaction would silently teleport the
       camera back to "our" universe.  This is the CPU-side half of the
       state-pixel repair. */
    this.rSign = 1;
    /* shadow-centring factor; 1.0 == pan by exactly b_mid/r.  Calibrated by
       measuring the dark-region bounding-box offset over a range of spins
       (0.4 -> -3.9%, 0.75 -> -1.6%, 1.0 -> 0.00%, 1.4 -> +3.1%). */
    this.aimK = 1.0;
    /* compositional offset on top of the physical aim: the photon ring is
       centred by lookAtCenter(), but the VISIBLE dark region is not, because
       the lensed near side of the disk covers the lower part of the shadow.
       autoFrame() measures that and stores the correction here. */
    this.aimBiasYaw = 0;
    this.aimBiasPitch = 0;
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3(0, 0, 0);        /* local ZAMO frame, in c */
    this.mode = 'orbit';
    this.fov = 62;
    this.mass = 1; this.spin = 0.86; this.charge = 0;
    this.interior = 0;
    this.speedScale = 1.15;                        /* M per second at v = 1 */
    this.dragScale = 0.85;
    this.gravity = 12.0;
    this.cineT = 0;
    this.events = [];
    this.input = new Input(dom);

    this.orbitCam = new THREE.PerspectiveCamera(this.fov, 1, 0.01, 1e5);
    this.orbitCam.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.orbitCam, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.8;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 220;
    this.controls.target.set(0, 0, 0);
    this.syncOrbitFromBL();
    this.lookAtCenter();
  }

  setParams(M, a, Q) { this.mass = M; this.spin = a; this.charge = Q; }

  setMode(m) {
    if (m === this.mode) return;
    this.mode = m;
    this.controls.enabled = (m === 'orbit');
    if (m === 'orbit') { this.syncOrbitFromBL(); }
    if (m !== 'flight') this.input.exitLock();
  }

  syncOrbitFromBL() {
    embed(this.r, this.th, this.ph, _v1);   /* embed() honours the sign of r */
    this.orbitCam.position.copy(_v1);
    this.orbitCam.up.set(0, 0, 1);
    this.orbitCam.lookAt(0, 0, 0);
  }
  /* Point the camera at the black hole -- and not at the bare coordinate origin.
     Frame dragging shifts the shadow off the r = 0 direction by ~b_mid/r, so the
     optical axis is panned by exactly that angle; without it every start-up has
     the hole sitting a few percent off-centre. */
  lookAtCenter() {
    const p = _v1.set(0, 0, 0);
    embed(this.r, this.th, this.ph, p);
    if (Math.abs(Math.cos(this.th)) > 0.985) _v2.set(Math.sin(this.ph), -Math.cos(this.ph), 0);
    else _v2.set(0, 0, 1);
    _m1.lookAt(p, _v7, _v2);
    this.quat.setFromRotationMatrix(_m1);
    this.applyAim(this.quat).normalize();
  }

  /* Pan angle that puts the SHADOW (not the coordinate origin) in the middle of
     the frame.  Frame dragging pushes the shadow towards one side by roughly
     b_mid/r; the numerical factor is the ratio between the shadow's apparent
     centroid displacement and that estimate and was calibrated by measuring the
     dark region's bounding box over a range of spins (tools/reframe-check).
     A positive yaw about the camera's own up axis turns the view towards its
     local -X, which is the direction the shadow is displaced away from. */
  aimYaw() {
    const aim = shadowAim(this.mass, this.spin, this.charge);
    const rr = Math.max(Math.abs(this.r), 1e-3) * (this.r < 0 ? -1 : 1);
    return Math.max(-0.6, Math.min(0.6, -this.aimK * aim.bMid / rr));
  }
  /* post-multiplies the centring pan into an existing quaternion (no
     allocation -- this runs every frame in orbit mode) */
  applyAim(q) {
    q.multiply(_q1.setFromAxisAngle(_axisY, this.aimYaw()));
    if (this.aimBiasYaw !== 0) q.multiply(_q1.setFromAxisAngle(_axisY, this.aimBiasYaw));
    if (this.aimBiasPitch !== 0) q.multiply(_q1.setFromAxisAngle(_axisX, this.aimBiasPitch));
    return q;
  }

  /* Pan so that a feature sitting at screen NDC (nx, ny) lands in the middle.
     nx/ny are normalised to the half frame, so the angle is
     atan(nx * tan(halfFov) * aspect) horizontally and atan(ny * tan(halfFov))
     vertically.  Looking towards the feature means a negative yaw (a positive
     yaw about the camera's +Y turns the view towards its local -X) and a
     positive pitch.  Capped, because this is framing, not physics. */
  aimShift(nx, ny, aspect) {
    const t = Math.tan((this.fov * Math.PI) / 360);
    const cap = 0.11;
    /* 0.0008 NDC is about 0.5 px.  The old 0.03 NDC was about 19 px horizontally,
       i.e. WIDER than recentre()'s own convergence test (0.006 NDC), so any
       residual between about 4 px and 19 px was silently never corrected. */
    const dead = 0.0008;
    const cl = (v) => Math.max(-cap, Math.min(cap, v));
    /* ACCUMULATE: the arguments are the residual offset of the feature after
       whatever bias is already in place, so the correction is ADDED rather
       than assigned -- assigning made repeated calls ratchet the framing. */
    if (Math.abs(nx) > dead) this.aimBiasYaw = cl(this.aimBiasYaw - Math.atan(nx * t * aspect));
    if (Math.abs(ny) > dead) this.aimBiasPitch = cl(this.aimBiasPitch + Math.atan(ny * t));
    return { yawDeg: (this.aimBiasYaw * 180) / Math.PI, pitchDeg: (this.aimBiasPitch * 180) / Math.PI };
  }

  /* the "initial radius / initial inclination" parameters define the start-up
     pose; apply them (clamped outside the horizon) and centre the hole. */
  applyStartup(v) {
    const h = horizons(this.mass, this.spin, this.charge);
    const rMin = Math.max(this.mass * 1.2, h.rp * 1.15, 2.2);
    this.r = Math.max(Math.abs(v.camR), rMin);
    this.rSign = 1;
    this.th = clamp(v.camTheta * Math.PI / 180, 0.02, Math.PI - 0.02);
    this.ph = 0.6;
    this.vel.set(0, 0, 0);
    this.lookAtCenter();
    this.syncOrbitFromBL();
    return { r: this.r, th: this.th, ph: this.ph };
  }

  applyPreset(i) {
    const p = PRESETS[clamp(i | 0, 0, PRESETS.length - 1)];
    this.r = p.r; this.rSign = p.r < 0 ? -1 : 1; this.th = p.th; this.ph = p.ph; this.fov = p.fov;
    this.vel.set(p.vel[0], p.vel[1], p.vel[2]);
    this.mode = p.mode === 'flight' ? 'flight' : 'orbit';
    this.controls.enabled = (this.mode === 'orbit');
    this.lookAtCenter();
    this.syncOrbitFromBL();
    this.cineT = 0;
    this.events.push({ kind: 'preset', text: p.name });
    return p;
  }

  /* ---- per frame ------------------------------------------------------- */
  update(dt) {
    dt = clamp(dt, 0.0005, 0.05);
    const M = this.mass, a = this.spin, Q = this.charge;
    if (this.mode === 'orbit') {
      this.controls.enabled = true;
      this.controls.update();
      const p = this.orbitCam.position;
      const len = Math.max(p.length(), 1e-4);
      this.r = this.rSign * len;
      this.th = Math.acos(clamp(p.z / len, -1, 1));
      this.ph = Math.atan2(p.y, p.x);
      this.quat.copy(this.orbitCam.quaternion);
      /* OrbitControls' update() ends with object.lookAt(target), which points
         the camera exactly at r = 0 and would throw the centring yaw away, so
         it is re-applied here every frame. */
      this.applyAim(this.quat).normalize();
      this.vel.set(0, 0, 0);
    } else if (this.mode === 'cinematic') {
      this.cineT = (this.cineT + dt) % CINE_LEN;
      let i = 0;
      while (i < CINE.length - 2 && CINE[i + 1].t < this.cineT) i++;
      const k0 = CINE[i], k1 = CINE[i + 1];
      let u = (this.cineT - k0.t) / Math.max(k1.t - k0.t, 1e-3);
      u = u * u * (3 - 2 * u);
      this.r = k0.r + (k1.r - k0.r) * u;
      this.rSign = this.r < 0 ? -1 : 1;
      this.th = k0.th + (k1.th - k0.th) * u;
      this.ph = k0.ph + (k1.ph - k0.ph) * u;
      this.vel.set(0, 0, 0);
      this.lookAtCenter();
    } else {
      this.controls.enabled = false;
      this.stepFlight(dt, M, a, Q);
    }
    const h = horizons(M, a, Q);
    this.interior = (this.r > 0 && this.r < h.rp * 1.0005) ? 1 : 0;
  }

  stepFlight(dt, M, a, Q) {
    const k = this.input.keys;
    const [mdx, mdy] = this.input.consumeMouse();
    const sens = 0.0021;

    /* ---- look ---- */
    const yaw = -mdx * sens, pitch = -mdy * sens;
    const roll = ((k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0)) * 1.15 * dt;
    if (yaw || pitch || roll) {
      this.quat.multiply(_q1.setFromAxisAngle(_axisY, yaw))
               .multiply(_q1.setFromAxisAngle(_axisX, pitch))
               .multiply(_q1.setFromAxisAngle(_axisZ, roll))
               .normalize();
    }

    /* ---- thrust, correctly rotated from the camera body into the ZAMO frame
       W/S push along the ship's -Z/+Z, A/D along X and the arrow keys along Y.
       The body axes are rotated by the orientation quaternion (flat embedding)
       and then projected on the local orthonormal triad (r-hat, th-hat, ph-hat),
       which is what makes WASD actually move the ship where it is pointing. */
    const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 3.0 : 1.0;
    const brake = k.has('ControlLeft') || k.has('ControlRight') ? 0.25 : 1.0;
    /* Movement lives on the ARROW keys: WASD collided with the global
       shortcuts (S = screenshot, R/F = up/down), so it is retired entirely. */
    const fwd = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0);
    const lat = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    const vert = (k.has('KeyR') ? 1 : 0) - (k.has('KeyF') ? 1 : 0);
    const acc = 0.85 * boost * brake;
    if (fwd || lat || vert) {
      const s = Math.sin(this.th), c = Math.cos(this.th);
      _v1.set(0, 0, -1).applyQuaternion(this.quat);
      _v2.set(1, 0, 0).applyQuaternion(this.quat);
      _v3.set(0, 1, 0).applyQuaternion(this.quat);
      const dir = _v1.multiplyScalar(fwd).add(_v2.multiplyScalar(lat)).add(_v3.multiplyScalar(vert));
      _v4.set(s * Math.cos(this.ph), s * Math.sin(this.ph), c);
      _v5.set(c * Math.cos(this.ph), c * Math.sin(this.ph), -s);
      _v6.set(-Math.sin(this.ph), Math.cos(this.ph), 0);
      _v8.set(dir.dot(_v4), dir.dot(_v5), dir.dot(_v6)).multiplyScalar(acc * dt);
      this.vel.add(_v8);
    }
    if (k.has('Space')) this.vel.multiplyScalar(Math.pow(0.02, dt));

    /* ---- gravity (KN form: -M/r^2 + Q^2/r^3) toward the ring -------------
       The acceleration is capped and smoothly switched off inside |r| <~ 1 M:
       the r = 0 disk is not a point mass, and without the cutoff the 1/r^2
       divergence would trap the ship oscillating on the ring instead of letting
       it coast through into the antiverse. */
    const rr = Math.max(Math.abs(this.r), 0.05);
    const gRaw = (M / (rr * rr)) - (Q * Q) / (rr * rr * rr);
    /* the pull is faded out entirely below r = 3 M so that a ship which has
       built up speed can actually coast through the ring and out the other
       side; otherwise the symmetric 1/r well would just make it bounce. */
    const cx = Math.min(1, Math.max(0, (Math.abs(this.r) - 3.0) / 6.0));
    const cut = cx * cx * (3 - 2 * cx);
    const gAcc = Math.min(Math.max(gRaw, 0), 1.0) * cut;
    const gMul = (k.has('ShiftLeft') || k.has('ShiftRight')) ? 2.0 : 1.0;
    this.vel.x -= Math.sign(this.r) * gAcc * this.gravity * gMul * dt;

    /* ---- damping (inertial: only the explicit damper key removes speed) -- */
    const sp = this.vel.length();
    if (sp > 1.0) this.vel.multiplyScalar(1.0 / sp);

    /* ---- advance the BL coordinates ------------------------------------- */
    const th = clamp(this.th, 0.02, Math.PI - 0.02);
    const s = Math.max(Math.sin(th), 0.02);
    const rho = Math.max(Math.abs(this.r), 0.06);
    const dr = this.vel.x * dt * this.speedScale;
    const dth = (this.vel.y * dt * this.speedScale) / Math.max(rho, 0.4);
    /* ZAMO advection = frame dragging; the ship is dragged even at rest */
    const g = this.metric(rho, th);
    const drag = g.f * a / Math.max(g.A, 1e-6);
    const dph = (this.vel.z * dt * this.speedScale) / Math.max(rho * s, 0.08) + drag * dt * this.dragScale;

    const rPrev = this.r;
    this.r += dr;
    this.th = clamp(this.th + dth, 0.02, Math.PI - 0.02);
    this.ph = wrapPi(this.ph + dph);

    if (Math.abs(this.r) < 0.02) this.r = (dr >= 0 ? 1 : -1) * 0.02;
    this.rSign = this.r < 0 ? -1 : 1;
    if (rPrev > 0 && this.r <= 0) this.events.push({ kind: 'ring', text: 'RING SINGULARITY CROSSED \u2192 ANTIVERSE' });
    if (rPrev < 0 && this.r >= 0) this.events.push({ kind: 'ring', text: 'RETURNED TO OUR UNIVERSE' });
    const h = horizons(M, a, Q);
    if (rPrev >= h.rp && this.r < h.rp) this.events.push({ kind: 'horizon', text: 'OUTER HORIZON r+ CROSSED' });
    if (rPrev >= h.rm && this.r < h.rm && this.r > 0) this.events.push({ kind: 'horizon', text: 'INNER HORIZON r- CROSSED' });
  }

  metric(r, th) {
    const M = this.mass, a = this.spin, Q = this.charge;
    const s = Math.sin(th), c = Math.cos(th);
    const s2 = s * s + 4e-4;
    const Sig = r * r + a * a * c * c;
    const Del = r * r - 2 * M * r + a * a + Q * Q;
    const f = 2 * M * r - Q * Q;
    return { Sig, Del, f, A: (r * r + a * a) * Sig + f * a * a * s2, s2 };
  }

  state() {
    const h = horizons(this.mass, this.spin, this.charge);
    return {
      r: this.r, th: this.th, ph: this.ph,
      quat: this.quat, vel: this.vel, speed: this.vel.length(),
      fov: this.fov, mode: this.mode,
      interior: this.interior,
      side: this.r < 0 ? -1 : 1,
      rp: h.rp, rm: h.rm,
      ergo: ergoRadius(this.mass, this.spin, this.charge, this.th),
      omega: this.r > h.rp ? omega(this.mass, this.spin, this.charge, Math.abs(this.r)) : 0,
    };
  }

  drainEvents() { const e = this.events.slice(); this.events.length = 0; return e; }
}
