import { metric, metricUp, transportRhs } from '../js/polar.js';
/* FLAT SPACE, radial null geodesic: r(lambda) = r0 + lambda, p constant, exact f^theta = 1/r. */
const M = 0, a = 0, Q = 0, th = 1.0;
const gAt = (r) => metric(r, th, M, a, Q).g;
const pAt = (r) => { const gu = metricUp(r, th, M, a, Q).gu; return [0,1,2,3].map(i => gu[i][0]*(-1) + gu[i][1]*1.0); };
const dotG = (g,x,y) => { let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
/* (a) FROZEN: one RK4 over the whole step, geometry at the step's end */
function frozen(r, f, h) {
  const p = pAt(r), p2 = pAt(r+h);
  const k1 = transportRhs(r+h, th, M, a, Q, p2, f);
  const ad = (x,k,c) => [0,1,2,3].map(i => x[i] + c*h*k[i]);
  const k2 = transportRhs(r+h, th, M, a, Q, p2, ad(f,k1,0.5));
  const k3 = transportRhs(r+h, th, M, a, Q, p2, ad(f,k2,0.5));
  const k4 = transportRhs(r+h, th, M, a, Q, p2, ad(f,k3,1.0));
  return [0,1,2,3].map(i => f[i] + (h/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
/* (b) COUPLED: f advanced by the SAME stages the geodesic uses, geometry at each stage */
function coupled(r, f, h) {
  const st = [0, 0.5, 0.5, 1.0];
  const K = [];
  const gs = [];
  for (let i = 0; i < 4; i++) {
    const ri = r + st[i]*h;
    gs.push(ri);
  }
  /* stage 1 */
  let k1 = transportRhs(gs[0], th, M, a, Q, pAt(gs[0]), f);
  const adv = (x,k,c) => [0,1,2,3].map(i => x[i] + c*h*k[i]);
  let k2 = transportRhs(gs[1], th, M, a, Q, pAt(gs[1]), adv(f,k1,0.5));
  let k3 = transportRhs(gs[2], th, M, a, Q, pAt(gs[2]), adv(f,k2,0.5));
  let k4 = transportRhs(gs[3], th, M, a, Q, pAt(gs[3]), adv(f,k3,1.0));
  return [0,1,2,3].map(i => f[i] + (h/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
for (const [label, fn] of [['frozen per step (what the app does)', frozen], ['coupled into the stages', coupled]]) {
  console.log(label + ':');
  for (const N of [40, 160, 640]) {
    const r0 = 10.0, tot = 4.0, h = tot/N;
    let r = r0, f = [0, 0, 1/r0, 0];
    for (let k = 0; k < N; k++) { f = fn(r, f, h); r += h; }
    const g = gAt(r);
    console.log('   N=' + String(N).padStart(4) + '  h=' + h.toFixed(4) + '   r*f^theta = ' + (r*f[2]).toFixed(12) + '   |f|^2 = ' + dotG(g,f,f).toFixed(12) + '   (exact 1)');
  }
}