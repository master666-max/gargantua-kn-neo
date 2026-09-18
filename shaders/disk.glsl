/* ============================================================================
   disk.glsl -- Novikov-Thorne style accretion disk, integrated as a real
   emissive/absorptive VOLUME (not as an infinitely thin plane).
   ----------------------------------------------------------------------------
   * scale height   H(r) = h * r * (r/r_in)^(1/8)   (h = uDiskThick, flared)
   * density        rho(r,th) = profile(r) * turbulence(r,phi) * edges * exp(-z^2/H^2)
                    with z = r cos(th) the height above the equatorial plane
   * radiation      the ray is split into segments (the RK4 steps themselves,
                    sub-divided 5x where it enters/leaves or crosses the disk);
                    each segment transfers
                        dI = S * (1 - exp(-dtau)),   transmittance *= exp(-dtau),
                        dtau = kappa * rho * ds,     ds = real path length
                    which is the standard emissive-absorptive solution, so a
                    grazing ray really does traverse more material and the disk
                    really does have a visible top/bottom surface and occludes
                    its own far side.
   * temperature    T(r) ~ r^(-3/4) * (1 - sqrt(r_in/r))^(1/4), truncated at the
                    ISCO computed on the CPU from KN circular geodesics.
   * kinematics     Keplerian Omega(r) = (sqrt(k r) - a k)/(r - a^2 k),
                    k = (M r - Q^2)/r^3, drives differential shear of the
                    procedural turbulence (inner annuli lap the outer ones).
   * frequency shift g = 1/(u^t (1 - Omega b)),  b = L/E,  I_obs = g^4 I_em
                    -- relativistic beaming and gravitational redshift, with an
                    explicit switch for the latter.
   ========================================================================== */

#ifndef KN_DISK
#define KN_DISK

uniform float uDiskTemp;     /* peak effective temperature (K)            */
uniform float uDiskThick;    /* scale height  H/r                         */
uniform float uDiskTurb;     /* turbulence amount  0..1                   */
uniform float uDiskGain;     /* bolometric gain                           */
uniform float uDiskDoppler;  /* 0 = no Doppler/beaming, 1 = full          */
uniform float uDiskRedshift; /* 1 = keep gravitational redshift           */
uniform float uDiskInner;    /* ISCO radius (CPU, from circular geodesics)*/
uniform float uDiskOuter;    /* outer truncation radius                   */
uniform float uFluxPeak;     /* peak of the L2 flux, peak-normalises T~(F)^(1/4) */
uniform float uFluxLin;      /* L(r_in) for the zero-torque inner boundary */
uniform float uOmegaScale;   /* orbital-time scaling for the shear        */

#define KN_TAU 2.2           /* absorption coefficient (optical depth / rho / L) */

/* The DISK's local metric uses |M|, matching the CPU's kinematic template (main.js
   builds uFluxPeak from |M| already).  Using the signed M here made knFluxTemp return a
   negative profile for M < 0, which the |M|-templated normalisation then turned into
   near-zero emission -- values in the float32 DENORMAL range, whose flush-to-zero
   behaviour a GPU does not guarantee to reproduce.  That is the best-supported
   explanation for M < 0 being the one case that differed frame-to-frame (measured: two
   captures inside ONE page load differed for M = -1 while a = 1.2 and a = 0.86 matched).
   The GEODESIC metric keeps the signed M: only the astrophysical disk model uses |M|. */
/* ---- L2: relativistic thin-disk emission temperature ----------------------
   Mirror of diskFluxTable()/ptTemp() in js/kn.js.  The viscously dissipated
   flux on one face, with the torque vanishing at the inner edge, is

       F(r) = (L(r) - L(r_in)) * (-dOmega/dr) / (4 pi r)

   (L, Omega = equatorial circular-geodesic specific angular momentum and
   angular velocity) and the emitted temperature follows Stefan-Boltzmann,
   T ~ F^(1/4), peak-normalised by uFluxPeak so the gain calibration is
   untouched.  Properties verified on the CPU twin: exact Newtonian limit
   (residual 1.5e-6), F(r_in) = 0, and Integral 2*2*pi*r*F dr = 1 - E(r_in)
   to -0.09% (Schwarzschild 5.719%, a=0.998 32.10%).  The peak moves from
   1.361 r_in (Newtonian) out to 1.652 r_in.                                   */
