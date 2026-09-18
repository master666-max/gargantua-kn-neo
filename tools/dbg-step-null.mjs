import { metric, metricUp, transportRhs, momentumUp, polFromField, unitise, zamo } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
const r = 6.0, th = 1.2;
const g = metric(r, th, M, a, Q).g;
const dotG = (x,y) => { let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
/* a NULL momentum (p_r solved so that p.p = 0) */
let pr = 0.3;
for (let it=0; it<200; it++) {
  const pu = momentumUp(r, th, M, a, Q, pr, 0.2, 1.0, 3.0);
  const H = dotG(pu,pu);
  if (Math.abs(H) < 1e-15) break;
  const hh = 1e-6;
  const pu2 = momentumUp(r, th, M, a, Q, pr+hh, 0.2, 1.0, 3.0);
  const dH = (dotG(pu2,pu2) - H)/hh;
  if (Math.abs(dH) < 1e-18) break;
  pr -= H/dH;
}
const pcov = [-1, pr, 0.2, 3.0];
const p = momentumUp(r, th, M, a, Q, pr, 0.2, 1.0, 3.0);
const u = zamo(r, th, M, a, Q);
const f0 = unitise(polFromField(p, u, [0,0,0,1], r, th, M, a, Q), r, th, M, a, Q);
const fp = (f) => { let s=0; for(let i=0;i<4;i++) s += f[i]*pcov[i]; return s; };
console.log('state: p.p = ' + dotG(p,p).toExponential(2) + ',  f.p = ' + fp(f0).toExponential(2) + ',  |f|^2 = ' + dotG(f0,f0).toFixed(12));
console.log('');
function rk4(f, ds) {
  const k1 = transportRhs(r, th, M, a, Q, p, f);
  const ad = (x,k,c) => [0,1,2,3].map(i => x[i] + c*ds*k[i]);
  const k2 = transportRhs(r, th, M, a, Q, p, ad(f,k1,0.5));
  const k3 = transportRhs(r, th, M, a, Q, p, ad(f,k2,0.5));
  const k4 = transportRhs(r, th, M, a, Q, p, ad(f,k3,1.0));
  return [0,1,2,3].map(i => f[i] + (ds/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
console.log('ONE step from a NULL state:');
console.log('    ds        f.p after        |f|^2 after        change in |f|^2');
let prev = null;
for (const ds of [0.4, 0.2, 0.1, 0.05, 0.025, 0.0125]) {
  const f1 = rk4(f0, ds);
  const ch = dotG(f1,f1) - 1;
  const ratio = prev === null ? '' : '  (x' + (prev/Math.abs(ch)).toFixed(2) + ' vs previous)';
  console.log('  ' + String(ds).padStart(7) + '   ' + fp(f1).toExponential(3).padStart(12) + '   ' + dotG(f1,f1).toFixed(12) + '   ' + ch.toExponential(3).padStart(11) + ratio);
  prev = Math.abs(ch);
}
console.log('');
console.log('note: if the change halves when ds halves, the step error is FIRST order in ds.');