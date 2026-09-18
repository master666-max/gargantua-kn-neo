/* ============================================================================
   validate-physics.mjs -- the GPU shader is written in GLSL, but every equation
   in it has an exact CPU twin in js/kn.js.  This harness exercises that twin in
   double precision and checks it against closed-form general-relativity results.
   If these numbers are right, the pixels come from a real Kerr-Newman
   integration and not from a drawing.

   run:  node tools/validate-physics.mjs
   ========================================================================== */
import { horizons, ergoRadius, isco, zamoInit, ham, carter, trace, geo, omega, direction,
         diskG, diskGRaw, tempProfile, criticalCurve, equatorialPhotonOrbits,
         lyapEq, equatorState, DISK_TEMP_EXP, circularOrbit, diskFluxTable,
         ssFluxNewtonian, GEOM_M_PER_C, GEOM_M_PER_GAUSS, M_SUN_GEOM,
         CHARGE_BALANCE_OVER_M, waldChargeOverM, chargePhysicality,
         SKY_PSF_RAD, SKY_STAR_SCALES, SKY_STAR_THRESH, skyStarPsfPx, skyStarCount,
         skyFrameSolidAngle } from '../js/kn.js';
import { sanitize, DEFAULTS } from '../js/params.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const rows = [];
function check(name, got, want, tol, unit) {
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  rows.push([ok ? 'PASS' : 'FAIL', name, fmt(got), fmt(want), fmt(tol), unit || '']);
  return ok;
}
function checkTrue(name, cond, detail) {
  cond ? pass++ : fail++;
  rows.push([cond ? 'PASS' : 'FAIL', name, detail, '', '', '']);
  return cond;
}
function fmt(x) {
  if (typeof x !== 'number') return String(x);
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e5 || a < 1e-3) return x.toExponential(4);
  return x.toFixed(6);
}

const M = 1;

console.log('\n=== GARGANTUA-KN  physics validation  (double precision CPU twin) ===\n');

/* --- 1. horizons ---------------------------------------------------------- */
check('Schwarzschild r+ (a=0,Q=0)', horizons(1, 0, 0).rp, 2, 1e-12, 'M');
check('Kerr a=0.86 r+', horizons(1, 0.86, 0).rp, 1 + Math.sqrt(1 - 0.86 * 0.86), 1e-12, 'M');
check('Kerr a=0.86 r-', horizons(1, 0.86, 0).rm, 1 - Math.sqrt(1 - 0.86 * 0.86), 1e-12, 'M');
check('Reissner-Nordstrom Q=0.6 r+', horizons(1, 0, 0.6).rp, 1.8, 1e-12, 'M');
check('KN a=0.5 Q=0.5 r+', horizons(1, 0.5, 0.5).rp, 1 + Math.sqrt(0.5), 1e-12, 'M');
check('extremal a=0.9 Q=sqrt(0.19) r+', horizons(1, 0.9, Math.sqrt(0.19)).rp, 1, 1e-9, 'M');
checkTrue('extremal a=1 r+=r-=1', Math.abs(horizons(1, 1, 0).rp - 1) < 1e-12 && Math.abs(horizons(1, 1, 0).rm - 1) < 1e-12, '');
check('ergosphere equator a=0.86', ergoRadius(1, 0.86, 0, Math.PI / 2), 2, 1e-12, 'M');
check('ergosphere pole a=0.86', ergoRadius(1, 0.86, 0, 0), 1 + Math.sqrt(1 - 0.86 * 0.86), 1e-12, 'M');

/* --- 2. ISCO (numeric minimiser of E(r) on KN circular orbits) ------------ */
check('ISCO Schwarzschild', isco(1, 0, 0), 6, 2e-3, 'M');
check('ISCO Kerr a=0.5', isco(1, 0.5, 0), 4.23300, 4e-3, 'M');
check('ISCO Kerr a=0.9', isco(1, 0.9, 0), 2.32088, 4e-3, 'M');
check('ISCO Kerr a=0.998', isco(1, 0.998, 0), 1.23728, 4e-3, 'M');
checkTrue('ISCO decreases monotonically with a',
  [0, 0.3, 0.6, 0.9, 0.998].every((a, i, arr) => i === 0 || isco(1, a, 0) < isco(1, arr[i - 1], 0)),
  'r_isco(0)=' + isco(1, 0, 0).toFixed(3) + '  r_isco(0.998)=' + isco(1, 0.998, 0).toFixed(3));
checkTrue('charge shrinks the ISCO (Q=0.5, a=0.5)',
  isco(1, 0, 0.5) < isco(1, 0, 0) && isco(1, 0, 0.5) > 0,
  'r_isco(Q=0.5,a=0)=' + isco(1, 0, 0.5).toFixed(4));

/* --- 3. nullity of the ZAMO initial data ---------------------------------- */
{
  let worst = 0;
  let n = 0;
  for (let ir = 0; ir < 14; ir++) {
    const r = 2.05 + ir * 1.7;
    for (let it = 1; it < 10; it++) {
      const th = (it / 10) * Math.PI;
      for (let k = 0; k < 24; k++) {
        const u = Math.sin(k * 12.9898) * 43758.5453;
        const fx = u - Math.floor(u);
        const u2 = Math.sin(k * 78.233 + ir) * 43758.5453;
        const fy = u2 - Math.floor(u2);
        const u3 = Math.sin(k * 39.425 + it) * 43758.5453;
        const fz = u3 - Math.floor(u3);
        const len = Math.hypot(fx - 0.5, fy - 0.5, fz - 0.5) || 1;
        const nn = [(fx - 0.5) / len, (fy - 0.5) / len, (fz - 0.5) / len];
        const z = zamoInit(1, 0.86, 0.3, r, th, nn);
        worst = Math.max(worst, Math.abs(ham(1, 0.86, z.g, z.pr, z.pth, z.E, z.L)));
        n++;
      }
    }
  }
  checkTrue('H = 0 on ' + n + ' random ZAMO initial states', worst < 1e-12,
    'max |H| = ' + worst.toExponential(3));
}