void knCircEq(float r, out float E, out float L, out float Om){
  float r2 = r * r;
  float Del = r2 - 2.0 * abs(uM) * r + uA * uA + uQ * uQ;
  float f   = 2.0 * abs(uM) * r - uQ * uQ;
  float gtt = -(Del - uA * uA) / r2;
  float gtp = -f * uA / r2;
  float gpp = (r2 + uA * uA) + f * uA * uA / r2;
  float k   = max((abs(uM) * r - uQ * uQ) / max(r2 * r, 1.0e-9), 1.0e-9);
  Om = (sqrt(k * r) - uA * k) / max(r - uA * uA * k, 1.0e-4);
  float nrm = -(gtt + 2.0 * Om * gtp + Om * Om * gpp);
  float s = inversesqrt(max(nrm, 1.0e-8));
  E = (-gtt - gtp * Om) * s;
  L = (gtp + gpp * Om) * s;
}
float knFluxTemp(float r){
  if (r <= uDiskInner) return 0.0;
  float E, L, Om, Ea, La, Oa, Eb, Lb, Ob;
  knCircEq(r, E, L, Om);
  float h = 3.0e-3 * r;
  knCircEq(r + h, Ea, La, Oa);
  knCircEq(max(r - h, uDiskInner * 1.0001), Eb, Lb, Ob);
  float dOm = (Oa - Ob) / (2.0 * h);
  float F = (L - uFluxLin) * (-dOm) / (12.566370614 * r);
  return pow(max(F, 0.0) / max(uFluxPeak, 1.0e-12), 0.25);
}

float knTempProfile(float r, float rin){
  float x = rin / max(r, 1e-4);
  if (x >= 1.0) return 0.0;
  float t = pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25);
  /* exact normaliser: x^(3/4)(1-sqrt x)^(1/4) attains its maximum
     0.487871339232 at x = 36/49 (r = 49/36 r_in), so the profile is exactly 1
     there.  The earlier 0.4872 was a rounded constant that made the peak 0.14%
     too high -- caught by the O7 regression. */
  return t / 0.487871339232;
}

/* frequency-shift factor for an equatorial Keplerian emitter */
float knDiskG(float r, float b){
  float r2 = r * r;
  float a2 = uA * uA;
  float Del = r2 - 2.0 * abs(uM) * r + a2 + uQ * uQ;
  float f   = 2.0 * abs(uM) * r - uQ * uQ;
  float Sig = r2;
  float A   = (r2 + a2) * Sig + f * a2;    /* sin^2 = 1 exactly on the equator */
  float D   = Del - a2;
  float Om  = knOmega(r);
  float gtt = -D / Sig;
  float gtp = -f * uA / Sig;
  float gpp = A / Sig;
  float nrm = -(gtt + 2.0 * Om * gtp + Om * Om * gpp);
  float ut  = 1.0 / sqrt(max(nrm, 1e-5));
  float dop = 1.0 / max(1.0 - Om * b, 1e-3);
  float g = (uDiskRedshift > 0.5) ? dop / ut : dop;
  /* bounded above as well: 1 - Omega b can pass through zero for a grazing
     retrograde photon, and g^4 would then put a 1e6 spike in a single pixel.
     The physical bound for a Keplerian emitter is |g| <~ 6, see the sweep in
     tools/validate-physics.mjs. */
  return clamp(g, 0.02, 6.0);
}

/* local scale height: standard flaring thin disk, H/r ~ (r/r_in)^(1/8) times the
   scale-height parameter, so the outer disk is visibly thicker than the inner
   one (and a grazing view really shows a wedge rather than a line). */
float knDiskH(float r){
  return uDiskThick * r * pow(max(r / max(uDiskInner, 1e-3), 1.0), 0.125);
}

/* crude inside test used to decide whether a segment needs sub-sampling */
bool knInDisk(float r, float th){
  if (r < uDiskInner * 0.86 || r > uDiskOuter * 1.10) return false;
  float z = r * cos(th);
  return abs(z) < 1.8 * knDiskH(r);
}

/* ---------------------------------------------------------------- turbulence
   Keplerian-sheared procedural field with a cyclic cross-fade so the winding
   never saturates into azimuthal stripes.  Cost is what matters here: profiling
   showed this single function was 45 % of the whole frame, so it is built from
   cheap 2-D value noise in the disk plane plus a short gated 3-D term:

     * the coarse clumps and their Keplerian shear need only the plane, so they
       use 4 octaves of 2-D noise (4 hashes per octave instead of 8);
     * the second (offset) layer of the cross-fade is skipped outright when the
       fade weight is saturated, which is ~20 % of the time;
     * the 3-D detail term is only evaluated where the vertical Gaussian still
       has weight (passed in as 'detail'), so samples near the slab boundary --
       which is exactly where the 5x sub-division spends its samples -- skip it.

   Net effect: ~4x fewer hashes per call for the same look.                    */
float knDiskTurb(float r, float phi, float z, float t, float seed, float detail){
  if (uDiskTurb <= 0.001) return 1.0;
  float rho = sqrt(r * r + uA * uA);
  float Om  = knOmega(r);
  float T   = 46.0;
  float t0  = mod(t, T);
  float w   = t0 / T;
  float fw  = w * w * (3.0 - 2.0 * w);              /* smoothstep(0,1,w) */
  float psA = phi - Om * t0 * uOmegaScale;
  vec2  pA  = vec2(rho * cos(psA), rho * sin(psA));
  float nA  = fbm2(pA * 0.62 + seed * 3.3, 4);
  float n;
  if (fw < 0.04) {
    n = nA;
  } else if (fw > 0.96) {
    float psB = phi - Om * (t0 - T) * uOmegaScale;
    n = fbm2(vec2(rho * cos(psB), rho * sin(psB)) * 0.62 + seed * 3.3, 4);
  } else {
    float psB = phi - Om * (t0 - T) * uOmegaScale;
    float nB = fbm2(vec2(rho * cos(psB), rho * sin(psB)) * 0.62 + seed * 3.3, 4);
    n = mix(nA, nB, fw);
  }
  float turb = n * 0.78;
  if (detail > 0.05) {
    turb += fbm3(vec3(pA * 1.75, z * 1.15) + seed, 2) * 0.34 * detail;
  }
  return mix(1.0, turb * 2.1, clamp(uDiskTurb, 0.0, 1.2));
}

