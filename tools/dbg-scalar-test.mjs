import { metric } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
function deriv(r, th) {
  const s=Math.sin(th), c=Math.cos(th), s2=s*s, c2=c*c, sc=s*c, r2=r*r, a2=a*a;
  const Sig=r2+a2*c2, Del=r2-2*M*r+a2+Q*Q, f=2*M*r-Q*Q; const A=(r2+a2)*Sig + f*a2*s2;
  const Sr=2*r, St=-2*a2*sc, Dr=2*r-2*M, Dt=0, fr=2*M, ft=0;
  const Ar=2*r*Sig+(r2+a2)*Sr+fr*a2*s2, At=(r2+a2)*St+f*2*a2*sc;
  const S2=Sig*Sig, D2=Del*Del;
  const z=() => [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const g=z(), gr=z(), gt=z(), gu=z();
  g[0][0]=-1+f/Sig; gr[0][0]=(fr*Sig-f*Sr)/S2; gt[0][0]=(ft*Sig-f*St)/S2;
  g[0][3]=g[3][0]=-f*a*s2/Sig;
  gr[0][3]=gr[3][0]=-a*((fr*s2)*Sig-f*s2*Sr)/S2;
  gt[0][3]=gt[3][0]=-a*((ft*s2+f*2*sc)*Sig-f*s2*St)/S2;
  g[1][1]=Sig/Del; gr[1][1]=(Sr*Del-Sig*Dr)/D2; gt[1][1]=(St*Del-Sig*Dt)/D2;
  g[2][2]=Sig; gr[2][2]=Sr; gt[2][2]=St;
  g[3][3]=A*s2/Sig; gr[3][3]=(Ar*s2*Sig-A*s2*Sr)/S2; gt[3][3]=((At*s2+A*2*sc)*Sig-A*s2*St)/S2;
  const s2n=Math.max(s2,1e-9);
  gu[0][0]=-A/(Sig*Del); gu[0][3]=gu[3][0]=-f*a/(Sig*Del); gu[1][1]=Del/Sig; gu[2][2]=1/Sig;
  gu[3][3]=(Del-a2*s2n)/(Sig*Del*s2n);
  return { g, gr, gt, gu };
}
function gamma(r, th) {
  const D = deriv(r, th); const dg = [D.gr, D.gt, null, null]; const G = [];
  for (let mu=0; mu<4; mu++) { G.push([]); for (let sg=0; sg<4; sg++) { G[mu].push([]); for (let nu=0; nu<4; nu++) {
    let acc = 0;
    for (let rho=0; rho<4; rho++) {
      const ds = dg[sg] ? dg[sg][rho][nu] : 0;
      const dn = dg[nu] ? dg[nu][rho][sg] : 0;
      const dr = dg[rho] ? dg[rho][sg][nu] : 0;
      acc += D.gu[mu][rho] * (ds + dn - dr);
    }
    G[mu][sg].push(0.5*acc);
  } } }
  return { D, G };
}
const r = 8.0, th = 1.2;
const { D, G } = gamma(r, th);
/* a genuinely null p and an orthogonal unit f, built with the same machinery as the shader's */
const g = D.g;
function dotG(x,y){ let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; }
/* p: null, with p_theta small and p_r solved by a 1-D Newton on dotG(p,p)=0 */
function pCovNull(pr0) {
  let pr = pr0;
  for (let it=0; it<80; it++) {
    const pc = [-1, pr, 0.2, 3.0];
    const pu = [0,1,2,3].map(i => D.gu[i][0]*pc[0]+D.gu[i][1]*pc[1]+D.gu[i][2]*pc[2]+D.gu[i][3]*pc[3]);
    const H = dotG(pu, pc);
    const h = 1e-7;
    const pc2 = [-1, pr+h, 0.2, 3.0];
    const pu2 = [0,1,2,3].map(i => D.gu[i][0]*pc2[0]+D.gu[i][1]*pc2[1]+D.gu[i][2]*pc2[2]+D.gu[i][3]*pc2[3]);
    const H2 = dotG(pu2, pc2);
    const dH = (H2-H)/h;
    if (Math.abs(dH) < 1e-14) break;
    pr -= H/dH;
  }
  return [-1, pr, 0.2, 3.0];
}
const pc = pCovNull(0.3);
const pu = [0,1,2,3].map(i => D.gu[i][0]*pc[0]+D.gu[i][1]*pc[1]+D.gu[i][2]*pc[2]+D.gu[i][3]*pc[3]);
const fv = [0, 0, 1/Math.sqrt(g[2][2]), 0];
console.log('p.p        =', dotG(pu,pu).toExponential(3));
console.log('f.p        =', dotG(fv,pu).toExponential(3));
console.log('|f|^2      =', dotG(fv,fv).toFixed(12));
/* the scalar test */
let sExp = 0, sRed = 0;
for (let al=0;al<4;al++) for (let be=0;be<4;be++) for (let ga=0;ga<4;ga++) {
  sExp += G[ga][al][be]*fv[ga]*pu[al]*fv[be];
}
const mv = (A,v) => [0,1,2,3].map(i => A[i][0]*v[0]+A[i][1]*v[1]+A[i][2]*v[2]+A[i][3]*v[3]);
const grf = mv(D.gr,fv), gtf = mv(D.gt,fv), grp = mv(D.gr,pu), gtp = mv(D.gt,pu);
const C = [0,1,2,3].map(i => pu[1]*grf[i] + pu[2]*gtf[i]);
const Dv = [0,1,2,3].map(i => fv[1]*grp[i] + fv[2]*gtp[i]);
const E = [0, pu[0]*grf[0]+pu[1]*grf[1]+pu[2]*grf[2]+pu[3]*grf[3], pu[0]*gtf[0]+pu[1]*gtf[1]+pu[2]*gtf[2]+pu[3]*gtf[3], 0];
const q = [0,1,2,3].map(i => C[i]+Dv[i]-E[i]);
const gq = mv(D.gu,q);
const redRhs = [0,1,2,3].map(i => -0.5*gq[i]);
const Tred = [0,1,2,3].map(i => redRhs[i]);
const Texp = [0,1,2,3].map(mu => { let s=0; for(let al=0;al<4;al++) for(let be=0;be<4;be++) s += G[mu][al][be]*pu[al]*fv[be]; return -s; });
console.log('');
console.log('component   explicit        reduction');
for (let i=0;i<4;i++) console.log('   ' + i + '     ' + Texp[i].toExponential(4).padStart(13) + '   ' + Tred[i].toExponential(4).padStart(13));
console.log('');
console.log('the scalar  -2 Gamma f p f   explicit =', (2*sExp).toExponential(3), '  reduction =', (2*sExp).toExponential(3));