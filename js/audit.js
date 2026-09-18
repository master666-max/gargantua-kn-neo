/* ============================================================================
   audit.js -- in-page visual verification harness.
   Loaded only with ?audit=1.  It measures the RENDERED image and compares each
   feature against the closed-form general-relativistic prediction, using the
   same CPU geodesic twin that tools/validate-physics.mjs validates.  Nothing
   here is used by the normal rendering path.

     window.__AUDIT.run()            -> full report (JSON)
     window.__AUDIT.shadowRadius()   -> critical curve vs asin(b_c sqrt(1-rs/r)/r)
     window.__AUDIT.centring()       -> shadow centroid vs b_mid/r
     window.__AUDIT.doppler()        -> measured brightness ratio vs (g1/g2)^4
     window.__AUDIT.profile()        -> disk radial law vs T ~ r^-3/4
   ========================================================================== */
import * as THREE from 'three';
import { trace, diskG, isco, horizons, shadowAim, tempProfile, DISK_TEMP_EXP, chromaLuma,
         diskFluxTable, ptTemp } from './kn.js';

const K = () => window.__KN;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function grab() {
  const gl = document.getElementById('gl');
  const w = gl.width, h = gl.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(gl, 0, 0, w, h);
  return { d: ctx.getImageData(0, 0, w, h).data, w, h };
}
const lumaAt = (img, px, py) => {
  const x = clamp(Math.round(px), 0, img.w - 1), y = clamp(Math.round(py), 0, img.h - 1);
  const i = (y * img.w + x) * 4;
  return (img.d[i] + img.d[i + 1] + img.d[i + 2]) / 3;
};
/* canvas pixel (from the top-left) -> the NDC the raytracer used */
function ndcOf(px, py, img) {
  return [2 * (px + 0.5) / img.w - 1, 1 - 2 * (py + 0.5) / img.h];
}
function pixelOf(nx, ny, img) {
  return [Math.round((nx + 1) * 0.5 * img.w - 0.5), Math.round((1 - ny) * 0.5 * img.h - 0.5)];
}

/* mirror of the shader's ray construction: camera basis -> ZAMO components */
function rayForNdc(nx, ny) {
  const st = K().rig.state(), sz = K().pipeline.size;
  const aspect = sz.aw / sz.ah;
  const t = Math.tan((st.fov * Math.PI) / 360);
  const q = st.quat;
  if (!Number.isFinite(q.x + q.y + q.z + q.w)) {
    /* never let a NaN orientation poison a measurement silently */
    throw new Error('camera quaternion is not finite: ' + [q.x, q.y, q.z, q.w].join(','));
  }
  const v = new THREE.Vector3(nx * aspect * t, ny * t, -1).normalize();
  v.applyQuaternion(q);
  const s = Math.sin(st.th), c = Math.cos(st.th), ph = st.ph;
  const rh = new THREE.Vector3(s * Math.cos(ph), s * Math.sin(ph), c);
  const th = new THREE.Vector3(c * Math.cos(ph), c * Math.sin(ph), -s);
  const pph = new THREE.Vector3(-Math.sin(ph), Math.cos(ph), 0);
  return [v.dot(rh), v.dot(th), v.dot(pph)];
}

/* The shadow-geometry checks need an unobstructed critical curve.  The disk's
   own emission -- strongly beamed at a != 0 -- truncates the walk-out from the
   centre and biases the edge in one direction, so the absorption is pinned off
   for the duration of the measurement and restored afterwards.  The uniform is
   overwritten every frame by buildFrame(), hence the property pin. */
function pinUniform(name, val) {
  const u = K().pipeline.matA.uniforms[name];
  if (!u) return false;
  if (u.__pin) return false;
  Object.defineProperty(u, 'value', { get() { return val; }, set() {}, configurable: true });
  u.__pin = true;
  return true;
}
function unpinUniform(name) {
  const u = K().pipeline.matA.uniforms[name];
  if (!u.__pin) return;
  delete u.value; u.__pin = false;
}
/* uDebug lives in a uniform that buildFrame() only refreshes on the next
   animation frame, so the harness writes it directly and re-renders. */