/* volumetric density at a point inside the disk.  The cheap factors are
   evaluated first and gate the noise, which is the expensive part. */
float knDiskDens(float r, float th, float phi, float t, float seed, out float qOut){
  qOut = 0.0;
  float rin  = uDiskInner;
  float rout = max(uDiskOuter, rin * 1.35);
  if (r < rin * 0.86 || r > rout * 1.08) return 0.0;
  float prof = knTempProfile(r, rin);
  float H = knDiskH(r);
  float z = r * cos(th);
  float q = z / H;
  qOut = q;
  float vert = exp(-q * q);
  /* clumping is concentrated towards the midplane (a thinner, denser core with
     a more diffuse surface) rather than being uniform in z */
  float amp = 1.0 - 0.30 * q * q;
  float edgeIn  = smoothstep(0.0, 0.22, (r - rin) / max(rin, 1e-3));
  float edgeOut = 1.0 - smoothstep(rout * 0.70, rout * 1.05, r);
  float gate = prof * edgeIn * edgeOut * vert * max(amp, 0.0);
  if (gate < 8.0e-3) return 0.0;                    /* noise skipped entirely */
  return gate * knDiskTurb(r, phi, z, t, seed, vert);
}

/* one segment of the disk volume: emitted radiance + segment transmittance */
vec3 knDiskSeg(float r, float th, float phi, float L, float t, float seed,
               float ds, out float atten, out float gOut){
  atten = 1.0;
  gOut = 1.0;   /* frequency-shift factor, exported for the line-profile integral */
  float q;
  float dens = knDiskDens(r, th, phi, t, seed, q);
  if (dens <= 1.0e-5 || ds <= 0.0) return vec3(0.0);
  /* L2: relativistic flux law for the TEMPERATURE.  The density shape below
     still uses the Shakura-Sunyaev-like profile -- the surface-density profile
     is a separate modelling choice and changing it is not part of L2. */
  float prof = knFluxTemp(r);
  float g = mix(1.0, knDiskG(r, L), clamp(uDiskDoppler, 0.0, 1.5));
  gOut = g;
  /* Vertical temperature gradient: the disk is hotter in the midplane than at
     its surface, so a grazing ray sees the hot core while a face-on ray sees
     the cooler surface.  This is what gives an optically thick slab its limb
     darkening instead of a flat wash.  q = z/H, and q = 0 exactly at the
     equatorial crossings, so the crossing-based predictions are unaffected. */
  float Trel = prof * (1.0 - 0.18 * q * q);
  /* hot clumps are also slightly hotter, not only denser */
  /* POLICY: aesthetics give way to rigour.  This used to read
       Tobs = uDiskTemp * Trel * (0.80 + 0.35*min(dens,1.5)) * g
     -- a density-driven CHROMATIC temperature with no matching magnitude, so a
     segment was not a Planck source at all.  Physically a density fluctuation
     belongs in the OPACITY (it already is: dtau = kN_TAU * dens * ds), not in the
     temperature: the local temperature is set by the disk model (radius and
     height), not by how clumpy the gas happens to be.  Removing the term makes
     every segment exactly a blackbody of temperature T_e = uDiskTemp * Trel,
     observed at g * T_e, and leaves the radial T^4 law untouched. */
  float Tobs = uDiskTemp * Trel * g;
  vec3 chroma = blackbodyRGB(Tobs);
  float dtau = KN_TAU * dens * ds;
  atten = exp(-dtau);
  /* L3 FIX (was 3.4): a blackbody's bolometric emissivity is j = sigma T_e^4/pi
     (Stefan-Boltzmann), so the emitted radiance must go as T_e^4.  With the g^4
     below and the chromaticity taken at the OBSERVED temperature g*T_e, the
     segment is exactly the Liouville/Planck result I_nu(nu_obs) = B_nu(nu_obs, g T_e):
     I_nu/nu^3 is the relativistic invariant and B_nu(a nu, T) = a^3 B_nu(nu, T/a),
     hence g^3 * B_nu(nu_obs/g, T_e) = B_nu(nu_obs, g T_e).  The old 3.4 made the
     radial law r^(-2.55) instead of the Novikov-Thorne r^(-3).  The literal here
     is cross-checked against DISK_TEMP_EXP in js/kn.js by the validator. */
  float src = pow(clamp(Trel, 0.0, 1.0), 4.0) * uDiskGain * pow(max(g, 0.02), 4.0);
  return chroma * src * (1.0 - exp(-dtau));
}

#endif