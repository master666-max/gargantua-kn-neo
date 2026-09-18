import { metric, metricUp, christoffel, transportRhs } from '../js/polar.js';
/* FLAT SPACE (M=0, a=0, Q=0) in spherical coordinates, radial null geodesic. */
const M = 0, a = 0, Q = 0;
const r0 = 10.0, th0 = 1.0;
const g = metric(r0, th0, M, a, Q).g;
const gu = metricUp(r0, th0, M, a, Q).gu;
const pCov = [-1.0, 1.0, 0.0, 0.0];   /* radial null: p_t = -1, p_r = +1 */
const p = [0,1,2,3].map(i => gu[i][0]*pCov[0]+gu[i][1]*pCov[1]+gu[i][2]*pCov[2]+gu[i][3]*pCov[3]);
const dotG = (x,y) => { let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
console.log('flat space: g = diag(' + [0,1,2,3].map(i=>g[i][i].toFixed(4)).join(', ') + ')');
console.log('p = [' + p.map(x=>x.toFixed(4)).join(', ') + ']   p.p = ' + dotG(p,p).toExponential(3));
let f = [0, 0, 1/r0, 0];
console.log('f^theta = ' + f[2].toFixed(8) + '   |f|^2 = ' + dotG(f,f).toFixed(12));
console.log('');
console.log('exact solution: f^theta = 1/r, so |f|^2 = r^2 * (1/r)^2 = 1 for all lambda.');
console.log('');
console.log('   step      r_final      f^theta          r * f^theta        |f|^2');
let r = r0; f = [0,0,1/r0,0];
const ds = 0.01;
for (let k = 1; k <= 400; k++) {
  f = (function(fv, dsv){
    const k1 = transportRhs(r, th0, M, a, Q, p, fv);
    const ad = (x,kk,c) => [0,1,2,3].map(i => x[i] + c*dsv*kk[i]);
    const k2 = transportRhs(r, th0, M, a, Q, p, ad(fv,k1,0.5));
    const k3 = transportRhs(r, th0, M, a, Q, p, ad(fv,k2,0.5));
    const k4 = transportRhs(r, th0, M, a, Q, p, ad(fv,k3,1.0));
    return [0,1,2,3].map(i => fv[i] + (dsv/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
  })(f, ds);
  r += p[1]*ds;   /* dr/dlambda = p^r */
  if (k % 100 === 0) {
    const gg = metric(r, th0, M, a, Q).g;
    const n2 = (function(){ let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += gg[i][j]*f[i]*f[j]; return s; })();
    console.log('   ' + String(k*ds).padStart(6) + '     ' + r.toFixed(4).padStart(8) + '   ' + f[2].toExponential(6) + '   ' + (r*f[2]).toFixed(9) + '     ' + n2.toFixed(9));
  }
}