/* --- 4. conservation along integrated rays -------------------------------- */
{
  let worstH = 0, worstC = 0, rays = 0, esc = 0;
  for (let i = 0; i < 240; i++) {
    const a = [0, 0.5, 0.86, 0.998][i % 4];
    const Q = [0, 0.3][i % 2];
    const r0 = 12 + (i % 7) * 4;
    const th0 = 0.25 + ((i * 0.37) % 1) * 2.6;
    const ph0 = (i * 0.7) % 6.28;
    const u1 = Math.sin(i * 3.77) * 4321.5, u2 = Math.sin(i * 9.13) * 1234.5, u3 = Math.sin(i * 5.31) * 876.5;
    const f1 = u1 - Math.floor(u1), f2 = u2 - Math.floor(u2), f3 = u3 - Math.floor(u3);
    const len = Math.hypot(f1 - 0.5, f2 - 0.5, f3 - 0.5) || 1;
    const n = [(f1 - 0.5) / len, (f2 - 0.5) / len, (f3 - 0.5) / len];
    const res = trace({ M: 1, a, Q, r0, th0, ph0, n, maxSteps: 20000, tol: 1e-7, stepScale: 0.45 });
    rays++;
    if (res.escaped) esc++;
    worstH = Math.max(worstH, res.maxErr);
    worstC = Math.max(worstC, res.maxCarter);
  }
  checkTrue('conservation monitor: ' + rays + ' rays, ' + esc + ' escaped',
    worstH < 3e-3, 'max |H|/|terms| = ' + worstH.toExponential(3));
  checkTrue('Carter constant Q_c conserved along every ray',
    worstC < 5e-4, 'max relative drift = ' + worstC.toExponential(3));
}

/* --- 5. flat-space limit -------------------------------------------------- */
{
  const res = trace({ M: 0, a: 0, Q: 0, r0: 30, th0: Math.PI / 2, ph0: 0, n: [-1, 0, 0.35], maxSteps: 4000, tol: 1e-9, stepScale: 0.4 });
  checkTrue('M=a=Q=0 -> straight line, |r| grows without bound',
    res.escaped && Math.abs(res.r) > 40, 'r_final = ' + fmt(res.r));
  const res2 = trace({ M: 0, a: 0, Q: 0, r0: 30, th0: Math.PI / 2, ph0: 0, n: [-1, 0, 0], maxSteps: 4000, tol: 1e-9, stepScale: 0.4 });
  checkTrue('M=a=Q=0, radial ray reaches the origin', Math.abs(res2.r) < 0.06, 'r_final = ' + fmt(res2.r));
}

/* --- 6. weak-field light bending  alpha = 4M/b ---------------------------- */
{
  /* A straight line keeps a *constant* velocity direction, so the deflection is
     simply the angle between the incoming and the outgoing Cartesian photon
     direction -- no finite-radius bookkeeping needed.  The reference is the
     post-Newtonian series  alpha = 4M/b + 15 pi M^2/(4 b^2) + 128 M^3/(3 b^3). */
  const defl = (b) => {
    const r0 = 20000, rFar = 40000;
    const n3 = b / r0;
    const n1 = -Math.sqrt(Math.max(1 - n3 * n3, 0));
    const res = trace({ M: 1, a: 0, Q: 0, r0, th0: Math.PI / 2, ph0: 0, n: [n1, 0, n3],
                        maxSteps: 200000, tol: 1e-5, stepScale: 0.5, rFar });
    const d0 = direction(1, 0, 0, r0, Math.PI / 2, 0, res.pr0, res.pth0, res.E, res.L);
    const d1 = direction(1, 0, 0, res.r, res.th, res.ph, res.pr, res.pth, res.E, res.L);
    const nn = (v) => Math.hypot(v[0], v[1], v[2]);
    const cosA = (d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2]) / (nn(d0) * nn(d1));
    return Math.acos(Math.max(-1, Math.min(1, cosA)));
  };
  const series = (b) => 4 / b + 15 * Math.PI / (4 * b * b) + 128 / (3 * b * b * b);
  const a2000 = defl(2000);
  check('weak deflection b=2000M vs 4M/b series', a2000, series(2000), 2e-5, 'rad');
  const a4000 = defl(4000);
  check('weak deflection halves when b doubles (Einstein 1/b law)', a2000 / a4000, 2, 0.05, 'x');
}