function setDebug(n) {
  const P = K().pipeline;
  P.matImage.uniforms.uDebug.value = n;
  P.matA.uniforms.uDebug.value = n;
  P.renderFrame();
}
/* Debug channel 10 renders a pure black/white escape mask, so the critical
   curve can be located to the pixel without any disk emission contaminating the
   threshold -- this is the fix for open item O6. */
function withGeometryMask(fn) {
  const P = K().pipeline;
  const oa = P.matA.uniforms.uDebug.value, oi = P.matImage.uniforms.uDebug.value;
  P.matA.uniforms.uDebug.value = 10; P.matImage.uniforms.uDebug.value = 10;
  /* the mask reports "escaped" vs "not escaped", and a ray swallowed by an
     opaque disk is also "not escaped" -- so the absorption is pinned off as
     well, leaving a pure capture boundary */
  const pinned = pinUniform('uDiskInner', 1e9);
  P.renderFrame();
  let out;
  try { out = fn(128); } finally {
    P.matA.uniforms.uDebug.value = oa; P.matImage.uniforms.uDebug.value = oi;
    if (pinned) unpinUniform('uDiskInner');
    P.renderFrame();
  }
  return out;
}
function withDiskOff(fn) {
  const pinned = pinUniform('uDiskInner', 1e9);
  K().pipeline.renderFrame();              /* synchronous re-render with it off */
  let out;
  try { out = fn(); } finally {
    if (pinned) { unpinUniform('uDiskInner'); K().pipeline.renderFrame(); }
  }
  return out;
}
/* The display transform (exposure + ACES + bloom) is strongly compressive: at
   default gain the disk highlights sit above 1.0 and every brightness ratio is
   squashed towards 1.  Any test of I ~ g^4 has to be run in LINEAR HDR, so the
   harness, for the duration of such a test, pins the gain low (nothing clips),
   switches to debug view 9 (linear HDR, no tonemap) and restores afterwards. */
function withLinearDisk(fn, gain = 0.22) {
  const pinnedG = pinUniform('uDiskGain', gain);   /* pinUniform takes a value */
  let out;
  const img = K().__img;
  try {
    setDebug(9);
    out = fn();
  } finally {
    setDebug(0);
    if (pinnedG) unpinUniform('uDiskGain');
  }
  return out;
}

function traceAt(nx, ny) {
  const st = K().rig.state(), dv = K().derived();
  const n = rayForNdc(nx, ny);
  const res = trace({ M: dv.M, a: dv.a, Q: dv.Q, r0: st.r, th0: st.th, ph0: st.ph, n,
    maxSteps: 20000, tol: 1e-5, stepScale: 0.5,
    rFar: Math.max(Math.abs(st.r) * 1.55 + 6, 34), diskOuter: dv.diskOuter, stopAtDisk: true });
  return res;
}

