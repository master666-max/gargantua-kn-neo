import { metricUp, metric, momentumUp } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
/* gu exactly as the GLSL knMetricDR builds it */
function guGLSL(r, th) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2 = s*s, c2 = c*c;
  const r2 = r*r, a2 = a*a;
  const Sig = r2 + a2*c2, Del = r2 - 2*M*r + a2 + Q*Q, f = 2*M*r - Q*Q;
  const A = (r2+a2)*Sig + f*a2*s2;
  const s2n = Math.max(s2, 1e-9);
  const gu = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  gu[0][0] = -A/(Sig*Del);
  gu[0][3] = gu[3][0] = -f*a/(Sig*Del);
  gu[1][1] = Del/Sig;
  gu[2][2] = 1/Sig;
  gu[3][3] = (Del - a2*s2n)/(Sig*Del*s2n);
  return gu;
}
const states = [[6,1.2],[12,0.7],[14.6,1.74],[18.2,2.90],[11,1.74]];
console.log('   r     th    worst gu rel     pUp worst rel   component');
for (const [r,th] of states) {
  const A1 = guGLSL(r,th), A2 = metricUp(r,th,M,a,Q).gu;
  let mg = 0, wp = '', pu = 0;
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) { const d = Math.abs(A1[i][j]-A2[i][j])/Math.max(Math.abs(A2[i][j]),1e-12); if (d>mg){mg=d; wp='gu['+i+']['+j+'] glsl '+A1[i][j].toExponential(4)+' js '+A2[i][j].toExponential(4);} }
  const p1 = [0,1,2,3].map(i => A1[i][0]*(-1)+A1[i][1]*0.3+A1[i][2]*0.2+A1[i][3]*3);
  const p2 = momentumUp(r,th,M,a,Q,0.3,0.2,1.0,3.0);
  for (let i=0;i<4;i++) pu = Math.max(pu, Math.abs(p1[i]-p2[i])/Math.max(Math.abs(p2[i]),1e-12));
  console.log(String(r).padStart(6)+String(th).padStart(7)+'  '+(mg*100).toExponential(2).padStart(12)+'%  '+(pu*100).toExponential(2).padStart(12)+'%   '+wp);
}