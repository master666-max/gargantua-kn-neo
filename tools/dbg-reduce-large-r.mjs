import { metric, metricUp, christoffel, transportRhs, momentumUp } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
function reduce(r, th, p, f) {
  const { gu } = metricUp(r, th, M, a, Q);
  const eps = 1e-5, hr = eps*Math.max(1, Math.abs(r)), ht = eps;
  const G = (R,T) => metric(R,T,M,a,Q).g;
  const gp = G(r+hr,th), gm = G(r-hr,th), tp = G(r,th+ht), tm = G(r,th-ht);
  const gr = [], gt = [];
  for (let i=0;i<4;i++){ gr.push([]); gt.push([]); for (let j=0;j<4;j++){ gr[i].push((gp[i][j]-gm[i][j])/(2*hr)); gt[i].push((tp[i][j]-tm[i][j])/(2*ht)); } }
  const mv = (A,v) => [0,1,2,3].map(i => A[i][0]*v[0]+A[i][1]*v[1]+A[i][2]*v[2]+A[i][3]*v[3]);
  const grf = mv(gr,f), gtf = mv(gt,f), grp = mv(gr,p), gtp = mv(gt,p);
  const C = [0,1,2,3].map(i => p[1]*grf[i] + p[2]*gtf[i]);
  const D = [0,1,2,3].map(i => f[1]*grp[i] + f[2]*gtp[i]);
  const dot = (x,y) => x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3];
  const E = [0, dot(p,grf), dot(p,gtf), 0];
  const q = [0,1,2,3].map(i => C[i]+D[i]-E[i]);
  const gq = mv(gu, q);
  return [0,1,2,3].map(i => -0.5*gq[i]);
}
console.log('r        |rhs| (explicit)    max rel diff (reduction vs explicit)');
for (const r of [6, 12, 100, 1000, 4000, 20000]) {
  const th = 1.2;
  const p = momentumUp(r, th, M, a, Q, 0.3, 0.2, 1.0, 3.0);
  const g = metric(r, th, M, a, Q).g;
  const f = [0, 0, 1/Math.sqrt(g[2][2]), 0];
  const exp_ = transportRhs(r, th, M, a, Q, p, f);
  const red = reduce(r, th, p, f);
  let mx = 0;
  for (let i=0;i<4;i++) mx = Math.max(mx, Math.abs(red[i]-exp_[i])/Math.max(Math.abs(exp_[i]), 1e-300));
  const mag = Math.max.apply(null, exp_.map(Math.abs));
  console.log(String(r).padStart(7) + '   ' + mag.toExponential(3).padStart(12) + '      ' + (mx*100).toExponential(2) + '%');
}