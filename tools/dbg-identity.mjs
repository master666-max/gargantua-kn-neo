import { metric, metricUp, christoffel, transportRhs, momentumUp, polFromField, unitise, zamo } from '../js/polar.js';
const M = 1, a = 0.86, Q = 0;
const r = 6.0, th = 1.2;
/* (1) does transportRhs equal the contraction built from christoffel() DIRECTLY? */
const G = christoffel(r, th, M, a, Q);
const p = momentumUp(r, th, M, a, Q, 0.3, 0.2, 1.0, 3.0);
const g = metric(r, th, M, a, Q).g;
const f0 = [0, 0, 1/Math.sqrt(g[2][2]), 0];
const direct = [0,1,2,3].map(mu => { let s=0; for(let al=0;al<4;al++) for(let be=0;be<4;be++) s += G[mu][al][be]*p[al]*f0[be]; return -s; });
const viaLib = transportRhs(r, th, M, a, Q, p, f0);
let mx = 0; for (let i=0;i<4;i++) mx = Math.max(mx, Math.abs(direct[i]-viaLib[i])/Math.max(Math.abs(viaLib[i]),1e-30));
console.log('transportRhs vs the contraction from christoffel() directly:');
console.log('   max relative difference = ' + (mx*100).toExponential(3) + '%');
console.log('');
/* (2) the identity: is d g(f,f)/dlambda = -2 Gamma_{abg} f^a p^b f^g actually zero for this state? */
const dotG = (x,y) => { let s=0; for(let i=0;i<4;i++) for(let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
/* a NULL p and an orthogonal f, as in the previous test */
let pr = 0.3;
for (let it=0; it<200; it++) {
  const pu = momentumUp(r, th, M, a, Q, pr, 0.2, 1.0, 3.0);
  const H = dotG(pu,pu);
  if (Math.abs(H) < 1e-15) break;
  const hh = 1e-6;
  const pu2 = momentumUp(r, th, M, a, Q, pr+hh, 0.2, 1.0, 3.0);
  const dH = (dotG(pu2,pu2) - H)/hh;
  pr -= H/dH;
}
const pN = momentumUp(r, th, M, a, Q, pr, 0.2, 1.0, 3.0);
const pcovN = [-1, pr, 0.2, 3.0];
const fN = unitise(polFromField(pN, zamo(r,th,M,a,Q), [0,0,0,1], r, th, M, a, Q), r, th, M, a, Q);
let s = 0;
for (let al=0;al<4;al++) for (let be=0;be<4;be++) for (let ga=0;ga<4;ga++) s += G[ga][al][be]*fN[ga]*pN[al]*fN[be];
let rhsDot = 0; for (let i=0;i<4;i++) rhsDot += fN[i]*transportRhs(r,th,M,a,Q,pN,fN)[i];
console.log('for an EXACTLY valid state (p null, f orthogonal):');
console.log('   p.p =', dotG(pN,pN).toExponential(2), '  f.p =', (function(){let q=0;for(let i=0;i<4;i++) q+=fN[i]*pcovN[i];return q;})().toExponential(2));
console.log('   -2 Gamma f p f        =', (-2*s).toExponential(3));
console.log('   f . (df/dlambda)      =', rhsDot.toExponential(3));
console.log('   these must be EQUAL and must be ZERO for norm preservation.');