/* --- 7. Schwarzschild critical impact parameter  b_c = 3 sqrt(3) M -------- */
{
  /* b = L/E is a conserved quantity, so it *is* the asymptotic impact
     parameter wherever the ray is launched from: the capture test can be run
     at r0 = 40 M, which is ~200x cheaper than launching from 3000 M. */
  const shotB = (a, n3) => {
    const r0 = 40;
    const n1 = -Math.sqrt(Math.max(1 - n3 * n3, 1e-12));
    const z = zamoInit(1, a, 0, r0, Math.PI / 2, [n1, 0, n3]);
    const res = trace({ M: 1, a, Q: 0, r0, th0: Math.PI / 2, ph0: 0, n: [n1, 0, n3],
                        maxSteps: 8000, tol: 1e-4, stepScale: 0.6, rFar: 200 });
    return { b: Math.abs(z.L / z.E), captured: !res.escaped };
  };
  /* n3 -> b is monotone, so a plain bisection on the launch angle is exact */
  const critB = (a, sign) => {
    let lo = 0.01, hi = 0.32;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (shotB(a, sign * m).captured) lo = m; else hi = m;
    }
    return shotB(a, sign * (lo + hi) / 2).b;
  };
  const bc = critB(0, 1);
  check('Schwarzschild shadow b_crit = 3 sqrt(3) M', bc, 3 * Math.sqrt(3), 6e-3, 'M');
  /* the photon sphere is the minimum of b(r) = r / sqrt(1 - 2M/r) */
  const bOfR = (r) => r / Math.sqrt(1 - 2 / r);
  let lo2 = 1.2, hi2 = 6;
  for (let i = 0; i < 200; i++) {
    const m1 = lo2 + (hi2 - lo2) * 0.382, m2 = lo2 + (hi2 - lo2) * 0.618;
    if (bOfR(m1) < bOfR(m2)) hi2 = m2; else lo2 = m1;
  }
  check('Schwarzschild photon sphere r_ph = 3M', (lo2 + hi2) / 2, 3, 5e-3, 'M');
  check('b(r_ph) reproduces the measured b_crit', bOfR((lo2 + hi2) / 2), bc, 6e-3, 'M');

  /* --- 8. frame dragging: the shadow edge is NOT symmetric ----------------
     exact reference (Bardeen 1972): equatorial circular photon orbits sit at
     r = 2M(1 + cos(2/3 arccos(-+a))) and the corresponding critical impact
     parameters come from  b = (r^2+a^2 +- a sqrt(Delta)) / (a +- sqrt(Delta)),
     which reproduces b = 2M / 7M for the extremal a = M hole. */
  const rph = (a, pro) => 2 * (1 + Math.cos((2 / 3) * Math.acos(pro ? -a : a)));
  const bExact = (a, pro) => {
    const r = rph(a, pro);
    const D = Math.sqrt(Math.max(r * r - 2 * r + a * a, 0));
    const s = pro ? 1 : -1;
    return Math.abs((r * r + a * a + s * a * D) / (a + s * D));
  };
  const spin = 0.86;
  const pro = critB(spin, 1), retro = critB(spin, -1);
  check('Kerr a=0.86 prograde b_crit (Bardeen r_ph=' + rph(spin, true).toFixed(3) + ')', pro, bExact(spin, true), 0.03, 'M');
  check('Kerr a=0.86 retrograde b_crit (Bardeen r_ph=' + rph(spin, false).toFixed(3) + ')', retro, bExact(spin, false), 0.03, 'M');
  checkTrue('frame dragging makes the shadow strongly asymmetric',
    (retro - pro) / retro > 0.45,
    'b_pro=' + pro.toFixed(3) + 'M  b_retro=' + retro.toFixed(3) + 'M  asymmetry=' + ((retro - pro) / retro * 100).toFixed(1) + '%');
  check('extremal a=M prograde b_crit analytic limit', bExact(1, true), 2, 1e-9, 'M');
  check('extremal a=M retrograde b_crit analytic limit', bExact(1, false), 7, 1e-9, 'M');
  const zz = zamoInit(1, 0.5, 0.7, 40, Math.PI / 2, [-Math.sqrt(1 - 0.04), 0, 0.2]);
  checkTrue('charged hole (a=0.5,Q=0.7) still yields finite conserved b',
    Number.isFinite(zz.L / zz.E), 'b=' + (zz.L / zz.E).toFixed(4));
}

/* --- 9. Kerr-Newman charge signature on the ISCO and the disk -------------- */
{
  const a = 0.4;
  const r0 = isco(1, a, 0), rq = isco(1, a, 0.6);
  checkTrue('KN charge reduces r_isco further', rq < r0, 'r_isco(a=0.4,Q=0)=' + r0.toFixed(4) + '  (Q=0.6)=' + rq.toFixed(4));
  checkTrue('Keplerian Omega > 0 and finite at the ISCO',
    Number.isFinite(omega(1, a, 0.6, rq)) && omega(1, a, 0.6, rq) > 0,
    'Omega(isco) = ' + omega(1, a, 0.6, rq).toFixed(5));
}

/* --- 10. accretion-disk formulae (open item O7) --------------------------- */
{
  /* Schwarzschild circular orbit: Omega = r^(-3/2) and u^t = (1-3M/r)^(-1/2),
     so the exact shift factor is  g = sqrt(1-3M/r)/(1-Omega b)  with the
     gravitational term on, and 1/(1-Omega b) with it off. */
  let worst = 0;
  for (const r of [6, 8, 12, 20, 40]) {
    const Om = Math.pow(r, -1.5);
    for (const b of [-8, -3, 0, 2, 5, 9]) {
      worst = Math.max(worst, Math.abs(diskGRaw(1, 0, 0, r, b, true) / (Math.sqrt(1 - 3 / r) / (1 - Om * b)) - 1));
      worst = Math.max(worst, Math.abs(diskGRaw(1, 0, 0, r, b, false) / (1 / (1 - Om * b)) - 1));
    }
  }
  checkTrue('disk shift factor vs the Schwarzschild closed form', worst < 1e-12,
    'max relative error = ' + worst.toExponential(2));
  const rin = 2.573;
  let pk = 0, pkAt = 0;
  for (let i = 0; i <= 40000; i++) {
    const r = rin * (1 + 3 * (i / 40000));
    const v = tempProfile(r, rin);
    if (v > pk) { pk = v; pkAt = r; }
  }
  check('NT profile peaks at 49/36 r_in', pkAt / rin, 49 / 36, 0.01, 'x r_in');
  check('NT peak normalised to 1', pk, 1, 2e-4, '');
  check('NT profile truncated at the ISCO', tempProfile(rin * 0.99, rin) + tempProfile(rin, rin), 0, 1e-12, '');
  let raw = 0, cl = 0;
  for (const a of [0, 0.5, 0.86, 0.998]) {
    const ri = isco(1, a, 0);
    for (let k = 0; k <= 200; k++) {
      const r = ri + ((60 - ri) * k) / 200;
      for (let j = -400; j <= 400; j++) {
        const b = j * 0.05;
        raw = Math.max(raw, diskGRaw(1, a, 0, r, b, false));
        cl = Math.max(cl, diskG(1, a, 0, r, b, false));
      }
    }
  }
  checkTrue('shift factor bounded by the firefly clamp', cl <= 6.0 + 1e-9,
    'unclamped max = ' + raw.toFixed(1) + ' (g^4 = ' + Math.pow(raw, 4).toExponential(1) + '), clamped = ' + cl.toFixed(3));
}

