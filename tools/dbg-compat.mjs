import { metric, metricUp, christoffel } from '../js/polar.js';
/* metric compatibility: the exact condition that makes parallel transport preserve g(f,f).
   Computed independently of any trajectory, so it cannot be confused by conditioning. */
const cases = [[1,0,0,10,1.0],[1,0.86,0,10,1.0],[1,0.5,0.6,10,1.0],[1,0.86,0,30,1.2],[1,0.86,0,4,0.6],[1,0.5,0.6,60,1.4]];
let worst = 0, worstAt = '';
for (const [M,a,Q,r,th] of cases) {
  const G = christoffel(r, th, M, a, Q);
  const g = metric(r, th, M, a, Q).g;
  const hr = 1e-6*Math.max(1,r), ht = 1e-6;
  for (const sig of [1,2]) {
    const gp = metric(sig===1?r+hr:r, sig===1?th:th+ht, M,a,Q).g;
    const gm = metric(sig===1?r-hr:r, sig===1?th:th-ht, M,a,Q).g;
    const d = sig===1?2*hr:2*ht;
    for (let mu=0; mu<4; mu++) for (let nu=mu; nu<4; nu++) {
      const dg = (gp[mu][nu]-gm[mu][nu])/d;
      let rhs = 0;
      for (let rho=0; rho<4; rho++) rhs += G[rho][sig][mu]*g[rho][nu] + G[rho][sig][nu]*g[rho][mu];
      /* scale by the size of the terms to judge the relative error */
      const scale = Math.max(1e-12, Math.abs(dg), Math.abs(rhs));
      const rel = Math.abs(dg-rhs)/scale;
      if (rel > worst) { worst = rel; worstAt = 'M='+M+' a='+a+' Q='+Q+' r='+r+' th='+th+' sigma='+sig+' mu='+mu+' nu='+nu+' lhs='+dg.toExponential(3)+' rhs='+rhs.toExponential(3); }
    }
  }
}
console.log('worst relative metric-compatibility violation: ' + worst.toExponential(3));
console.log('at: ' + worstAt);