/* ============================================================================
   SHADER-vs-CPU SCREEN EVPA CROSS-CHECK  (section 3, deliverable (B))

   WHAT IS ASSERTED.  For four rays, the screen EVPA the SHADER computes (view 27,
   transportInfo.x) is compared against an INDEPENDENT integration in js/polar.js that
   starts from the same observer, builds the same observer screen basis
   e_a = d_phi / sqrt(g_phiphi), e_b = -d_theta / sqrt(g_thth), transports all three
   vectors with the polarisation, expands the SOURCE epsilon-construction in that
   transported basis and takes atan2.  Nothing about the shader's own arithmetic is
   reused: only its exported ray data.

   WHY THE TOLERANCE IS WHAT IT IS.  Two floors, both measured rather than assumed:

     * READOUT.  chi is exported on one 8-bit channel spanning +-pi/2, so the quantum is
       pi/255 = 0.012322 rad and the quantisation error alone reaches half of that.
     * TERMINATION.  The trace BREAKS where it is, so the exported end state r is a step
       endpoint, not a root.  A repeated read of the same pixel showed r flip by 0.1565 --
       exactly one integration step -- while chi itself stayed put.  Near the disk the
       transport is steep, so that flip moves chi by more than the readout quantum; the
       test therefore measures d(chi)/dr on the CPU and uses the measured band.

   The GEODESIC IDENTITY is asserted separately and is the part that matters: the CPU's
   theta at the shader's end radius must agree with the shader's exported theta to within
   that channel's own quantum (0.8/255 = 0.003137).  Without this check an earlier round
   "found" a 0.256 rad theta discrepancy that was nothing but a CLIPPED p^theta readout.

   DATA PROVENANCE.  Each row is a pixel readback taken in one session from the running
   app (port 8241).  M, a, Q and the camera are the app's own values.
   ========================================================================== */
import * as pol from '../js/polar.js';

const M = 1.0, A = 0.86, Q = 0.0;
const CAM_R = 24.0, CAM_TH = 76 * Math.PI / 180;      /* the observer, from __KN.values */
const QUANT_CHI = Math.PI / 255;                       /* view 27 x channel */
const QUANT_TH  = 0.8 / 255;                           /* view 34 x channel */
const STEP_FLIP = 0.16;                                /* measured one-step r ambiguity */

const CASES = [
  { tag: 'A (400,580)  escaped',  pr0: -0.887351, pth0: -7.770427, E: 0.955887, L:  -9.67949, rT: 44.1224, thS: 1.5409924, chiS: -0.0184791 },
  { tag: 'B (1210,640) escaped',  pr0: -0.764690, pth0: -7.725888, E: 0.959139, L:  13.9796, rT: 43.7621, thS: 1.3496198, chiS:  0.0923993 },
  { tag: 'C (400,400)  disk',     pr0: -0.935823, pth0: -1.514611, E: 0.956185, L: -10.21787, rT: 11.1947, thS: 1.5629530, chiS:  0.4003930 },
  { tag: 'D (300,420)  disk',     pr0: -0.865944, pth0: -2.122880, E: 0.955816, L: -12.90189, rT: 17.7202, thS: 1.5472670, chiS:  0.2279240 },
];

const D = (g, u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g[i][j] * u[i] * v[j]; return s; };
const fold = (x) => { while (x > Math.PI / 2) x -= Math.PI; while (x <= -Math.PI / 2) x += Math.PI; return x; };

function trace(C, h) {
  const gO = pol.metric(CAM_R, CAM_TH, M, A, Q).g;
  const uO = pol.zamo(CAM_R, CAM_TH, M, A, Q);
  const pUpO = pol.momentumUp(CAM_R, CAM_TH, M, A, Q, C.pr0, C.pth0, C.E, C.L);
  const eA = [0, 0, 0, 1 / Math.sqrt(gO[3][3])];
  const eB = [0, 0, -1 / Math.sqrt(gO[2][2]), 0];
  const mk = (b) => pol.unitise(pol.polFromField(pUpO, uO, b, CAM_R, CAM_TH, M, A, Q), CAM_R, CAM_TH, M, A, Q);
  const traj = [];
  pol.tracePolarised({
    M, a: A, Q, E: C.E, L: C.L, r0: CAM_R, th0: CAM_TH, pr0: C.pr0, pth0: C.pth0,
    f0: mk([0, 0, 0, 1]), fList: [mk(eA), mk(eB)],
    steps: 2000000, h, rMax: 50, stopAtHorizon: false,
    onStep: (st) => traj.push({ r: st.r, th: st.th, pr: st.pr, pth: st.pth, f: st.f.slice(), gA: st.extras[0].slice(), gB: st.extras[1].slice() }),
  });
  return traj;
}

/* the shader stops on the OUTGOING branch (its exported p^r is positive), so the crossing
   is selected by sign of p^r -- otherwise a ray that crosses the same radius twice would
   be matched to the wrong end state. */