/* --- 11. Kerr-Newman photon orbits and the analytic critical curve -------- */
{
  /* Teo 2003 / Bardeen 1972: equatorial circular photon orbits sit at
     r = 2M(1 + cos(2/3 arccos(-+a/M))) for Kerr.  The generalised solver
     (roots of eta(r) = 0) must reproduce them, and by construction it also
     covers Q != 0 where no closed form is used. */
  const rphKerr = (a, pro) => 2 * (1 + Math.cos((2 / 3) * Math.acos(pro ? -a : a)));
  const o86 = equatorialPhotonOrbits(1, 0.86, 0);
  check('KN solver: a=0.86 prograde photon orbit r', o86.rPro, rphKerr(0.86, true), 2e-3, 'M');
  check('KN solver: a=0.86 retrograde photon orbit r', o86.rRet, rphKerr(0.86, false), 2e-3, 'M');
  const o998 = equatorialPhotonOrbits(1, 0.998, 0);
  check('KN solver: a=0.998 prograde photon orbit r', o998.rPro, rphKerr(0.998, true), 2e-3, 'M');

  /* the analytic critical curve must be a circle of radius 3 sqrt(3) M at a=0 */
  const c0 = criticalCurve(1, 0, 0, Math.PI / 2, 200);
  let rmin = 1e9, rmax = 0;
  for (const p of c0) { const rr = Math.hypot(p[0], p[1]); rmin = Math.min(rmin, rr); rmax = Math.max(rmax, rr); }
  check('critical curve a=0 is a circle (min radius)', rmin, 3 * Math.sqrt(3), 1e-6, 'M');
  check('critical curve a=0 is a circle (max radius)', rmax, 3 * Math.sqrt(3), 1e-6, 'M');

  /* the curve's equatorial extremes equal the exact photon-orbit impact
     parameters, for Kerr AND for charged Kerr-Newman */
  for (const [a, Q] of [[0.86, 0], [0.5, 0.5], [0.9, 0.3]]) {
    const c = criticalCurve(1, a, Q, Math.PI / 2, 300);
    let amin = 1e9, amax = -1e9;
    for (const p of c) { amin = Math.min(amin, p[0]); amax = Math.max(amax, p[0]); }
    const o = equatorialPhotonOrbits(1, a, Q);
    /* alpha = -xi / sin i, so the screen coordinate is the NEGATIVE of the
       impact parameter b = xi (the image is mirror-flipped by the choice of
       the alpha axis).  Comparing magnitudes, not raw signed values. */
    checkTrue('critical curve extremes == photon orbits (a=' + a + ', Q=' + Q + ')',
      Math.abs(-amin / o.bPro - 1) < 2e-3 && Math.abs(-amax / o.bRet - 1) < 2e-3,
      'curve alpha [' + amin.toFixed(4) + ', ' + amax.toFixed(4) + ']  <=>  b [',
      o.bRet.toFixed(4) + ', ' + o.bPro.toFixed(4) + ']');
  }

  /* and the RAYTRACER's own capture boundary must agree with the analytic
     photon-orbit impact parameters -- including with charge, which the old
     effective-spin shortcut got wrong */
  const shotKN = (a, Q, sign, n3) => {
    const r0 = 40;
    const n1 = -Math.sqrt(Math.max(1 - n3 * n3, 1e-12));
    const z = zamoInit(1, a, Q, r0, Math.PI / 2, [n1, 0, n3]);
    const res = trace({ M: 1, a, Q, r0, th0: Math.PI / 2, ph0: 0, n: [n1, 0, n3],
                        maxSteps: 8000, tol: 1e-4, stepScale: 0.6, rFar: 200, interior: false });
    return { b: Math.abs(z.L / z.E), captured: !res.escaped };
  };
  const critKN = (a, Q, sign) => {
    let lo = 0.005, hi = 0.32;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (shotKN(a, Q, sign, sign * m).captured) lo = m; else hi = m;
    }
    return shotKN(a, Q, sign, sign * (lo + hi) / 2).b;
  };
  const oq = equatorialPhotonOrbits(1, 0.5, 0.5);
  check('raytraced KN prograde b_crit (a=0.5, Q=0.5)', critKN(0.5, 0.5, +1), oq.bPro, 0.03, 'M');
  check('raytraced KN retrograde b_crit (a=0.5, Q=0.5)', critKN(0.5, 0.5, -1), Math.abs(oq.bRet), 0.03, 'M');
  const oq2 = equatorialPhotonOrbits(1, 0.0, 0.6);
  check('raytraced charged b_crit (a=0, Q=0.6)', critKN(0, 0.6, +1), oq2.bPro, 0.03, 'M');
  checkTrue('charge shrinks the shadow (Q=0.6 vs Q=0)', oq2.bPro < 3 * Math.sqrt(3),
    'b_crit(0,0.6) = ' + oq2.bPro.toFixed(4) + '  vs  ' + (3 * Math.sqrt(3)).toFixed(4));
}


