/* ============================================================================
   polar.js -- polarised synchrotron transfer along a Kerr-Newman geodesic.
   CPU reference implementation; the shader port comes after this validates.

   WHY NOT THE PENROSE-WALKER SHORTCUT.  The Penrose-Walker constant
       kappa = [*J + i J]_{mu nu} p^mu f^nu = (A - iB)(r - i a cos th)
   is conserved along a null geodesic for any parallel-transported f, which turns
   parallel transport into a one-line reconstruction of the observed EVPA
   (Himwich et al. 2020; arXiv:2606.12518 Eq. 12-14).  It rests on the Killing-Yano
   tensor, i.e. on RICCI FLATNESS.  Kerr-Newman is NOT Ricci flat (it is
   electrovacuum), so kappa is NOT conserved here and that shortcut is unavailable.
   Therefore the production path integrates the transport equation directly,
       df^mu/dlambda = -Gamma^mu_{alpha beta} p^alpha f^beta,
   which needs only the metric and its derivatives and is valid for any Q.
   The PW method is kept out of the production path entirely.

   EMISSION SIDE.  Power-law electrons N(E) ~ E^-p: the intrinsic linear
   polarization is Pi = (p+1)/(p+7/3) (Rybicki & Lightman 1979, ch. 6), the
   optically thin spectral index is alpha = (1-p)/2, and the EVPA is perpendicular
   to the magnetic field projected on the sky (chi_E = chi_B - pi/2, Nalewajko 2012).
   Circular polarization j_V is taken as zero for a power law: that is the standard
   simplification and it is stated rather than hidden (Pandya et al. 2016, ApJ 822,
   34, has the full four-Stokes scheme including V).
   ========================================================================== */

/* Boyer-Lindquist Kerr-Newman metric, signature (-,+,+,+), x = (t, r, th, ph). */
export function metric(r, th, M, a, Q) {
  const s = Math.sin(th), c = Math.cos(th);
  const Sig = r * r + a * a * c * c;
  const Del = r * r - 2 * M * r + a * a + Q * Q;
  const f = 2 * M * r - Q * Q;
  const A = (r * r + a * a) * Sig + f * a * a * s * s;
  const g = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  g[0][0] = -1 + f / Sig;                 /* = -Del... in BL: -(1 - f/Sig) with f = 2Mr-Q^2 */
  g[0][3] = g[3][0] = -f * a * s * s / Sig;
  g[1][1] = Sig / Del;
  g[2][2] = Sig;
  g[3][3] = A * s * s / Sig;
  return { g, Sig, Del, f, A, s, c };
}

/* analytic contravariant components (exact, no inversion needed) */
export function metricUp(r, th, M, a, Q) {
  const m = metric(r, th, M, a, Q);
  const { Sig, Del, f, A, s } = m;
  const s2 = Math.max(s * s, 1e-12);
  const gu = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  gu[0][0] = -A / (Sig * Del);
  gu[0][3] = gu[3][0] = -f * a / (Sig * Del);
  gu[1][1] = Del / Sig;
  gu[2][2] = 1 / Sig;
  gu[3][3] = (Del - a * a * s2) / (Sig * Del * s2);
  return { gu, Sig, Del, f, A };
}

/* Christoffel symbols by central differences in r and theta only: t and phi are
   Killing directions of a stationary axisymmetric metric, so those derivatives
   vanish identically and the sum over sigma collapses to two terms. */
