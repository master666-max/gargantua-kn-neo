/* bisect: does the reduction match the explicit contraction for a DIAGONAL metric (a = 0)? */
const M = 1, Q = 0;
function build(a) {
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
  return { deriv, gamma };
}
const mv = (A,v) => [0,1,2,3].map(i => A[i][0]*v[0]+A[i][1]*v[1]+A[i][2]*v[2]+A[i][3]*v[3]);
const dot = (x,y) => x[0]*y[0]+x[1]*y[1]+x[2]*y[2]+x[3]*y[3];
for (const a of [0.0, 0.86]) {
  const { deriv, gamma } = build(a);
  const r = 8.0, th = 1.2;
  const { D, G } = gamma(r, th);
  const p = mv(D.gu, [-1, 0.3, 0.2, 3.0]);
  const fv = [0, 0, 1/Math.sqrt(D.g[2][2]), 0];
  const Texp = [0,1,2,3].map(mu => { let s=0; for(let al=0;al<4;al++) for(let be=0;be<4;be++) s += G[mu][al][be]*p[al]*fv[be]; return -s; });
  const grf = mv(D.gr,fv), gtf = mv(D.gt,fv), grp = mv(D.gr,p), gtp = mv(D.gt,p);
  const C = [0,1,2,3].map(i => p[1]*grf[i] + p[2]*gtf[i]);
  const Dv = [0,1,2,3].map(i => fv[1]*grp[i] + fv[2]*gtp[i]);
  const E = [0, dot(p,grf), dot(p,gtf), 0];
  const q = [0,1,2,3].map(i => C[i]+Dv[i]-E[i]);
  const Tred = mv(D.gu,q).map(x => -0.5*x);
  let mx = 0; for (let i=0;i<4;i++) mx = Math.max(mx, Math.abs(Tred[i]-Texp[i])/Math.max(Math.abs(Texp[i]),1e-30));
  console.log('a = ' + a + '   max relative difference reduction vs explicit = ' + (mx*100).toExponential(3) + '%');
  for (let i=0;i<4;i++) console.log('     comp ' + i + '  explicit ' + Texp[i].toExponential(4).padStart(13) + '   reduction ' + Tred[i].toExponential(4).padStart(13));
}