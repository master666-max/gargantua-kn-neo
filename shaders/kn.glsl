/* ============================================================================
   kn.glsl -- Kerr-Newman geometry, Hamiltonian null geodesics, ZAMO tetrad
   ----------------------------------------------------------------------------
   Metric (Boyer-Lindquist, signature -+++, G = c = 1):
       Sigma = r^2 + a^2 cos^2(th)
       Delta = r^2 - 2 M r + a^2 + Q^2
       f     = 2 M r - Q^2                      (KN charge correction)
       A     = (r^2+a^2) Sigma + f a^2 sin^2(th)
       D     = Delta - a^2 sin^2(th)
   contravariant components actually used:
       g^tt  = -A/(Sigma Delta)
       g^tph = -f a/(Sigma Delta)
       g^phph=  D/(Sigma Delta sin^2 th)
       g^rr  =  Delta/Sigma
       g^thth=  1/Sigma
   covariant components:
       g_tt  = -D/Sigma ,  g_tph = -f a sin^2/Sigma ,  g_phph = A sin^2/Sigma
       g_rr  = Sigma/Delta ,  g_thth = Sigma

   Photon state integrated here:  y = (r, th, p_r, p_th)
   Conserved along the flow:      E = -p_t   and   L = p_phi
   (stationarity + axisymmetry => both are exact constants of the RK4 flow)

   Hamiltonian (null normalisation H = 0):
       H = 1/2 [ P/(Sigma Delta) + (Delta/Sigma) p_r^2 + p_th^2/Sigma ]
       P = -A E^2 + 2 f a E L + D L^2/sin^2(th)

   Hamilton equations  dq/dlam = dH/dp ,  dp/dlam = -dH/dq :
       dr /dlam = (Delta/Sigma) p_r
       dth/dlam = p_th / Sigma
       dp_r/dlam = -dH/dr
       dp_th/dlam= -dH/dth
       dph/dlam = D L/(Sigma Delta sin^2) + f a E/(Sigma Delta)
   (the last two are the standard KN angular velocities; dphi is carried
    outside the RK4 core because phi never feeds back into the metric.)

   Axis regularisation: sin^2(th) -> sin^2(th) + KN_EPS2.  The Boyer-Lindquist
   phi coordinate is degenerate on the polar axis (g^phph -> inf); the shift is
   analytically differentiable (d/dth sqrt(s^2+e^2) = s c / sqrt(s^2+e^2)) so
   the Hamiltonian stays *exactly* conserved for the regularised metric.
   The deformation is confined to |th - pi/2| > 89 deg and is documented.
   ========================================================================== */

#ifndef KN_GEOM
#define KN_GEOM

uniform float uM;
uniform float uA;
uniform float uQ;

#define KN_EPS2 4.0e-4

struct KNGeo {
  float r, th, s, c, s2, ds2, Sig, Del, f, A, D, S2;
};

KNGeo knGeo(float r, float th){
  KNGeo g;
  float s = sin(th);
  g.r  = r;
  g.th = th;
  g.s  = s;
  g.c  = cos(th);
  float s2 = s * s;
  float w  = exp(-s2 / KN_EPS2);          /* 1 on the axis, 0 elsewhere      */
  g.s2  = s2 + KN_EPS2 * w;               /* regularised sin^2(th)            */
  g.ds2 = 2.0 * s * g.c * (1.0 - w);      /* its exact theta derivative       */
  float a2 = uA * uA;
  float r2 = r * r;
  /* cos^2 is taken as the exact complement 1 - sin^2 so that the metric
     identities (det = -Delta sin^2, -g^tt = A/(Sigma Delta), omega = f a/A)
     hold to machine precision.  Using cos(th)*cos(th) instead would leave an
     O(a^2 eps^2) inconsistency that shows up as a fake conservation drift and
     as a non-null initial photon. */
  g.Sig = r2 + a2 * (1.0 - g.s2);
  g.Del = r2 - 2.0 * uM * r + a2 + uQ * uQ;
  g.f   = 2.0 * uM * r - uQ * uQ;
  g.A   = (r2 + a2) * g.Sig + g.f * a2 * g.s2;
  g.D   = g.Del - a2 * g.s2;
  g.S2  = g.Sig * g.Del;
  return g;
}

/* returns vec3(H, |terms|, fine).
   .y  = 0.5*(|t1|+|t2|+|t3|)  normalises the REPORTED conservation drift.
   .z  = the same norm with the signs stripped INSIDE P, i.e. at the sub-term
         level.  It is the scale the step controller must use, because .y
         degenerates: P is a difference of O(1) terms, so near a turning point
         P -> 0 while its pieces do not, and .y then measures round-off. */
vec3 knH(KNGeo g, float pr, float pth, float E, float L){
  float P  = -g.A * E * E + 2.0 * g.f * uA * E * L + g.D * L * L / g.s2;
  float t1 = P / g.S2;
  float t2 = (g.Del / g.Sig) * pr * pr;
  float t3 = pth * pth / g.Sig;
  float fine = 0.5 * (g.A * E * E + 2.0 * abs(g.f * uA * E * L) + g.D * L * L / g.s2) / g.S2
             + 0.5 * (t2 + t3);
  return vec3(0.5 * (t1 + t2 + t3),
              0.5 * (abs(t1) + abs(t2) + abs(t3)) + 1e-20,
              fine + 1e-20);
}