export function christoffel(r, th, M, a, Q, h) {
  const hr = (h || 1e-5) * Math.max(1, Math.abs(r));
  const ht = (h || 1e-5);
  const var2 = (idx, d) => (idx === 1 ? [r + d * hr, th] : [r, th + d * ht]);
  const R = 4, G = [];
  const dg = [null, [null, null, null, null], [null, null, null, null]];   /* dg[sigma][alpha][beta] */
  for (const sig of [1, 2]) {
    const [rp, tp] = var2(sig, +1), [rm, tm] = var2(sig, -1);
    const gp = metric(rp, tp, M, a, Q).g, gm = metric(rm, tm, M, a, Q).g;
    dg[sig] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for (let al = 0; al < R; al++) for (let be = 0; be < R; be++) {
      const d = sig === 1 ? 2 * hr : 2 * ht;
      dg[sig][al][be] = (gp[al][be] - gm[al][be]) / d;
    }
  }
  const { gu } = metricUp(r, th, M, a, Q);
  for (let mu = 0; mu < R; mu++) {
    G.push([]);
    for (let al = 0; al < R; al++) {
      G[mu].push(new Array(R).fill(0));
      for (let be = 0; be < R; be++) {
        let sAcc = 0;
        /* sigma plays TWO roles and the first version conflated them:
             - as the DERIVATIVE index in d_sigma g_{alpha beta}, only sigma in {r, th} is
               nonzero in a stationary axisymmetric metric;
             - as the CONTRACTED metric index in g^{mu sigma} and in d_alpha g_{sigma beta},
               sigma runs over ALL FOUR values.
           Restricting the loop to {1, 2} silently dropped the sigma = t term, which is the
           one that makes Gamma^t_{rt} = (1/2) g^{tt} d_r g_{tt} = M/(r(r-2M)) nonzero.  The
           result was a connection that is NOT metric compatible: measured violation 100%,
           |f|^2 drifting by 0.03, f.d_phi by 30, and -- the tell-tale -- the drift did not
           scale with the step size, because it was systematic, not discretisation.
           Caught by testing d_sigma g_{mu nu} = Gamma^rho_{sigma mu} g_{rho nu} +
           Gamma^rho_{sigma nu} g_{mu rho} directly, a definition-level check that does not
           depend on any trajectory or on conditioning. */
        for (let sig = 0; sig < R; sig++) {
          const dA = dg[al] ? dg[al][sig][be] : 0;
          const dB = dg[be] ? dg[be][sig][al] : 0;
          const dC = dg[sig] ? dg[sig][al][be] : 0;
          sAcc += gu[mu][sig] * (dA + dB - dC);
        }
        G[mu][al][be] = 0.5 * sAcc;
      }
    }
  }
  return G;
}

/* one step of parallel transport: df/dlam = -Gamma^mu_{al be} p^al f^be */
export function transportRhs(r, th, M, a, Q, p, f) {
  const G = christoffel(r, th, M, a, Q);
  const out = [0, 0, 0, 0];
  for (let mu = 0; mu < 4; mu++) {
    let sAcc = 0;
    for (let al = 0; al < 4; al++) for (let be = 0; be < 4; be++) sAcc += G[mu][al][be] * p[al] * f[be];
    out[mu] = -sAcc;
  }
  return out;
}

/* ---- synchrotron emission, power-law electrons ---------------------------- */
export function polFraction(pPower) {   /* (p+1)/(p+7/3), Rybicki & Lightman */
  return (pPower + 1) / (pPower + 7 / 3);
}
export function thinSpectralIndex(pPower) { return (1 - pPower) / 2; }

/* EVPA of synchrotron emission: perpendicular to B projected on the sky.
   bHat is the unit B in the observer's screen frame; returns the angle of the
   electric vector, i.e. chi_B - pi/2 (Nalewajko 2012; pandya2016 uses the same). */
export function evpaFromB(bScreenX, bScreenY) {
  const chiB = Math.atan2(bScreenY, bScreenX);
  return chiB - Math.PI / 2;
}

/* ---- documented magnetic field models ------------------------------------ */
/* NOT GRMHD: a prescribed analytic field, stated as such.  'toroidal' is the
   standard SANE-like guess for a rotating flow, 'vertical' the MAD-like one. */
export function fieldModel(kind, r, th, phi, B0) {
  const s = Math.sin(th), c = Math.cos(th);
  if (kind === 'vertical') return [0, B0 * c, -B0 * s, 0];      /* B^r, B^th, B^ph in BL-ish poloidal */
  if (kind === 'toroidal') return [0, 0, 0, B0 / Math.max(r, 1e-6)];
  if (kind === 'radial') return [0, B0 / Math.max(r * r, 1e-6), 0, 0];
  return [0, 0, 0, 0];
}
/* solve p_r from the null condition H = 0 at fixed r, th, E, L, p_th.  Without this the
   "geodesic" is not null, the affine parameterisation is meaningless and every invariant
   downstream is garbage -- which is exactly what the first version of this file did. */
export function solveNullPr(r, th, M, a, Q, pth, E, L, sign) {
  const { gu } = metricUp(r, th, M, a, Q);
  const rest = gu[0][0]*E*E - 2*gu[0][3]*E*L + gu[3][3]*L*L + gu[2][2]*pth*pth;
  const s = -rest / gu[1][1];
  if (s < 0) return null;
  return (sign === undefined || sign >= 0 ? 1 : -1) * Math.sqrt(s);
}

