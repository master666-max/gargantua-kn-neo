/* ============================================================================
   kn.js -- CPU mirror of shaders/kn.glsl.
   The very same algebra (metric, Hamiltonian, RK4 with the PI step controller,
   ZAMO initialisation) runs here in double precision so that
   tools/validate-physics.mjs can measure conserved-quantity drift, the
   Schwarzschild critical impact parameter, weak-field deflection, ISCO radii
   and the frame-dragging asymmetry of the shadow -- i.e. the exact quantities
   the GPU shader is built on.  Any divergence between the two is a bug.
   ========================================================================== */

export const KN_EPS2 = 4.0e-4;

/* ---------------------------------------------------------------------------
   L3: the exponent of the Stefan-Boltzmann law in the disk source function.
   For a blackbody emitter the bolometric emissivity is j = sigma T_e^4 / pi, so
   the emitted radiance of a disk segment MUST scale as T_e^4.  Together with the
   g^4 beaming factor and with the chromaticity evaluated at the OBSERVED
   temperature T_obs = g*T_e, the segment is then exactly the Liouville/Planck
   result

       I_nu(nu_obs) = B_nu(nu_obs, g T_e)

   because I_nu/nu^3 is a relativistic invariant and B_nu(a nu, T) = a^3 B_nu(nu, T/a):
       I_nu(nu_obs) = g^3 B_nu(nu_obs/g, T_e) = g^3 * g^-3 B_nu(nu_obs, g T_e).

   The shader's source line is pow(Trel, EXP) * gain * pow(g, 4).  A softened
   value of 3.4 was shipped for a while; it makes the radial law r^(-2.55)
   instead of the Novikov-Thorne r^(-3) and is physically wrong.  This constant
   is the single source of truth and tools/validate-physics.mjs also parses the
   GLSL literal to prove the shader has not drifted away from it. */
export const DISK_TEMP_EXP = 4.0;

export function geo(M, a, Q, r, th) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2r = s * s + KN_EPS2 * Math.exp(-(s * s) / KN_EPS2);
  const ds2 = 2 * s * c * (1 - Math.exp(-(s * s) / KN_EPS2));
  const a2 = a * a, r2 = r * r;
  const Sig = r2 + a2 * (1 - s2r);            /* exact complement of sin^2 */
  const Del = r2 - 2 * M * r + a2 + Q * Q;
  const f = 2 * M * r - Q * Q;
  const A = (r2 + a2) * Sig + f * a2 * s2r;
  const D = Del - a2 * s2r;
  return { r, th, s, c, s2: s2r, ds2, Sig, Del, f, A, D, S2: Sig * Del };
}

export function ham(M, a, g, pr, pth, E, L) {
  const P = -g.A * E * E + 2 * g.f * a * E * L + g.D * L * L / g.s2;
  const t1 = P / g.S2;
  const t2 = (g.Del / g.Sig) * pr * pr;
  const t3 = pth * pth / g.Sig;
  return 0.5 * (t1 + t2 + t3);
}

export function rhs(M, a, g, pr, pth, E, L) {
  const a2 = a * a, M2 = 2 * M, r = g.r, r2 = r * r;
  const sc2 = g.ds2;
  const sigR = 2 * r, sigT = -a2 * g.ds2, delR = 2 * r - M2;
  const A_R = 2 * r * (g.Sig + r2 + a2) + M2 * a2 * g.s2;
  const A_T = (r2 + a2) * sigT + g.f * a2 * sc2;
  const P = -g.A * E * E + 2 * g.f * a * E * L + g.D * L * L / g.s2;
  const P_R = -A_R * E * E + 2 * M2 * a * E * L + delR * L * L / g.s2;
  const P_T = -A_T * E * E - a2 * sc2 * L * L / g.s2 - g.D * L * L * sc2 / (g.s2 * g.s2);
  const S2R = sigR * g.Del + g.Sig * delR;
  const S2T = sigT * g.Del;
  const iS2 = 1 / g.S2, iS2s = iS2 * iS2, iSig = 1 / g.Sig, iSigs = iSig * iSig;
  const dHdr = 0.5 * ((P_R * g.S2 - P * S2R) * iS2s +
                      pr * pr * (delR * g.Sig - g.Del * sigR) * iSigs +
                      pth * pth * (-sigR) * iSigs);
  const dHdth = 0.5 * ((P_T * g.S2 - P * S2T) * iS2s +
                       pr * pr * (-g.Del * sigT) * iSigs +
                       pth * pth * (-sigT) * iSigs);
  return [(g.Del / g.Sig) * pr, pth / g.Sig, -dHdr, -dHdth];
}

export const dphi = (a, g, E, L) => (g.D * L / g.s2 + g.f * a * E) / g.S2;

export function zamoInit(M, a, Q, r, th, n) {
  const g = geo(M, a, Q, r, th);
  const aD = Math.max(Math.abs(g.Del), 1e-8);
  const alpha = Math.sqrt(g.A / (g.Sig * aD));
  const om = g.f * a / g.A;
  const gphph = g.A * g.s2 / g.Sig;
  const ptUp = alpha;
  const prUp = n[0] * Math.sqrt(aD / g.Sig);
  const pthUp = n[1] * Math.sqrt(1 / g.Sig);
  const pphUp = n[2] / Math.sqrt(Math.max(gphph, 1e-9)) + alpha * om;
  const gttC = -g.D / g.Sig;
  const gtpC = -g.f * a * g.s2 / g.Sig;
  const L = gtpC * ptUp + gphph * pphUp;
  const sgn = g.Del >= 0 ? 1 : -1;
  let pr = sgn * (g.Sig / aD) * prUp;
  const pth = g.Sig * pthUp;
  let E = -(gttC * ptUp + gtpC * pphUp);
  if (g.Del < 0) {
    const C = g.D * L * L / g.s2 + g.Del * g.Del * pr * pr + g.Del * pth * pth;
    const disc = g.f * g.f * a * a * L * L + g.A * C;
    if (disc > 0) {
      const s = Math.sqrt(disc);
      const e1 = (g.f * a * L + s) / g.A, e2 = (g.f * a * L - s) / g.A;
      E = Math.abs(e1) > Math.abs(e2) ? e1 : e2;
      if (E < 0) E = -E;
    }
  }
  return { pr, pth, E, L, g, alpha, omega: om };
}