function chiAt(traj, C, rT) {
  let k = -1, best = 1e9;
  for (let i = 1; i < traj.length; i++) {
    const A0 = traj[i - 1], B0 = traj[i];
    if ((A0.r - rT) * (B0.r - rT) > 0) continue;
    const w0 = (rT - A0.r) / (B0.r - A0.r);
    if ((A0.pr + w0 * (B0.pr - A0.pr)) <= 0) continue;
    const d = Math.abs(B0.r - rT);
    if (d < best) { best = d; k = i; }
  }
  if (k < 1) return null;
  const A0 = traj[k - 1], B0 = traj[k], w = (rT - A0.r) / (B0.r - A0.r), mix = (x, y) => x + w * (y - x);
  const thI = mix(A0.th, B0.th), prI = mix(A0.pr, B0.pr), pthI = mix(A0.pth, B0.pth);
  const gI = pol.metric(rT, thI, M, A, Q).g;
  const uI = pol.zamo(rT, thI, M, A, Q);
  const aI = A0.gA.map((x, i) => mix(x, B0.gA[i]));
  const bI = A0.gB.map((x, i) => mix(x, B0.gB[i]));
  const fI = A0.f.map((x, i) => mix(x, B0.f[i]));
  const pUpI = pol.momentumUp(rT, thI, M, A, Q, prI, pthI, C.E, C.L);
  const fS = pol.unitise(pol.polFromField(pUpI, uI, [0, 0, 0, 1], rT, thI, M, A, Q), rT, thI, M, A, Q);
  const G11 = D(gI, aI, aI), G12 = D(gI, aI, bI), G22 = D(gI, bI, bI);
  const r1 = D(gI, fS, aI), r2 = D(gI, fS, bI), dt = G11 * G22 - G12 * G12;
  const c1 = (r1 * G22 - r2 * G12) / dt, c2 = (r2 * G11 - r1 * G12) / dt;
  return {
    chi: fold(Math.atan2(c2, c1)), th: thI, pr: prI,
    gram: Math.abs(D(gI, fS, fS) - (c1 * r1 + c2 * r2)),
    normF: D(gI, fI, fI), orthF: D(gI, fI, pUpI),
  };
}

/* Node's console.log does NOT honour %-24s width specifiers; the strings are padded by hand
   so the table is readable. */
const f = (x, n) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(n);
const e = (x) => x.toExponential(1);
let bad = 0;
console.log('shader-vs-CPU screen EVPA cross-check   (M=1 a=0.86 Q=0, observer r=24 th=76deg)');
console.log('readout quantum: chi ' + QUANT_CHI.toFixed(6) + ' rad, theta ' + QUANT_TH.toFixed(6) + ' rad');
console.log('');
console.log('case'.padEnd(24) + 'dtheta(geo)'.padStart(12) + 'shader chi'.padStart(12) + 'cpu chi'.padStart(12)
  + 'dchi'.padStart(11) + 'tolerance'.padStart(12) + '  verdict');
for (const C of CASES) {
  const t1 = trace(C, 0.005), t2 = trace(C, 0.01);
  const m = chiAt(t1, C, C.rT), m2 = chiAt(t2, C, C.rT);
  const lo = chiAt(t1, C, C.rT - STEP_FLIP), hi = chiAt(t1, C, C.rT + STEP_FLIP);
  if (!m || !lo || !hi) { console.log(C.tag.padEnd(24) + '  NO CROSSING FOUND'); bad++; continue; }
  const band = Math.abs(hi.chi - lo.chi);
  const tol = Math.max(QUANT_CHI, band);
  const dChi = m.chi - C.chiS, dTh = m.th - C.thS;
  const selfConv = Math.abs(m.chi - m2.chi);
  const okGeo = Math.abs(dTh) <= QUANT_TH;
  const okChi = Math.abs(dChi) <= tol;
  if (!okGeo || !okChi) bad++;
  console.log(C.tag.padEnd(24) + e(dTh).padStart(12) + f(C.chiS, 6).padStart(12) + f(m.chi, 6).padStart(12)
    + f(dChi, 6).padStart(11) + e(tol).padStart(12) + '  ' + (okGeo && okChi ? 'PASS' : '*** FAIL ***'));
  console.log('    tolerance is max(readout ' + QUANT_CHI.toFixed(6) + ', measured r-band ' + band.toFixed(6)
    + '); cpu self-convergence ' + e(selfConv) + '; Gram resid ' + e(m.gram)
    + '; |f|^2-1 ' + e(m.normF - 1) + '; f.p ' + e(m.orthF));
}
console.log('');
console.log(bad ? (bad + ' CASE(S) FAILED') : 'ALL ' + CASES.length + ' CASES PASS'
  + '  (geodesic identity + EVPA within the readout/termination floor)');
process.exit(bad ? 1 : 0);
