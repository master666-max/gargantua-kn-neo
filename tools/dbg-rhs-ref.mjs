import { transportRhs, momentumUp, metric } from '../js/polar.js';
const M=1, a=0.86, Q=0, r=6.0, th=1.2;
const pt=-1.0, pr=0.3, pth=0.2, pph=3.0;
const pu = momentumUp(r, th, M, a, Q, pr, pth, pt, pph);
const g = metric(r,th,M,a,Q).g;
const fv = [0,0,1/Math.sqrt(g[2][2]),0];
const rhs = transportRhs(r,th,M,a,Q,pu,fv);
console.log(JSON.stringify({ pcov:[pt,pr,pth,pph], pcon: pu.map(v=>+v.toFixed(6)), fv: fv.map(v=>+v.toFixed(6)), rhs: rhs.map(v=>+v.toFixed(6)) }));