/* --- 12. L1: photon-ring subrings and the Lyapunov exponent ---------------
   Primary sources for the convention used here:
     Bozza, PRD 66 103001 (2002)          -- strong deflection limit, abar = 1
     Gralla & Lupsasca, PRD 102 124003    -- per-half-orbit Lyapunov exponent
     arXiv:2406.09498 Eqs. 6-8            -- n_half = -ln|d|/gamma, delta r_n ~ e^{gamma n}
   Consequence: dPhi(b_c(1+x)) -> -(pi/gamma) ln x + const, and the n-th subring
   sits at d_n = exp(-gamma n), so successive subring offsets shrink by e^{-gamma}.
   gamma = pi sqrt(F''(u_c)/2) with F = (du/dphi)^2; it is exactly pi for
   Schwarzschild and is computed from the exact Carter reduction for KN.       */
{
  const eqPhi = (a, Q, b) => {
    const t = trace({ M, a, Q, r0: 60, th0: Math.PI / 2, ph0: 0, bEquator: b,
                      maxSteps: 400000, stepScale: 0.30, tol: 1e-6, rFar: 140, interior: false });
    return { phi: Math.abs(t.ph), ok: t.escaped || t.captured, steps: t.steps };
  };
  const lsFit = (pts) => {
    const n = pts.length;
    if (n < 3) return null;
    const mx = pts.reduce((p, c) => p + c[0], 0) / n, my = pts.reduce((p, c) => p + c[1], 0) / n;
    let sxy = 0, sxx = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
    return sxy / sxx;
  };
  const sweep = (a, Q, xs, retro) => {
    const o = equatorialPhotonOrbits(M, a, Q);
    const bC = retro ? o.bRet : o.bPro;
    const pts = [];
    for (const x of xs) { const w = eqPhi(a, Q, bC * (1 + x)); if (w.ok) pts.push([Math.log(x), w.phi]); }
    const S = lsFit(pts);
    const gAn = lyapEq(M, a, Q, bC, retro ? o.rRet : o.rPro).gamma;
    return { S, gMeas: isFinite(S) ? -Math.PI / S : NaN, gAn, pts, bC };
  };

  /* (a) the analytic exponent must reproduce the published pi exactly */
  const gSchw = lyapEq(M, 0, 0, 3 * Math.sqrt(3), 3).gamma;
  check('L1: analytic gamma for Schwarzschild is exactly pi', gSchw, Math.PI, 1e-12, '');

  /* (a2) the closed form for F'' must agree with an independent
     finite-difference evaluation of F on the same orbit */
  {
    const o0 = equatorialPhotonOrbits(M, 0, 0), o1 = equatorialPhotonOrbits(M, 0.9, 0);
    const e0 = lyapEq(M, 0, 0, o0.bPro, o0.rPro), e1 = lyapEq(M, 0.9, 0, o1.bPro, o1.rPro);
    check("L1: closed-form F'' == finite-difference F'' (Schwarzschild)", e0.Fpp, e0.FppNum, 2e-4, '');
    check("L1: closed-form F'' == finite-difference F'' (Kerr a=0.9)", e1.Fpp, e1.FppNum, 2e-4, '');
  }

  /* (b) the swept azimuth must diverge as -(1/abar) ln x with abar = 1 */
  const sw0 = sweep(0, 0, [1e-4, 1e-5, 1e-6, 1e-7, 1e-8]);
  check('L1: Schwarzschild winding slope dPhi/dln x = -1 (Bozza abar=1)', sw0.S, -1, 0.01, '');
  check('L1: Schwarzschild gamma from the slope (must be pi)', sw0.gMeas, Math.PI, 0.01, '');

  /* (c) same law with charge and with spin */
  const swQ = sweep(0, 0.6, [1e-4, 1e-6, 1e-8]);
  check("L1: RN Q=0.6M gamma matches pi*sqrt(F''/2)", swQ.gMeas, swQ.gAn, 0.005, '');
  checkTrue('L1: charge lowers the Lyapunov exponent below pi', swQ.gAn < Math.PI,
    'gamma(0,0.6) = ' + swQ.gAn.toFixed(6) + '  vs  pi = ' + Math.PI.toFixed(6));
  const swK = sweep(0.9, 0, [1e-4, 1e-6, 1e-8]);
  check("L1: Kerr a=0.9 prograde gamma matches pi*sqrt(F''/2)", swK.gMeas, swK.gAn, 0.005, '');
  const swKr = sweep(0.9, 0, [1e-4, 1e-6, 1e-8], true);
  check("L1: Kerr a=0.9 retrograde gamma matches pi*sqrt(F''/2)", swKr.gMeas, swKr.gAn, 0.005, '');

  /* (d) subring demagnification: successive subrings shrink by exp(-gamma) */
  const inv = (pts, target) => {
    const s = pts.slice().sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < s.length; i++) {
      if ((s[i - 1][1] - target) * (s[i][1] - target) <= 0 && s[i - 1][1] !== s[i][1]) {
        const fr = (target - s[i - 1][1]) / (s[i][1] - s[i - 1][1]);
        return Math.exp(s[i - 1][0] + fr * (s[i][0] - s[i - 1][0]));
      }
    }
    return NaN;
  };
  const wide = sweep(0, 0, [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9]);
  const nMax = Math.floor(Math.max(...wide.pts.map(p => p[1])) / Math.PI);
  const ratios = [];
  for (let k = 2; k < nMax; k++) {
    const d1 = inv(wide.pts, k * Math.PI), d2 = inv(wide.pts, (k + 1) * Math.PI);
    if (isFinite(d1) && isFinite(d2)) ratios.push(d2 / d1);
  }
  checkTrue('L1: successive subrings shrink geometrically', ratios.length >= 3,
    'ratios = ' + ratios.map(r => r.toFixed(6)).join(', '));
  const dLast = ratios.slice(-2);
  check('L1: subring ratio -> exp(-gamma) = exp(-pi) for Schwarzschild',
    dLast.reduce((p, c) => p + c, 0) / dLast.length, Math.exp(-Math.PI), 0.002, '');

  /* (e) regression guard for the turning-point freeze (defect B16).
     Before the fix, sc = 0.5(|t1|+|t2|+|t3|) collapsed to round-off AT the
     turning point, every step was rejected and h decayed to ~1e-10: a ray at
     x = 1e-9 froze with the winding stuck near 10 rad after 400000 steps. */
  const deepRay = eqPhi(0, 0, equatorialPhotonOrbits(M, 0, 0).bPro * (1 + 1e-9));
  checkTrue('L1: near-critical ray escapes instead of freezing at its turning point',
    deepRay.ok && deepRay.steps < 4000 && deepRay.phi > 22,
    'x=1e-9: steps = ' + deepRay.steps + ', |dPhi| = ' + deepRay.phi.toFixed(4) +
    ', escaped = ' + deepRay.ok);

  /* (f) the exact equatorial Carter state and the shader's ZAMO screen
     initialisation must describe the same geodesic */
  for (const [aa, qq] of [[0, 0], [0.9, 0], [0.5, 0.5]]) {
    const o = equatorialPhotonOrbits(M, aa, qq);
    const bT = o.bPro * 1.001;
    const bOf = (s) => { const z = zamoInit(M, aa, qq, 60, Math.PI / 2, [-Math.sqrt(Math.max(1 - s * s, 0)), 0, s]); return z.L / z.E; };
    let lo = 0, hi = 1, fl = bOf(lo), fh = bOf(hi);
    if (fl > fh) { const t = lo; lo = hi; hi = t; const t2 = fl; fl = fh; fh = t2; }
    let s = 0;
    for (let i = 0; i < 80; i++) { s = 0.5 * (lo + hi); const b = bOf(s); if ((b - bT) * (fl - bT) <= 0) { hi = s; } else { lo = s; fl = b; } }
    const n = [-Math.sqrt(Math.max(1 - s * s, 0)), 0, s];
    const tz = trace({ M, a: aa, Q: qq, r0: 60, th0: Math.PI / 2, ph0: 0, n, maxSteps: 200000, stepScale: 0.30, tol: 1e-6, rFar: 140, interior: false });
    const te = trace({ M, a: aa, Q: qq, r0: 60, th0: Math.PI / 2, ph0: 0, bEquator: bT, maxSteps: 200000, stepScale: 0.30, tol: 1e-6, rFar: 140, interior: false });
    check('L1: ZAMO screen init == exact equatorial state (a=' + aa + ', Q=' + qq + ')',
      Math.abs(tz.ph) / Math.abs(te.ph), 1, 5e-4, '');
  }
}

