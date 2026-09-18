import { metric, metricUp, christoffel } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
function harnessGamma(r, th) {
  const eps = 1e-5, hr = eps*Math.max(1,Math.abs(r)), ht = eps;
  const G = (R,T) => metric(R,T,M,a,Q).g;
  const gp=G(r+hr,th), gm=G(r-hr,th), tp=G(r,th+ht), tm=G(r,th-ht);
  const gr=[], gt=[];
  for(let i=0;i<4;i++){ gr.push([]); gt.push([]); for(let j=0;j<4;j++){ gr[i].push((gp[i][j]-gm[i][j])/(2*hr)); gt[i].push((tp[i][j]-tm[i][j])/(2*ht)); } }
  const gu = metricUp(r,th,M,a,Q).gu;
  const dg=[null,gr,gt,null]; const out=[];
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
console.log('FULL 64-component comparison, library christoffel vs the certified harness build:');
for (const [r,th] of [[6,1.2],[12,0.7],[18.2,2.9]]) {
  const A = christoffel(r, th, M, a, Q);
  const B = harnessGamma(r, th);
  let mx = 0, worst='';
  for (let mu=0;mu<4;mu++) for (let sg=0;sg<4;sg++) for (let nu=0;nu<4;nu++) {
    const d = Math.abs(A[mu][sg][nu]-B[mu][sg][nu])/Math.max(Math.abs(A[mu][sg][nu]), Math.abs(B[mu][sg][nu]), 1e-12);
    if (d>mx) { mx=d; worst='('+mu+','+sg+','+nu+') lib '+A[mu][sg][nu].toExponential(4)+' mine '+B[mu][sg][nu].toExponential(4); }
  }
  console.log('  (' + r + ', ' + th + ')  max rel diff = ' + (mx*100).toExponential(3) + '%   worst ' + worst);
}
console.log('');
console.log('and as a cross-check, the fully symmetric part: is the library Gamma symmetric in its lower pair');
console.log('(which is what a connection built from a metric must be)?');
const A6 = christoffel(6, 1.2, M, a, Q);
let asym = 0, w='';
for (let mu=0;mu<4;mu++) for (let sg=0;sg<4;sg++) for (let nu=0;nu<4;nu++) {
  const d = Math.abs(A6[mu][sg][nu]-A6[mu][nu][sg])/Math.max(Math.abs(A6[mu][sg][nu]),1e-12);
  if (d>asym) { asym=d; w='('+mu+','+sg+','+nu+') vs ('+mu+','+nu+','+sg+')'; }
}
console.log('   max asymmetry = ' + (asym*100).toExponential(3) + '%   at ' + w);