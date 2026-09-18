import { metric } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
function analytic(r, th) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2 = s*s, c2 = c*c, sc = s*c;
  const r2 = r*r, a2 = a*a;
  const Sig = r2 + a2*c2, Del = r2 - 2*M*r + a2 + Q*Q, f = 2*M*r - Q*Q;
  const A = (r2+a2)*Sig + f*a2*s2;
  const Sr = 2*r, St = -2*a2*sc, Dr = 2*r-2*M, Dt = 0, fr = 2*M, ft = 0;
  const Ar = 2*r*Sig + (r2+a2)*Sr + fr*a2*s2, At = (r2+a2)*St + f*2*a2*sc;
  const S2 = Sig*Sig, D2 = Del*Del;
  const gr = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gt = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], g = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  g[0][0] = -1 + f/Sig;
  gr[0][0] = (fr*Sig - f*Sr)/S2;  gt[0][0] = (ft*Sig - f*St)/S2;
  g[0][3] = g[3][0] = -f*a*s2/Sig;
  gr[0][3] = gr[3][0] = -a*((fr*s2)*Sig - f*s2*Sr)/S2;
  gt[0][3] = gt[3][0] = -a*((ft*s2 + f*2*sc)*Sig - f*s2*St)/S2;
  g[1][1] = Sig/Del; gr[1][1] = (Sr*Del - Sig*Dr)/D2; gt[1][1] = (St*Del - Sig*Dt)/D2;
  g[2][2] = Sig; gr[2][2] = Sr; gt[2][2] = St;
  g[3][3] = A*s2/Sig;
  gr[3][3] = (Ar*s2*Sig - A*s2*Sr)/S2;
  gt[3][3] = ((At*s2 + A*2*sc)*Sig - A*s2*St)/S2;
  return { gr, gt };
}
function fd(r, th) {
  const eps = 1e-5, hr = eps*Math.max(1, Math.abs(r)), ht = eps;
  const gr = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gt = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const gp = metric(r+hr, th, M, a, Q).g, gm = metric(r-hr, th, M, a, Q).g;
  const tp = metric(r, th+ht, M, a, Q).g, tm = metric(r, th-ht, M, a, Q).g;
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) { gr[i][j] = (gp[i][j]-gm[i][j])/(2*hr); gt[i][j] = (tp[i][j]-tm[i][j])/(2*ht); }
  return { gr, gt };
}
const states = [[6,1.2],[12,0.7],[14.6,1.74],[18.2,2.90],[11,1.74]];
console.log('   r     th     worst gr rel     worst gt rel    component');
for (const [r,th] of states) {
  const A = analytic(r,th), F = fd(r,th);
  let mr=0, mt=0, w='';
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
    const dr = Math.abs(A.gr[i][j]-F.gr[i][j])/Math.max(Math.abs(F.gr[i][j]),1e-9);
    const dt = Math.abs(A.gt[i][j]-F.gt[i][j])/Math.max(Math.abs(F.gt[i][j]),1e-9);
    if (dr>mr) mr=dr; if (dt>mt){mt=dt; w='gt['+i+']['+j+'] analytic '+A.gt[i][j].toExponential(3)+' fd '+F.gt[i][j].toExponential(3);}
  }
  console.log(String(r).padStart(6)+String(th).padStart(7)+'  '+(mr*100).toExponential(2).padStart(12)+'%  '+(mt*100).toExponential(2).padStart(12)+'%   '+w);
}