import { metric, metricUp, metricUp as mu, transportRhs, momentumUp, polFromField, zamo, unitise, solveNullPr, screenEVPA } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
/* a genuinely NULL photon momentum, at a strong-field radius */
function nullP(r, th, L, beta) {
  const c = Math.cos(th), s = Math.sin(th);
  const eta = beta * beta + a * a * c * c;
  const pth2 = eta - c * c * L * L / (s * s);
  if (pth2 < 0) return null;
  const pth0 = Math.sqrt(pth2);
  const pr0 = solveNullPr(r, th, M, a, Q, pth0, 1, L, -1);
  if (pr0 === null) return null;
  return momentumUp(r, th, M, a, Q, pr0, pth0, 1, L);
}
function dotG(g, x, y) { let s = 0; for (let i=0;i<4;i++) for (let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; }
function step(r, th, p, f, ds) {
  const k1 = transportRhs(r, th, M, a, Q, p, f);
  const add = (x, k, c) => [0,1,2,3].map(i => x[i] + c * ds * k[i]);
  const k2 = transportRhs(r, th, M, a, Q, p, add(f, k1, 0.5));
  const k3 = transportRhs(r, th, M, a, Q, p, add(f, k2, 0.5));
  const k4 = transportRhs(r, th, M, a, Q, p, add(f, k3, 1.0));
  return [0,1,2,3].map(i => f[i] + (ds/6)*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
}
const r = 8.0, th = 1.2;
const p = nullP(r, th, 3.0, 5.0);
if (!p) { console.log('could not build a null p'); process.exit(1); }
const g = metric(r, th, M, a, Q).g;
const u = zamo(r, th, M, a, Q);
const f0 = unitise(polFromField(p, u, [0,0,0,1], r, th, M, a, Q), r, th, M, a, Q);
console.log('state r=' + r + ' th=' + th);
console.log('  p.p        =', dotG(g, p, p).toExponential(3), '   (must be ~0 for a photon)');
console.log('  f.p        =', dotG(g, f0, p).toExponential(3), '   (must be ~0)');
console.log('  |f|^2      =', dotG(g, f0, f0).toFixed(12));
console.log('  |df/dlam|  =', Math.max.apply(null, transportRhs(r, th, M, a, Q, p, f0).map(Math.abs)).toExponential(3));
console.log('');
console.log('  total ds   one update    |f|^2 after          change');
for (const ds of [0.32, 0.16, 0.08, 0.04, 0.02]) {
  const fa = step(r, th, p, f0, ds);
  const ch = dotG(g, fa, fa) - 1;
  console.log('  ' + String(ds).padStart(8) + '              ' + dotG(g, fa, fa).toFixed(12) + '     ' + ch.toExponential(3));
}
console.log('');
console.log('  same total 0.32, split into N: what happens to the change?');
for (const N of [1, 2, 4, 8]) {
  let f = f0.slice();
  for (let s = 0; s < N; s++) f = step(r, th, p, f, 0.32 / N);
  console.log('  N=' + String(N).padStart(2) + '   |f|^2 = ' + dotG(g, f, f).toFixed(12) + '   change ' + (dotG(g, f, f) - 1).toExponential(3));
}