/* the ZAMO (zero-angular-momentum observer) four-velocity: stationary and axisymmetric,
   so u = N (1, 0, 0, omega) with omega = -g_tphi/g_phiphi and N fixed by u.u = -1. */
export function zamo(r, th, M, a, Q) {
  const { g } = metric(r, th, M, a, Q);
  const om = -g[0][3] / g[3][3];
  const nrm = -(g[0][0] + 2 * om * g[0][3] + om * om * g[3][3]);
  const N = 1 / Math.sqrt(Math.max(nrm, 1e-12));
  return [N, 0, 0, N * om];
}

/* Polarisation four-vector for synchrotron emission, built covariantly as
       f^mu ~ eps^{mu nu rho sigma} p_nu u_rho b_sigma
   with b the magnetic field four-vector.  Because eps is antisymmetric, f.p is
   IDENTICALLY zero -- no projection, no gauge fixing, and no dependence on the
   degenerate trick of subtracting (f.p/p.p)p, which does not exist for a null p. */
export function polFromField(pIn, uIn, bIn, r, th, M, a, Q) {
  /* The contraction is eps^{mu nu rho sigma} p_nu u_rho b_sigma with all three indices
     COVARIANT.  The first version passed the contravariant momentum, so p_mu p_nu was no
     longer a symmetric pair and the exact cancellation f.p = 0 (which comes from eps being
     antisymmetric) did not happen -- the residual was 3.6e-4 and the ratio f^r : f^th came
     out -3.6e-4 instead of the -0.044 the algebra demands.  Lower the indices here. */
  const gL = metric(r, th, M, a, Q).g;
  const lower = (v) => { const o = [0,0,0,0]; for (let i = 0; i < 4; i++) { let s = 0; for (let j = 0; j < 4; j++) s += gL[i][j] * v[j]; o[i] = s; } return o; };
  const p = lower(pIn), u = lower(uIn), b = lower(bIn);
  const { Sig } = metric(r, th, M, a, Q);
  const s = Math.max(Math.sin(th), 1e-9);
  const sqrtMdetG = Sig * s;                       /* sqrt(-g) for Boyer-Lindquist */
  const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const parity = (idx) => { let inv = 0; for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) if (idx[i] > idx[j]) inv++; return inv % 2 ? -1 : 1; };
  const f = [0, 0, 0, 0];
  for (let mu = 0; mu < 4; mu++) {
    const rest = [0,1,2,3].filter((k) => k !== mu);
    let acc = 0;
    for (const pm of perms) {
      const [i, j, k] = pm;
      /* sign of the full permutation (mu, rest[i], rest[j], rest[k]) */
      const full = [mu, rest[i], rest[j], rest[k]];
      let inv = 0; for (let x = 0; x < 4; x++) for (let y = x+1; y < 4; y++) if (full[x] > full[y]) inv++;
      /* the parity of the FULL index list (mu, rest[i], rest[j], rest[k]) already IS the
         sign of this term -- multiplying by the parity of the sub-permutation as well
         flipped the odd terms, which destroyed the exact cancellation f.p = 0 and left a
         3.6e-4 residual.  Kept: only the full parity. */
      acc += (inv % 2 ? -1 : 1) * p[rest[i]] * u[rest[j]] * b[rest[k]];
    }
    f[mu] = acc / sqrtMdetG;
  }
  return f;
}

/* ---- null geodesic in BL, with the polarization transported alongside -------
   State y = (r, th, ph, pr, pth); conserved E and L.  The polarization f is a
   4-vector advanced by the transport equation with the same steps. */
