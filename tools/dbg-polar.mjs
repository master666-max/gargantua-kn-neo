import { metric, metricUp, momentumUp, solveNullPr, zamo, polFromField, unitise, tracePolarised, hamiltonian } from '../js/polar.js';
const M=1,a=0.86,Q=0,r0=12,th0=Math.PI/2,pth0=0.05,E=1,L=4;
const pr0 = solveNullPr(r0,th0,M,a,Q,pth0,E,L,+1);
const pu = momentumUp(r0,th0,M,a,Q,pr0,pth0,E,L);
const u = zamo(r0,th0,M,a,Q);
const f0 = unitise(polFromField(pu, u, [0,1,0,0], r0,th0,M,a,Q), r0,th0,M,a,Q);
console.log('initial f  ', f0.map(v=>v.toExponential(4)).join('  '));
const rows=[];
const t = tracePolarised({ M,a,Q,r0,th0,pr0,pth0,E,L,f0,steps:4000,h:0.02, onStep:(s)=>{ if (s.i % 400 === 0) rows.push(s); } });
for (const s of rows) {
  const g = metric(s.r, s.th, M,a,Q).g;
  const dot=(uu,vv)=>{let sum=0;for(let i=0;i<4;i++)for(let j=0;j<4;j++)sum+=g[i][j]*uu[i]*vv[j];return sum;};
  const pu2 = momentumUp(s.r,s.th,M,a,Q,s.pr,s.pth,E,L);
  const H = hamiltonian(s.r,s.th,M,a,Q,s.pr,s.pth,E,L);
  console.log('lam ' + s.lam.toFixed(1).padStart(5) + '  r ' + s.r.toFixed(2).padStart(8) + '  H ' + H.toExponential(2) + '  |f|2 ' + dot(s.f,s.f).toExponential(2) + '  f.dp ' + dot(s.f,[0,0,0,1]).toExponential(2) + '  f.p ' + dot(s.f,pu2).toExponential(2) + '  f ' + s.f.map(v=>v.toExponential(2)).join(' '));
}
console.log('');
console.log('final worst: norm', t.worstNorm.toExponential(3), ' orth', t.worstOrth.toExponential(3), ' ft', t.worstFt.toExponential(3), ' fp', t.worstFp.toExponential(3));