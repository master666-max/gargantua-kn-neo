/* ============================================================================
   BASIS-INVARIANT AND CONVERGENCE TEST   --  goal step (1), the ipole-style design.

   WHY THIS AND NOT SOMETHING ELSE.  The previous assertion compared the shader against a second
   integrator PIXEL BY PIXEL.  That mixes the errors of both implementations, which is why four
   rounds of hypotheses about the residual all failed.  ipole's validation (Moscibrodzka & Gammie
   2018, arXiv:1712.03057) instead transports a controlled source and checks TRANSPORT-STEP
   INVARIANTS, then measures how the residual falls with step size.  An invariant check compares
   against a conservation law, not against a second implementation.

   WHAT THE INVARIANT IS HERE.  The screen EVPA comes from solving G c = r, where G is the Gram
   matrix of the transported observer basis (gA, gB) and r is the source expanded in it.  Therefore
   the quantities that MUST be conserved along the transport are
       |gA|^2 = 1,  |gB|^2 = 1,  gA . gB = 0
   and they are exactly the precondition for the expansion to mean anything.  A basis whose Gram
   matrix drifts produces a chi that drifts with it.  This file measures that drift and its order.
   ========================================================================== */
import * as pol from '../js/polar.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(HERE, 'measurements', 'evpa-physical.json'), 'utf8'));
const M = data.app.M, A = data.app.a, Q = data.app.Q;
const r0 = data.app.camR, th0 = data.app.camTheta * Math.PI / 180;

function drift(C, h) {
  const gO = pol.metric(r0, th0, M, A, Q).g;
  const uO = pol.zamo(r0, th0, M, A, Q);
  const pUpO = pol.momentumUp(r0, th0, M, A, Q, C.pr, C.pth, C.E, C.L);
  const eA = [0, 0, 0, 1 / Math.sqrt(gO[3][3])];
  const eB = [0, 0, -1 / Math.sqrt(gO[2][2]), 0];
  const mk = (b) => pol.unitise(pol.polFromField(pUpO, uO, b, r0, th0, M, A, Q), r0, th0, M, A, Q);
  let wA = 0, wB = 0, wAB = 0, wf = 0, worstOrth = 0, n = 0;
  pol.tracePolarised({
    M, a: A, Q, E: C.E, L: C.L, r0, th0, pr0: C.pr, pth0: C.pth,
    f0: mk([0, 0, 0, 1]), fList: [mk(eA), mk(eB)],
    steps: 400000, h, rMax: 200, stopAtHorizon: true,
    onStep: (st) => {
      const gI = pol.metric(st.r, st.th, M, A, Q).g;
      const D = (u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += gI[i][j] * u[i] * v[j]; return s; };
      const gA2 = D(st.extras[0], st.extras[0]), gB2 = D(st.extras[1], st.extras[1]);
      const gAB = D(st.extras[0], st.extras[1]);
      wA = Math.max(wA, Math.abs(gA2 - 1));
      wB = Math.max(wB, Math.abs(gB2 - 1));
      wAB = Math.max(wAB, Math.abs(gAB));
      wf = Math.max(wf, Math.abs(D(st.f, st.f) - 1));
      n++;
    },
  });
  return { wA, wB, wAB, wf, n };
}

const hs = [0.08, 0.04, 0.02, 0.01, 0.005];
const cases = data.cases.slice(0, 6);
console.log('BASIS GRAM-MATRIX DRIFT ALONG THE TRANSPORT  (|gA|^2-1, |gB|^2-1, gA.gB)');
console.log('h      worst|gA|^2-1   worst|gB|^2-1   worst gA.gB   worst|f|^2-1   ratio |gA|');
let prev = null;
for (const h of hs) {
  let a = 0, b = 0, ab = 0, f = 0;
  for (const C of cases) { const d = drift(C, h); a = Math.max(a, d.wA); b = Math.max(b, d.wB); ab = Math.max(ab, d.wAB); f = Math.max(f, d.wf); }
  const ratio = prev === null ? '   --' : (Math.log(prev / a) / Math.log(2)).toFixed(2);
  console.log(h.toFixed(3).padEnd(6) + a.toExponential(2).padStart(14) + b.toExponential(2).padStart(15)
    + ab.toExponential(2).padStart(14) + f.toExponential(2).padStart(13) + ('   ' + ratio).padStart(10));
  prev = a;
}
console.log('');
console.log('the last column is the observed order: log2(drift(2h)/drift(h)).  RK4 transport should give ~4.');