/* --- 13. L3: strict Liouville/Planck consistency of the disk source ---------
   The shader emits  chroma(T_obs) * pow(Trel, EXP) * gain * pow(g, 4)  with
   T_obs = g*T_e.  For this to be a blackbody it must be exactly
       I_nu(nu_obs) = B_nu(nu_obs, g T_e)
   i.e. (a) the emitted radiance scales as T_e^4 (Stefan-Boltzmann), (b) it is
   boosted by g^4, and (c) the chromaticity is read at the OBSERVED temperature.
   Everything below checks those three statements against the exact Planck
   function, and the shader literal against the single source of truth.        */
{
  const h = 6.62607015e-34, kB = 1.380649e-23, c = 2.99792458e8;
  /* exact spectral radiance, SI: W m^-2 sr^-1 Hz^-1 */
  const planck = (nu, T) => (2 * h * nu * nu * nu) / (c * c * (Math.exp((h * nu) / (kB * T)) - 1));

  /* (a) the scaling identity that makes the boost a pure temperature shift */
  const T0 = 13000, gTest = 1.31;
  let worstScale = 0;
  for (const nu of [1e13, 3e13, 1e14, 5e14, 1e15, 3e15]) {
    const lhs = planck(gTest * nu, T0);                 /* B_nu(a nu, T)      */
    const rhs = gTest * gTest * gTest * planck(nu, T0 / gTest);  /* a^3 B_nu(nu,T/a) */
    worstScale = Math.max(worstScale, Math.abs(lhs / rhs - 1));
  }
  check('L3: Planck identity B_nu(a nu, T) = a^3 B_nu(nu, T/a)', worstScale, 0, 1e-12, 'rel');

  /* (b) the invariant I_nu / nu^3 under the boost: the observed spectrum of a
     blackbody at T_e seen with shift g is a blackbody at g*T_e */
  let worstInv = 0;
  for (const nuObs of [2e13, 8e13, 3e14, 1e15, 4e15]) {
    const boosted = planck(nuObs, gTest * T0);
    const transported = Math.pow(gTest, 3) * planck(nuObs / gTest, T0);
    worstInv = Math.max(worstInv, Math.abs(boosted / transported - 1));
  }
  check('L3: I_nu(nu_obs) == g^3 B_nu(nu_obs/g, T_e) (bolometric -> B_nu(nu_obs, g T_e))',
    worstInv, 0, 1e-12, 'rel');

  /* (c) bolometric intensity ratio must be exactly g^4.  Integrated numerically
     on a FIXED absolute frequency grid so the two cases are not trivially the
     same substitution. */
  const nuLo = 1e9, nuHi = 1e19, NPTS = 400000;
  const dln = Math.log(nuHi / nuLo) / (NPTS - 1);
  const bol = (T) => {
    let s = 0;
    for (let i = 0; i < NPTS; i++) {
      const nu = nuLo * Math.exp(i * dln);
      s += planck(nu, T) * nu * dln;      /* dnu = nu dln nu */
    }
    return s;
  };
  const b0 = bol(T0), bg = bol(gTest * T0);
  check('L3: bolometric intensity ratio == g^4 (numerical integral)', bg / b0, Math.pow(gTest, 4), Math.pow(gTest, 4) * 1e-6, '');
  /* and the Stefan-Boltzmann T^4 law itself for a second temperature */
  check('L3: I_bol(T) / T^4 is constant (Stefan-Boltzmann)', bol(2 * T0) / b0, 16, 1e-6, '');

  /* (d) the shipped exponent must be the exact one, in the CPU twin AND in the
     GLSL literal -- a source-level guard so the softening cannot come back */
  check('L3: DISK_TEMP_EXP is the Stefan-Boltzmann exponent', DISK_TEMP_EXP, 4, 0, '');
  const glsl = readFileSync(new URL('../shaders/disk.glsl', import.meta.url), 'utf8');
  const mm = /pow\(clamp\(Trel, 0\.0, 1\.0\), ([0-9.]+)\)/.exec(glsl);
  checkTrue('L3: shaders/disk.glsl carries the same exponent literal',
    !!mm && Number(mm[1]) === DISK_TEMP_EXP,
    mm ? 'GLSL literal = ' + mm[1] + ', DISK_TEMP_EXP = ' + DISK_TEMP_EXP : 'pattern not found in disk.glsl');
  const au = readFileSync(new URL('../js/audit.js', import.meta.url), 'utf8');
  checkTrue('L3: the audit harness has no hard-coded softened exponent left',
    !/3\.4\s*\)\s*\*\s*Math\.pow|Math\.max\(q\.prof, 1e-6\), 3\.4\)/.test(au),
    'no 3.4 exponent remains in js/audit.js');

  /* (e) the chromatic pathway: the colour must be read at T_obs = g*T_e, which
     is what makes the boost a temperature shift and not a colour ramping */
  checkTrue('L3: the observed temperature is exactly g times the emitted one',
    /float Tobs = uDiskTemp \* Trel \* g;/.test(glsl),
    'disk.glsl: Tobs = uDiskTemp * Trel * g');
  /* Strip comments before this guard: the fix documents the old expression, and a
     naive substring test would be tripped by its own explanatory comment. */
  const stripComments = (src) => src.split('/*').map((s, i) => (i === 0 ? s : s.slice(s.indexOf('*/') + 2))).join(' ').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const glslCode = stripComments(glsl);
  checkTrue('POLICY: no density-driven chromatic temperature remains (every segment is Planckian)',
    !glslCode.includes('0.35 * min(dens, 1.5)') && !glslCode.includes('(0.80 + 0.35'),
    'density enters only through dtau = kN_TAU * dens * ds');
  checkTrue('L3: the beaming exponent in the shader is 4',
    /uDiskGain \* pow\(max\(g, 0\.02\), 4\.0\)/.test(glsl),
    'disk.glsl: ... * uDiskGain * pow(max(g, 0.02), 4.0)');
}