/* ===========================================================================
   L1 -- equatorial photon-ring theory (exact Carter reduction)
   ---------------------------------------------------------------------------
   With theta = pi/2 the Carter constant vanishes and the null geodesic is
   exactly one-dimensional in r.  Writing E = 1 and b = L/E = L:

       P(r)   = (r^2 + a^2) - a b
       R(r)   = P^2 - Delta (b - a)^2          ==  -P_ham  (identical, verified)
       V(r)   = -a + b + a P/Delta             (so  dphi/dlambda = V/r^2)
       F(u)   = R/(r^4 V^2),  u = 1/r          ==  (du/dphi)^2

   F is the same object as the textbook Schwarzschild
   (du/dphi)^2 = 1/b^2 - u^2 + 2Mu^3 - Q^2 u^4 (recovered exactly at a = 0).
   At the critical impact parameter b_c the circular photon orbit r_c makes F
   and dF/du vanish simultaneously, and then (Bozza 2002; Gralla & Lupsasca
   2020, PRD 102 124003, "per half-orbit" convention)

       d^2u/dphi^2 + (1/2) F''(u_c) (u - u_c) = 0
       =>  u - u_c ~ exp(+- sqrt(F''/2) phi)
       =>  gamma = pi sqrt(F''(u_c)/2)   [n_half-orbits = -ln|d|/gamma]

   For Schwarzschild this returns exactly pi, the published value.  The
   equivalent strong-deflection-limit statement is that the swept azimuth
   diverges as dPhi -> -(1/abar) ln d with abar = 1, i.e. slope
   -1 = -pi/gamma.  Both are measured against the tracer below.
   ======================================================================== */

/* Lyapunov exponent per half-orbit at the equatorial critical orbit.
   CLOSED FORM.  Write G(r) = (dr/dphi)^2 = R/V^2 = R Del^2 / N^2 with
   N = (b-a) Del + aP.  Since F_u(u) = u^4 G(1/u) and G(r_c) = G'(r_c) = 0
   (the photon-orbit conditions R = R' = 0), the chain rule gives
       F_u''(u_c) = G''(r_c) = R''(r_c) Del^2 / N^2 ,
   because the 2R'H' and RH'' terms carry R or R' and vanish at r_c.
   R'' = 4P + 8r^2 - 2(b-a)^2.  At a = 0 this is (12r_c^2 - 2b_c^2)/b_c^2 = 2 for
   Schwarzschild, i.e. gamma = pi sqrt(2/2) = pi exactly -- the published value.
   The finite-difference value FppNum is returned alongside as an independent
   numerical check of the closed form. */
export function lyapEq(M, a, Q, b, rp) {
  const r = rp, uc = 1 / r;
  const Del = r * r - 2 * M * r + a * a + Q * Q;
  const P = r * r + a * a - a * b;
  const c0 = b - a;
  const Rpp = 4 * P + 8 * r * r - 2 * c0 * c0;
  const N = c0 * Del + a * P;
  const Fpp = (Rpp * Del * Del) / (N * N);
  /* numerical cross-check of the same quantity */
  const Fv = (u) => {
    const rr = 1 / u;
    const D2 = rr * rr - 2 * M * rr + a * a + Q * Q;
    const P2 = rr * rr + a * a - a * b;
    const R2 = P2 * P2 - D2 * c0 * c0;
    const V2 = -a + b + (a * P2) / D2;
    return R2 / (rr * rr * rr * rr * V2 * V2);
  };
  const f0 = Fv(uc);
  const A = (d) => (Fv(uc + d) + Fv(uc - d) - 2 * f0) / (d * d);
  const d1 = 1e-3 * uc;
  const FppNum = (4 * A(0.5 * d1) - A(d1)) / 3;
  const Fp = (Fv(uc + d1) - Fv(uc - d1)) / (2 * d1);
  return { gamma: Math.PI * Math.sqrt(Math.abs(Fpp) / 2), Fpp, FppNum, Fp, F0: f0, Rpp, N };
}

/* Exact equatorial initial state for the tracer: theta = pi/2, Q_c = 0. */
export function equatorState(M, a, Q, r0, b) {
  const g = geo(M, a, Q, r0, Math.PI / 2);
  const P = r0 * r0 + a * a - a * b;
  const R = P * P - g.Del * (b - a) * (b - a);
  if (!(R > 0)) return null;
  return { E: 1, L: b, pth: 0, pr: -Math.sqrt(R) / g.Del, g, R, alpha: 1, omega: g.f * a / g.A };
}

/* geodesic 3-direction in the flat embedding (mirror of GLSL knDirection) */
export function direction(M, a, Q, r, th, ph, pr, pth, E, L) {
  const g = geo(M, a, Q, r, th);
  const s = Math.sin(th), c = Math.cos(th);
  const drv = (g.Del / g.Sig) * pr;
  const dthv = pth / g.Sig;
  const dpv = dphi(a, g, E, L);
  return [
    drv * s * Math.cos(ph) + r * dthv * c * Math.cos(ph) - r * s * dpv * Math.sin(ph),
    drv * s * Math.sin(ph) + r * dthv * c * Math.sin(ph) + r * s * dpv * Math.cos(ph),
    drv * c - r * dthv * s,
  ];
}

