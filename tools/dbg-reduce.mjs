import { metric, christoffel, transportRhs, metricUp } from '../js/polar.js';
import { readFileSync } from 'node:fs';
/* reuse the analytic derivative code by importing the debug module's function is not exported, so
   recompute it here compactly */
function an(r, th, M, a, Q) {
  const s=Math.sin(th), c=Math.cos(th), s2=s*s, c2=c*c, sc=s*c, r2=r*r, a2=a*a;
  const Sig=r2+a2*c2, Del=r2-2*M*r+a2+Q*Q, f=2*M*r-Q*Q, A=(r2+a2)*Sig+f*a2*s2;
  const Sr=2*r, St=-2*a2*sc, Dr=2*r-2*M, Dt=0, fr=2*M;
  const Ar=2*r*Sig+(r2+a2)*Sr+fr*a2*s2, At=(r2+a2)*St+f*2*a2*sc;
  const S2=Sig*Sig, D2=Del*Del;
  const g=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gr=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gt=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  g[0][0]=-1+f/Sig; gr[0][0]=(fr*Sig-f*Sr)/S2; gt[0][0]=(-f*St)/S2;
  g[0][3]=g[3][0]=-f*a*s2/Sig; gr[0][3]=gr[3][0]=-a*((fr*s2)*Sig-f*s2*Sr)/S2;
  gt[0][3]=gt[3][0]=-a*((f*2*sc)*Sig-f*s2*St)/S2;
  g[1][1]=Sig/Del; gr[1][1]=(Sr*Del-Sig*Dr)/D2; gt[1][1]=(St*Del)/D2;
  g[2][2]=Sig; gr[2][2]=Sr; gt[2][2]=St;
  g[3][3]=A*s2/Sig; gr[3][3]=(Ar*s2*Sig-A*s2*Sr)/S2; gt[3][3]=((At*s2+A*2*sc)*Sig-A*s2*St)/S2;
  return { g, gr, gt };
}
function mv(m,v){const o=[0,0,0,0];for(let i=0;i<4;i++){let s=0;for(let j=0;j<4;j++)s+=m[i][j]*v[j];o[i]=s;}return o;}
function gammaFromAnalytic(r,th,M,a,Q){
  const { gr, gt } = an(r,th,M,a,Q);
  const { gu } = metricUp(r,th,M,a,Q);
  const D=[gr,gt,null,null];   /* d_sig g, sigma=0,3 are zero; use null to mark */
  const G=[];
  for(let mu=0;mu<4;mu++){G.push([]);for(let al=0;al<4;al++){G[mu].push(new Array(4).fill(0));
    for(let be=0;be<4;be++){let acc=0;
      for(let sig=0;sig<4;sig++){
        const dA=(al===1)?gr[sig][be]:((al===2)?gt[sig][be]:0);
        const dB=(be===1)?gr[sig][al]:((be===2)?gt[sig][al]:0);
        const dC=(sig===1)?gr[al][be]:((sig===2)?gt[al][be]:0);
        acc+=gu[mu][sig]*(dA+dB-dC);}
      G[mu][al][be]=0.5*acc;}}}
  return G;
}
const cases=[[6,1.2,1,0.5,0.0,[0,0.3,0.4,2.0],[0,0.5,0.7,0.1]],[6,1.5708,1,0.86,0.0,[-1,0.2,0.1,3.0],[0,0.1,0.9,0.0]],
             [12,0.7,1,0.5,0.6,[-1,0.05,0.2,4.0],[0,0.3,0.5,0.2]]];
for (const [r,th,M,a,Q,p,fv] of cases) {
  const G = gammaFromAnalytic(r,th,M,a,Q);
  const explicit=[0,0,0,0];
  for(let mu=0;mu<4;mu++){let s=0;for(let al=0;al<4;al++)for(let be=0;be<4;be++)s+=G[mu][al][be]*p[al]*fv[be];explicit[mu]=-s;}
  const fd = transportRhs(r,th,M,a,Q,p,fv);
  const { gr, gt } = an(r,th,M,a,Q);
  const { gu } = metricUp(r,th,M,a,Q);
  const grf=mv(gr,fv), gtf=mv(gt,fv), grp=mv(gr,p), gtp=mv(gt,p);
  const C_=[0,1,2,3].map(i=>p[0]*grf[i]+p[1]*gtf[i]);
  const D_=[0,1,2,3].map(i=>fv[0]*grp[i]+fv[1]*gtp[i]);
  const Er=p[0]*grf[0]+p[1]*grf[1]+p[2]*grf[2]+p[3]*grf[3];
  const Et=p[0]*gtf[0]+p[1]*gtf[1]+p[2]*gtf[2]+p[3]*gtf[3];
  /* E is indexed by sigma = (t, r, theta, phi): only r and theta are nonzero, so it is
     [0, Er, Et, 0] -- the first version put Er at the t position. */
  const Esig=[0,Er,Et,0];
  const q=[0,1,2,3].map(i=>C_[i]+D_[i]-Esig[i]);
  const reduced=mv(gu,q).map(v=>-0.5*v);
  const rel=(x,y)=>{let n=0,d=0;for(let i=0;i<4;i++){n=Math.max(n,Math.abs(x[i]-y[i]));d=Math.max(d,Math.abs(y[i]));}return n/Math.max(d,1e-30);};
  console.log('r='+r+' th='+th+'  explicitGamma vs FD: '+rel(explicit,fd).toExponential(3)+'   reduced vs explicitGamma: '+rel(reduced,explicit).toExponential(3));
}