/* ============================================================================
   GELLES 2021 SCREEN CONVENTION vs THIS RENDERER'S SCREEN BASIS   (deliverable (D))

   WHAT THIS DOES.  It takes Gelles et al. 2021 (PRD 104, 044060; arXiv:2105.09440)
   at its word -- its Eq. (13) and Eq. (36) -- and determines, from MEASUREMENTS
   inside this renderer rather than from a hand derivation of the camera geometry,
   how this renderer's screen basis relates to theirs.  Hand-derived geometry is what
   produced this session's phantom discrepancies; the measurements below are what
   settled it.

   THE PAPER'S DEFINITIONS (quoted, v2 of the HTML):
     Eq. (13):  alpha = -lambda / sin(theta_o),   beta = +-o sqrt(Theta)
                "+-o is the sign of p^theta at the observer"
     Eq. (36):  "we measure the Electric Vector Position Angle (EVPA) counter-clockwise
                 from +beta-hat:  EVPA = arctan(-f^alpha_obs / f^beta_obs)"
     Sec. III.2 comment: "for theta_o < pi/2, +-s = -1 for both m=0 on the BOTTOM of the
                 image (where +-o = -1) and m=1 on the TOP (where +-o = +1)"

   STEP 1 -- AN ALGEBRAIC IDENTITY THAT COLLAPSES beta.  With p_t = -1 (their
   normalisation), lambda = L/E, alpha = -lambda/sin(theta_o) and the Kerr Carter constant
   eta = p_theta^2 + cos^2(theta_o) [ lambda^2 / sin^2(theta_o) - a^2 ] evaluated at the
   observer (it is conserved), Eq. (14) gives
        beta^2 = eta - (alpha^2 - a^2) cos^2(theta_o) = p_theta^2 ,
   i.e. BETA IS EXACTLY THE SIGNED THETA-MOMENTUM.  Therefore +beta-hat is the direction
   in which p^theta increases -- and, crucially, the sign function +-o must NOT be
   differentiated when taking gradients (doing so once gave me a wrong determinant sign).
   checkBetaIdentity() verifies the cancellation numerically.

   STEP 2 -- THE ORIENTATION, FROM MEASURED GRADIENTS.  The screen direction +alpha-hat is
   the direction of increasing alpha, i.e. of DECREASING L (E and theta_o are constant to
   6e-5 over the patch, measured).  The direction +beta-hat is the direction of increasing
   p^theta.  Both gradients are read off the running renderer (views 39 and 37, 16-bit) and
   the sign of the Jacobian det[d(alpha,beta)/d(canvas)] says whether this renderer's screen
   has the same handedness as the paper's.

   THE RESULT AND ITS LIMIT ARE STATED IN THE OUTPUT.  No sign is asserted that was not
   computed here.
   ========================================================================== */

const T = (s) => String(s);
const f6 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(6);
const e2 = (x) => x.toExponential(2);

/* ---- the algebra -------------------------------------------------------- */
function checkBetaIdentity() {
  const a = 0.86, M = 1.0;
  let worst = 0;
  for (const th of [0.4, 0.9, 1.32645, 1.9, 2.6]) {
    for (const E of [0.7, 1.0, 1.6]) {
      for (const L of [-12, -3, 0, 5, 14]) {
        for (const pth of [-7, -1.5, 0.3, 4]) {
          const lam = L / E, pthN = pth / E;
          const alpha = -lam / Math.sin(th);
          const etaN = pthN * pthN + Math.cos(th) ** 2 * (lam * lam / Math.sin(th) ** 2 - a * a);
          const betaSq = etaN - (alpha * alpha - a * a) * Math.cos(th) ** 2;
          worst = Math.max(worst, Math.abs(betaSq - pthN * pthN));
        }
      }
    }
  }
  return worst;
}

/* ---- the measurement ---------------------------------------------------- */
const PX = 400, PY = 580;          /* the pixel the gradients were read at */
const READBACK = {
  /* view 37 decodes p^theta on [-8,8]; view 38 decodes E on [0,4]; view 39 decodes L on [-32,32].
     Columns: [dx, dy, p^theta, E, L, n_phi, n_theta].  9 points of a cross. */
  note: 'one session, port 8241, read with gl.readPixels on the default framebuffer',
  rows: [
    [   0,   0, -7.770427, 0.956248, -9.679477, -0.41176, -0.32549],
    [   5,   0, -7.790358, 0.956248, -9.533810, -0.41176, -0.32549],
    [  -5,   0, -7.759354, 0.956186, -9.824160, -0.41961, -0.32549],
    [  10,   0, -7.838093, 0.956248, -9.373379, -0.40392, -0.32549],
    [ -10,   0, -7.729827, 0.956186, -9.967859, -0.42745, -0.32549],
    [   0,   5, -7.924952, 0.956248, -9.587943, -0.41176, -0.33333],
    [   0,  -5, -7.605321, 0.956248, -9.702115, -0.41961, -0.31765],
    [   0,  10, -7.971949, 0.956248, -9.564321, -0.41176, -0.33333],
    [   0, -10, -7.461869, 0.956248, -9.724752, -0.41961, -0.30980],
  ],
};

