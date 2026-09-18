/* ============================================================================
   PENROSE-WALKER CONSERVATION  --  goal step (2), the exact reference.

   Gelles et al. 2021 (arXiv:2105.09440) Eq. (12):
       kappa = (A - i B) (r - i a cos theta)
       A = (p^t f^r - p^r f^t) + a sin^2(theta) (p^r f^phi - p^phi f^r)
       B = [ (r^2 + a^2)(p^phi f^theta - p^theta f^phi) - a (p^t f^theta - p^theta f^t) ] sin theta
   and kappa is CONSERVED along a null geodesic in Kerr.  Their paper uses it to solve for f at any
   point; the sharper use here is the converse: ANY f that is parallel transported along the ray and
   stays orthogonal to p must keep kappa constant.  So this file does not need to solve for anything --
   it checks whether the f that this renderer's transport produces keeps kappa constant.

   WHY THIS ADJUDICATES.  It involves no basis, no Gram matrix and no angle.  If kappa is conserved to
   machine precision on the one case that still fails -- (800,360), r_cross = 3.69, hard against the
   shadow, where dchi/dr = -1.63 -- then the transport there is correct and the failure is in the
   radius-explanation MODEL.  If kappa drifts, the transport is broken there instead.

   The flattened HTML does not say whether the components are up or down, so both are computed; the
   conserved one is the right pairing.
   ========================================================================== */
import * as pol from '../js/polar.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(HERE, 'measurements', 'evpa-physical.json'), 'utf8'));
const M = data.app.M, A = data.app.a, Q = data.app.Q;
const r0 = data.app.camR, th0 = data.app.camTheta * Math.PI / 180;
const lower = (g, v) => { const o = [0,0,0,0]; for (let i = 0; i < 4; i++) { let s = 0; for (let j = 0; j < 4; j++) s += g[i][j] * v[j]; o[i] = s; } return o; };
function bF4(r, th) { const s = Math.sin(th), c = Math.cos(th);
  if (data.app.bfield < 1.5) return [0, 0, 0, 1 / Math.max(r, 0.3)];
  if (data.app.bfield < 2.5) return [0, 0, c, -s]; return [0, 1 / Math.max(r, 0.3), 0, 0]; }
/* kappa from a 4-momentum and a 4-polarisation, both in whatever index position is given */
function kappaOf(r, th, p, f, a) {
  const s = Math.sin(th);
  const Aa = (p[0]*f[1] - p[1]*f[0]) + a*s*s*(p[1]*f[3] - p[3]*f[1]);
  const Bb = ((r*r + a*a)*(p[3]*f[2] - p[2]*f[3]) - a*(p[0]*f[2] - p[2]*f[0])) * s;
  const re = Aa*(r), im = -Bb*(r);            /* multiply by (r - i a cos) => real and imaginary parts below */
  const cr = Math.cos(th);
  /* (A - iB)(r - i a cos) = (A r - B a cos) - i (B r + A a cos) */
  return [Aa*r - Bb*a*cr, -(Bb*r + Aa*a*cr)];
}
function run(C, h) {
  const gO = pol.metric(r0, th0, M, A, Q).g, uO = pol.zamo(r0, th0, M, A, Q);
  const pUpO = pol.momentumUp(r0, th0, M, A, Q, C.pr, C.pth, C.E, C.L);
  const eA = [0, 0, 0, 1 / Math.sqrt(gO[3][3])], eB = [0, 0, -1 / Math.sqrt(gO[2][2]), 0];
  const mk = (b) => pol.unitise(pol.polFromField(pUpO, uO, b, r0, th0, M, A, Q), r0, th0, M, A, Q);
  let k0 = null, worstUp = 0, worstDn = 0, n = 0, kEnd = null;
  pol.tracePolarised({ M, a: A, Q, E: C.E, L: C.L, r0, th0, pr0: C.pr, pth0: C.pth,
    f0: mk([0, 0, 0, 1]), fList: [mk(eA), mk(eB)], steps: 400000, h, rMax: 200, stopAtHorizon: true,
    onStep: (st) => {
      const gI = pol.metric(st.r, st.th, M, A, Q).g;
      const pUp = pol.momentumUp(st.r, st.th, M, A, Q, st.pr, st.pth, C.E, C.L);
      const pDn = lower(gI, pUp), fDn = lower(gI, st.f);
      const ku = kappaOf(st.r, st.th, pUp, st.f, A);      /* both up */
      const kd = kappaOf(st.r, st.th, pDn, fDn, A);       /* both down */
      if (k0 === null) { k0 = ku; kEnd = kd; }
      const mu = Math.hypot(ku[0] - k0[0], ku[1] - k0[1]);
      const md = Math.hypot(kd[0] - kEnd[0], kd[1] - kEnd[1]);
      worstUp = Math.max(worstUp, mu); worstDn = Math.max(worstDn, md); n++;
    },
  });
  return { worstUp, worstDn, n, kMag: Math.hypot(k0[0], k0[1]) };
}
console.log('PENROSE-WALKER CONSERVATION along the transported polarisation');
console.log('case        |kappa|     drift(up,up)  rel(up,up)   drift(down,down)   steps');
for (const C of data.cases) {
  const d = run(C, 0.005);
  const rel = d.worstUp / Math.max(d.kMag, 1e-30);
  console.log(C.tag.padEnd(12) + d.kMag.toExponential(3).padStart(11) + d.worstUp.toExponential(2).padStart(14)
    + rel.toExponential(2).padStart(12) + d.worstDn.toExponential(2).padStart(18) + String(d.n).padStart(8));
}
console.log('');
console.log('the (up,up) column uses contravariant p and f; (down,down) uses both lowered.  ONE of them');
console.log('should be conserved to round-off if the transport is correct.');