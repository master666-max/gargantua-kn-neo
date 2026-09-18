import { metric, christoffel } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
/* the FD christoffel that transportRhs actually calls: is IT metric-compatible? */
function compat(r, th) {
  const G = christoffel(r, th, M, a, Q);
  const eps = 1e-5, hr = eps * Math.max(1, Math.abs(r)), ht = eps;
  const G_f = (R,T) => metric(R,T,M,a,Q).g;
  const gp = G_f(r+hr,th), gm = G_f(r-hr,th), tp = G_f(r,th+ht), tm = G_f(r,th-ht);
  let mx = 0, worst = '';
  for (const [sg, hub] of [[0, hr], [1, ht]]) {
    for (let mu=0; mu<4; mu++) for (let nu=0; nu<4; nu++) {
      const d = sg === 0 ? (gp[mu][nu]-gm[mu][nu])/(2*hr) : (tp[mu][nu]-tm[mu][nu])/(2*ht);
      const g = metric(r, th, M, a, Q).g;
      let rhs = 0;
      for (let rho=0; rho<4; rho++) rhs += G[rho][sg][mu]*g[rho][nu] + G[rho][sg][nu]*g[mu][rho];
      const rel = Math.abs(d - rhs) / Math.max(Math.abs(d), 1e-9);
      if (rel > mx) { mx = rel; worst = 'sigma=' + (sg===0?'r':'th') + ' g[' + mu + '][' + nu + ']'; }
    }
  }
  return { mx, worst };
}
console.log('state        max relative compatibility residual (FD christoffel)');
for (const [r,th] of [[8,1.2],[6,1.2],[12,0.7],[3.8,1.74],[18.2,2.9]]) {
  const { mx, worst } = compat(r, th);
  console.log('(' + r + ', ' + th + ')'.padEnd(5) + '   ' + (mx*100).toExponential(3) + '%   ' + worst);
}