import { metric, metricUp, christoffel } from '../js/polar.js';
const MV = 1, AV = 0.86, QV = 0;
function deriv(r, th, M, a, Q) {
  const eps = 1e-5, hr = eps*Math.max(1,Math.abs(r)), ht = eps;
  const G = (R,T) => metric(R,T,M,a,Q).g;
  const gp=G(r+hr,th), gm=G(r-hr,th), tp=G(r,th+ht), tm=G(r,th-ht);
  const gr=[], gt=[];
  for(let i=0;i<4;i++){ gr.push([]); gt.push([]); for(let j=0;j<4;j++){ gr[i].push((gp[i][j]-gm[i][j])/(2*hr)); gt[i].push((tp[i][j]-tm[i][j])/(2*ht)); } }
  return { g: metric(r,th,M,a,Q).g, gu: metricUp(r,th,M,a,Q).gu, dg: [null, gr, gt, null] };
}
function gamma(r, th, M, a, Q) {
  const D = deriv(r, th, M, a, Q); const G = [];
  for(let mu=0;mu<4;mu++){ G.push([]); for(let sg=0;sg<4;sg++){ G[mu].push([]); for(let nu=0;nu<4;nu++){
    let acc=0;
    for(let rho=0;rho<4;rho++){
      const ds = D.dg[sg] ? D.dg[sg][rho][nu] : 0;
      const dn = D.dg[nu] ? D.dg[nu][rho][sg] : 0;
      const dr = D.dg[rho] ? D.dg[rho][sg][nu] : 0;
      acc += D.gu[mu][rho]*(ds+dn-dr);
    }
    G[mu][sg].push(0.5*acc);
  }}}
  return { D, G };
}
console.log('SELF-CERTIFICATION (Schwarzschild, a=0 Q=0, r=8, theta=1.2):');
const rS=8, thS=1.2;
const libS = christoffel(rS, thS, 1, 0, 0);
const { G: GS } = gamma(rS, thS, 1, 0, 0);
let ok = true;
for (const [name, lib, mine, exact] of [
  ['Gamma^r_tt', libS[1][0][0], GS[1][0][0], 1*(rS-2)/(rS*rS*rS)],
  ['Gamma^r_thth', libS[1][2][2], GS[1][2][2], -(rS-2)],
  ['Gamma^th_thth', libS[2][2][2], GS[2][2][2], 0],
]) {
  const pass = Math.abs(mine - exact) <= 1e-4 * Math.max(Math.abs(exact), 1);
  if (!pass) ok = false;
  console.log('  ' + name.padEnd(14) + ' analytic ' + exact.toExponential(4).padStart(13) + '  library ' + lib.toExponential(4).padStart(13) + '  mine ' + mine.toExponential(4).padStart(13) + '  ' + (pass?'PASS':'FAIL'));
}
console.log('  harness certified: ' + ok);
if (!ok) { console.log('ABORT'); process.exit(0); }
console.log('');
function compat(r, th, M, a, Q) {
  const { D, G } = gamma(r, th, M, a, Q); let mx = 0;
  for (let sg=0; sg<4; sg++) for (let mu=0;mu<4;mu++) for (let nu=0;nu<4;nu++) {
    const d = D.dg[sg] ? D.dg[sg][mu][nu] : 0;
    let rhs=0;
    for (let rho=0;rho<4;rho++) rhs += G[rho][sg][mu]*D.g[rho][nu] + G[rho][sg][nu]*D.g[mu][rho];
    mx = Math.max(mx, Math.abs(d-rhs)/Math.max(Math.abs(d),1e-9));
  }
  return mx;
}
const mv = (A,v) => [0,1,2,3].map(i => A[i][0]*v[0]+A[i][1]*v[1]+A[i][2]*v[2]+A[i][3]*v[3]);
const dot = (x,y) => x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3];
console.log('  r      th       harness Gamma compat      reduction vs explicit');
for (const [r,th] of [[6,1.2],[8,1.2],[12,0.7],[18.2,2.9],[3.8,1.74]]) {
  const { D, G } = gamma(r, th, MV, AV, QV);
  const p = mv(D.gu, [-1, 0.3, 0.2, 3.0]);
  const fv = [0, 0, 1/Math.sqrt(D.g[2][2]), 0];
  const Texp = [0,1,2,3].map(mu => { let s=0; for(let al=0;al<4;al++) for(let be=0;be<4;be++) s += G[mu][al][be]*p[al]*fv[be]; return -s; });
  const grf = mv(D.dg[1],fv), gtf = mv(D.dg[2],fv), grp = mv(D.dg[1],p), gtp = mv(D.dg[2],p);
  const C = [0,1,2,3].map(i => p[1]*grf[i] + p[2]*gtf[i]);
  const Dv = [0,1,2,3].map(i => fv[1]*grp[i] + fv[2]*gtp[i]);
  const E = [0, dot(p,grf), dot(p,gtf), 0];
  const q = [0,1,2,3].map(i => C[i]+Dv[i]-E[i]);
  const Tred = mv(D.gu,q).map(x => -0.5*x);
  let mx = 0; for (let i=0;i<4;i++) mx = Math.max(mx, Math.abs(Tred[i]-Texp[i])/Math.max(Math.abs(Texp[i]),1e-30));
  console.log('  ' + String(r).padStart(5) + String(th).padStart(7) + '     ' + (compat(r,th,MV,AV,QV)*100).toExponential(2).padStart(10) + '%' + '     ' + (mx*100).toExponential(3).padStart(12) + '%');
}