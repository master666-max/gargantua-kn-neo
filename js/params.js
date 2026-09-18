/* ============================================================================
   params.js -- the 21 exposed parameters, their grouping, formatting,
   constraint handling, URL (de)serialisation and the derived KN quantities
   that the UI needs (horizons, ergosphere, ISCO, disk extent).
   ========================================================================== */
import { horizons, isco as solveIsco, ergoRadius, omega } from './kn.js';

export const GROUPS = [
  { id: 'space',  title: 'SPACETIME \u65f6\u7a7a' },
  { id: 'camera', title: 'CAMERA \u76f8\u673a' },
  { id: 'disk',   title: 'ACCRETION DISK \u5438\u79ef\u76d8' },
  { id: 'sky',    title: 'SKY \u661f\u7a7a' },
  { id: 'integ',  title: 'INTEGRATOR \u79ef\u5206\u5668' },
  { id: 'post',   title: 'POST \u540e\u5904\u7406' },
];

const f2 = (v, u) => v.toFixed(2) + (u ? ' ' + u : '');
const f3 = (v, u) => v.toFixed(3) + (u ? ' ' + u : '');

/* --------------------------------------------------------------------------
   1  mass M          2  spin a/M       3  charge Q/M
   4  camera radius   5  camera tilt     6  initial speed
   7  disk peak T     8  disk thickness  9  turbulence
  10  radiation gain 11  Doppler        12  gravitational redshift (toggle)
  13  star density   14  galaxy         15  max integration steps
  16  adaptive step  17  bloom strength 18  bloom radius   19  exposure
  21  post group (vignette / grain / chromatic aberration)
   (+ 20 = tolerance of the conservation monitor, the adaptive-step target)
   -------------------------------------------------------------------------- */
