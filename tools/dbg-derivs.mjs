/* Is the analytic metric derivative right, independently of any contraction algebra? */
import { metric } from '../js/polar.js';
function anDR(r, th, M, a, Q) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2 = s*s, c2 = c*c, sc = s*c, r2 = r*r, a2 = a*a;
  const Sig = r2 + a2*c2;
  const Del = r2 - 2*M*r + a2 + Q*Q;
  const f = 2*M*r - Q*Q;
  const A = (r2 + a2)*Sig + f*a2*s2;
  const Sr = 2*r, St = -2*a2*sc;
  const Dr = 2*r - 2*M, Dt = 0;
  const fr = 2*M, ft = 0;
  const Ar = 2*r*Sig + (r2+a2)*Sr + fr*a2*s2;
  const At = (r2+a2)*St + f*2*a2*sc;
  const Sig2 = Sig*Sig, Del2 = Del*Del;
  const g = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gr = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], gt = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  g[0][0] = -1 + f/Sig; gr[0][0] = (fr*Sig - f*Sr)/Sig2; gt[0][0] = (ft*Sig - f*St)/Sig2;
  g[0][3] = g[3][0] = -f*a*s2/Sig;
  gr[0][3] = gr[3][0] = -a*((fr*s2)*Sig - f*s2*Sr)/Sig2;
  gt[0][3] = gt[3][0] = -a*((ft*s2 + f*2*sc)*Sig - f*s2*St)/Sig2;
  g[1][1] = Sig/Del; gr[1][1] = (Sr*Del - Sig*Dr)/Del2; gt[1][1] = (St*Del - Sig*Dt)/Del2;
  g[2][2] = Sig; gr[2][2] = Sr; gt[2][2] = St;
  g[3][3] = A*s2/Sig; gr[3][3] = (Ar*s2*Sig - A*s2*Sr)/Sig2; gt[3][3] = ((At*s2 + A*2*sc)*Sig - A*s2*St)/Sig2;
  return { g, gr, gt };
}
const cases = [[6,1.2,1,0.5,0.0],[6,1.5708,1,0.86,0.0],[12,0.7,1,0.5,0.6],[3,0.3,1,0.3,0.2]];
console.log('  r      th      max |analytic dr - FD dr| / |FD|     max |analytic dth - FD dth| / |FD|');
for (const [r,th,M,a,Q] of cases) {
  const { gr, gt } = anDR(r,th,M,a,Q);
  const h = 1e-6*Math.max(1,Math.abs(r));
  const gp = metric(r+h,th,M,a,Q).g, gm = metric(r-h,th,M,a,Q).g;
  const tp = metric(r,th+h,M,a,Q).g, tm = metric(r,th-h,M,a,Q).g;
  let wr = 0, wt = 0, dr0 = 0, dt0 = 0;
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
    const fdR = (gp[i][j]-gm[i][j])/(2*h), fdT = (tp[i][j]-tm[i][j])/(2*h);
    dr0 = Math.max(dr0, Math.abs(fdR)); dt0 = Math.max(dt0, Math.abs(fdT));
    wr = Math.max(wr, Math.abs(gr[i][j]-fdR)); wt = Math.max(wt, Math.abs(gt[i][j]-fdT));
  }
  console.log('  ' + String(r).padStart(3) + '  ' + String(th).padStart(7) + '   ' + (wr/Math.max(dr0,1e-30)).toExponential(3).padStart(12) + '                      ' + (wt/Math.max(dt0,1e-30)).toExponential(3));
}