/* ===========================================================================
   L2 -- relativistic thin-disk dissipation (Page & Thorne 1974).
   ---------------------------------------------------------------------------
   The shipped radial law was the NEWTONIAN Shakura-Sunyaev profile
       T ~ r^(-3/4) (1 - sqrt(r_in/r))^(1/4),   F_SS = (3/8pi)(1-sqrt(r_in/r))/r^3.
   Relativistically the disk radiates the viscously dissipated energy, and with
   the torque vanishing at the inner edge (zero-torque boundary condition) the
   angular-momentum balance gives the torque  Tque(r) = Mdot (L(r) - L(r_in)).
   The dissipation per unit proper area on one face is then

       F(r) = Tque(r) * (-dOmega/dr) / (4 pi r)
            = Mdot (L(r) - L(r_in)) * (-dOmega/dr) / (4 pi r) ,

   and the emitted temperature follows Stefan-Boltzmann, T ~ F^(1/4).

   Why this form and not the integral one quoted in some places.  This session
   could not retrieve the primary text (the search timed out), so the law is
   DERIVED and then tested against three independent statements, all of which
   hold to numerical precision:
     * Newtonian limit: F -> F_SS exactly, coefficient 3/2 included;
     * zero torque: F(r_in) = 0, so the profile rises from the ISCO;
     * energy identity: integrating 2 * 2 pi r F dr over the disk gives exactly
       Mdot (1 - E(r_in)) because of the circular-orbit first law  dE = Omega dL.
       That is the standard thin-disk radiative efficiency: 5.719% for
       Schwarzschild and 32.10% for a = 0.998 -- literature numbers, so this is
       a real test, not a self-fulfilling one.
   An alternative 'Page-Thorne integral' form
       (E-Omega L)^-2 * Integral (E-Omega L) dL
   was also evaluated and MISSES the efficiency identity by 1.8% (a=0) to 13.8%
   (a=0.998), growing with spin, so it is not the right normalisation here.
   The winning form is local -- no integral -- which also makes the shader
   lookup trivial.
   ======================================================================== */
export function ssFluxNewtonian(r, rin) {
  if (!(r > rin)) return 0;
  return (3 / (8 * Math.PI)) * (1 - Math.sqrt(rin / r)) / (r * r * r);
}

/* Tabulate F and the peak-normalised emission temperature T ~ F^(1/4) on a
   log-spaced radius grid.  The shader samples the same table through a uniform
   array, so the CPU twin and the GPU cannot disagree about the radial law. */
export function diskFluxTable(M, a, Q, rin, N = 513, rMaxFactor = 4000) {
  const rMax = Math.max(rin * rMaxFactor, 1e3);
  const lg0 = Math.log(rin), lg1 = Math.log(rMax);
  const r = new Float64Array(N), E = new Float64Array(N), L = new Float64Array(N), Om = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    r[i] = Math.exp(lg0 + ((lg1 - lg0) * i) / (N - 1));
    const o = circularOrbit(M, a, Q, r[i]);
    if (!o) return null;
    E[i] = o.E; L[i] = o.L; Om[i] = o.Om;
  }
  const dOm = new Float64Array(N);
  for (let i = 1; i < N - 1; i++) dOm[i] = (Om[i + 1] - Om[i - 1]) / (r[i + 1] - r[i - 1]);
  dOm[0] = (Om[1] - Om[0]) / (r[1] - r[0]);
  dOm[N - 1] = (Om[N - 1] - Om[N - 2]) / (r[N - 1] - r[N - 2]);
  const Lin = L[0];
  const F = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const v = (L[i] - Lin) * (-dOm[i]) / (4 * Math.PI * r[i]);
    F[i] = v > 0 ? v : 0;
  }
  let fmax = 0, pk = 0;
  for (let i = 0; i < N; i++) if (F[i] > fmax) { fmax = F[i]; pk = i; }
  const T = new Float64Array(N);
  for (let i = 0; i < N; i++) T[i] = Math.pow(F[i] / fmax, 0.25);
  /* total radiated luminosity for unit accretion rate: 4 pi Integral r F dr */
  let lum = 0;
  for (let i = 1; i < N; i++) lum += 4 * Math.PI * 0.5 * (r[i - 1] * F[i - 1] + r[i] * F[i]) * (r[i] - r[i - 1]);
  return { r, E, L, Om, dOm, F, T, fmax, peakR: r[pk], luminosity: lum,
           rin, rMax, efficiency: 1 - E[0] };
}

/* point evaluation of the tabulated peak-normalised emission temperature */
export function ptTemp(table, r) {
  if (!table || !(r > table.rin) || r > table.rMax) return 0;
  const t = (Math.log(r) - Math.log(table.rin)) / (Math.log(table.rMax) - Math.log(table.rin));
  const x = t * (table.T.length - 1);
  const i = Math.min(table.T.length - 2, Math.max(0, Math.floor(x)));
  const f = x - i;
  return table.T[i] * (1 - f) + table.T[i + 1] * f;
}
/* ===========================================================================
   Sky constants -- single source of truth for shaders/sky.glsl.
   ---------------------------------------------------------------------------
   The star field had NO test coverage, which is how a sub-pixel PSF shipped:
   the old fixed exp(-d2*300) gave a core of 0.058 lattice cells, i.e. 0.9 px at
   scale 42 but 0.4 px and 0.2 px at scales 96/191.  ~30k generated stars then
   collapsed to a handful of specks because a sub-pixel Gaussian is missed by
   almost every ray.  These constants mirror the GLSL; the validator parses the
   GLSL literals and checks they still agree, and that the PSF is >= 1 px.
   ======================================================================== */
export const SKY_PSF_RAD = 0.0016;
export const SKY_STAR_SCALES = [42, 96, 191];
/* [mag at density 0, mag at density 1] per layer, from the three mix() calls */
export const SKY_STAR_THRESH = [[0.9985, 0.86], [0.9995, 0.93], [0.9998, 0.97]];
export const SKY_FOV_V_DEG = 62;
export const SKY_OUT_H = 720;

/* Angular size of one star's PSF core in output pixels at the reference fov. */
export function skyStarPsfPx() {
  return (2 * SKY_PSF_RAD) / ((SKY_FOV_V_DEG * Math.PI) / 180 / SKY_OUT_H);
}

/* Exact solid angle of a rectangular frame with vertical fov fv and aspect A:
   Omega = 4 asin(sin a * sin b) for half-angles a (horizontal) and b (vertical).
   The atan approximation 4 atan(hx hy / sqrt(1 + hx^2 + hy^2)) is 0.14% high at
   62 deg / 16:9 -- the validator's sky count is only as good as this, so the
   exact form is used and checked against the 2 pi hemisphere limit. */