export const PARAMS = [
  { id: 'M', g: 'space', num: true, label: '\u8d28\u91cf M', sub: 'mass \u00b7 negative = repulsive naked singularity', min: -20, max: 20, step: 0.01, def: 1, fmt: v => f2(v, 'M') },
  { id: 'a', g: 'space', num: true, label: '\u81ea\u65cb a/M', sub: 'spin \u00b7 negative = retrograde (frame dragging flips)', min: -1.5, max: 1.5, step: 0.001, def: 0.86, fmt: v => v.toFixed(3) + ' M' },
  { id: 'Q', g: 'space', num: true, label: '\u7535\u8377 Q/M', sub: 'charge \u00b7 the metric only sees Q^2, so +Q and -Q render identically', min: -1.5, max: 1.5, step: 0.001, def: 0.0, fmt: v => v.toFixed(3) + ' M' },

  { id: 'camR', g: 'camera', label: '\u76f8\u673a\u521d\u59cb\u534a\u5f84', sub: 'initial radius r0', min: 2.2, max: 60, step: 0.1, def: 24, fmt: v => f2(v, 'M') },
  { id: 'camTheta', g: 'camera', label: '\u76f8\u673a\u503e\u89d2', sub: 'initial polar angle', min: 0.5, max: 179.5, step: 0.1, def: 76, fmt: v => v.toFixed(1) + '\u00b0' },
  { id: 'initSpeed', g: 'camera', label: '\u521d\u59cb\u901f\u5ea6', sub: 'initial speed (c=1)', min: 0, max: 0.95, step: 0.005, def: 0.06, fmt: v => v.toFixed(3) + ' c' },

  { id: 'diskTemp', g: 'disk', label: '\u76d8\u9762\u6e29\u5ea6\u5cf0\u503c', sub: 'peak effective temperature', min: 2000, max: 40000, step: 100, def: 15000, fmt: v => (v / 1000).toFixed(1) + ' kK' },
  { id: 'diskThick', g: 'disk', label: '\u76d8\u9762\u539a\u5ea6', sub: 'scale height H/r', min: 0.01, max: 0.6, step: 0.005, def: 0.11, fmt: v => v.toFixed(3) },
  { id: 'turb', g: 'disk', label: '\u6e4d\u6d41\u5f3a\u5ea6', sub: 'turbulence / clumping', min: 0, max: 1.2, step: 0.01, def: 0.85, fmt: v => v.toFixed(2) },
  { id: 'gain', g: 'disk', label: '\u8f90\u5c04\u589e\u76ca', sub: 'bolometric gain', min: 0, max: 8, step: 0.05, def: 2.4, fmt: v => v.toFixed(2) },
  { id: 'doppler', g: 'disk', label: 'Doppler \u5f3a\u5ea6', sub: 'relativistic beaming blend', min: 0, max: 1.5, step: 0.01, def: 1.0, fmt: v => v.toFixed(2) },
  { id: 'redshift', g: 'disk', sub: 'gravitational redshift', type: 'toggle', def: 1, label: '\u5f15\u529b\u7ea2\u79fb' },
  { id: 'bfield', g: 'disk', label: '\u78c1\u573a\u6a21\u578b B', sub: 'prescribed analytic model, NOT GRMHD: 0 none / 1 toroidal / 2 vertical / 3 radial / 4 fixed asymptotic x-axis', min: 0, max: 4, step: 1, def: 1, num: true, fmt: (v) => ['none','toroidal','vertical','radial'][Math.round(v)] || '-' },

  { id: 'starDensity', g: 'sky', label: '\u661f\u7a7a\u5bc6\u5ea6', sub: 'starfield density', min: 0, max: 1.2, step: 0.01, def: 0.66, fmt: v => v.toFixed(2) },
  { id: 'galaxy', g: 'sky', label: '\u94f6\u6cb3\u5f3a\u5ea6', sub: 'Milky-Way band', min: 0, max: 3, step: 0.01, def: 1.05, fmt: v => v.toFixed(2) },

  { id: 'maxSteps', g: 'integ', label: '\u79ef\u5206\u6b65\u6570\u4e0a\u9650', sub: 'iteration cap per ray \u00b7 2048 keeps the unresolved area at zero', min: 48, max: 4096, step: 8, def: 2048, fmt: v => v.toFixed(0) },
  { id: 'stepScale', g: 'integ', label: '\u81ea\u9002\u5e94\u6b65\u957f\u7cfb\u6570', sub: 'base adaptive step', min: 0.04, max: 1.0, step: 0.005, def: 0.15, fmt: v => v.toFixed(3) },
  { id: 'tol', g: 'integ', label: '\u5b88\u6052\u5bb9\u5dee', sub: 'conservation monitor target', min: -8, max: -2, step: 0.1, def: -4.0, log: true, fmt: v => Math.pow(10, v).toExponential(1) },

  { id: 'bloomStrength', g: 'post', label: 'Bloom \u5f3a\u5ea6', sub: 'HDR bloom mix', min: 0, max: 3, step: 0.01, def: 0.9, fmt: v => v.toFixed(2) },
  { id: 'bloomRadius', g: 'post', label: 'Bloom \u534a\u5f84', sub: 'up-sample kernel radius', min: 0.4, max: 3, step: 0.01, def: 1.25, fmt: v => v.toFixed(2) },
  { id: 'exposure', g: 'post', label: '\u66dd\u5149', sub: 'pre-tonemap exposure', min: 0.1, max: 5, step: 0.01, def: 1.45, fmt: v => v.toFixed(2) },
  { id: 'post', g: 'post', type: 'group', label: '\u6697\u89d2 / \u9897\u7c92 / \u8272\u6563', sub: 'vignette / grain / aberration', children: [
    { id: 'vignette', label: '\u6697\u89d2 vignette', min: 0, max: 1, step: 0.01, def: 0.55, fmt: v => v.toFixed(2) },
    { id: 'grain', label: '\u9897\u7c92 grain', min: 0, max: 1, step: 0.01, def: 0.22, fmt: v => v.toFixed(2) },
    { id: 'aberration', label: '\u8272\u6563 aberration', min: 0, max: 1, step: 0.01, def: 0.30, fmt: v => v.toFixed(2) },
  ] },
];

export const LEAVES = (() => {
  const out = [];
  for (const p of PARAMS) {
    if (p.type === 'group') for (const c of p.children) out.push({ ...c, g: p.g });
    else out.push(p);
  }
  return out;
})();

export const DEFAULTS = Object.fromEntries(LEAVES.map(p => [p.id, p.def]));

/* The sub-extremality clamp and the lastExtremalClamp report it fed were REMOVED here: the
   extended domain is the point of this build, so a^2 + Q^2 > M^2 is a legal request, not an
   error to be reported.  The bookkeeping outlived the clamp for a while -- the HUD still
   imported the always-null flag and carried a toast that could never fire -- and the comment
   above sanitize() still described the clamp as present.  Both are gone now.  See README:
   "the sub-extremality clamp is gone ... extended domain M +/-, a +/-, Q +/-". */

