import { metric, metricUp, christoffel, transportRhs, momentumUp, solveNullPr, zamo, polFromField, unitise } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
const r = 6.0, th = 1.2;
const g = metric(r, th, M, a, Q).g;
const dotG = (x,y) => { let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
/* build a genuinely NULL momentum and VERIFY it before use */
let pr = 0.3, best = null;
for (let it = 0; it < 200; it++) {
  const pu = momentumUp(r, th, M, a, Q, pr, 0.2, 1.0, 3.0);
  const H = dotG(pu, pu);
  if (best === null || Math.abs(H) < Math.abs(best.H)) best = { pr, H };
  if (Math.abs(H) < 1e-14) break;
  const h = 1e-6;
  const pu2 = momentumUp(r, th, M, a, Q, pr+h, 0.2, 1.0, 3.0);
  const dH = (dotG(pu2,pu2) - H)/h;
  if (Math.abs(dH) < 1e-16) break;
  pr -= H/dH;
}
const p = momentumUp(r, th, M, a, Q, best.pr, 0.2, 1.0, 3.0);
console.log('null-momentum solve:  p_r = ' + best.pr.toFixed(8) + '   p.p = ' + dotG(p,p).toExponential(3));
const u = zamo(r, th, M, a, Q);
const f0 = unitise(polFromField(p, u, [0,0,0,1], r, th, M, a, Q), r, th, M, a, Q);
console.log('f.p = ' + dotG(f0,p).toExponential(3) + '   |f|^2 = ' + dotG(f0,f0).toFixed(12));
console.log('');
function rk4(f, ds) {
  const k1 = transportRhs(r, th, M, a, Q, p, f);
  const ad = (x,k,c) => [0,1,2,3].map(i => x[i] + c*ds*k[i]);
  const k2 = transportRhs(r, th, M, a, Q, p, ad(f,k1,0.5));
  const k3 = transportRhs(r, th, M, a, Q, p, ad(f,k2,0.5));
  const k4 = transportRhs(r, th, M, a, Q, p, ad(f,k3,1.0));
  return [0,1,2,3].map(i => f[i] + (ds/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
console.log('one RK4 step from this state, using the library RHS (now trusted):');
console.log('   ds        |f|^2 after          change             f components');
for (const ds of [0.05, 0.02]) {
  const f1 = rk4(f0, ds);
  console.log('   ' + String(ds).padEnd(6) + '   ' + dotG(f1,f1).toFixed(12) + '     ' + (dotG(f1,f1)-1).toExponential(3) + '   [' + f1.map(x=>x.toExponential(3)).join(', ') + ']');
}