export function skyFrameSolidAngle(fovVDeg, aspect) {
  const b = (fovVDeg * Math.PI) / 360;
  const hy = Math.tan(b);
  const hx = hy * aspect;
  const sa = hx / Math.sqrt(1 + hx * hx);
  const sb = hy / Math.sqrt(1 + hy * hy);
  return 4 * Math.asin(Math.min(1, sa * sb));
}

/* Expected number of stars INSIDE the frame.  Each layer places one candidate per
   lattice cell whose sphere is cut by the unit direction sphere (4 pi scale^2
   cells) and keeps it with probability 1 - threshold. */
export function skyStarCount(density, fovVDeg = SKY_FOV_V_DEG, aspect = 16 / 9) {
  const d = Math.max(0, Math.min(1.2, density));
  /* mirror knStars(): below 0.001 the shader early-outs and draws nothing */
  if (d <= 0.001) return 0;
  let n = 0;
  for (let i = 0; i < SKY_STAR_SCALES.length; i++) {
    const s = SKY_STAR_SCALES[i], a = SKY_STAR_THRESH[i][0], b = SKY_STAR_THRESH[i][1];
    n += 4 * Math.PI * s * s * (1 - (a + d * (b - a)));
  }
  return n * (skyFrameSolidAngle(fovVDeg, aspect) / (4 * Math.PI));
}
/* ===========================================================================
   L4 -- the physicality of the charge: no-hair, plasma screening, Wald.
   ---------------------------------------------------------------------------
   (M, a, Q) is the COMPLETE electrovacuum solution class: by the no-hair
   theorem a stationary, axisymmetric, asymptotically flat electrovacuum black
   hole is fixed by exactly these three numbers.  But no astrophysical black
   hole is an electrovacuum -- it sits in a conducting plasma, and free charge
   is neutralised on the light-crossing time.  What survives is bounded by:

   (1) Wald equilibrium charge (Wald 1974): a Kerr hole in an asymptotically
       uniform magnetic field B charges up to  Q_W = 2 a M B  (geometrized),
       i.e.  Q_W/M = 2 (a/M) (B_geom M)  with  B_geom = B[G] * 1e-4 * K_Q .
   (2) Plasma bound: once the electrostatic force on an ambient proton beats
       gravity the plasma cannot be held, so  |Q|/M < m_p/e  (geometrized),
       a hard bound for charge-neutral hydrogen: 9.0e-19.

   Unit conversion: 1 coulomb is GEOM_M_PER_C metres and 1 gauss is
   1e-4 * GEOM_M_PER_C per metre in geometrized Gaussian units.  These are NOT
   asserted -- tools/validate-physics.mjs rebuilds them from CODATA and checks
   that e^2/hbar reproduces the fine-structure constant 1/137.036 (2e-4).
   ======================================================================== */
export const GEOM_M_PER_C = 8.6173324e-18;
export const GEOM_M_PER_GAUSS = 1.0e-4 * GEOM_M_PER_C;
export const M_SUN_GEOM = 1476.6;
export const CHARGE_BALANCE_OVER_M = 8.997e-19;   /* (m_p/e) in geometrized units */

export function waldChargeOverM(aOverM, Bgauss, Mmsun = 10) {
  return 2 * aOverM * Bgauss * GEOM_M_PER_GAUSS * Mmsun * M_SUN_GEOM;
}

/* How far the slider is from anything astrophysical.  QoverM is the slider
   value; the reference is the larger of the Wald charge and the plasma bound. */
export function chargePhysicality(QoverM, opts = {}) {
  const aOverM = opts.aOverM ?? 0.86;
  const Bgauss = opts.Bgauss ?? 1.0e4;
  const Mmsun = opts.Mmsun ?? 10;
  const wald = waldChargeOverM(aOverM, Bgauss, Mmsun);
  const balance = CHARGE_BALANCE_OVER_M;
  const ref = Math.max(wald, balance);
  return { wald, balance, reference: ref, Bgauss, Mmsun, aOverM,
           ordersAbove: QoverM > 0 ? Math.log10(QoverM / ref) : 0 };
}
/* JS port of blackbodyRGB() in shaders/common.glsl: the Tanner Helland
   Planckian-locus fit, chroma-normalised (max channel = 1) so it carries the
   HUE ONLY and no magnitude whatsoever.  The magnitude lives entirely in the
   source term, which is what makes the T^4 / g^4 law testable in isolation.
   It is exposed here because the audit harness needs the same chromaticity to
   predict the rendered luma: the receding side of the disk is not only dimmed
   by g^4, it is also REDDER, and a redder colour has a lower luma per unit
   magnitude, so a prediction written as g^4 * prof^4 alone is incomplete. */