export function sanitize(v) {
  const o = { ...v };
  for (const p of LEAVES) {
    const raw = o[p.id];
    let x = Number(raw);
    if (!Number.isFinite(x)) x = p.def;
    if (p.type === 'toggle' || p.min === undefined || p.max === undefined) {
      /* toggles have no min/max; clamping them against undefined produced NaN,
         which made gl.uniform1f receive NaN and silently disabled the switch. */
      o[p.id] = x ? 1 : 0;
      continue;
    }
    o[p.id] = Math.min(p.max, Math.max(p.min, x));
  }
  /* DOMAIN ONLY.  The black-hole clamp a^2 + Q^2 < M^2 is GONE: extremal holes and
     naked singularities are the point of this build, and both render fine because
     M and Q enter the metric through Q^2 and through 2Mr, not through Delta's sign.
     What is kept is the numerical domain -- |M| >= 0.05 (every readout divides by M)
     and the exploration bound |a|, |Q| <= 1.5.  NOTE: the metric sees a^2 and Q^2,
     so +Q and -Q give identical images; that is physics, not a missing feature.
     The sign of M is NOT a symmetry: M < 0 is a repulsive naked singularity. */
  if (!(Math.abs(o.M) >= 0.05)) o.M = o.M < 0 ? -0.05 : 0.05;
  const M = o.M;
  const s = o.a * o.a + o.Q * o.Q;
  const absM = Math.abs(M);
  if (Math.abs(o.a) > 1.5 * absM) o.a = Math.sign(o.a) * 1.5 * absM;
  if (Math.abs(o.Q) > 1.5 * absM) o.Q = Math.sign(o.Q) * 1.5 * absM;
  return o;
}
export function derive(v) {
  /* |M| sets the length unit and the sign of M is carried into the metric as a sign
     (negative mass), so the spin and charge magnitudes must use |M| -- otherwise a
     negative mass would silently flip a and Q as well. */
  const M = v.M, a = v.a * Math.abs(M), Q = v.Q * Math.abs(M);
  const h = horizons(M, a, Q);
  const isco = solveIsco(M, a, Q);
  const camTh = (v.camTheta * Math.PI) / 180;
  /* THE DISK IS DECOUPLED FROM THE CAMERA.  It used to be Math.max(26*M, v.camR*1.25), which keeps
     the disk the same apparent size on screen at any camera distance -- but it also means raising
     camR moves the SCENE rather than the observer, so the asymptotic-observer comparison that (9)
     needs could never be set up (at camR = 500 the disk would extend to 625 M).  The reference radius
     is now fixed at the DEFAULT camera radius, so the default scene is bit-identical and a distant
     camera sees the same disk. */
  const REF_CAM_R = 24;                       /* the default camR, in M */
  /* THE OUTER RADIUS IS A LENGTH, SO IT MUST NOT INHERIT THE SIGN OF M.  The signed form
     Math.max(26*M, REF_CAM_R*1.25*M) is fine for M > 0 (both terms scale, max = 30 M) but for
     M < 0 it picks the SMALLER magnitude -- M = -1 gave rDiskOut = max(-26, -30) = -26.  Down
     in disk.glsl that value is clamped by max(uDiskOuter, rin*1.35), so the disk did not
     vanish; it silently collapsed into a thin annulus: the density window became
     0.86*rin .. 1.08*8.1 M instead of .. 32.4 M.  Measured in view 21 (emission-gated), the
     lit area at M = -1 was 26207 px = 2.84% of the frame against 744812 px = 80.82% at
     M = +1.  |M| makes the two cases agree, and leaves M > 0 bit-identical. */
  const rDiskOut = Math.max(26, REF_CAM_R * 1.25) * Math.abs(M);
  return {
    M, a, Q, rp: h.rp, rm: h.rm, naked: h.naked,
    isco, ergo: ergoRadius(M, a, Q, camTh),
    ergoEq: ergoRadius(M, a, Q, Math.PI / 2),
    diskInner: isco, diskOuter: rDiskOut,
    omegaIn: omega(M, a, Q, isco),
  };
}

export const paramCount = PARAMS.length;

/* ---- URL <-> values ------------------------------------------------------ */
export function encodeParams(v) {
  const u = new URLSearchParams();
  for (const p of LEAVES) {
    const val = v[p.id];
    if (Math.abs(val - p.def) < 1e-9) continue;
    u.set(p.id, String(Number(val.toFixed(5))));
  }
  return u;
}
export function decodeParams(search) {
  const u = new URLSearchParams(search);
  const v = { ...DEFAULTS };
  for (const p of LEAVES) {
    if (u.has(p.id)) {
      const x = Number(u.get(p.id));
      if (Number.isFinite(x)) v[p.id] = x;
    }
  }
  return sanitize(v);
}
/* ---- VIEWS: named diagnostic channels, shared by the panel selector and the toasts ----
   Codes 11-18 are the band and special views added for this build.  Each one is labelled
   with what it is and, where the renderer can only approximate the band, that is said
   explicitly rather than implied. */
