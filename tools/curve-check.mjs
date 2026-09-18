import { shadowAim } from '../js/kn.js';
for (const [a,Q] of [[0.86,0],[0.5,0.5],[0.9,0.3]]) {
  const s = shadowAim(1,a,Q);
  const ae = Math.sqrt(a*a+Q*Q);
  console.log('a='+a,'Q='+Q,'exact  bPro='+s.bPro.toFixed(4)+' bRet='+s.bRet.toFixed(4)+' bMid='+s.bMid.toFixed(4),
    '| old effective-spin ae='+ae.toFixed(4));
}
const t0=Date.now(); for(let i=0;i<100000;i++) shadowAim(1,0.86,0); console.log('100k cached calls:', Date.now()-t0, 'ms');