/* Hamilton right-hand side; dy = (dr, dth, dp_r, dp_th)/dlam */
void knRHS(KNGeo g, float pr, float pth, float E, float L, out vec4 dy){
  float a2  = uA * uA;
  float M2  = 2.0 * uM;
  float r   = g.r;
  float r2  = r * r;
  float sc2  = g.ds2;                   /* d(regularised sin^2)/dth */
  float sigR = 2.0 * r;
  float sigT = -a2 * g.ds2;             /* dSigma/dth = a^2 d(cos^2)/dth */
  float delR = 2.0 * r - M2;
  float A_R  = 2.0 * r * (g.Sig + r2 + a2) + M2 * a2 * g.s2;
  float A_T  = (r2 + a2) * sigT + g.f * a2 * sc2;
  float P    = -g.A * E * E + 2.0 * g.f * uA * E * L + g.D * L * L / g.s2;
  float P_R  = -A_R * E * E + 2.0 * M2 * uA * E * L + delR * L * L / g.s2;
  float P_T  = -A_T * E * E - a2 * sc2 * L * L / g.s2 - g.D * L * L * sc2 / (g.s2 * g.s2);
  float S2R  = sigR * g.Del + g.Sig * delR;
  float S2T  = sigT * g.Del;
  float iS2  = 1.0 / g.S2;
  float iS2s = iS2 * iS2;
  float iSig = 1.0 / g.Sig;
  float iSigs= iSig * iSig;
  float dHdr = 0.5 * ((P_R * g.S2 - P * S2R) * iS2s
                      + pr * pr * (delR * g.Sig - g.Del * sigR) * iSigs
                      + pth * pth * (-sigR) * iSigs);
  float dHdth= 0.5 * ((P_T * g.S2 - P * S2T) * iS2s
                      + pr * pr * (-g.Del * sigT) * iSigs
                      + pth * pth * (-sigT) * iSigs);
  dy.x = (g.Del / g.Sig) * pr;
  dy.y = pth / g.Sig;
  dy.z = -dHdr;
  dy.w = -dHdth;
}

float knDphi(KNGeo g, float E, float L){
  return (g.D * L / g.s2 + g.f * uA * E) / g.S2;
}

/* ---- ZAMO (zero-angular-momentum observer) orthonormal tetrad ------------
   e0 = alpha (d_t + omega d_phi),  alpha = sqrt(-g^tt),  omega = f a / A
   e1 = sqrt(g^rr) d_r,  e2 = sqrt(g^thth) d_th,  e3 = d_phi/sqrt(g_phph)
   n = (n1,n2,n3) is a unit direction *in that tetrad*.  With E_loc = 1 the
   photon 4-momentum is assembled and lowered with g, giving the covariant
   (p_r,p_th) plus the exact conserved (E,L).  H is then 0 identically;
   knH() is used afterwards to measure the integrator drift.            */
bool knZamoInit(float r, float th, vec3 n, out float pr, out float pth, out float E, out float L){
  KNGeo g = knGeo(r, th);
  float aD = max(abs(g.Del), 1e-8);
  float alpha = sqrt(g.A / (g.Sig * aD));         /* sqrt(-g^tt) in the exterior */
  float omega = g.f * uA / g.A;
  float gphph = g.A * g.s2 / g.Sig;
  float pt_up  = alpha;
  float pr_up  = n.x * sqrt(aD / g.Sig);
  float pth_up = n.y * sqrt(1.0 / g.Sig);
  float pph_up = n.z / sqrt(max(gphph, 1e-9)) + alpha * omega;
  float gtt_c  = -g.D / g.Sig;
  float gtp_c  = -g.f * uA * g.s2 / g.Sig;
  L   =   gtp_c * pt_up + gphph * pph_up;
  float sgn = (g.Del >= 0.0) ? 1.0 : -1.0;
  pr  = sgn * (g.Sig / aD) * pr_up;
  pth = g.Sig * pth_up;
  E   = -(gtt_c * pt_up + gtp_c * pph_up);
  if (g.Del < 0.0){
    /* Interior chart: Delta < 0 makes g^rr negative, so the tetrad above is
       only formal.  Restore exact nullness by solving H = 0 for E:
         A E^2 - 2 f a L E - C = 0 ,  C = D L^2/s2 + Delta^2 p_r^2 + Delta p_th^2
       and keeping the root of largest magnitude.  Exterior pixels never take
       this branch (the tetrad there is already exactly null).               */
    float C = g.D * L * L / g.s2 + g.Del * g.Del * pr * pr + g.Del * pth * pth;
    float disc = g.f * g.f * uA * uA * L * L + g.A * C;
    if (disc > 0.0){
      float s = sqrt(disc);
      float e1 = ( g.f * uA * L + s) / g.A;
      float e2 = ( g.f * uA * L - s) / g.A;
      E = (abs(e1) > abs(e2)) ? e1 : e2;
      if (E < 0.0) E = -E;
    }
  }
  return true;
}

/* horizons and ergosphere (exposed for the HUD + CPU parity) */
float knRplus(){
  float d = uM * uM - uA * uA - uQ * uQ;
  return uM + sqrt(max(d, 0.0));
}
float knRminus(){
  float d = uM * uM - uA * uA - uQ * uQ;
  return uM - sqrt(max(d, 0.0));
}
/* ergosphere radius at polar angle th (g_tt = 0) */
float knErgo(float th){
  float d = uM * uM - uA * uA * cos(th) * cos(th) - uQ * uQ;
  return uM + sqrt(max(d, 0.0));
}
/* Keplerian angular velocity of an equatorial circular geodesic (KN) */
float knOmega(float r){
  float k = (uM * r - uQ * uQ) / max(r * r * r, 1e-6);
  k = max(k, 1e-7);
  float num = sqrt(k * r) - uA * k;
  float den = r - uA * uA * k;
  return num / max(den, 1e-4);
}

#endif
