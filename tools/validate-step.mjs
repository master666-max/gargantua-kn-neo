/* (B) FEASIBILITY / ERROR BOUND for putting the parallel transport into the shader.
   The transport costs a Christoffel contraction per step per pixel, which is why the port has
   not been done.  Its cost is proportional to 1/h, so the question is: how large may the step
   be before the EVPA moves?  This measures the EVPA against the step size for a set of rays
   and reports the error against the fine-step reference.  Fourth-order convergence is expected
   (RK4), so a 16x cheaper integration should cost about 16^4 = 6.5e4 in local error -- if that
   is what the data shows, the port is viable; if the error saturates, it is not. */
import { metric, momentumUp, solveNullPr, zamo, polFromField, unitise, tracePolarised, foldEVPA, evpaDiff } from '../js/polar.js';
const M = 1, Q = 0, thObs = 0.02, R = 300;
function evpa(a, beta, h) {
  const c = Math.cos(thObs), s = Math.sin(thObs);
  const L = 0, eta = beta * beta + a * a * c * c;
  const pth2 = eta - c * c * L * L / (s * s);
  if (pth2 < 0) return null;
  const pth0 = Math.sqrt(pth2);
  const pr0 = solveNullPr(R, thObs, M, a, Q, pth0, 1, L, -1);
  if (pr0 === null) return null;
  const gO = metric(R, thObs, M, a, Q).g;
  const dO = (x, y) => { let q = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += gO[i][j] * x[i] * y[j]; return q; };
  const eA = [0, 0, 0, 1 / Math.sqrt(gO[3][3])], eB = [0, 0, -1 / Math.sqrt(gO[2][2]), 0];
  const uO = zamo(R, thObs, M, a, Q);
  const puO = momentumUp(R, thObs, M, a, Q, pr0, pth0, 1, L);
  const g1 = polFromField(puO, uO, eA, R, thObs, M, a, Q), g2 = polFromField(puO, uO, eB, R, thObs, M, a, Q);
  const Aa = dO(g1, eA), Ab = dO(g1, eB), Ba = dO(g2, eA), Bb = dO(g2, eB);
  let at = null, prev = null;
  tracePolarised({ M, a, Q, r0: R, th0: thObs, pr0, pth0, E: 1, L,
    f0: unitise(g1, R, thObs, M, a, Q), fList: [unitise(g2, R, thObs, M, a, Q)],
    steps: Math.ceil(400000 * 0.05 / h), h, rMax: R * 1.6,
    onStep: (st) => {
      if (!at && prev && (prev.th - Math.PI / 2) * (st.th - Math.PI / 2) < 0 && st.r > 0.5) {
        const t = (Math.PI / 2 - prev.th) / (st.th - prev.th);
        at = { r: prev.r + t * (st.r - prev.r), f1: st.f.slice(), f2: st.extras[0].slice(), pr: st.pr, pth: st.pth };
      }
      prev = { r: st.r, th: st.th };
    } });
  if (!at) return null;
  const rs = at.r, gS = metric(rs, Math.PI / 2, M, a, Q).g;
  const dS = (x, y) => { let q = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += gS[i][j] * x[i] * y[j]; return q; };
  const puS = momentumUp(rs, Math.PI / 2, M, a, Q, -at.pr, -at.pth, 1, 0), uS = zamo(rs, Math.PI / 2, M, a, Q);
  const fS = unitise(polFromField(puS, uS, [0, 1, 0, 0], rs, Math.PI / 2, M, a, Q), rs, Math.PI / 2, M, a, Q);
  const G11 = dS(at.f1, at.f1), G12 = dS(at.f1, at.f2), G22 = dS(at.f2, at.f2);
  const r1 = dS(fS, at.f1), r2 = dS(fS, at.f2), det = G11 * G22 - G12 * G12;
  if (Math.abs(det) < 1e-14) return null;
  const c1 = (r1 * G22 - r2 * G12) / det, c2 = (r2 * G11 - r1 * G12) / det;
  return { rs, chi: foldEVPA(Math.atan2(c1 * Ab + c2 * Bb, c1 * Aa + c2 * Ba)) };
}
const cases = [[0.5, 8], [0.5, 20], [0.7, 8], [0.3, 20]];
const hs = [0.05, 0.1, 0.2, 0.4, 0.8, 1.6];
console.log('EVPA vs the transport step size (radians)');
console.log('   a   beta   ' + hs.map((h) => ('h=' + h).padStart(12)).join(''));
const refs = {};
for (const [a, beta] of cases) {
  const row = [];
  for (const h of hs) { const e = evpa(a, beta, h); row.push(e ? e.chi : null); }
  refs['' + a + ',' + beta] = row[0];
  console.log('  ' + a.toFixed(1) + '  ' + String(beta).padStart(4) + '   ' + row.map((v) => (v === null ? 'failed'.padStart(12) : v.toExponential(4).padStart(12))).join(''));
}
console.log('');
console.log('error against the h = 0.05 reference (radians), and the cost ratio 0.05/h');
for (const [a, beta] of cases) {
  const key = '' + a + ',' + beta;
  const row = [];
  for (const h of hs) { const e = evpa(a, beta, h); row.push(e ? evpaDiff(e.chi, refs[key]) : null); }
  console.log('  a=' + a + ' beta=' + String(beta).padStart(3) + '  ' + row.map((v, i) => (v === null ? '-' : v.toExponential(2) + ' (x' + (0.05 / hs[i]).toFixed(0) + ')')).join('   '));
}