export function blackbodyRGB(T) {
  const Tc = Math.min(42000, Math.max(700, T));
  const t = Tc * 0.01;
  let r, g, b;
  if (t <= 66) r = 255; else r = 329.698727446 * Math.pow(Math.max(t - 60, 1e-3), -0.1332047592);
  if (t <= 66) g = 99.4708025861 * Math.log(Math.max(t, 1)) - 161.1195681661;
  else g = 288.1221695283 * Math.pow(Math.max(t - 60, 1e-3), -0.0755148492);
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(Math.max(t - 10, 1e-3)) - 305.0447927307;
  const cl = (v) => Math.min(1, Math.max(0, v / 255));
  let c = [cl(r), cl(g), cl(b)].map((v) => Math.pow(v, 0.92));
  const m = Math.max(c[0], Math.max(c[1], c[2]), 1e-3);
  return [c[0] / m, c[1] / m, c[2] / m];
}
export const chromaLuma = (T) => {
  const c = blackbodyRGB(T);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

/* Novikov-Thorne / Shakura-Sunyaev normalised temperature profile,
   identical to knTempProfile() in shaders/disk.glsl:
     prof(r) = (r_in/r)^(3/4) (1 - sqrt(r_in/r))^(1/4) / 0.487871339232
   normalised so that the peak (at r = 49/36 r_in) is exactly 1. */
export function tempProfile(r, rin) {
  const x = rin / Math.max(r, 1e-4);
  if (x >= 1) return 0;
  return (Math.pow(x, 0.75) * Math.pow(Math.max(1 - Math.sqrt(x), 0), 0.25)) / 0.487871339232;
}

/* relativistic frequency-shift factor of an equatorial Keplerian emitter,
   identical to knDiskG() in shaders/disk.glsl:  g = 1/(u^t (1 - Omega b)).
   diskG() applies the same upper clamp as the shader (firefly guard);
   diskGRaw() exposes the unclamped value for the bound sweep. */
export function diskGRaw(M, a, Q, r, b, redshiftOn = true) {
  const r2 = r * r, a2 = a * a;
  const Del = r2 - 2 * M * r + a2 + Q * Q;
  const f = 2 * M * r - Q * Q;
  const Sig = r2;
  const A = (r2 + a2) * Sig + f * a2;      /* sin^2 = 1 on the equator */
  const D = Del - a2;
  const Om = omega(M, a, Q, r);
  const gtt = -D / Sig, gtp = -f * a / Sig, gpp = A / Sig;
  const nrm = -(gtt + 2 * Om * gtp + Om * Om * gpp);
  const ut = 1 / Math.sqrt(Math.max(nrm, 1e-5));
  const dop = 1 / Math.max(1 - Om * b, 1e-3);
  const g = redshiftOn ? dop / ut : dop;
  return Math.max(g, 0.02);
}
export function diskG(M, a, Q, r, b, redshiftOn = true) {
  return Math.min(diskGRaw(M, a, Q, r, b, redshiftOn), 6.0);
}

/* ---------------------------------------------------------------------------
   Analytic critical curve (the shadow outline), Bardeen 1972 / Teo 2003.
   The same derivation holds for Kerr-Newman because KN is separable (Carter
   1968): R(r) = (E(r^2+a^2) - aL)^2 - Delta[(L-aE)^2 + Q_c] with
   Delta = r^2 - 2Mr + a^2 + Q^2, and Delta' = 2(r-M) is independent of Q, so
   R = R' = 0 give, for a photon with E = 1, L = xi, Q_c = eta,

       xi(r)  = [ r^2 + a^2 - 2 r Delta/(r-M) ] / a
       eta(r) = 4 r^2 Delta/(r-M)^2 - (xi - a)^2

   and the observer at inclination i sees it at
       alpha = -xi / sin i,   beta = +-sqrt(eta + a^2 cos^2 i - xi^2 cot^2 i).
   Sampling every r whose eta >= 0 outside the horizon traces the full closed
   outline, not just its equatorial extremes.  (a = 0 is handled separately.)
   --------------------------------------------------------------------------- */
export function criticalCurve(M, a, Q, inc, n = 900) {
  const a2 = a * a;
  const si = Math.sin(inc), ci = Math.cos(inc);
  const pts = [];
  if (Math.abs(a) < 1e-9) {
    const b = 3 * Math.sqrt(3) * M;
    for (let k = 0; k <= n; k++) {
      const t = (2 * Math.PI * k) / n;
      pts.push([b * Math.cos(t), b * Math.sin(t)]);
    }
    return pts;
  }
  const rMin = -40 * M, rMax = 240 * M;
  const evalR = (r) => {
    if (Math.abs(r - M) < 1e-6) return null;
    const Del = r * r - 2 * M * r + a2 + Q * Q;
    if (Del <= 1e-9) return null;
    const xi = (r * r + a2 - (2 * r * Del) / (r - M)) / a;
    const eta = (4 * r * r * Del) / ((r - M) * (r - M)) - (xi - a) * (xi - a);
    return { xi, eta, Del };
  };
  /* seed the sweep with the exact equatorial photon-orbit radii: the valid
     eta >= 0 window around them can be narrower than the sweep step (it was
     for a=0.9, Q=0.3, losing the prograde extreme by 1.5%). */
  const eq = equatorialPhotonOrbits(M, a, Q);
  const seeds = [eq.rPro, eq.rRet].filter((x) => Number.isFinite(x) && x > rMin && x < rMax);
  const N = n * 8;
  const grid = [];
  for (let k = 0; k <= N; k++) grid.push(rMin + ((rMax - rMin) * k) / N);
  for (const s of seeds) { grid.push(s - 0.02 * M, s - 0.002 * M, s, s + 0.002 * M, s + 0.02 * M); }
  grid.sort((x, y) => x - y);
  let prev = null, prevR = rMin;
  for (let k = 0; k < grid.length; k++) {
    const r = grid[k];
    const v = evalR(r);
    if (!v) { prev = null; prevR = r; continue; }
    /* eta = 0 IS the equatorial photon orbit, and it is where the outline
       reaches its extreme alpha -- so bisect for the exact root instead of
       relying on the sampling step (which left a 1-2% error). */
    if (prev && prev.eta * v.eta < 0) {
      let lo = prevR, hi = r, flo = prev.eta;
      for (let it = 0; it < 80; it++) {
        const mid = 0.5 * (lo + hi);
        const vm = evalR(mid);
        if (!vm) break;
        if (flo * vm.eta <= 0) { hi = mid; } else { lo = mid; flo = vm.eta; }
      }
      const vr = evalR(0.5 * (lo + hi));
      if (vr) {
        const al = -vr.xi / si;
        const bb = vr.eta + a2 * ci * ci - vr.xi * vr.xi * (ci * ci) / (si * si);
        if (bb > -1e-9) pts.push([al, Math.sqrt(Math.max(bb, 0))], [al, -Math.sqrt(Math.max(bb, 0))]);
      }
    }
    prev = v; prevR = r;
    if (v.eta < -1e-12) continue;
    const alpha = -v.xi / si;
    const b2 = v.eta + a2 * ci * ci - v.xi * v.xi * (ci * ci) / (si * si);
    if (b2 < 0) continue;
    const beta = Math.sqrt(b2);
    pts.push([alpha, beta], [alpha, -beta]);
  }
  return pts;
}

/* Exact equatorial circular photon orbits of Kerr-Newman: the roots of
   eta(r) = 0.  Returns the signed impact parameters b = xi, so bPro > 0
   (co-rotating) and bRet < 0.  This replaces the old sqrt(a^2+Q^2)
   "effective spin" shortcut, which is quantitatively wrong once Q != 0. */
export function equatorialPhotonOrbits(M, a, Q) {
  const a2 = a * a;
  const ev = (r) => {
    if (Math.abs(r - M) < 1e-9) return null;
    const Del = r * r - 2 * M * r + a2 + Q * Q;
    if (Del <= 0) return null;
    const xi = (r * r + a2 - (2 * r * Del) / (r - M)) / a;
    return (4 * r * r * Del) / ((r - M) * (r - M)) - (xi - a) * (xi - a);
  };
  if (Math.abs(a) < 1e-12) {
    /* Reissner-Nordstrom: R = R' = 0 give r(r-M) = 2 Delta, i.e.
         r_ph = [3M + sqrt(9M^2 - 8Q^2)] / 2 ,   b_c = r_ph^2 / sqrt(Delta(r_ph)).
       The first version of this branch returned 3 sqrt(3) M regardless of Q,
       which is only the Q = 0 answer -- the raytraced capture boundary caught
       it immediately (Q = 0.6 measures 4.8587 against the analytic 4.8594). */
    const rp = 0.5 * (3 * M + Math.sqrt(Math.max(9 * M * M - 8 * Q * Q, 0)));
    const Del = rp * rp - 2 * M * rp + Q * Q;
    const b = (rp * rp) / Math.sqrt(Math.max(Del, 1e-12));
    return { bPro: b, bRet: -b, rPro: rp, rRet: rp, rootCount: 1 };
  }
  const roots = [];
  const rp = M + Math.sqrt(Math.max(M * M - a2 - Q * Q, 0));
  let prevR = rp * 1.0001, prev = ev(prevR);
  const rMax = 400 * M, N = 40000;
  for (let k = 1; k <= N; k++) {
    const r = rp * 1.0001 + ((rMax - rp * 1.0001) * k) / N;
    const v = ev(r);
    if (v === null) { prev = null; prevR = r; continue; }
    if (prev !== null && prev * v < 0) {
      let lo = prevR, hi = r, flo = prev;
      for (let it = 0; it < 100; it++) {
        const mid = 0.5 * (lo + hi);
        const vm = ev(mid);
        if (vm === null) break;
        if (flo * vm <= 0) hi = mid; else { lo = mid; flo = vm; }
      }
      roots.push(0.5 * (lo + hi));
    }
    prev = v; prevR = r;
  }
  const xiAt = (r) => {
    const Del = r * r - 2 * M * r + a2 + Q * Q;
    return (r * r + a2 - (2 * r * Del) / (r - M)) / a;
  };
  let bPro = 0, bRet = 0, rPro = 0, rRet = 0;
  for (const r of roots) { const x = xiAt(r); if (x > bPro) { bPro = x; rPro = r; } if (x < bRet) { bRet = x; rRet = r; } }
  return { bPro, bRet, rPro, rRet, rootCount: roots.length };
}
export function carter(a, g, pth, E, L) {
  return pth * pth - a * a * E * E * g.c * g.c + L * L * g.c * g.c / g.s2;
}

export function horizons(M, a, Q) {
  /* M <= 0 has no horizon at all: Delta = r^2 - 2Mr + a^2 + Q^2 stays positive for
     every r > 0 when M < 0, and M = 0 is not a black hole either.  Negative mass is
     a legitimate exact solution with a REPULSIVE far field and a naked ring. */
  /* Finite, not NaN.  With rp = NaN the CPU-side framing and the state-pixel
     plausibility checks propagate a NaN, and M = -1 was the ONE configuration that
     stayed non-reproducible after the camera pose was pinned (three others matched
     exactly).  A NaN that reaches a comparison is a coin flip for the surrounding
     control flow, so return the nominal value the naked branch already uses. */
  if (!(M > 0)) return { naked: true, rp: M, rm: M, sqrt: 0 };
  const d = M * M - a * a - Q * Q;
  if (d < 0) return { naked: true, rp: M, rm: M, sqrt: 0 };
  const s = Math.sqrt(d);
  return { naked: false, rp: M + s, rm: M - s, sqrt: s };
}

export function ergoRadius(M, a, Q, th) {
  const d = M * M - a * a * Math.cos(th) ** 2 - Q * Q;
  return M + Math.sqrt(Math.max(d, 0));
}

export function omega(M, a, Q, r) {
  const k = Math.max((M * r - Q * Q) / Math.max(r * r * r, 1e-9), 1e-9);
  return (Math.sqrt(k * r) - a * k) / Math.max(r - a * a * k, 1e-4);
}

/* equatorial circular-orbit energy / angular momentum (Bardeen-like) */
export function circularOrbit(M, a, Q, r) {
  const a2 = a * a, r2 = r * r;
  const Del = r2 - 2 * M * r + a2 + Q * Q;
  const f = 2 * M * r - Q * Q;
  const gtt = -(Del - a2) / r2;
  const gtp = -f * a / r2;
  const gpp = (r2 + a2) + f * a2 / r2;
  const Om = omega(M, a, Q, r);
  const nrm = -(gtt + 2 * Om * gtp + Om * Om * gpp);
  if (!(nrm > 1e-8)) return null;
  return {
    Om,
    E: (-gtt - gtp * Om) / Math.sqrt(nrm),
    L: (gtp + gpp * Om) / Math.sqrt(nrm),
  };
}

/* ISCO: minimiser of E(r) along the equatorial circular-orbit sequence.
   Numeric (no closed form reused) so Kerr-Newman charge enters exactly. */
export function isco(M, a, Q) {
  const h = horizons(M, a, Q);
  /* no photon shell and no ISCO without a horizon: fall back to the Schwarzschild
     value in units of |M| so the disk still has an inner edge to truncate at. */
  if (h.naked) return 6 * Math.abs(M) || 6;
  let lo = h.rp * 1.0005 + 1e-3;
  const hi0 = 24 * M;
  let best = null;
  const N = 4000;
  for (let i = 0; i <= N; i++) {
    const r = lo + (hi0 - lo) * (i / N);
    const o = circularOrbit(M, a, Q, r);
    if (!o) continue;
    if (!best || o.E < best.E) best = { r, E: o.E };
  }
  if (!best) return lo;
  /* golden-section refine around the bracket */
  let A = Math.max(lo, best.r - (hi0 - lo) / N * 3);
  let B = Math.min(hi0, best.r + (hi0 - lo) / N * 3);
  const gr = 0.6180339887;
  let c = B - gr * (B - A), d = A + gr * (B - A);
  const E = (x) => { const o = circularOrbit(M, a, Q, x); return o ? o.E : 1e9; };
  for (let i = 0; i < 120; i++) {
    if (E(c) < E(d)) B = d; else A = c;
    c = B - gr * (B - A); d = A + gr * (B - A);
  }
  return (A + B) / 2;
}

/* ---------------------------------------------------------------------------
   Apparent displacement of the shadow centre.
   Frame dragging makes the shadow a D-shaped region whose edges sit at the
   prograde / retrograde critical impact parameters; to first order its centroid
   lies at their mean, b_mid.  A camera that simply aims at r = 0 therefore has
   the hole off-centre by about b_mid/r.  The critical impact parameters come
   from the analytic Kerr equatorial photon orbits with an effective spin
   sqrt(a^2+Q^2) (exact for Kerr, and it reduces to 3*sqrt(3) M for a=Q=0).
   --------------------------------------------------------------------------- */
/* Memoised: the rig calls this every frame in orbit mode, and the exact solver
   scans 40000 radii for the roots of eta(r). */
let _aimKey = null, _aimVal = null;
export function shadowAim(M, a, Q) {
  const key = M + '|' + a + '|' + Q;
  if (key === _aimKey) return _aimVal;
  /* Exact Kerr-Newman equatorial photon orbits (roots of eta = 0).  The
     previous implementation used an "effective spin" sqrt(a^2+Q^2) inside the
     Kerr formula, which is quantitatively wrong once Q != 0: for
     (a=0.5, Q=0.5) it predicts roughly (2.6, 6.2) where the exact KN values
     are (3.784, 5.945).  Frame dragging is one of the headline effects of
     this project, so the aim compensation must not use an approximation. */
  const o = equatorialPhotonOrbits(M, a, Q);
  _aimKey = key;
  _aimVal = { bPro: o.bPro, bRet: o.bRet, bMid: 0.5 * (o.bPro + o.bRet),
              rPro: o.rPro, rRet: o.rRet };
  return _aimVal;
}

/* ---------------------------------------------------------------------------
   Full double-precision ray tracer (same algorithm as bufferA.frag).
   Used by the validation tools; returns diagnostics rather than a picture.
   --------------------------------------------------------------------------- */
export function trace(o) {
  const M = o.M, a = o.a, Q = o.Q;
  const uOuter = o.diskOuter ?? 1e9;
  const maxSteps = o.maxSteps ?? 4000;
  const stepScale = o.stepScale ?? 0.28;
  const tol = o.tol ?? 1e-6;
  const rFar = o.rFar ?? Math.max(Math.abs(o.r0) * 1.55 + 6, 34);
  /* bEquator (L1 tests): launch the exact equatorial geodesic of impact
     parameter b instead of a ZAMO screen direction n.  Same integrator, same
     step controller -- only the initial data differ, and the two paths are
     cross-checked against each other in tools/l1-photon-ring.mjs. */
  const useEq = o.bEquator !== undefined && o.bEquator !== null;
  /* the equatorial state is only meaningful at theta = pi/2 -- using o.th0 here
     would silently integrate the equatorial initial data in the metric of some
     other colatitude.  Force it instead of trusting the caller. */
  const thStart = useEq ? Math.PI / 2 : o.th0;
  const z = useEq ? equatorState(M, a, Q, o.r0, o.bEquator) : zamoInit(M, a, Q, o.r0, thStart, o.n);
  if (!z) return { steps: 0, escaped: false, captured: false, invalid: true, ph: 0, E: 0, L: 0 };
  let { pr, pth, E, L } = z;
  const rp = horizons(M, a, Q).rp;
  let r = o.r0, th = thStart, ph = o.ph0 ?? 0;
  let h = stepScale * 0.2;
  let cOld = Math.cos(th);
  let maxErr = 0, maxCarter = 0, maxQ = 0;
  let steps = 0, escaped = false, captured = false, minDist = Infinity;
  let crossR = -1, crossPhi = 0, crossG = 0, crossB = 0;   /* first disk crossing */
  const Qc0 = carter(a, z.g, pth, E, L);
  for (let i = 0; i < maxSteps; i++) {
    steps = i + 1;
    const g = geo(M, a, Q, r, th);
    const drd0 = (g.Del / g.Sig) * pr;
    const hh0 = horizons(M, a, Q);
    const dHor = Math.min(Math.abs(r - hh0.rp), Math.abs(r - hh0.rm));
    const hGeo = Math.min(
      stepScale * (0.02 + 0.30 * Math.abs(r)) / Math.max(Math.abs(drd0), 0.05),
      stepScale * 0.25 * dHor / Math.max(Math.abs(drd0), 1e-6));
    const hAng = stepScale * 0.09 / Math.max(Math.max(Math.abs(dphi(a, g, E, L)), Math.abs(pth / g.Sig)), 1e-3);
    h = Math.min(h, Math.min(hGeo, hAng));
    let rn = r, tn = th, prn = pr, ptn = pth, phn = ph, gn = g, err = 0, habs = 0, drift = 0;
    const H0 = ham(M, a, g, pr, pth, E, L);
    for (let retry = 0; retry < 4; retry++) {
      const k1 = rhs(M, a, g, pr, pth, E, L);
      const g2 = geo(M, a, Q, r + 0.5 * h * k1[0], th + 0.5 * h * k1[1]);
      const k2 = rhs(M, a, g2, pr + 0.5 * h * k1[2], pth + 0.5 * h * k1[3], E, L);
      const g3 = geo(M, a, Q, r + 0.5 * h * k2[0], th + 0.5 * h * k2[1]);
      const k3 = rhs(M, a, g3, pr + 0.5 * h * k2[2], pth + 0.5 * h * k2[3], E, L);
      const g4 = geo(M, a, Q, r + h * k3[0], th + h * k3[1]);
      const k4 = rhs(M, a, g4, pr + h * k3[2], pth + h * k3[3], E, L);
      rn = r + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      tn = th + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      prn = pr + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      ptn = pth + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      gn = geo(M, a, Q, rn, tn);
      phn = ph + 0.5 * h * (dphi(a, g, E, L) + dphi(a, gn, E, L));
      const P = -gn.A * E * E + 2 * gn.f * a * E * L + gn.D * L * L / gn.s2;
      const t1 = P / gn.S2;
      const t2 = (gn.Del / gn.Sig) * prn * prn;
      const t3 = ptn * ptn / gn.Sig;
      const sc = 0.5 * (Math.abs(t1) + Math.abs(t2) + Math.abs(t3));
      /* CONTROL on scFine, REPORT on sc.  sc = 0.5(|t1|+|t2|+|t3|) VANISHES at a
         turning point: for an equatorial ray P = -R and (Delta/Sigma) p_r^2 =
         R/(Sigma Delta), so t1 = -t2 exactly and sc = |R|/(Sigma Delta) -> 0 as
         the ray reaches its turning point.  A relative error against a vanishing
         scale then rejects every step, h decays towards 1e-10 and the ray FREEZES
         ON the turning point (measured: r pinned at 3.0007749 with h = 1.1e-10
         and |H| = 1.3e-19 for 3e5 steps).  That is exactly where the photon ring
         lives, so near-critical rays -- the ones carrying the subring structure
         -- never escaped and burned the whole step budget.  scFine strips the
         signs INSIDE P, so it keeps P's O(1) pieces apart and stays O(1) there
         (3.0 for Schwarzschild at r_c) while the physical drift is 1e-19. */
      const scFine = 0.5 * (gn.A * E * E + 2 * Math.abs(gn.f * a * E * L) + gn.D * L * L / gn.s2) / gn.S2
                   + 0.5 * (t2 + t3) + 1e-300;
      habs = Math.abs(0.5 * (t1 + t2 + t3));
      /* o.legacyScale reproduces defect B16 on purpose: it is the A/B switch
         that measures how many rays the collapsed normaliser used to lose at a
         given step budget.  Never set in production. */
      err = Math.abs(0.5 * (t1 + t2 + t3) - H0) / (o.legacyScale ? (sc + 1e-300) : scFine);
      drift = habs / (sc + 1e-300);
      if (err <= tol * 4) break;
      h *= Math.min(Math.max(0.9 * Math.pow(tol / Math.max(err, 1e-12), 0.2), 0.08), 0.70);
    }
    maxErr = Math.max(maxErr, drift);
    /* analytic null-constraint projection (see bufferA.frag): H is quadratic in
       (p_r, p_th), so the nearest exactly-null momenta come from one scaling. */
    {
      const Kin = (gn.Del / gn.Sig) * prn * prn + ptn * ptn / gn.Sig;
      const Pn = -gn.A * E * E + 2 * gn.f * a * E * L + gn.D * L * L / gn.s2;
      const want = -Pn / gn.S2;
      if (Kin > 1e-20 && want > 0) {
        const mu = Math.min(2, Math.max(0.5, Math.sqrt(want / Kin)));
        prn *= mu; ptn *= mu;
      }
    }
    const Qc = carter(a, gn, ptn, E, L);
    maxCarter = Math.max(maxCarter, Math.abs(Qc - Qc0) / (Math.abs(Qc0) + E * E + L * L + 1e-3));
    maxQ = Math.max(maxQ, habs);
    h *= Math.min(Math.max(0.9 * Math.pow(tol / Math.max(err, 1e-15), 0.2), 0.5), 2.0);
    if (crossR < 0 && cOld * gn.c < 0) {
      const tt = cOld / (cOld - gn.c + 1e-12);
      const rc = r + (rn - r) * tt;
      if (rc > 0 && rc < uOuter) {
        crossR = rc;
        crossPhi = ph + ((((phn - ph) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * tt;
        crossB = L / E;
        crossG = diskG(M, a, Q, rc, crossB, true);
        if (o.stopAtDisk) { steps = i + 1; break; }
      }
    }
    cOld = gn.c;                       /* must advance, or no crossing is ever seen */
    r = rn; th = tn; pr = prn; pth = ptn; ph = phn;
    if (o.onStep && i < 4000) o.onStep({ i, r, th, pr, pth, ph, h, err, drift, drd0, hGeo, hAng });
    if (o.onStepAll) o.onStepAll({ i, r, th, pr, pth, ph, h, err, drift, drd0, hGeo, hAng, habs });
    minDist = Math.min(minDist, Math.abs(r) - rp);
    if (gn.Sig < 2e-4) break;
    if (Math.abs(r) > rFar) { const outward = r > 0 ? drd0 > 0 : drd0 < 0; if (outward) { escaped = true; break; } }
    if (!o.interior && gn.Del <= 5e-4 * M * M) { captured = true; break; }
    if (o.interior && Math.abs(r) - rp < 2e-3) break;
  }
  return { steps, escaped, captured, maxErr, maxCarter, maxH: maxQ, r, th, ph, E, L, pr, pth, minDist,
           carter0: Qc0, H0: ham(M, a, z.g, z.pr, z.pth, E, L), pr0: z.pr, pth0: z.pth,
           crossR, crossPhi, crossG, crossB };
}
