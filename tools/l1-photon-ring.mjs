/* ============================================================================
   l1-photon-ring.mjs -- L1: photon-ring subrings and the Lyapunov exponent

   MEASURED (all from js/kn.js, the double-precision mirror of the shader's
   integrator; nothing is assumed):

     1. The swept azimuth dPhi(b) of an equatorial null geodesic launched from
        r0 with impact parameter b = b_c (1 + x).  Strong-deflection theory:
            dPhi -> -(1/abar) ln x + const ,
        with abar = 1 for Schwarzschild in the photon-sphere normalisation
        (Bozza 2002, PRD 66 103001, Eqs. 47-49).
     2. The Lyapunov exponent per half-orbit, gamma.  Gralla & Lupsasca 2020
        (PRD 102 124003) and the BHEX paper (arXiv:2406.09498, Eqs. 6-8) define
            n_half-orbits = -ln|d| / gamma ,   delta r_n = delta r_0 e^{gamma n}
        so the n-th subring sits at d_n = exp(-gamma n), and the slope in (1)
        must be -pi/gamma.  The analytic value here is
            gamma = pi sqrt(F''(u_c)/2) ,  F(u) = (du/dphi)^2 ,
        which returns exactly pi for Schwarzschild (published) and is evaluated
        for Kerr-Newman from the exact Carter reduction:
            P(r)=r^2+a^2-ab,  R=P^2-Delta(b-a)^2,  V=-a+b+aP/Delta,
            F = R/(r^4 V^2)           [reduces to 1/b^2-u^2+2Mu^3-Q^2u^4 at a=0]
     3. The subring demagnification ratio d_{n+1}/d_n -> exp(-gamma).
     4. Cross-check: the exact equatorial state against the ZAMO screen
        initialisation the shader uses, at the same impact parameter.

   Usage: node tools/l1-photon-ring.mjs [quick|full]
   ========================================================================== */
import { trace, lyapEq, equatorState, equatorialPhotonOrbits, zamoInit } from '../js/kn.js';

const PI = Math.PI;
const R0 = 60, R_FAR = 140;

function wind(M, a, Q, b) {
  const t = trace({
    M, a, Q, r0: R0, th0: PI / 2, ph0: 0, bEquator: b,
    maxSteps: 400000, stepScale: 0.30, tol: 1e-6, rFar: R_FAR, interior: false,
  });
  return { phi: Math.abs(t.ph), n: Math.abs(t.ph) / PI, t, ok: t.escaped || t.captured };
}

