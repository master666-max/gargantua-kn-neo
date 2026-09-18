/* (D) subimage prediction, second attempt.  The first found only one ray per spin with an rs
   that drifted 30% across the range, so the comparison was not like-for-like.  Here the beta
   scan is dense INSIDE the narrow near-critical band (the subimages live just above the
   critical Carter constant), and the observable is read at a FIXED emission radius by
   interpolating each spin's chi(rs) curve at common rs values. */
import { metric, momentumUp, solveNullPr, zamo, polFromField, unitise, tracePolarised, foldEVPA, evpaDiff } from '../js/polar.js';
const M = 1, Q = 0, thObs = 0.02, R = 300;
function chiAtCrossings(a, beta) {
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
  const cross = []; let prev = null;
  tracePolarised({ M, a, Q, r0: R, th0: thObs, pr0, pth0, E: 1, L,
    f0: unitise(g1, R, thObs, M, a, Q), fList: [unitise(g2, R, thObs, M, a, Q)],
    steps: 400000, h: 0.05, rMax: R * 1.6, stopAtHorizon: false,
    onStep: (st) => {
      if (prev && prev.c * Math.cos(st.th) < 0 && st.r > 0.5) cross.push({ r: st.r, f1: st.f.slice(), f2: st.extras[0].slice(), pr: st.pr, pth: st.pth });
      prev = { c: Math.cos(st.th) };
    } });
  const res = [];
  for (const at of cross) {
    const rs = at.r, gS = metric(rs, Math.PI / 2, M, a, Q).g;
    const dS = (x, y) => { let q = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += gS[i][j] * x[i] * y[j]; return q; };
    const puS = momentumUp(rs, Math.PI / 2, M, a, Q, -at.pr, -at.pth, 1, 0), uS = zamo(rs, Math.PI / 2, M, a, Q);
    const fS = unitise(polFromField(puS, uS, [0, 1, 0, 0], rs, Math.PI / 2, M, a, Q), rs, Math.PI / 2, M, a, Q);
    const G11 = dS(at.f1, at.f1), G12 = dS(at.f1, at.f2), G22 = dS(at.f2, at.f2);
    const r1 = dS(fS, at.f1), r2 = dS(fS, at.f2), det = G11 * G22 - G12 * G12;
    if (Math.abs(det) < 1e-14) continue;
    const c1 = (r1 * G22 - r2 * G12) / det, c2 = (r2 * G11 - r1 * G12) / det;
    res.push({ rs, order: res.length + 1, chi: foldEVPA(Math.atan2(c1 * Ab + c2 * Bb, c1 * Aa + c2 * Ba)) });
  }
  return res;
}
const spins = [0, 0.3, 0.6];
const tab = {};
for (const a of spins) {
  tab[a] = [];
  const lo = 5.19 - 0.9 * a, hi = lo + 1.6;   /* dense scan just above the critical Carter value */
  for (let i = 0; i <= 60; i++) {
    const beta = lo + (hi - lo) * i / 60;
    const cs = chiAtCrossings(a, +beta.toFixed(4));
    if (!cs) continue;
    for (const c of cs) if (c.order >= 2) tab[a].push(c);
  }
  console.log('a=' + a + '  subimage rays ' + tab[a].length + (tab[a].length ? '  rs ' + Math.min(...tab[a].map(c => c.rs)).toFixed(2) + '..' + Math.max(...tab[a].map(c => c.rs)).toFixed(2) : ''));
}
function interp(pts, rs) { const s = pts.slice().sort((x, y) => x.rs - y.rs); for (let i = 1; i < s.length; i++) if ((s[i-1].rs - rs) * (s[i].rs - rs) <= 0) { const t = (rs - s[i-1].rs) / (s[i].rs - s[i-1].rs); return s[i-1].chi + t * (s[i].chi - s[i-1].chi); } return null; }
const lo0 = Math.max(...spins.map(a => Math.min(...tab[a].map(c => c.rs))));
const hi0 = Math.min(...spins.map(a => Math.max(...tab[a].map(c => c.rs))));
console.log('common rs window: ' + lo0.toFixed(3) + ' .. ' + hi0.toFixed(3));
console.log('');
console.log('SUBIMAGE DeltaEVPA at matched rs, vs +-a/sqrt(27) = ' + (1/Math.sqrt(27)).toFixed(4) + '*a');
console.log('    rs      a     measured   a/sqrt(27)   ratio');
for (const a of spins) {
  if (a === 0) continue;
  for (const rs of [lo0 + (hi0-lo0)*0.25, lo0 + (hi0-lo0)*0.5, lo0 + (hi0-lo0)*0.75]) {
    const c0 = interp(tab[0], rs), ca = interp(tab[a], rs);
    if (c0 === null || ca === null) continue;
    const d = evpaDiff(ca, c0), pred = a / Math.sqrt(27);
    console.log('  ' + rs.toFixed(3) + '  ' + a.toFixed(1) + '  ' + d.toExponential(3).padStart(11) + '  ' + pred.toExponential(3).padStart(11) + '  ' + (d/pred).toFixed(3).padStart(7));
  }
}