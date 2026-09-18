import { metric, metricUp } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
/* Rebuild the SHADER's analytic derivatives and inverse, exactly as knMetricDR does, then form the
   connection the shader's reduction contracts against, and test the definition of metric
   compatibility:  d_sigma g_{mu nu} = Gamma^rho_{sigma mu} g_{rho nu} + Gamma^rho_{sigma nu} g_{mu rho}. */
function deriv(r, th) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2=s*s, c2=c*c, sc=s*c, r2=r*r, a2=a*a;
  const Sig=r2+a2*c2, Del=r2-2*M*r+a2+Q*Q, f=2*M*r-Q*Q;
  const A=(r2+a2)*Sig + f*a2*s2;
  const Sr=2*r, St=-2*a2*sc, Dr=2*r-2*M, Dt=0, fr=2*M, ft=0;
  const Ar=2*r*Sig+(r2+a2)*Sr+fr*a2*s2, At=(r2+a2)*St+f*2*a2*sc;
  const S2=Sig*Sig, D2=Del*Del;
  const g=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gr=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gt=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gu=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
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
/* Gamma^rho_{sigma mu} = 1/2 gu^rho nu ( d_sigma g_{nu mu} + d_mu g_{nu sigma} - d_nu g_{sigma mu} )
   with d_sigma meaning d/dr or d/dth.  Build all four sigma entries and test compatibility. */
function gammaAt(r, th) {
  const D = deriv(r, th);
  const dg = [D.gr, D.gt, null, null];   /* sigma = r, th have derivatives; t and phi are Killing */
  const G = [];
  for (let rho=0; rho<4; rho++) { G.push([]); for (let sg=0; sg<4; sg++) { G[rho].push([]); for (let mu=0; mu<4; mu++) {
    let acc = 0;
    for (let nu=0; nu<4; nu++) {
      const ds = dg[sg] ? dg[sg][nu][mu] : 0;
      const dm = dg[mu] ? dg[mu][nu][sg] : 0;
      const dn = dg[nu] ? dg[nu][sg][mu] : 0;
      acc += D.gu[rho][nu] * (ds + dm - dn);
    }
    G[rho][sg].push(0.5*acc);
  } } }
  return { D, G };
}
const states=[[6,1.2],[12,0.7],[14.6,1.74],[11,1.74],[3.8,1.74],[18.2,2.9]];
console.log('   r     th    max compatibility residual (rel)');
for (const [r,th] of states) {
  const { D, G } = gammaAt(r, th);
  let mx = 0, worst='';
  for (let sg=2; sg<4; sg++) for (let mu=0; mu<4; mu++) for (let nu=0; nu<4; nu++) {
    /* d_sigma g_{mu nu} = 0 for sigma = t, phi (Killing) */
    if (sg>=2) continue;
    const d = (sg===0 ? D.gr[mu][nu] : D.gt[mu][nu]);
    let rhs = 0;
    for (let rho=0; rho<4; rho++) rhs += G[rho][sg][mu]*D.g[rho][nu] + G[rho][sg][nu]*D.g[mu][rho];
    const rel = Math.abs(d - rhs)/Math.max(Math.abs(d), 1e-9);
    if (rel>mx) { mx=rel; worst='d'+(sg===0?'r':'th')+'g['+mu+']['+nu+']'; }
  }
  console.log(String(r).padStart(6)+String(th).padStart(7)+'   '+(mx*100).toExponential(2).padStart(12)+'%   '+worst);
}