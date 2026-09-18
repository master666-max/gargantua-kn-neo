import { momentumUp, solveNullPr, zamo, polFromField, unitise, tracePolarised, metric } from '../js/polar.js';
const M = 1, Q = 0, thObs = 0.02, R = 300;
function inward(a, beta, rObs) {
  const c = Math.cos(thObs), s = Math.sin(thObs);
  const L = 0, eta = beta * beta + a * a * c * c;
  const pth2 = eta - c * c * L * L / (s * s);
  if (pth2 < 0) return null;
  const pth0 = Math.sqrt(pth2);
  const pr0 = solveNullPr(rObs, thObs, M, a, Q, pth0, 1, L, -1);
  let rec = null;
  tracePolarised({ M, a, Q, r0: rObs, th0: thObs, pr0, pth0, E: 1, L, f0: [0,0,0,1], steps: 400000, h: 0.05, rMax: rObs*1.6,
    onStep: (st) => { if (!rec && st.th > Math.PI/2 && st.r > 0.5) rec = { r: st.r, pr: st.pr, pth: st.pth }; } });
  return rec;
}
function detail(a, beta) {
  const cs = inward(a, beta, R); if (!cs) return null;
  const rs = cs.r;
  const pu = momentumUp(rs, Math.PI/2, M, a, Q, -cs.pr, -cs.pth, 1, 0);
  const u = zamo(rs, Math.PI/2, M, a, Q);
  const f0 = unitise(polFromField(pu, u, [0,1,0,0], rs, Math.PI/2, M, a, Q), rs, Math.PI/2, M, a, Q);
  let last = null;
  tracePolarised({ M, a, Q, r0: rs, th0: Math.PI/2, pr0: -cs.pr, pth0: -cs.pth, E: 1, L: 0, f0, steps: 400000, h: 0.05, rMax: R*1.6,
    onStep: (st) => { if (st.r > R) last = { r: st.r, th: st.th, f: st.f }; } });
  if (!last) return null;
  const m = metric(last.r, last.th, M, a, Q); const g = m.g;
  const eTh = [0,0,1/Math.sqrt(g[2][2]),0], ePh = [0,0,0,1/Math.sqrt(g[3][3])];
  const dot = (x,y) => { let s=0; for (let i=0;i<4;i++) for (let j=0;j<4;j++) s += g[i][j]*x[i]*y[j]; return s; };
  const fa = dot(last.f, ePh), fb = -dot(last.f, eTh);
  return { rs, fa, fb, f: last.f, raw: Math.atan2(fb, fa) };
}
console.log('a = 0.5, raw screen projections (fa along +phi, fb along -theta)');
console.log('   beta      rs          fa            fb        atan2(fb,fa)');
for (const beta of [6, 12, 18, 25, 40, 60, 90]) {
  const d = detail(0.5, beta);
  if (!d) { console.log('  ' + String(beta).padStart(5) + '   FAILED'); continue; }
  console.log('  ' + String(beta).padStart(5) + '  ' + d.rs.toFixed(3).padStart(9) + '  ' + d.fa.toExponential(4).padStart(13) + '  ' + d.fb.toExponential(4).padStart(13) + '  ' + d.raw.toExponential(4).padStart(13));
}
console.log('');
console.log('same for a = 0 (must be identically zero by symmetry)');
for (const beta of [6, 25, 90]) {
  const d = detail(0, beta);
  console.log('  ' + String(beta).padStart(5) + '  ' + (d ? d.rs.toFixed(3) + '  fa ' + d.fa.toExponential(3) + '  fb ' + d.fb.toExponential(3) : 'FAILED'));
}