export const VIEWS = [
  { n: 0,  label: '成品图 ACES' },
  { n: 1,  label: '积分步数' },
  { n: 2,  label: '守恒漂移' },
  { n: 3,  label: '赤道穿越次数' },
  { n: 4,  label: '到视界距离' },
  { n: 5,  label: '片层符号 (红 = r ≥ 0 · 绿 = 反宇宙 r < 0)' },
  { n: 6,  label: '泛光 L1' }, { n: 7, label: '泛光 L2' }, { n: 8, label: '泛光 L3' },
  { n: 9,  label: '线性 HDR (无色调映射)' },
  { n: 10, label: '终止原因 (原始编码)' },
  { n: 11, label: 'X 射线 2-10 keV (盘+冕代理)' },
  { n: 12, label: '射电 230 GHz (EHT 伪彩/对数)' },
  { n: 13, label: '近红外 K 波段 2.2 µm' },
  { n: 14, label: '铁 Kα 6.4 keV 线心位移' },
  { n: 15, label: '高阶像阶数 (光子环子结构)' },
  { n: 16, label: '红移/蓝移场 g−1' },
  { n: 17, label: '对数强度伪彩 (全波段)' },
  { n: 18, label: '终止+片层全景 (含 r<0)' },  { n: 19, label: '铁 Kα 线宽' },  { n: 20, label: '几何视图 (掩模+临界曲线)' },  { n: 21, label: '观测偏振度 (含法拉第退偏)' },  { n: 22, label: '法拉第深度 θ_F' },  { n: 23, label: '\u5f20\u91cf\u65ad\u8a00 1: |f|\u00b2 = 1' },
  { n: 25, label: '\u63a2\u9488: \u5ea6\u89c4\u5bfc\u6570\u5bf9\u7167' },
 { n: 125, label: 'rhs probe' },
  { n: 26, label: '\u70b9\u63a2\u9488 f\u00b7p \u4e0e |f|\u00b2 (\u6574\u5c4f\u5e38\u6570)' },
 { n: 27, label: '\u5c4f\u5e55 EVPA (rad)' },
 { n: 28, label: '\u70b9\u63a2\u9488 \u5ea6\u89c4 + \u5355\u6b65\u8f93\u8fd0 (\u5206\u91cf 2)' },
 { n: 29, label: '\u70b9\u63a2\u9488 f^r, f^\u03b8 (b = \u2202\u03c6)' },
 { n: 30, label: '\u521d\u59cb p^r, p^\u03b8 (\u00b12)' },
 { n: 31, label: '\u70b9\u63a2\u9488 f^r, f^\u03c6 (b = \u2202r)' },
 { n: 32, label: 'E (0..4) \u4e0e L (\u00b112)' },
 { n: 33, label: '\u5149\u7ebf\u7ec8\u70b9 r (16 \u4f4d: \u7c97+\u7ec6)' },
 { n: 34, label: '\u7ec8\u70b9 \u03b8\u2212\u03c0/2 \u4e0e p^r' },
 { n: 35, label: '\u7ec8\u70b9 p^\u03b8 (\u00b116)' },
 { n: 36, label: '\u521d\u59cb p^r (16 \u4f4d)' },
 { n: 37, label: '\u521d\u59cb p^\u03b8 (16 \u4f4d)' },
 { n: 38, label: 'E (16 \u4f4d)' },
 { n: 39, label: 'L (16 \u4f4d)' },
 { n: 40, label: '\u89c2\u6d4b\u8005\u5c40\u90e8\u65b9\u5411 nloc (n_\u03c6, n_\u03b8)' },
 { n: 41, label: '\u7269\u7406\u5c4f\u5e55 EVPA (\u9996\u6b21\u8d64\u9053\u7a7f\u8d8a, \u6e90 = B)' },
 { n: 42, label: '\u7269\u7406 EVPA \u6709\u6548\u6027 (\u7eff = \u6709\u7a7f\u8d8a)' },
 { n: 43, label: 'Gelles +\u03b1\u0302 \u65b9\u5411 (\u5c40\u90e8\u6b63\u4ea4\u7cfb)' },
 { n: 44, label: 'Gelles +\u03b2\u0302 \u65b9\u5411 (\u5c40\u90e8\u6b63\u4ea4\u7cfb)' },
 { n: 45, label: '\u7269\u7406 EVPA (16 \u4f4d, \u91cf\u5b50 4.8e-5 rad)' },
 { n: 46, label: '\u7a7f\u8d8a\u534a\u5f84 (16 \u4f4d, \u91cf\u5b50 1e-3)' },
 { n: 47, label: '\u50cf\u9636 ncross (\u6570\u503c)' },
 { n: 48, label: 'Penrose-Walker \u6f02\u79fb (\u5bf9\u6570)' },
 { n: 49, label: '\u56fa\u6709\u6e90\u89d2 (\u5c40\u90e8, \u65e0\u8f93\u8fd0)' },



];