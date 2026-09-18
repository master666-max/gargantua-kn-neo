import { metric, metricUp, transportRhs } from '../js/polar.js';
/* FLAT SPACE, radial null geodesic, exact solution f^theta = 1/r. */
const M = 0, a = 0, Q = 0, th = 1.0;
const dotG = (g,x,y) => { let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
function rk4At(r, th, p, f, ds) {
  const k1 = transportRhs(r, th, M, a, Q, p, f);
  const ad = (x,k,c) => [0,1,2,3].map(i => x[i] + c*ds*k[i]);
  const k2 = transportRhs(r, th, M, a, Q, p, ad(f,k1,0.5));
  const k3 = transportRhs(r, th, M, a, Q, p, ad(f,k2,0.5));
  const k4 = transportRhs(r, th, M, a, Q, p, ad(f,k3,1.0));
  return [0,1,2,3].map(i => f[i] + (ds/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
function run(label, h, scheme) {
  const r0 = 10.0;
  let r = r0, f = [0, 0, 1/r0, 0], acc = 0;
  const pr = 1.0;   /* p^r for the radial null ray */
  const p0 = [0,1,2,3].map(i => metricUp(r0,th,M,a,Q).gu[i][1]*1.0 + metricUp(r0,th,M,a,Q).gu[i][0]*(-1.0));
  for (let k = 0; k < 400; k++) {
    acc += h;
    if (scheme === 'per-step') {
      f = rk4At(r, th, p0, f, h);
      r += pr*h;
    } else {
      /* frozen over the whole interval: transport once when the accumulator passes a target */
      if (acc >= 0.04) { f = rk4At(r, th, p0, f, acc); r += pr*acc; acc = 0; }
      else { r += pr*h; }
    }
    if (scheme === 'per-step') { /* r already advanced */ } else { }
  }
  const g = metric(r, th, M, a, Q).g;
  console.log('  ' + label.padEnd(28) + ' r = ' + r.toFixed(4) + '   r*f^theta = ' + (r*f[2]).toFixed(9) + '   |f|^2 = ' + dotG(g,f,f).toFixed(9) + '   (exact 1.000000000)');
}
console.log('flat-space acceptance test, 400 steps of h = 0.01, exact answer r*f^theta = 1:');
run('frozen over the interval', 0.01, 'frozen');
run('per geodesic step', 0.01, 'per-step');
run('per geodesic step, h=0.005', 0.005, 'per-step');
run('per geodesic step, h=0.002', 0.002, 'per-step');