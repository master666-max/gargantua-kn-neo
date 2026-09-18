import { metricUp, transportRhs } from '../js/polar.js';
function an(r, th, M, a, Q) {
  const s=Math.sin(th), c=Math.cos(th), s2=s*s, c2=c*c, sc=s*c, r2=r*r, a2=a*a;
  const Sig=r2+a2*c2, Del=r2-2*M*r+a2+Q*Q, f=2*M*r-Q*Q, A=(r2+a2)*Sig+f*a2*s2;
  const Sr=2*r, St=-2*a2*sc, Dr=2*r-2*M, fr=2*M;
  const Ar=2*r*Sig+(r2+a2)*Sr+fr*a2*s2, At=(r2+a2)*St+f*2*a2*sc;
  const S2=Sig*Sig, D2=Del*Del;
  const gr=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gt=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  gr[0][0]=(fr*Sig-f*Sr)/S2; gt[0][0]=(-f*St)/S2;
  gr[0][3]=gr[3][0]=-a*((fr*s2)*Sig-f*s2*Sr)/S2; gt[0][3]=gt[3][0]=-a*((f*2*sc)*Sig-f*s2*St)/S2;
  gr[1][1]=(Sr*Del-Sig*Dr)/D2; gt[1][1]=(St*Del)/D2;
  gr[2][2]=Sr; gt[2][2]=St;
  gr[3][3]=(Ar*s2*Sig-A*s2*Sr)/S2; gt[3][3]=((At*s2+A*2*sc)*Sig-A*s2*St)/S2;
  return { gr, gt };
}
function mv(m,v){const o=[0,0,0,0];for(let i=0;i<4;i++){let s=0;for(let j=0;j<4;j++)s+=m[i][j]*v[j];o[i]=s;}return o;}
function mT(m){const o=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)o[j][i]=m[i][j];return o;}
const cases=[[6,1.2,1,0.5,0.0,[0,0.3,0.4,2.0],[0,0.5,0.7,0.1]],[6,1.5708,1,0.86,0.0,[-1,0.2,0.1,3.0],[0,0.1,0.9,0.0]],[12,0.7,1,0.5,0.6,[-1,0.05,0.2,4.0],[0,0.3,0.5,0.2]]];
const rel=(x,y)=>{let n=0,d=0;for(let i=0;i<4;i++){n=Math.max(n,Math.abs(x[i]-y[i]));d=Math.max(d,Math.abs(y[i]));}return n/Math.max(d,1e-30);};
const variants = {
  'C+D-E': (G) => { const {grf,gtf,grp,gtp,Er,Et,p,fv}=G; const C=[0,1,2,3].map(i=>p[0]*grf[i]+p[1]*gtf[i]); const D=[0,1,2,3].map(i=>fv[0]*grp[i]+fv[1]*gtp[i]); const E=[0,Er,Et,0]; return [0,1,2,3].map(i=>-0.5*(C[i]+D[i]-E[i])); },
  'C+D (no E)': (G) => { const {grf,gtf,grp,gtp,p,fv}=G; const C=[0,1,2,3].map(i=>p[0]*grf[i]+p[1]*gtf[i]); const D=[0,1,2,3].map(i=>fv[0]*grp[i]+fv[1]*gtp[i]); return [0,1,2,3].map(i=>-0.5*(C[i]+D[i])); },
  '2C-E': (G) => { const {grf,gtf,Er,Et,p}=G; const C=[0,1,2,3].map(i=>p[0]*grf[i]+p[1]*gtf[i]); const E=[0,Er,Et,0]; return [0,1,2,3].map(i=>-0.5*(2*C[i]-E[i])); },
  '2C': (G) => { const {grf,gtf,p}=G; const C=[0,1,2,3].map(i=>p[0]*grf[i]+p[1]*gtf[i]); return [0,1,2,3].map(i=>-C[i]); },
  /* THE CANDIDATE: p is (p^t, p^r, p^th, p^phi), so p^r is component 1 and p^th is component 2.
     All the earlier variants used components 0 and 1, i.e. p^t and p^r -- a plain index error
     that no amount of re-deriving the algebra would have fixed. */
  'C+D-E idx fixed': (G) => { const {grf,gtf,grp,gtp,Er,Et,p,fv}=G; const C=[0,1,2,3].map(i=>p[1]*grf[i]+p[2]*gtf[i]); const D=[0,1,2,3].map(i=>fv[1]*grp[i]+fv[2]*gtp[i]); const E=[0,Er,Et,0]; return [0,1,2,3].map(i=>-0.5*(C[i]+D[i]-E[i])); },
  'C+D+E': (G) => { const {grf,gtf,grp,gtp,Er,Et,p,fv}=G; const C=[0,1,2,3].map(i=>p[0]*grf[i]+p[1]*gtf[i]); const D=[0,1,2,3].map(i=>fv[0]*grp[i]+fv[1]*gtp[i]); const E=[0,Er,Et,0]; return [0,1,2,3].map(i=>-0.5*(C[i]+D[i]+E[i])); },
};
console.log('   case          ' + Object.keys(variants).map(k=>k.padStart(12)).join(''));
for (const [r,th,M,a,Q,p,fv] of cases) {
  const { gr, gt } = an(r,th,M,a,Q);
  const { gu } = metricUp(r,th,M,a,Q);
  const grf=mv(gr,fv), gtf=mv(gt,fv), grp=mv(gr,p), gtp=mv(gt,p);
  const Er=p[0]*grf[0]+p[1]*grf[1]+p[2]*grf[2]+p[3]*grf[3];
  const Et=p[0]*gtf[0]+p[1]*gtf[1]+p[2]*gtf[2]+p[3]*gtf[3];
  const G={grf,gtf,grp,gtp,Er,Et,p,fv};
  const fd = transportRhs(r,th,M,a,Q,p,fv);
  let line = '  r='+String(r).padStart(2)+' th='+String(th).padStart(7)+'  ';
  for (const k of Object.keys(variants)) { const v = mv(gu, variants[k](G)); line += rel(v,fd).toExponential(1).padStart(12); }
  console.log(line);
}