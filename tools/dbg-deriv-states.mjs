import { metric, christoffel } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
/* analytic derivatives, transcribed EXACTLY as the GLSL knMetricDR does */
function analytic(r, th) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2 = s*s, c2 = c*c, sc = s*c;
  const r2 = r*r, a2 = a*a;
  const Sig = r2 + a2*c2;
  const Del = r2 - 2*M*r + a2 + Q*Q;
  const f = 2*M*r - Q*Q;
  const Sr = 2*r, St = -2*a2*sc;
  const Dr = 2*r - 2*M, Dt = 0;
  const fr = 2*M, ft = 0;
  const Ar = 2*r*Sig + (r2+a2)*Sr + fr*a2*s2;
  const At = (r2+a2)*St + f*2*a2*sc;
  const Sig2 = Sig*Sig, Del2 = Del*Del;
  const gr = []; for (let i=0;i<4;i++){ gr.push([0,0,0,0]); }
  const gt = []; for (let i=0;i<4;i++){ gt.push([0,0,0,0]); }
  gr[0][0] = (fr*Sig - f*Sr)/Sig2;
  gt[0][0] = (ft*Sig - f*St)/Sig2;
  gr[0][3] = gr[3][0] = -a*((fr*s2)*Sig - f*s2*Sr)/Sig2;
  gt[0][3] = gt[3][0] = -a*((ft*s2 + f*2*sc)*Sig - f*s2*St)/Sig2;
  gr[1][1] = (Sr*Del - Sig*Dr)/Del2;
  gt[1][1] = (St*Del - Sig*Dt)/Del2;
  return { gr, gt, Ar, At };
}
/* numerical derivative of g, same central difference the JS christoffel uses */
function fd(r, th) {
  const eps = 1e-5;
  const gr = [], gt = [];
  for (let i=0;i<4;i++){ gr.push([0,0,0,0]); gt.push([0,0,0,0]); }
  const hr = eps*Math.max(1, Math.abs(r)), ht = eps;
  const gp = metric(r+hr, th, M, a, Q).g, gm = metric(r-hr, th, M, a, Q).g;
  const tp = metric(r, th+ht, M, a, Q).g, tm = metric(r, th-ht, M, a, Q).g;
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) { gr[i][j] = (gp[i][j]-gm[i][j])/(2*hr); gt[i][j] = (tp[i][j]-tm[i][j])/(2*ht); }
  return { gr, gt };
}
const states = [[6,1.2],[6,Math.PI/2],[12,0.7],[14.6,1.74],[18.2,2.90],[11,1.74]];
console.log('state            max|dgr|rel   max|dgt|rel   worst component');
for (const [r,th] of states) {
  const A = analytic(r,th), F = fd(r,th);
  let mr = 0, mt = 0, wr = '', wt = '';
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
    const dr = Math.abs(A.gr[i][j]-F.gr[i][j])/Math.max(Math.abs(F.gr[i][j]),1e-9);
    const dt = Math.abs(A.gt[i][j]-F.gt[i][j])/Math.max(Math.abs(F.gt[i][j]),1e-9);
    if (dr>mr){mr=dr;wr='gr['+i+']['+j+']';} if (dt>mt){mt=dt;wt='gt['+i+']['+j+']';}
  }
  console.log(String(r).padStart(5)+' '+String(th).padStart(5)+'  '+(mr*100).toExponential(2).padStart(12)+'%  '+(mt*100).toExponential(2).padStart(12)+'%   '+wr+' / '+wt);
}