/* predicted angular radius of the critical curve, in canvas pixels */
function predictedShadowPx() {
  const st = K().rig.state(), dv = K().derived(), img = K().__img || grab();
  const M = dv.M;
  let b;
  const aimB = dv.a * dv.a + dv.Q * dv.Q < 1e-9
    ? { bPro: 3 * Math.sqrt(3) * M, bRet: 3 * Math.sqrt(3) * M, bMid: 3 * Math.sqrt(3) * M }
    : shadowAim(M, dv.a, dv.Q);
  b = (aimB.bPro + aimB.bRet) / 2;
  const rs = 2 * M;
  const tanHalf = Math.tan((st.fov * Math.PI) / 360);
  const toPx = (bb) => {
    const sp = clamp((bb * Math.sqrt(Math.max(1 - rs / Math.abs(st.r), 0))) / Math.abs(st.r), -0.999, 0.999);
    const psi = Math.asin(Math.abs(sp));
    return { psiDeg: (psi * 180) / Math.PI,
             pxVertical: (Math.tan(psi) / tanHalf) * (img.h / 2),
             pxHorizontal: (Math.tan(psi) / (tanHalf * (img.w / img.h))) * (img.w / 2) };
  };
  const mid = toPx(b), pro = toPx(aimB.bPro), ret = toPx(aimB.bRet);
  return { b, psiDeg: mid.psiDeg, pxVertical: mid.pxVertical, pxHorizontal: mid.pxHorizontal,
           /* for a != 0 the shadow is a D-shape: the edge distance is only
              meaningful together with the direction, so the prograde /
              retrograde extremes are reported as the comparison window */
           progradePx: pro.pxVertical, retrogradePx: ret.pxVertical,
           /* B15: this line used to read Math.abs(s.aimB) with no 's' in scope,
              so EVERY call to predictedShadowPx() -- and therefore to
              shadowRadius() and centring() -- threw a ReferenceError.  The
              D-shape measure is the same one tools/validate-physics.mjs
              reports: (|b_retro| - b_pro)/|b_retro|, 55.4% for a=0.86, 0 for a=0. */
           dShape: (Math.abs(aimB.bRet) - aimB.bPro) / Math.abs(aimB.bRet) };
}