function fit(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((p, c) => p + c, 0) / n, my = ys.reduce((p, c) => p + c, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const S = sxy / sxx, A = my - S * mx;
  let ss = 0; for (let i = 0; i < n; i++) { const r = ys[i] - (A + S * xs[i]); ss += r * r; }
  return { A, S, r2: 1 - ss / Math.max(syy, 1e-300) };
}

/* crossings are only meaningful on the monotone, CONVERGED subset: a ray that
   ran out of steps reports a winding that is not physical and manufactures
   spurious crossings (this bit the first version of this tool). */
function invertAt(pts, target) {
  const s = pts.slice().sort((p, q) => p.lx - q.lx);
  for (let i = 1; i < s.length; i++) {
    const p = s[i - 1], q = s[i];
    if ((p.phi - target) * (q.phi - target) <= 0 && p.phi !== q.phi) {
      const f = (target - p.phi) / (q.phi - p.phi);
      return Math.exp(p.lx + f * (q.lx - p.lx));
    }
  }
  return NaN;
}

function sweep(name, M, a, Q, xList, retro = false) {
  const eq = equatorialPhotonOrbits(M, a, Q);
  const bC = retro ? eq.bRet : eq.bPro;
  const rC = retro ? eq.rRet : eq.rPro;
  const rows = [];
  for (const x of xList) {
    const b = bC * (1 + x);
    const w = wind(M, a, Q, b);
    rows.push({ x, b, lx: Math.log(x), phi: w.phi, n: w.n, steps: w.t.steps, esc: w.t.escaped, cap: w.t.captured, ok: w.ok });
  }
  const good = rows.filter(r => r.ok);
  const F = fit(good.map(r => r.lx), good.map(r => r.phi));
  const gMeas = -PI / F.S;
  const an = lyapEq(M, a, Q, bC, rC);
  const ratios = [];
  const nMax = Math.floor(Math.max(...good.map(r => r.phi)) / PI);
  for (let k = 1; k < nMax; k++) {
    const dk = invertAt(good, k * PI), dk1 = invertAt(good, (k + 1) * PI);
    if (isFinite(dk) && isFinite(dk1)) ratios.push({ k, dk, dk1, ratio: dk1 / dk });
  }
  /* slope stability: refit on the inner half of the window */
  const half = good.slice(Math.floor(good.length / 2));
  const F2 = fit(half.map(r => r.lx), half.map(r => r.phi));
  return { name, M, a, Q, eq, bC, rC, rows, good, fit: F, fit2: F2, gMeas, gAn: an.gamma, an, ratios, retro };
}

const f6 = (v, n = 6) => (Number.isFinite(v) ? v.toFixed(n) : 'NaN');

function report(s) {
  const L = [];
  L.push('======================================================================');
  L.push(' ' + s.name);
  L.push('   M=' + s.M + '  a=' + s.a + '  Q=' + s.Q + (s.retro ? '   (RETROGRADE)' : '   (PROGRADE)'));
  L.push('   critical equatorial photon orbit : r_c = ' + f6(s.rC, 7) + '   b_c = ' + f6(s.bC, 9));
  L.push('   analytic gamma = pi*sqrt(F\'\'(u_c)/2) = ' + f6(s.gAn, 9) +
         '   [F\'\' = ' + f6(s.an.Fpp, 7) + ', F\' residual ' + s.an.Fp.toExponential(2) + ']');
  L.push('   measured slope dPhi/dln x = ' + f6(s.fit.S, 7) + '  (R^2 = ' + f6(s.fit.r2, 9) +
         ', n=' + s.good.length + ')   inner-half slope = ' + f6(s.fit2.S, 7));
  L.push('   => gamma from slope = ' + f6(s.gMeas, 7) + '   vs analytic ' + f6(s.gAn, 7) +
         '   (' + (100 * (s.gMeas / s.gAn - 1)).toFixed(3) + '%)');
  L.push('   Bozza abar check: measured -1/abar = ' + f6(-s.fit.S, 7) +
         '   predicted pi/gamma = ' + f6(PI / s.gAn, 7) + '   (' + (100 * (s.fit.S / (-PI / s.gAn) - 1)).toFixed(3) + '%)');
  L.push('   ------------------------------------------------------------------');
  L.push('        x            b          |dPhi|     n_half   steps    end');
  for (const r of s.rows) {
    L.push('   ' + r.x.toExponential(1).padStart(9) + '  ' + f6(r.b, 8).padStart(12) + '  ' +
           f6(r.phi, 5).padStart(9) + '  ' + f6(r.n, 5).padStart(8) + '  ' +
           String(r.steps).padStart(6) + '  ' + (r.esc ? 'escaped' : r.cap ? 'CAPTURED' : 'NOT CONVERGED'));
  }
  L.push('   subrings: d_n = impact-parameter offset of the n-th half-orbit image;');
  L.push('   d_{n+1}/d_n must converge to exp(-gamma) = ' + f6(Math.exp(-s.gAn), 7));
  for (const r of s.ratios) {
    L.push('      d_' + r.k + '=' + r.dk.toExponential(5) + '  d_' + (r.k + 1) + '=' + r.dk1.toExponential(5) +
           '  ratio=' + f6(r.ratio, 7) + '  (' + (100 * (r.ratio / Math.exp(-s.gAn) - 1)).toFixed(2) + '% vs exp(-gamma))');
  }
  L.push('======================================================================');
  return L.join('\n');
}

/* exact equatorial Carter state vs the shader's ZAMO screen initialisation.
   NOTE the screen vector here is (n_r, n_theta, n_phi) in the local ZAMO frame,
   so the impact parameter is set by the PHI component -- picking n_r (the
   radial one) gives |b| ~ r0, which is what a naive parameterisation does. */
function crossCheck() {
  const L = ['\n-- cross-check: exact equatorial state vs ZAMO screen init (same b) --'];
  for (const [M, a, Q] of [[1, 0, 0], [1, 0.9, 0], [1, 0.5, 0.5]]) {
    const eq = equatorialPhotonOrbits(M, a, Q);
    const bTarget = eq.bPro * 1.001;
    const sgnRet = eq.bRet < 0 ? -1 : 1;
    /* scan the azimuthal component for a bracket around bTarget */
    const bOf = (s) => { const z = zamoInit(M, a, Q, R0, PI / 2, [-Math.sqrt(Math.max(1 - s * s, 0)), 0, s]); return z.L / z.E; };
    let lo = 0, hi = 1, flo = bOf(lo), fhi = bOf(hi);
    if (flo > fhi) { const t = lo; lo = hi; hi = t; const f = flo; flo = fhi; fhi = f; }
    let s = 0, bz = flo;
    if (bTarget >= Math.min(flo, fhi) && bTarget <= Math.max(flo, fhi)) {
      for (let i = 0; i < 120; i++) {
        s = 0.5 * (lo + hi); bz = bOf(s);
        if ((bz - bTarget) * (flo - bTarget) <= 0) { hi = s; fhi = bz; } else { lo = s; flo = bz; }
      }
    }
    const n = [-Math.sqrt(Math.max(1 - s * s, 0)), 0, s];
    const opts = { maxSteps: 400000, stepScale: 0.30, tol: 1e-6, rFar: R_FAR, interior: false };
    const tz = trace({ M, a, Q, r0: R0, th0: PI / 2, ph0: 0, n, ...opts });
    const te = trace({ M, a, Q, r0: R0, th0: PI / 2, ph0: 0, bEquator: bTarget, ...opts });
    const ok = Math.abs(bz / bTarget - 1) < 1e-6;
    L.push('   a=' + a + ' Q=' + Q + '  b_target=' + f6(bTarget, 8) + '  b(s=' + f6(s, 6) + ')=' + f6(bz, 8) +
           '  [bracket ' + f6(Math.min(flo, fhi), 4) + '..' + f6(Math.max(flo, fhi), 4) + (ok ? ' ok' : ' OUT OF RANGE') + ']');
    L.push('        dPhi  zamo=' + f6(Math.abs(tz.ph), 6) + '  exact=' + f6(Math.abs(te.ph), 6) +
           '   dev=' + (100 * (Math.abs(tz.ph) / Math.abs(te.ph) - 1)).toFixed(4) + '%' +
           '   steps ' + tz.steps + '/' + te.steps +
           '   verdict ' + (tz.escaped ? 'esc' : tz.captured ? 'cap' : '?') + '/' + (te.escaped ? 'esc' : te.captured ? 'cap' : '?'));
  }
  return L.join('\n');
}

const mode = process.argv[2] || 'quick';
const xQuick = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9];
const xFull = [1e-2, 3e-3, 1e-3, 3e-4, 1e-4, 3e-5, 1e-5, 3e-6, 1e-6, 3e-7, 1e-7, 3e-8, 1e-8, 3e-9, 1e-9];
const xs = mode === 'full' ? xFull : xQuick;

const out = [];
out.push(report(sweep('A. Schwarzschild  -- analytic gamma must be exactly pi', 1, 0, 0, xs)));
out.push(report(sweep('B. Reissner-Nordstrom Q = 0.6M', 1, 0, 0.6, xs)));
if (mode === 'full') {
  out.push(report(sweep('C. Kerr a = 0.9M, prograde critical orbit', 1, 0.9, 0, xs)));
  out.push(report(sweep('D. Kerr a = 0.9M, retrograde critical orbit', 1, 0.9, 0, xs, true)));
  out.push(report(sweep('E. Kerr-Newman a = 0.5M, Q = 0.5M, prograde', 1, 0.5, 0.5, xs)));
} else {
  out.push(report(sweep('C. Kerr a = 0.9M, prograde critical orbit', 1, 0.9, 0, xs)));
}
out.push(crossCheck());
console.log(out.join('\n'));