/* --- 14. L2: relativistic thin-disk dissipation (Page & Thorne 1974) ------
   The disk temperature is now T ~ F^(1/4) with the viscously dissipated flux
      F(r) = (L(r) - L(r_in)) * (-dOmega/dr) / (4 pi r) ,
   the torque vanishing at the inner edge.  Three independent statements pin it:
   the Newtonian limit must reproduce the Shakura-Sunyaev closed form, F must
   vanish at the ISCO, and the integrated luminosity must equal the standard
   radiative efficiency 1 - E(r_in) (5.719% Schwarzschild, 32.1% for a=0.998). */
{
  const cases = [[1, 0, 0], [1, 0.5, 0], [1, 0.9, 0], [1, 0.998, 0], [1, 0, 0.6], [1, 0.5, 0.5]];
  let worstDev = 0, worstFirstLaw = 0, worstF0 = 0;
  const effs = [];
  for (const [m, a, q] of cases) {
    const rin = isco(m, a, q);
    const t = diskFluxTable(m, a, q, rin, 4093);
    effs.push(100 * t.efficiency);
    worstDev = Math.max(worstDev, Math.abs(t.luminosity / t.efficiency - 1));
    worstF0 = Math.max(worstF0, Math.abs(t.F[0] / t.fmax));
    for (let i = 1; i < t.r.length - 1; i += 71) {
      /* near the ISCO dL/dr -> 0, so a RELATIVE check of dE = Omega dL is
         dominated by the finite-difference error there; stay clear of it */
      if (t.r[i] < rin * 1.25) continue;
      const h = t.r[i + 1] - t.r[i - 1];
      const dE = (t.E[i + 1] - t.E[i - 1]) / h, dL = (t.L[i + 1] - t.L[i - 1]) / h;
      if (Math.abs(dL) > 1e-9) worstFirstLaw = Math.max(worstFirstLaw, Math.abs(dE / (t.Om[i] * dL) - 1));
    }
  }
  check('L2: thin-disk luminosity identity  L_tot = 1 - E(r_in)', worstDev, 0, 5e-3, 'rel');
  check('L2: circular-orbit first law dE = Omega dL', worstFirstLaw, 0, 1e-3, 'rel');
  check('L2: zero-torque inner boundary F(r_in) = 0', worstF0, 0, 1e-9, 'of peak');
  check('L2: Schwarzschild radiative efficiency = 5.7191%', effs[0], 5.7191, 5e-3, '%');
  check('L2: a=0.998 radiative efficiency ~ 32.1% (literature)', effs[3], 32.0994, 0.02, '%');
  check('L2: charge raises the efficiency above the Schwarzschild value', effs[4], 6.2722, 0.01, '%');
  const tSch = diskFluxTable(1, 0, 0, 6, 4093);
  check('L2: relativistic temperature peak r/rin = 1.6523 (Newtonian 1.3611)', tSch.peakR / 6, 1.6523, 5e-3, 'r_in');
  let worstSS = 0;
  for (let i = 1; i < 6000; i++) {
    const r = 6 * Math.exp((i / 6000) * Math.log(1e6));
    const h = 3e-3 * r;
    const dOm = (Math.pow(r + h, -1.5) - Math.pow(r - h, -1.5)) / (2 * h);
    const F = (Math.sqrt(r) - Math.sqrt(6)) * (-dOm) / (4 * Math.PI * r);
    worstSS = Math.max(worstSS, Math.abs(F / ssFluxNewtonian(r, 6) - 1));
  }
  check('L2: law reduces to the Shakura-Sunyaev flux in the Newtonian limit', worstSS, 0, 1e-4, 'rel');
  const gd = readFileSync(new URL('../shaders/disk.glsl', import.meta.url), 'utf8');
  checkTrue('L2: the shader takes the disk TEMPERATURE from knFluxTemp',
    gd.includes('float prof = knFluxTemp(r);'), 'disk.glsl');
  checkTrue('L2: the shader keeps the SS shape only for the DENSITY',
    gd.includes('float prof = knTempProfile(r, rin);'), 'disk.glsl');
  checkTrue('L2: the relativistic flux law is present in GLSL',
    gd.includes('(L - uFluxLin) * (-dOm)'), 'disk.glsl');
}

