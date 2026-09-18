import { trace } from '../js/kn.js';
const base = { M: 1, a: 0, Q: 0, r0: 60, th0: Math.PI / 2, ph0: 0, rFar: 140, interior: false };
/* phi evaluated at a FIXED radius on the outgoing leg: removes the
   'where did we stop' contribution that dominated the first attempt */
const phiAt = (ss, tol) => {
  let phi = null;
  trace({ ...base, bEquator: 10, maxSteps: 400000, stepScale: ss, tol,
    onStep: (s) => { if (phi === null && s.r > 100) phi = s.ph; } });
  return phi;
};
const ref = phiAt(0.05, 1e-10);
console.log('reference phi(r=100) = ' + ref.toFixed(12));
for (const [ss, tol] of [[1.0,1e-4],[0.5,1e-4],[0.5,1e-5],[0.5,1e-6],[0.5,1e-8],[0.2,1e-4],[0.1,1e-4],[0.1,1e-8]]) {
  const t = trace({ ...base, bEquator: 10, maxSteps: 400000, stepScale: ss, tol });
  const v = phiAt(ss, tol);
  console.log('stepScale=' + ss.toFixed(2) + ' tol=' + tol.toExponential(0) + '  steps=' + String(t.steps).padStart(5) + '  |dphi|=' + Math.abs(v - ref).toExponential(3));
}