/* EXTERNAL VALIDATION of the EVPA observable, round 3b -- the CORRECT construction.

   Two ingredients, both established: (1) transporting an observer-frame vector inward is the
   exact inverse of transporting the source vector outward, so only the inward integration is
   needed -- this sidesteps the radial-turning-point degeneracy that invalidated reversing the
   momentum; (2) the two states g1 = eps(p,u,e_alpha) and g2 = eps(p,u,e_beta) SPAN the
   polarisation plane but are NOT screen-aligned and NOT orthogonal, so the source vector must
   be expanded in them by solving a 2x2 system and the screen angle formed at the observer.
   (Using g1 as 'the EVPA = 0 state' was wrong and the self-check caught it: g1.e_alpha = -0.82
   instead of 0, because e_alpha is not orthogonal to the null p.) */
import { metric, momentumUp, solveNullPr, zamo, polFromField, unitise, tracePolarised, foldEVPA, evpaDiff } from '../js/polar.js';
const M = 1, Q = 0, thObs = 0.02, R = 300;
const fieldKind = process.argv[2] === 'toroidal' ? 'toroidal' : 'radial';
const sideSign = process.argv[3] === 'neg' ? -1 : 1;   /* which side of the image (beta < 0 or > 0) */

function evpa(a, beta) {
  const c = Math.cos(thObs), s = Math.sin(thObs);
  const L = 0, eta = beta * beta + a * a * c * c;
  const pth2 = eta - c * c * L * L / (s * s);
  if (pth2 < 0) return null;
  const pth0 = sideSign * Math.sqrt(pth2);
  const pr0 = solveNullPr(R, thObs, M, a, Q, pth0, 1, L, -1);
  if (pr0 === null) return null;
  const gO = metric(R, thObs, M, a, Q).g;
  const dO = (x, y) => { let q = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += gO[i][j] * x[i] * y[j]; return q; };
  const eA = [0, 0, 0, 1 / Math.sqrt(gO[3][3])];
  const eB = [0, 0, -1 / Math.sqrt(gO[2][2]), 0];
  const uO = zamo(R, thObs, M, a, Q);
  const puO = momentumUp(R, thObs, M, a, Q, pr0, pth0, 1, L);
  const g1 = polFromField(puO, uO, eA, R, thObs, M, a, Q);   /* spans the plane */
  const g2 = polFromField(puO, uO, eB, R, thObs, M, a, Q);
  const g1n = unitise(g1, R, thObs, M, a, Q), g2n = unitise(g2, R, thObs, M, a, Q);
  const Aa = dO(g1, eA), Ab = dO(g1, eB), Ba = dO(g2, eA), Bb = dO(g2, eB);
  let at = null, prev = null;
  tracePolarised({ M, a, Q, r0: R, th0: thObs, pr0, pth0, E: 1, L, f0: g1n, fList: [g2n], steps: 400000, h: 0.05, rMax: R * 1.6,
    onStep: (st) => {
      if (!at && prev && (prev.th - Math.PI / 2) * (st.th - Math.PI / 2) < 0 && st.r > 0.5) {
        const t = (Math.PI / 2 - prev.th) / (st.th - prev.th);
        at = { r: prev.r + t * (st.r - prev.r), f1: st.f.slice(), f2: st.extras[0].slice(), pr: st.pr, pth: st.pth };
      }
      prev = { r: st.r, th: st.th };
    } });
  if (!at) return null;
  const rs = at.r;
  const gS = metric(rs, Math.PI / 2, M, a, Q).g;
  const dS = (x, y) => { let q = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += gS[i][j] * x[i] * y[j]; return q; };
  const puS = momentumUp(rs, Math.PI / 2, M, a, Q, -at.pr, -at.pth, 1, 0);
  const uS = zamo(rs, Math.PI / 2, M, a, Q);
  const bvec = fieldKind === 'toroidal' ? [0, 0, 0, 1] : [0, 1, 0, 0];
  const fS = unitise(polFromField(puS, uS, bvec, rs, Math.PI / 2, M, a, Q), rs, Math.PI / 2, M, a, Q);
  /* expand fS in the transported spanning pair: G c = rhs */
  const G11 = dS(at.f1, at.f1), G12 = dS(at.f1, at.f2), G22 = dS(at.f2, at.f2);
  const r1 = dS(fS, at.f1), r2 = dS(fS, at.f2);
  const det = G11 * G22 - G12 * G12;
  if (Math.abs(det) < 1e-14) return null;
  const c1 = (r1 * G22 - r2 * G12) / det;
  const c2 = (r2 * G11 - r1 * G12) / det;
  const compA = c1 * Aa + c2 * Ba;
  const compB = c1 * Ab + c2 * Bb;
  return { rs, chi: foldEVPA(Math.atan2(compB, compA)), cond: Math.abs(det) / (G11 * G22) };
}

console.log('field model: ' + fieldKind + ', beta side: ' + (sideSign > 0 ? '+beta' : '-beta') + '   (the published -2a/rs^2 is geometric, so both must agree)');
console.log('   a    beta      rs        chi       cond');
const tab = {};
for (const a of [0, 0.5]) {
  tab[a] = [];
  for (let beta = 2.2; beta <= 60; beta *= 1.28) {
    const e = evpa(a, +beta.toFixed(3));
    if (!e) continue;
    tab[a].push(e);
    if (beta < 5 || beta > 25) console.log('  ' + a.toFixed(1) + '  ' + String(beta.toFixed(1)).padStart(6) + '  ' + e.rs.toFixed(3).padStart(8) + '  ' + e.chi.toFixed(6).padStart(10) + '  ' + e.cond.toFixed(4));
  }
}
function interp(pts, rs) { for (let i = 1; i < pts.length; i++) if ((pts[i-1].rs - rs) * (pts[i].rs - rs) <= 0) { const t = (rs - pts[i-1].rs) / (pts[i].rs - pts[i-1].rs); return pts[i-1].chi + t * (pts[i].chi - pts[i-1].chi); } return null; }
console.log('');
console.log('DeltaEVPA vs the published -2a/rs^2');
console.log('    rs      measured      -2a/rs^2     ratio');
for (const rs of [5, 8, 10, 14, 20, 30]) {
  const c0 = interp(tab[0], rs), ca = interp(tab[0.5], rs);
  if (c0 === null || ca === null) continue;
  const d = evpaDiff(ca, c0), pred = -2 * 0.5 / (rs * rs);
  console.log('  ' + String(rs).padStart(4) + '  ' + d.toExponential(3).padStart(12) + '  ' + pred.toExponential(3).padStart(12) + '  ' + (d / pred).toFixed(3).padStart(8));
}