export function hamiltonian(r, th, M, a, Q, pr, pth, E, L) {
  const { gu } = metricUp(r, th, M, a, Q);
  return 0.5 * (gu[0][0] * E * E - 2 * gu[0][3] * E * L + gu[3][3] * L * L + gu[1][1] * pr * pr + gu[2][2] * pth * pth);
}
export function momentumUp(r, th, M, a, Q, pr, pth, E, L) {
  const { gu } = metricUp(r, th, M, a, Q);
  return [ -gu[0][0] * E + gu[0][3] * L, gu[1][1] * pr, gu[2][2] * pth, -gu[0][3] * E + gu[3][3] * L ];
}
export function geoRhs(y, M, a, Q, E, L) {
  const [r, th, , pr, pth] = y;
  const { gu } = metricUp(r, th, M, a, Q);
  const hr = 1e-6 * Math.max(1, Math.abs(r)), ht = 1e-6;
  const dHdr = (hamiltonian(r + hr, th, M, a, Q, pr, pth, E, L) - hamiltonian(r - hr, th, M, a, Q, pr, pth, E, L)) / (2 * hr);
  const dHdth = (hamiltonian(r, th + ht, M, a, Q, pr, pth, E, L) - hamiltonian(r, th - ht, M, a, Q, pr, pth, E, L)) / (2 * ht);
  return [ gu[1][1] * pr, gu[2][2] * pth, -gu[0][3] * E + gu[3][3] * L, -dHdr, -dHdth ];
}
/* normalise g(f,f) = 1.  No projection is needed or possible here: f comes from the
   Levi-Civita construction above, which is exactly orthogonal to p already. */
export function unitise(f, r, th, M, a, Q) {
  const g = metric(r, th, M, a, Q).g;
  let nn = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) nn += g[i][j] * f[i] * f[j];
  const s = nn > 0 ? 1 / Math.sqrt(nn) : 1;
  return f.map((v) => v * s);
}
/* integrate the geodesic and the transported polarization together */
export function tracePolarised(o) {
  const { M, a, Q, E, L } = o;
  let r = o.r0, th = o.th0, ph = 0, pr = o.pr0, pth = o.pth0;
/* S carries the polarisation and any extra vectors that must be transported in parallel with
     it.  Transporting an OBSERVER-frame basis INWARD is the exact inverse of transporting the
     source vector OUTWARD, and it needs only the inward integration -- which is the one that
     works.  Reversing the momentum instead (rounds 1-2) is invalid for this ray family. */
  let f = o.f0.slice();
  const S = [f.slice()].concat((o.fList || []).map((v) => v.slice()));
  const N = o.steps || 20000, h = o.h || 0.02;
  const g = metric(r, th, M, a, Q).g;
  const dot = (u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g[i][j] * u[i] * v[j]; return s; };
  const start = { ft: dot(f, [1, 0, 0, 0]), fp: dot(f, [0, 0, 0, 1]) };
  let worstNorm = 0, worstOrth = 0, worstFt = 0, worstFp = 0, maxRot = 0;
  for (let i = 0; i < N; i++) {
    const y = [r, th, ph, pr, pth];
    const k1 = geoRhs(y, M, a, Q, E, L);
    const p0 = momentumUp(r, th, M, a, Q, pr, pth, E, L);
    const t1 = S.map((v) => transportRhs(r, th, M, a, Q, p0, v));
    const y2 = y.map((v, k) => v + 0.5 * h * k1[k]);
    const r2 = y2[0], th2 = y2[1];
    const p2 = momentumUp(r2, th2, M, a, Q, y2[3], y2[4], E, L);
    const S2 = S.map((v, si) => v.map((x, k) => x + 0.5 * h * t1[si][k]));
    const k2 = geoRhs(y2, M, a, Q, E, L);
    const t2 = S2.map((v) => transportRhs(r2, th2, M, a, Q, p2, v));
    const S3 = S.map((v, si) => v.map((x, k) => x + 0.5 * h * t2[si][k]));
    const y3 = y.map((v, k) => v + 0.5 * h * k2[k]);
    const p3 = momentumUp(y3[0], y3[1], M, a, Q, y3[3], y3[4], E, L);
    const k3 = geoRhs(y3, M, a, Q, E, L);
    const t3 = S3.map((v) => transportRhs(y3[0], y3[1], M, a, Q, p3, v));
    const S4 = S.map((v, si) => v.map((x, k) => x + h * t3[si][k]));
    const y4 = y.map((v, k) => v + h * k3[k]);
    const p4 = momentumUp(y4[0], y4[1], M, a, Q, y4[3], y4[4], E, L);
    const k4 = geoRhs(y4, M, a, Q, E, L);
    const t4 = S4.map((v) => transportRhs(y4[0], y4[1], M, a, Q, p4, v));
    for (let k = 0; k < 5; k++) y[k] += (h / 6) * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k]);
    for (let si = 0; si < S.length; si++)
      for (let k = 0; k < 4; k++)
        S[si][k] += (h / 6) * (t1[si][k] + 2 * t2[si][k] + 2 * t3[si][k] + t4[si][k]);
    f = S[0];
    r = y[0]; th = y[1]; ph = y[2]; pr = y[3]; pth = y[4];
    if (!(isFinite(r) && isFinite(f[0]) && isFinite(f[1]))) break;
    if (o.onStep) o.onStep({ i, lam: i * h, r, th, f: f.slice(), extras: S.slice(1).map((v) => v.slice()), pr, pth });
    const gg = metric(r, th, M, a, Q).g;
    const d2 = (u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += gg[i][j] * u[i] * v[j]; return s; };
    const pu = momentumUp(r, th, M, a, Q, pr, pth, E, L);
    worstNorm = Math.max(worstNorm, Math.abs(d2(f, f) - 1));
    worstOrth = Math.max(worstOrth, Math.abs(d2(f, pu)));
    worstFt = Math.max(worstFt, Math.abs(d2(f, [1, 0, 0, 0]) - start.ft));
    worstFp = Math.max(worstFp, Math.abs(d2(f, [0, 0, 0, 1]) - start.fp));
    /* These were hard-coded conveniences from the first tests (|r| > 200 for an observer at
       r ~ 12, r < 2 for unit mass).  An observer at r = 4000 tripped the first one on the
       very first step and every ray came back null.  Both are now parameterised, and the
       horizon test only fires when a horizon actually exists. */
    if (o.rMax !== undefined && Math.abs(r) > o.rMax) break;
    if (o.stopAtHorizon !== false && M > 0 && a * a + Q * Q < M * M) {
      const rpH = M + Math.sqrt(Math.max(M * M - a * a - Q * Q, 0));
      if (r < rpH * 1.02) break;
    }
  }
  return { r, th, ph, f, worstNorm, worstOrth, worstFp, worstFt, dfp: Math.abs(dot(f, [0, 0, 0, 1]) - start.fp) };
}
/* ============================================================================
   POLARISED RADIATIVE TRANSFER

   Stokes vector S = (I, Q, U, V) carried along the ray in the frame defined by the
   magnetic field projected perpendicular to the photon direction.  In that frame the
   synchrotron emission has U = 0 and the linear polarisation fraction is Pi, so the
   source vector is (jI, Pi jI, 0, jV) and the transport equation is the standard
   Jones-O'Dell / ipole form:
       dS/ds = j - K S,   K = [[aI, aQ, 0, aV],
                                [aQ, aI, rV, 0],
                                [0, -rV, aI, rQ],
                                [aV, 0, -rQ, aI]]
   with a the absorption coefficients and r the Faraday rotation (rV) and conversion
   (rQ) coefficients.  Two further rotations act on the LINEAR part only:
     * the parallel transport of the polarisation vector, f, which rotates P = Q + iU by
       2 psi_transport, and which is INTEGRATED (see tracePolarised above), valid at any Q;
     * the Faraday rotation itself, dpsi_F/ds = rV.

   NORMALISATION.  This renderer carries no physical units, so the ABSOLUTE scales of the
   emissivity and absorptivity are a documented modelling choice (the pair of constants
   below); what is exact is the STRUCTURE -- the spectral indices, the polarisation
   fraction, the (p+2)/(p+1) absorptivity factor, the nu^-2 Faraday law, and the source
   function jI/aI that the optically thick limit saturates to.  Those are what the
   validator checks, rather than pretending the constants are derived here.
   ========================================================================== */

