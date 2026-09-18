import { metric, metricUp, christoffel, transportRhs, momentumUp } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
const r = 6.0, th = 1.2;
const p = momentumUp(r, th, M, a, Q, 0.3, 0.2, 1.0, 3.0);
const g = metric(r, th, M, a, Q).g;
const f0 = [0, 0, 1 / Math.sqrt(g[2][2]), 0];
/* exactly the shader's knTransportStep, using the JS transportRhs as the RHS */
function step(f, ds) {
  const k1 = transportRhs(r, th, M, a, Q, p, f);
  const add = (x, k, c) => [0,1,2,3].map(i => x[i] + c * ds * k[i]);
  const k2 = transportRhs(r, th, M, a, Q, p, add(f, k1, 0.5));
  const k3 = transportRhs(r, th, M, a, Q, p, add(f, k2, 0.5));
  const k4 = transportRhs(r, th, M, a, Q, p, add(f, k3, 1.0));
  return [0,1,2,3].map(i => f[i] + (ds/6)*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
}
const n2 = (f) => { let s = 0; for (let i=0;i<4;i++) for (let j=0;j<4;j++) s += g[i][j]*f[i]*f[j]; return s; };
const LAM = 0.28;   /* the accepted affine step the shader reports */
console.log('one update of total length', LAM, 'split into N sub-steps');
console.log('  N     squared-norm error      ratio to previous');
let prev = null;
for (const N of [1, 2, 4, 8, 16]) {
  let f = f0.slice();
  for (let s = 0; s < N; s++) f = step(f, LAM / N);
  const err = n2(f) - 1.0;
  const ratio = prev === null ? '' : (prev / Math.abs(err)).toFixed(1) + 'x';
  console.log('  ' + String(N).padStart(2) + '     ' + (err * 100).toExponential(4).padStart(14) + '%     ' + ratio);
  prev = Math.abs(err);
}
/* and the control: does the same integrator preserve the norm for a vector parallel to p? */
console.log('');
console.log('sanity: n2(f0) should be 1 ->', n2(f0).toFixed(12));