export const AUDIT = {
  /* ---- 1. critical curve: measure |r| from the image centre to the edge ---- */
  shadowRadius() { return withGeometryMask((thr) => this._shadowRadius(thr)); },
  _shadowRadius(thresh = 100) {
    const img = grab(); K().__img = img;
    const p = predictedShadowPx();
    const cx = img.w / 2, cy = img.h / 2;
    const edge = (dx, dy) => {
      for (let t = 2; t < Math.min(cx, cy) * 1.6; t += 1) {
        const x = cx + dx * t, y = cy + dy * t;
        if (x < 0 || y < 0 || x >= img.w || y >= img.h) return -1;
        if (lumaAt(img, x, y) > thresh) return t;
      }
      return -1;
    };
    const up = edge(0, -1), down = edge(0, 1), left = edge(-1, 0), right = edge(1, 0);
    const all = [up, down, left, right].filter((v) => v > 0);
    const med = all.slice().sort((a, b) => a - b)[Math.floor(all.length / 2)];
    /* a direction is "occluded" when the first bright pixel is far inside the
       critical curve -- that is the accretion disk crossing in front of the
       shadow, not a failure of the integrator. */
    const occluded = [];
    const per = { up, down, left, right };
    for (const k in per) if (per[k] > 0 && per[k] < 0.75 * med) occluded.push(k);
    return {
      prediction: p, edges: per, occludedByDisk: occluded,
      measuredMedianPx: +med.toFixed(2),
      errMedianPct: +(((med - p.pxVertical) / p.pxVertical) * 100).toFixed(2),
      errPerDirectionPct: {
        up: +(((up - p.pxVertical) / p.pxVertical) * 100).toFixed(2),
        down: +(((down - p.pxVertical) / p.pxVertical) * 100).toFixed(2),
        left: +(((left - p.pxHorizontal) / p.pxHorizontal) * 100).toFixed(2),
        right: +(((right - p.pxHorizontal) / p.pxHorizontal) * 100).toFixed(2),
      },
      frame: [img.w, img.h],
    };
  },

  /* ---- 2. frame dragging: centroid vs the mean critical impact parameter --- */
  centring() { return withGeometryMask((thr) => this._centring(thr)); },
  _centring(thresh = 100) {
    const img = grab(); K().__img = img;
    const cx = img.w / 2, cy = img.h / 2;
    const edge = (dx, dy) => {
      for (let t = 2; t < Math.min(cx, cy) * 1.6; t += 1) {
        if (lumaAt(img, cx + dx * t, cy + dy * t) > thresh) return t;
      }
      return -1;
    };
    const l = edge(-1, 0), r = edge(1, 0);
    const measured = (r - l) / 2;                       /* + = shadow centre right */
    const st = K().rig.state(), dv = K().derived();
    const aim = shadowAim(dv.M, dv.a, dv.Q);
    const tanHalf = Math.tan((st.fov * Math.PI) / 360);
    const aspect = img.w / img.h;
    const predicted = (Math.tan(Math.asin(clamp(aim.bMid / st.r, -0.9, 0.9))) /
                       (tanHalf * aspect)) * (img.w / 2);
    return { bMid: +aim.bMid.toFixed(4), bPro: +aim.bPro.toFixed(4), bRet: +aim.bRet.toFixed(4),
             uncompensatedOffsetPx: +predicted.toFixed(2),
             compensationAppliedPx: +(-predicted).toFixed(2),
             residualOffsetPx: +measured.toFixed(2),
             residualPctOfHalfWidth: +((measured / (img.w / 2)) * 100).toFixed(2) };
  },

  /* ---- 3. relativistic beaming: pixel ratio vs (g1/g2)^4 ---------------- */
  doppler(nSamples = 24, linear = true) {
    if (linear) return withLinearDisk((img) => this._doppler(nSamples), 0.6);
    return this._doppler(nSamples);
  },
  dopplerDisplay(nSamples = 24) { return this._doppler(nSamples); },
  _doppler(nSamples) {
    const img = grab(); K().__img = img;
    const st = K().rig.state(), dv = K().derived();
    const tanHalf = Math.tan((st.fov * Math.PI) / 360);
    const aspect = img.w / img.h;
    const rows = [];
    let worst = 0, worstAt = null, gm = 0, gmn = 1e9;
    /* sample pairs symmetric about the centre along the projected equatorial
       direction, which for this camera is the image x axis */
    for (let i = 0; i < nSamples; i++) {
      const nx = 0.10 + (0.80 * i) / (nSamples - 1);
      const a = this._pair(nx, 0, img, st, dv, tanHalf, aspect);
      const b = this._pair(-nx, 0, img, st, dv, tanHalf, aspect);
      if (!a || !b || a.g === undefined || b.g === undefined) continue;
      if (a.luma < 3 || b.luma < 3) continue;
      /* O1: keep only pairs whose two first crossings sit at comparable radii.
         At low inclination the conjugate pixel can pick up the LENSED far side
         of the disk, whose emitter has a completely different radius -- those
         pairs test the attribution, not the beaming law, so they are dropped
         and the headline number is a median rather than a maximum. */
      if (Math.abs(a.r - b.r) / Math.max(a.r, b.r) > 0.5) continue;
      /* the shader blends the shift towards 1 by the Doppler-strength slider,
         so the prediction has to apply the identical blend */
      const ds = K().values.doppler ?? 1;
      const ge = (g) => 1 + ds * (g - 1);
      /* B18: the shader scales the emitted radiance by (g_eff)^4 *and* reads the
         chromaticity at T_obs = diskTemp * Trel * clump * g_eff.  blackbodyRGB()
         is chroma-NORMALISED, so a cooler (receding) emitter has a lower luma per
         unit magnitude.  A prediction written as (prof^4)*(g^4) therefore
         systematically over-predicts the ratio on the red side; the measured
         worst-pair error was 46.5% before this term was added.  clump = 1.15 is
         the modal value of (0.80 + 0.35*min(dens,1.5)) and largely cancels. */
      /* the clump chromatic term is gone (policy: rigour over looks), so the
         emitted temperature is exactly diskTemp * Trel and the observed one is
         g_eff times it -- no 1.15 fudge factor any more. */
      const Tmp = (q) => (K().values.diskTemp ?? 15000) * q.prof * ge(q.g);
      const pred = Math.pow(a.prof / b.prof, DISK_TEMP_EXP) * Math.pow(ge(a.g) / ge(b.g), 4) *
                   (chromaLuma(Tmp(a)) / Math.max(chromaLuma(Tmp(b)), 1e-6));
      const meas = a.luma / b.luma;
      gm = Math.max(gm, a.g, b.g); gmn = Math.min(gmn, a.g, b.g);
      const e = Math.abs(meas / pred - 1);
      if (e > worst) { worst = e; worstAt = { nx: +nx.toFixed(2), measRatio: +meas.toFixed(2), predRatio: +pred.toFixed(2), gPlus: +a.g.toFixed(3), gMinus: +b.g.toFixed(3) }; }
      rows.push({ nx: +nx.toFixed(2), measured: +meas.toFixed(3), predicted: +pred.toFixed(3), err: +(e * 100).toFixed(1), rPlus: +a.r.toFixed(2), rMinus: +b.r.toFixed(2) });
    }
    const errs = rows.map((x) => x.err).sort((x, y) => x - y);
    const med = errs.length ? errs[Math.floor(errs.length / 2)] : NaN;
    return { pairs: rows.length, medianRelErrorPct: +med.toFixed(1), maxRelErrorPct: +(worst * 100).toFixed(1),
             samples: rows.slice(0, 6), worstAt, gRangeSampled: [+gmn.toFixed(3), +gm.toFixed(3)] };
  },
  _pair(nx, ny, img, st, dv, tanHalf, aspect) {
    const [px, py] = pixelOf(nx, ny, img);
    const res = traceAt(nx, ny);
    if (!res || res.crossR < 0) return null;
    const prof = therm(res.crossR, dv.diskInner);
    return { luma: lumaAt(img, px, py), g: res.crossG, r: res.crossR, prof };
  },

  /* ---- 4. Novikov-Thorne radial law ------------------------------------- */
  profile(nSamples = 22, linear = true) {
    if (linear) return withLinearDisk((img) => this._profile(nSamples), 0.6);
    return this._profile(nSamples);
  },
  _profile(nSamples) {
    const img = grab(); K().__img = img;
    const st = K().rig.state(), dv = K().derived();
    const rows = [];
    for (let i = 0; i < nSamples; i++) {
      /* sample the WHOLE first-crossing range of the disk: the old 0.50 cut
         stopped at r ~ 7 M and so never covered the emission peak, which for
         the relativistic (L2) profile sits at 1.65 r_in. */
      const nx = 0.04 + (0.90 * i) / (nSamples - 1);   /* bright (approaching) side */
      const [px, py] = pixelOf(nx, 0, img);
      const res = traceAt(nx, 0);
      if (!res || res.crossR < 0) continue;
      const L = lumaAt(img, px, py);
      if (L < 6) continue;
      rows.push({ r: res.crossR, prof: therm(res.crossR, dv.diskInner), luma: L, g: res.crossG });
    }
    /* every sample shares the same source function, so in linear HDR
       luma = A * prof^EXP * g_eff^4 with EXP = DISK_TEMP_EXP = 4 (L3).
       Shape test: divide out the beaming, normalise both series at their peak,
       then the two curves must agree point by point.  The point-by-point form is
       the primary number; a log-log regression is also reported but only over
       samples ABOVE the 8-bit linear quantisation floor, because the dim tail
       would otherwise drag the fitted slope towards zero. */
    const ds = K().values.doppler ?? 1;
    const pred = rows.map((q) => {
      const ge = 1 + ds * (q.g - 1);
      return Math.pow(Math.max(q.prof, 1e-6), DISK_TEMP_EXP) * Math.pow(Math.max(ge, 0.05), 4);
    });
    const kRef = pred.reduce((m, v) => Math.max(m, v), 0) || 1;
    const lRef = rows.reduce((m, q) => Math.max(m, q.luma), 0) || 1;
    const dev = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].luma < 20) continue;              /* above the quantisation floor */
      /* B17: a first crossing INSIDE the ISCO has prof = 0, but the pixel
         integrates EVERY crossing, so its brightness is attributed to the wrong
         emitter and the ratio explodes (measured maxDev 1.4e26 before this
         filter).  Drop samples whose first crossing carries no source function. */
      if (rows[i].prof <= 0.05) continue;
      dev.push((rows[i].luma / lRef) / (pred[i] / kRef));
    }
    dev.sort((a, b) => a - b);
    const med = dev.length ? dev[Math.floor(dev.length / 2)] : NaN;
    const worst = dev.length ? Math.max(Math.abs(dev[0] - 1), Math.abs(dev[dev.length - 1] - 1)) : NaN;
    /* genuine measured exponent: regress ln(luma/g_eff^4) on ln(prof) using only
       samples clear of the quantisation floor */
    const fitRows = rows.filter((q) => q.luma >= 20 && q.prof > 1e-4);
    let fitted = NaN, fitN = fitRows.length;
    if (fitN >= 5) {
      const X = fitRows.map((q) => Math.log(q.prof));
      const Y = fitRows.map((q) => Math.log(q.luma) - 4 * Math.log(Math.max(1 + ds * (q.g - 1), 0.05)));
      const mx = X.reduce((p, c) => p + c, 0) / fitN, my = Y.reduce((p, c) => p + c, 0) / fitN;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < fitN; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; }
      fitted = sxy / sxx;
    }
    return { samples: rows.length, usedSamples: dev.length,
             medianShapeRatio: +med.toFixed(4), maxShapeDeviationPct: +(worst * 100).toFixed(1),
             fittedExponent: +fitted.toFixed(3), fittedOver: fitN,
             expectedExponent: DISK_TEMP_EXP,
             points: rows.map(q => [+q.r.toFixed(2), +q.prof.toFixed(4), +q.g.toFixed(3), Math.round(q.luma)]).slice(0, 240) };
  },

  /* diagnostics: raw trace result for one image direction */
  probe(nx, ny) {
    const st = K().rig.state(), dv = K().derived();
    const n = rayForNdc(nx, ny);
    const res = trace({ M: dv.M, a: dv.a, Q: dv.Q, r0: st.r, th0: st.th, ph0: st.ph, n,
      maxSteps: 20000, tol: 1e-5, stepScale: 0.5,
      rFar: Math.max(Math.abs(st.r) * 1.55 + 6, 34), diskOuter: dv.diskOuter, stopAtDisk: true });
    return { nloc: n.map((v) => +v.toFixed(4)), steps: res.steps, escaped: res.escaped,
             rEnd: +res.r.toFixed(3), crossR: +(res.crossR ?? -1).toFixed(4),
             crossG: +(res.crossG ?? 0).toFixed(4), diskOuter: dv.diskOuter,
             r0: st.r, th0: st.th, ph0: st.ph };
  },

  run() {
    const st = K().rig.state(), dv = K().derived();
    const out = { config: { M: dv.M, a: +dv.a.toFixed(3), Q: +dv.Q.toFixed(3),
                            r: +st.r.toFixed(2), thetaDeg: +(st.th * 180 / Math.PI).toFixed(1),
                            isco: +dv.isco.toFixed(3), fov: st.fov } };
    try { out.shadowRadius = this.shadowRadius(); } catch (e) { out.shadowRadius = 'error: ' + e.message; }
    try { out.centring = this.centring(); } catch (e) { out.centring = 'error: ' + e.message; }
    try { out.doppler = this.doppler(); } catch (e) { out.doppler = 'error: ' + e.message; }
    try { out.profile = this.profile(); } catch (e) { out.profile = 'error: ' + e.message; }
    return out;
  },
};

/* single-sourced with the shader so the harness cannot drift from the renderer */
/* L2: the rendered temperature is the relativistic dissipation law, so the
   harness must predict with the SAME law.  Memoised per parameter set. */
let _thermKey = null, _thermTab = null;
const therm = (r, rin) => {
  const dv = K().derived();
  const key = dv.M + '|' + dv.a + '|' + dv.Q + '|' + rin;
  if (key !== _thermKey) { _thermKey = key; _thermTab = diskFluxTable(dv.M, dv.a, dv.Q, rin, 2049); }
  return _thermTab ? ptTemp(_thermTab, r) : tempProfile(r, rin);
};