/* power-law synchrotron, averaged over pitch angle, in the B-perpendicular frame */
export function synchrotronCoeffs(o) {
  const { p, Bperp, nu, n, Bpar } = o;
  const s = Math.max(Bperp, 1e-12);
  const jI = EMIS0 * n * Math.pow(s, (p + 1) / 2) * Math.pow(nu, -(p - 1) / 2);
  const Pi = polFraction(p);
  /* absorptivity follows from the same electrons: the (p+2)/(p+1) factor and the
     steeper frequency and B powers are the standard self-absorbed synchrotron result */
  const aI = ABS0 * n * Math.pow(s, (p + 2) / 2) * Math.pow(nu, -(p + 4) / 2) * (p + 2) / (p + 1);
  /* Faraday rotation: rho_V ~ n B_parallel / nu^2  (standard) */
  const rV = FAR0 * n * Bpar / (nu * nu);
  return { jI, jQ: Pi * jI, jU: 0, jV: 0, aI, aQ: Pi * aI, aU: 0, aV: 0, rV, rQ: 0, Pi };
}
export const EMIS0 = 1.0e0;
export const ABS0  = 1.0e-6;
export const FAR0  = 1.0e-9;

/* one RK4 step of the Stokes system in the B-frame, plus the two linear rotations */
export function stokesRhs(S, c) {
  const [I, Q, U, V] = S;
  return [
    c.jI - c.aI * I - c.aQ * Q - c.aV * V,
    c.jQ - c.aQ * I - c.aI * Q - c.rV * U,
    c.jU - c.aI * U + c.rV * Q - c.rQ * V,
    c.jV - c.aV * I - c.aI * V + c.rQ * U,
  ];
}
export function stokesStep(S, c, ds) {
  const k1 = stokesRhs(S, c);
  const S2 = S.map((v, i) => v + 0.5 * ds * k1[i]);
  const k2 = stokesRhs(S2, c);
  const S3 = S.map((v, i) => v + 0.5 * ds * k2[i]);
  const k3 = stokesRhs(S3, c);
  const S4 = S.map((v, i) => v + ds * k3[i]);
  const k4 = stokesRhs(S4, c);
  return S.map((v, i) => v + (ds / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/* flat-space Faraday test bench: uniform n, B, straight path.  Analytic answer for the
   rotation angle is psi_F = rho_V * L with rho_V ~ n B_par / nu^2. */
export function faradayFlat(o) {
  const { p = 3, nu, n, Bpar, L, steps = 4000 } = o;
  const c = synchrotronCoeffs({ p, Bperp: 1e-12, Bpar, nu, n });
  let psi = 0;
  const ds = L / steps;
  for (let i = 0; i < steps; i++) psi += c.rV * ds;
  return { psi, rhoV: c.rV, analytic: c.rV * L };
}
/* ---- the OBSERVABLE: EVPA on the observer's screen -------------------------
   Convention (arXiv:2606.12518 Sec. II.4, matching the Gelles 2021 toy model): the
   image-plane axes are +alpha along the sky-projected +phi direction and +beta along the
   sky-projected spin axis, i.e. along -theta.  In Boyer-Lindquist the coordinate fields
   d_theta and d_phi are already orthogonal, so the screen basis is just their normalised
   versions and no Gram-Schmidt is needed.
   The EVPA is then the angle of the polarisation 4-vector's projection onto that screen.
   Whether the EVPA is taken as the angle of f or of its perpendicular is a global
   convention; it cancels in any DIFFERENCE of angles, which is exactly what the external
   test below uses. */
export function screenEVPA(f, r, th, M, a, Q) {
  const m = metric(r, th, M, a, Q);
  const g = m.g;
  const eTh = [0, 0, 1 / Math.sqrt(g[2][2]), 0];
  const ePh = [0, 0, 0, 1 / Math.sqrt(g[3][3])];
  const dot = (u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g[i][j] * u[i] * v[j]; return s; };
  const fa = dot(f, ePh);
  const fb = -dot(f, eTh);          /* +beta points along -theta */
  const raw = Math.atan2(fb, fa);
  /* The EVPA is only defined modulo pi (a polarisation plane, not a vector), and the
     source papers state the convention explicitly: fold into (-pi/2, pi/2].  Without this
     fold the angle jumps by pi or 2pi between neighbouring rays and every DIFFERENCE of
     angles is dominated by a branch offset -- measured 6.27 rad ~ 2pi against a prediction
     of order 1e-2.  See arXiv:2606.12518 Eq. 14 footnote 5. */
  return foldEVPA(raw);
}
/* fold an angle into (-pi/2, pi/2] */
export function foldEVPA(x) {
  let v = x % Math.PI;
  if (v <= -Math.PI / 2) v += Math.PI;
  if (v > Math.PI / 2) v -= Math.PI;
  return v;
}
/* signed difference of two EVPAs, folded, in (-pi/2, pi/2] */
export function evpaDiff(a1, a0) { return foldEVPA(a1 - a0); }
/* screen coordinates from the conserved quantities (E = 1), arXiv:2606.12518 Eq. 5 */
export function screenCoords(a, thObs, L, eta) {
  const s = Math.sin(thObs), c = Math.cos(thObs);
  const alpha = -L / s;
  const b2 = eta - (alpha * alpha - a * a) * c * c;
  return { alpha, beta: b2 >= 0 ? Math.sqrt(b2) : NaN };
}