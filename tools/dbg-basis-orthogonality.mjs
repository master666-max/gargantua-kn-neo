/* Quantify how much the NON-ORTHOGONAL basis distorts the angle: chi as atan2(c2,c1) in the raw
   (gA,gB) basis, against chi after Gram-Schmidt in the metric.  If the two differ by O(0.1 rad),
   then the quantity called 'screen EVPA' has never been a screen angle. */
import * as pol from '../js/polar.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(HERE, 'measurements', 'evpa-physical.json'), 'utf8'));
const M = data.app.M, A = data.app.a, Q = data.app.Q;
const r0 = data.app.camR, th0 = data.app.camTheta * Math.PI / 180;
const D = (g, u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g[i][j] * u[i] * v[j]; return s; };
const fold = (x) => { while (x > Math.PI / 2) x -= Math.PI; while (x <= -Math.PI / 2) x += Math.PI; return x; };
function bF4(r, th) { const s = Math.sin(th), c = Math.cos(th);
  if (data.app.bfield < 1.5) return [0, 0, 0, 1 / Math.max(r, 0.3)];
  if (data.app.bfield < 2.5) return [0, 0, c, -s]; return [0, 1 / Math.max(r, 0.3), 0, 0]; }
function run(C, h) {
  const gO = pol.metric(r0, th0, M, A, Q).g, uO = pol.zamo(r0, th0, M, A, Q);
  const pUpO = pol.momentumUp(r0, th0, M, A, Q, C.pr, C.pth, C.E, C.L);
  const eA = [0, 0, 0, 1 / Math.sqrt(gO[3][3])], eB = [0, 0, -1 / Math.sqrt(gO[2][2]), 0];
  const mk = (b) => pol.unitise(pol.polFromField(pUpO, uO, b, r0, th0, M, A, Q), r0, th0, M, A, Q);
  const traj = [];
  pol.tracePolarised({ M, a: A, Q, E: C.E, L: C.L, r0, th0, pr0: C.pr, pth0: C.pth,
    f0: mk([0, 0, 0, 1]), fList: [mk(eA), mk(eB)], steps: 400000, h, rMax: 200, stopAtHorizon: true,
    onStep: (st) => traj.push({ r: st.r, th: st.th, pr: st.pr, pth: st.pth, gA: st.extras[0].slice(), gB: st.extras[1].slice() }) });
  let k = -1; for (let i = 1; i < traj.length; i++) if ((traj[i-1].th - Math.PI/2) * (traj[i].th - Math.PI/2) <= 0) { k = i; break; }
  if (k < 1) return null;
  const A0 = traj[k-1], B0 = traj[k], w = (Math.PI/2 - A0.th)/(B0.th - A0.th), mix = (x,y) => x + w*(y-x);
  const thI = Math.PI/2, rI = mix(A0.r, B0.r), prI = mix(A0.pr, B0.pr), pthI = mix(A0.pth, B0.pth);
  const gI = pol.metric(rI, thI, M, A, Q).g, uI = pol.zamo(rI, thI, M, A, Q);
  const aI = A0.gA.map((x,i)=>mix(x,B0.gA[i])), bI = A0.gB.map((x,i)=>mix(x,B0.gB[i]));
  const pUpI = pol.momentumUp(rI, thI, M, A, Q, prI, pthI, C.E, C.L);
  const fP = pol.unitise(pol.polFromField(pUpI, uI, bF4(rI, thI), rI, thI, M, A, Q), rI, thI, M, A, Q);
  const G11 = D(gI,aI,aI), G12 = D(gI,aI,bI), G22 = D(gI,bI,bI);
  const r1 = D(gI,fP,aI), r2 = D(gI,fP,bI), dt = G11*G22 - G12*G12;
  const c1 = (r1*G22 - r2*G12)/dt, c2 = (r2*G11 - r1*G12)/dt;
  const raw = fold(Math.atan2(c2, c1));
  /* Gram-Schmidt in the metric: e1 = gA/|gA|, e2 = (gB - (gB.e1)e1)/|...| */
  const nA = Math.sqrt(G11);
  const e1 = aI.map(x => x/nA);
  const proj = D(gI, bI, e1);
  const perp = bI.map((x,i) => x - proj*e1[i]);
  const nP = Math.sqrt(Math.abs(D(gI, perp, perp)));
  const e2 = perp.map(x => x/nP);
  const q1 = D(gI, fP, e1), q2 = D(gI, fP, e2);
  const orth = fold(Math.atan2(q2, q1));
  let d = orth - raw; while (d > Math.PI/2) d -= Math.PI; while (d <= -Math.PI/2) d += Math.PI;
  return { raw, orth, delta: d, cosAB: G12/Math.sqrt(G11*G22), r: rI };
}
console.log('case          rCross   cos(gA,gB)   chi RAW     chi ORTHO    delta (rad)  delta (quanta)');
let worst = 0;
for (const C of data.cases) {
  const a = run(C, 0.005); if (!a) continue;
  worst = Math.max(worst, Math.abs(a.delta));
  console.log(C.tag.padEnd(12) + a.r.toFixed(2).padStart(8) + a.cosAB.toFixed(4).padStart(12)
    + a.raw.toFixed(5).padStart(11) + a.orth.toFixed(5).padStart(12) + a.delta.toFixed(5).padStart(13)
    + (Math.abs(a.delta)/(Math.PI/255)).toFixed(2).padStart(14));
}
console.log('');
console.log('worst |delta| = ' + worst.toFixed(5) + ' rad = ' + (worst/(Math.PI/255)).toFixed(2) + ' readout quanta.');