function pick(dx, dy) { return READBACK.rows.find((r) => r[0] === dx && r[1] === dy); }
function central(h) {                       /* symmetric difference, per pixel */
  const p1 = pick(h, 0), m1 = pick(-h, 0), p2 = pick(0, h), m2 = pick(0, -h);
  return {
    dLdx: (p1[4] - m1[4]) / (2 * h), dLdy: (p2[4] - m2[4]) / (2 * h),
    dpdx: (p1[2] - m1[2]) / (2 * h), dpdy: (p2[2] - m2[2]) / (2 * h),
    dnphdx: (p1[5] - m1[5]) / (2 * h), dnthdy: (p2[6] - m2[6]) / (2 * h),
    dE: Math.max(p1[3], m1[3], p2[3], m2[3]) - Math.min(p1[3], m1[3], p2[3], m2[3]),
  };
}

/* THE AFFINE-PARAMETER SIGN, and how it is CERTIFIED rather than assumed.
   This renderer traces rays BACKWARD from the observer, so the momentum it integrates is the
   negative of the physical photon's momentum: my_p^theta = -(physical p^theta).  The paper
   supplies an independent test of that claim: it states that +-o = +1, i.e. physical
   p^theta > 0, is on the TOP of the image.  Measured on the vertical centre line of this
   renderer (view 37):
        y =  40 (bottom)  my p^theta = +8.02        y = 680 (top)  my p^theta = -7.96
   so my p^theta is NEGATIVE at the top, i.e. my p^theta = -(physical p^theta) exactly as the
   backward tracing implies, and the paper's statement is reproduced.  Had I skipped this, the
   tool would have put +beta-hat at the BOTTOM -- where it contradicts the paper -- and every
   subsequent handedness conclusion would have been inverted. */
const OBS_PTH_IS_PHYSICAL = -1;      /* my p^theta = -1 x physical p^theta */
const CENTRE_SCAN = { ys: [40, 150, 260, 340, 380, 460, 560, 680], pth: [8.0202, 7.8834, 3.9282, 0.7907, -0.8038, -4.0020, -7.5994, -7.9569] };

const bad = [];
console.log('Gelles 2021 screen convention vs this renderer  --  pixel (' + PX + ',' + PY + ')');
console.log('');
console.log('');

const idw = checkBetaIdentity();
console.log('STEP 1  beta = p_theta (Eq. 13+14 with the Kerr Carter constant)');
console.log('   worst |beta^2 - p_theta^2| over 300 (theta,E,L,p_theta) combinations: ' + e2(idw));
console.log('   -> ' + (idw < 1e-12 ? 'IDENTITY HOLDS; +beta-hat is the direction of increasing p^theta' : '*** IDENTITY FAILS ***'));
if (!(idw < 1e-12)) bad.push('beta identity');
console.log('');

console.log('STEP 2  gradients (central differences, 5 and 10 px; L and p^theta are 16-bit)');
console.log('   h(px)   dL/dx      dL/dy      dp^th/dx   dp^th/dy   dn_phi/dx  dn_th/dy   dE');
const grads = {};
for (const h of [5, 10]) {
  const g = central(h);
  grads[h] = g;
  console.log('   ' + String(h).padEnd(6) + f6(g.dLdx).padStart(10) + f6(g.dLdy).padStart(11)
    + f6(g.dpdx).padStart(11) + f6(g.dpdy).padStart(11) + f6(g.dnphdx).padStart(11)
    + f6(g.dnthdy).padStart(11) + '   ' + e2(g.dE));
}
console.log('   E is constant to ' + e2(Math.max(grads[5].dE, grads[10].dE)) + ' over the patch, so alpha depends on L alone.');
console.log('   dn_phi/dx > 0 and dn_th/dy < 0 with EQUAL magnitude: the canvas axes are the observer');
console.log('   local axes, +x = +phi-hat and +y = -theta-hat, i.e. +y points at the NORTH pole.');
console.log('');

