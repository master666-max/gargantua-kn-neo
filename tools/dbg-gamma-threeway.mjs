import { metric, metricUp, christoffel } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
function fdG(r, th) {
  const eps = 1e-5, hr = eps*Math.max(1,Math.abs(r)), ht = eps;
  const G = (R,T) => metric(R,T,M,a,Q).g;
  const gp=G(r+hr,th), gm=G(r-hr,th), tp=G(r,th+ht), tm=G(r,th-ht);
  const gr=[], gt=[];
  for(let i=0;i<4;i++){ gr.push([]); gt.push([]); for(let j=0;j<4;j++){ gr[i].push((gp[i][j]-gm[i][j])/(2*hr)); gt[i].push((tp[i][j]-tm[i][j])/(2*ht)); } }
  const gu = metricUp(r,th,M,a,Q).gu;
  const dg=[gr,gt,null,null]; const out=[];
  for(let mu=0;mu<4;mu++){ out.push([]); for(let sg=0;sg<4;sg++){ out[mu].push([]); for(let nu=0;nu<4;nu++){
    let acc=0;
    for(let rho=0;rho<4;rho++){
      const ds = dg[sg]?dg[sg][rho][nu]:0;
      const dn = dg[nu]?dg[nu][rho][sg]:0;
      const dr = dg[rho]?dg[rho][sg][nu]:0;
      acc += gu[mu][rho]*(ds+dn-dr);
    }
    out[mu][sg].push(0.5*acc);
  }}}
  return out;
}
const r = 8.0, th = 1.2;
const A = christoffel(r, th, M, a, Q);
const B = fdG(r, th);
let mx = 0, worst='';
for (let mu=0;mu<4;mu++) for (let sg=0;sg<4;sg++) for (let nu=0;nu<4;nu++) {
  const d = Math.abs(A[mu][sg][nu]-B[mu][sg][nu])/Math.max(Math.abs(B[mu][sg][nu]),1e-12);
  if (d>mx) { mx=d; worst='('+mu+','+sg+','+nu+') lib '+A[mu][sg][nu].toExponential(3)+' fresh '+B[mu][sg][nu].toExponential(3); }
}
console.log('library christoffel vs a fresh central-difference build (a=0.86, r=8):');
console.log('   max rel diff = ' + (mx*100).toExponential(3) + '%   worst ' + worst);
console.log('');
/* Schwarzschild sanity: Gamma^r_tt = M(r-2M)/r^3 -- the assertion that PASSES in the app */
const rs = 8;
const A0 = christoffel(rs, 1.2, 1, 0, 0);
const B0 = fdG(rs, 1.2);
console.log('Schwarzschild Gamma^r_tt: expected ' + (1*(rs-2)/(rs*rs*rs)).toExponential(6) + '   library ' + A0[1][0][0].toExponential(6) + '   fresh ' + B0[1][0][0].toExponential(6));
console.log('Schwarzschild Gamma^th_thth: expected ' + (0).toExponential(6) + '   library ' + A0[2][2][2].toExponential(6) + '   fresh ' + B0[2][2][2].toExponential(6));
console.log('Schwarzschild Gamma^r_thth: expected ' + (-(rs-2)).toExponential(6) + '   library ' + A0[1][2][2].toExponential(6) + '   fresh ' + B0[1][2][2].toExponential(6));