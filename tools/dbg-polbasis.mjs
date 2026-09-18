import { metric, momentumUp, solveNullPr, zamo, polFromField, unitise, tracePolarised } from '../js/polar.js';
const M=1,a=0.5,Q=0,r=12,th=1.4;
const pu = momentumUp(r, th, M, a, Q, -0.4, 0.3, 1, 3);
const g = metric(r, th, M, a, Q).g;
const dot=(x,y)=>{let s=0;for(let i=0;i<4;i++)for(let j=0;j<4;j++)s+=g[i][j]*x[i]*y[j];return s;};
const s2=Math.sin(th)**2;
const eA=[0,0,0,1/Math.sqrt(g[3][3])];      /* +alpha = +phi hat */
const eB=[0,0,-1/Math.sqrt(g[2][2]),0];     /* +beta  = -theta hat */
const u=zamo(r,th,M,a,Q);
const fA=unitise(polFromField(pu,u,eB,r,th,M,a,Q),r,th,M,a,Q);   /* E along alpha */
const fB=unitise(polFromField(pu,u,eA,r,th,M,a,Q),r,th,M,a,Q);   /* E along beta  */
console.log('fA.p     ', dot(fA,pu).toExponential(2), ' (must be 0)');
console.log('fB.p     ', dot(fB,pu).toExponential(2), ' (must be 0)');
console.log('fA.fA    ', dot(fA,fA).toExponential(6));
console.log('fB.fB    ', dot(fB,fB).toExponential(6));
console.log('fA.fB    ', dot(fA,fB).toExponential(2), ' (must be 0)');
console.log('fA.eAlpha', dot(fA,eA).toExponential(2), ' (must be 0)');
console.log('fB.eAlpha', dot(fB,eA).toExponential(2), ' (must be nonzero)');
let rec=null, prev=null;
const tr = tracePolarised({ M,a,Q,r0:r,th0:th,pr0:-0.4,pth0:0.3,E:1,L:3,f0:fA,fList:[fB],steps:400,h:0.05,
  onStep:(st)=>{ if (st.th>Math.PI/2 && !rec && prev) { const t2=(Math.PI/2-prev.th)/(st.th-prev.th); rec={r:prev.r+t2*(st.r-prev.r), extras:st.extras, f:st.f}; } prev={r:st.r,th:st.th}; } });
console.log('transport ran, worst |f|^2 deviation', tr.worstNorm.toExponential(2));
if (rec) {
  const g2=metric(rec.r, Math.PI/2, M,a,Q).g;
  const d2=(x,y)=>{let s=0;for(let i=0;i<4;i++)for(let j=0;j<4;j++)s+=g2[i][j]*x[i]*y[j];return s;};
  console.log('at the source: |fA|=', Math.sqrt(d2(rec.f,rec.f)).toFixed(6), ' |fB|=', Math.sqrt(d2(rec.extras[0],rec.extras[0])).toFixed(6), ' fA.fB=', d2(rec.f,rec.extras[0]).toExponential(2));
}