console.log('STEP 3  orientation of det[d(alpha,beta)/d(canvas)]');
console.log('   alpha = -L/(E sin theta_o)  =>  grad alpha = -(1/(E sin theta_o)) grad L');
console.log('   beta  = physical p_theta    =>  grad beta  = -grad(my p_theta)     (STEP 1 + sign above)');
console.log('   h(px)   det (sign is what matters)                  sign');
const signs = [];
for (const h of [5, 10]) {
  const g = grads[h];
  /* d(alpha)/dx = -dL/dx ;  d(beta)/dx = -dp/dx */
  const det = (-g.dLdx) * (-g.dpdy) - (-g.dLdy) * (-g.dpdx);
  signs.push(Math.sign(det));
  console.log('   ' + String(h).padEnd(6) + f6(det).padStart(14) + '                         ' + (det > 0 ? 'POSITIVE' : 'NEGATIVE'));
}
const sameHanded = signs.every((s) => s === signs[0]) && signs[0] > 0;
console.log('');
if (signs.every((s) => s === signs[0])) console.log('   the sign is stable across baselines');
else { console.log('   *** SIGN NOT STABLE ACROSS BASELINES ***'); bad.push('unstable sign'); }

/* the geometric cross-check, independent of the determinant */
{
  const g = grads[10];
  const aHat = [-g.dLdx, -g.dLdy], bHat = [-g.dpdx, -g.dpdy];
  const nA = Math.hypot(aHat[0], aHat[1]), nB = Math.hypot(bHat[0], bHat[1]);
  const A = [aHat[0] / nA, aHat[1] / nA], B = [bHat[0] / nB, bHat[1] / nB];
  /* -alpha-hat, the direction the paper's EVPA rotates TOWARDS from +beta-hat */
  const mA = [-A[0], -A[1]];
  const cross = B[0] * mA[1] - B[1] * mA[0];    /* >0 => beta-hat -> -alpha-hat is CCW on canvas */
  const ccw = cross > 0;
  /* the paper's own cross-check: +beta-hat is the TOP of the image (north), i.e. +canvas y */
  const betaUp = B[1] > 0;
  console.log('   cross-check, no determinant:  +alpha-hat = (' + A.map((x) => x.toFixed(3)).join(', ')
    + '),  +beta-hat = (' + B.map((x) => x.toFixed(3)).join(', ') + ')');
  console.log('   rotating from +beta-hat to -alpha-hat (= ' + (mA[0] >= 0 ? '+' : '') + mA[0].toFixed(3) + ','
    + (mA[1] >= 0 ? '+' : '') + mA[1].toFixed(3) + ') has cross ' + cross.toFixed(4) + '  =>  '
    + (ccw ? 'CCW on canvas' : 'CW on canvas'));
  console.log('   +beta-hat has canvas-y component ' + B[1].toFixed(3) + '  =>  points '
    + (betaUp ? 'UP, toward the north pole, exactly as the paper requires (+-o = +1 is the top)'
              : '*** DOWN, contradicting the paper (+-o = +1 is the top) ***'));
  if (!betaUp) bad.push('beta-hat points down');
  const agree = (ccw === sameHanded);
  console.log('   paper measures the EVPA along exactly that rotation (' + (ccw ? 'CCW' : 'CW') + ' on canvas);');
  console.log('   this renderer measures chi the other way (atan2 from +x toward +y = CCW).');
  console.log('   det<0 says opposite handedness; the rotation sense says ' + (ccw ? 'same' : 'opposite') + '.');
  console.log('   => ' + (agree ? 'BOTH ROUTES AGREE: EVPA_Gelles runs OPPOSITE to chi on this canvas'
                              : '*** THE TWO ROUTES DISAGREE ***'));
  if (!agree) bad.push('handedness disagreement');
}
console.log('');
console.log('CONCLUSION');
console.log('   EVPA_Gelles = -chi + R(pixel; a)   where R is the rotation between the observer local');
console.log('   orthonormal frame and the asymptotic (alpha,beta) screen.  The SIGN is settled here: the');
console.log('   two screens have OPPOSITE handedness, so a spin-induced rotation of chi carries the');
console.log('   OPPOSITE SIGN as the paper\'s dEVPA.');
console.log('   R ITSELF IS NOT CLAIMED.  It is pixel- and spin-dependent (the map from the local sky to');
console.log('   the asymptotic screen is not conformal at r_o = 24 M), so dEVPA = dchi + dR, and only the');
console.log('   sign of dchi is certified by this file.');
console.log('');
console.log(bad.length ? ('FAILED: ' + bad.join('; '))
  : 'ALL CHECKS PASS (sign stable across baselines; both routes agree the handedness is OPPOSITE)');
process.exit(bad.length ? 1 : 0);