/* --- 15. L4: physicality of the charge ------------------------------------
   The (M,a,Q) family is the complete electrovacuum class (no-hair), but no
   astrophysical hole is an electrovacuum: it is screened by its plasma.  The
   surviving charge is bounded by the Wald equilibrium (2 a M B) and by the
   plasma bound (m_p/e).  The unit conversions used to quote those numbers in
   metres are themselves checked here, through the fine-structure constant. */
{
  const hP = 6.62607015e-34, hbar = hP / (2 * Math.PI), c = 2.99792458e8;
  const G = 6.67430e-11, eC = 1.602176634e-19, mp = 1.67262192369e-27, Msun = 1.98892e30;
  const eGeom = eC * GEOM_M_PER_C, hbarGeom = hbar * G / (c * c * c);
  check('L4: the C -> metres factor reproduces alpha = 1/137.036', eGeom * eGeom / hbarGeom,
    1 / 137.035999084, 1e-5, '');
  check('L4: one solar mass in metres', M_SUN_GEOM, G * Msun / (c * c), 1.5, 'm');
  check('L4: one gauss = 1e-4 * (one coulomb factor)', GEOM_M_PER_GAUSS / GEOM_M_PER_C, 1e-4, 1e-12, '');
  check('L4: plasma charge bound (m_p/e in geometrized units)', CHARGE_BALANCE_OVER_M,
    mp * G / (c * c) / eGeom, 1e-21, '');
  const wald = waldChargeOverM(0.86, 1e4, 10);
  check('L4: Wald |Q|/M for 10 Msun, a/M=0.86, B=1e4 G', wald, 2.19e-13, 2e-15, '');
  checkTrue('L4: the Wald charge is linear in B and in a/M',
    Math.abs(waldChargeOverM(0.86, 2e4, 10) / (2 * wald) - 1) < 1e-12 &&
    Math.abs(waldChargeOverM(0.43, 1e4, 10) / (0.5 * wald) - 1) < 1e-12, 'linear');
  const cp = chargePhysicality(0.6, { aOverM: 0.86 });
  check('L4: the slider at Q=0.6 sits 12.44 decades above reality', cp.ordersAbove, 12.44, 0.05, 'dex');
  /* POLICY CHANGE, RECORDED RATHER THAN ASSUMED.  This block used to require that sanitize()
     pulled a^2 + Q^2 back inside the black-hole regime and reported the clamp factor through
     lastExtremalClamp.  That clamp was DELIBERATELY REMOVED: js/params.js says so in the code
     ("the black-hole clamp a^2 + Q^2 < M^2 is GONE: extremal holes and naked singularities are
     the point of this build") and the README records it twice ("the sub-extremality clamp is
     gone" / "extended domain M +/-, a +/-, Q +/- | done, no clamping").  The checks below were
     left encoding the superseded policy, so the harness had been reading 105 / 108 since the
     removal.  They now pin the CURRENT policy: the naked region is reachable, the numerical
     DOMAIN is still clamped, and the disclaimer lives where it now actually is. */
  checkTrue('L4: the Q parameter is labelled as not astrophysical',
    readFileSync(new URL('../js/hud.js', import.meta.url), 'utf8').includes('not a model of an astrophysical hole'), 'hud.js');
  checkTrue('L4: the panel note states the plasma screening scale',
    readFileSync(new URL('../js/hud.js', import.meta.url), 'utf8').includes('screened'), 'hud.js');
  const naked = sanitize({ ...DEFAULTS, M: 1, a: 0.998, Q: 0.98 });
  checkTrue('L4: a^2 + Q^2 > M^2 is REACHABLE (the sub-extremality clamp is gone by design)',
    naked.a === 0.998 && naked.Q === 0.98 && naked.a * naked.a + naked.Q * naked.Q > 1,
    'a = ' + naked.a.toFixed(4) + ', Q = ' + naked.Q.toFixed(4));
  const dom = sanitize({ ...DEFAULTS, M: 0.5, a: 1.9, Q: -2.4 });
  checkTrue('L4: the numerical DOMAIN is still clamped (|a|,|Q| <= 1.5|M|)',
    dom.a === 0.75 && dom.Q === -0.75,
    'M = 0.5: a -> ' + dom.a.toFixed(4) + ', Q -> ' + dom.Q.toFixed(4));
}

/* --- 16. sky: star field and galaxy coverage ------------------------------
   The sky had ZERO test coverage, which is exactly how a sub-pixel star PSF
   shipped unnoticed: the field generated ~30k stars and rendered five specks.
   These checks pin the PSF angular size (the defect class), the generated star
   count, and the agreement between the GLSL literals and js/kn.js.            */
{
  const sky = readFileSync(new URL('../shaders/sky.glsl', import.meta.url), 'utf8');
  const psfPx = skyStarPsfPx();
  checkTrue('sky: star PSF core is 1.5-4 px wide at 62 deg / 720 px', psfPx >= 1.5 && psfPx <= 4,
    psfPx.toFixed(2) + ' px  (the old fixed exp(-d2*300) gave 0.9/0.4/0.2 px)');
  const mPsf = /STAR_PSF_RAD\s*=\s*([0-9.]+)/.exec(sky);
  checkTrue('sky: the GLSL PSF literal matches SKY_PSF_RAD',
    !!mPsf && Number(mPsf[1]) === SKY_PSF_RAD,
    mPsf ? 'GLSL ' + mPsf[1] + ' vs JS ' + SKY_PSF_RAD : 'STAR_PSF_RAD not found');
  checkTrue('sky: the old sub-pixel PSF (exp(-d2*300)) is gone', !sky.includes('d2 * 300.0'), 'sky.glsl');
  const scales = [...sky.matchAll(/starLayer\(d, ([0-9.]+),/g)].map((m) => Number(m[1]));
  checkTrue('sky: the three star layer scales match js/kn.js',
    scales.length === 3 && scales.every((v, i) => v === SKY_STAR_SCALES[i]),
    'GLSL [' + scales.join(', ') + ']');
  const ths = [...sky.matchAll(/mix\(([0-9.]+), ([0-9.]+), density\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  checkTrue('sky: the three star thresholds match js/kn.js',
    ths.length === 3 && ths.every((v, i) => v[0] === SKY_STAR_THRESH[i][0] && v[1] === SKY_STAR_THRESH[i][1]),
    'GLSL ' + JSON.stringify(ths));
  const nDefault = skyStarCount(0.66);
  checkTrue('sky: the default density puts >= 500 stars in frame', nDefault >= 500,
    Math.round(nDefault) + ' stars in a 62 deg 16:9 frame');
  checkTrue('sky: denser settings only add stars',
    skyStarCount(1.2) > nDefault && skyStarCount(0.2) < nDefault,
    'n(0.2)=' + Math.round(skyStarCount(0.2)) + ' n(0.66)=' + Math.round(nDefault) + ' n(1.2)=' + Math.round(skyStarCount(1.2)));
  check('sky: hemisphere limit of the frame solid angle', skyFrameSolidAngle(180, 1), 2 * Math.PI, 1e-6, 'sr');
  check('sky: small-angle limit of the frame solid angle',
    skyFrameSolidAngle(1, 1) / Math.pow((1 * Math.PI) / 180, 2), 1, 5e-3, '');
  /* regression pin only: the two LIMIT checks above are what validate the
     formula; this records the shipped fov so a change shows up here. */
  check('sky: frame solid angle at 62 deg 16:9 (regression pin)', skyFrameSolidAngle(62, 16 / 9), 1.5419, 5e-4, 'sr');
  checkTrue('sky: zero density yields no stars', skyStarCount(0) === 0, 'n(0) = ' + skyStarCount(0));
}
console.log(rows.map(r => [r[0].padEnd(5), r[1].padEnd(56), r[2].padStart(14), r[3].padStart(14), r[4].padStart(12), r[5]].join(' ')).join('\n'));
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');

/* machine readable summary for the report */
console.log(JSON.stringify({ pass, fail, checks: rows.map(r => ({ ok: r[0] === 'PASS', name: r[1], got: r[2], want: r[3] })) }));
process.exit(fail ? 1 : 0);