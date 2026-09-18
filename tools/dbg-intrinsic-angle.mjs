/* INTRINSIC SOURCE ANGLE, WITHOUT ANY TRANSPORT.  At a FIXED coordinate point (r_s, theta = pi/2, phi),
   for two spins, this evaluates the epsilon construction of model 4's field and measures the resulting
   polarisation direction in the LOCAL orthonormal frame.  Nothing is transported, so whatever changes
   with the spin here is the intrinsic contribution that contaminates the +/-a screen-angle difference.
   If it is of order the missing signal, the non-reproduction is explained; if it is far smaller, the
   paper's rotation is genuinely absent. */
import * as pol from '../js/polar.js';
const M = 1.0, Q = 0.0, PHI = 0.0;
const D = (g, u, v) => { let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g[i][j] * u[i] * v[j]; return s; };
const fold = (x) => { while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };
function bModel4(r, th, ph, a) {
  const s = Math.sin(th), c = Math.cos(th), cp = Math.cos(ph), sp = Math.sin(ph);
  const nr = s * cp, nth = c * cp, nph = -sp;
  const a2 = a * a;
  const Sig = r * r + a2 * c * c, Del = r * r - 2 * M * r + a2 + Q * Q;
  const AA = (r * r + a2) * Sig + (2 * M * r - Q * Q) * a2 * s * s;
  const grr = Sig / Del, gthth = Sig, gphph = AA * s * s / Sig;
  return [0, nr / Math.sqrt(grr), nth / Math.sqrt(gthth), nph / Math.sqrt(gphph)];
}
function localAngle(r, th, ph, a) {
  const m = pol.metric(r, th, M, a, Q);
  const u = pol.zamo(r, th, M, a, Q);
  const g = m.g, gu = pol.metricUp(r, th, M, a, Q).gu;
  /* a radially ingoing null photon, the face-on limit */
  const S = Math.sin(th), C = Math.cos(th);
  const Del = r * r - 2 * M * r + a * a + Q * Q;
  const L = 0.5 * a * S * S * 0;            /* zero angular momentum: exactly radial */
  const E = 1.0;
  const pr = -Math.sqrt(Math.max((r * r + a * a) * (r * r + a * a) - a * a * Del * 0, 1e-12)) / Math.max(Del, 1e-9);
  const pCov = [-E, pr, 0, L];
  const pUp = pol.momentumUp(r, th, M, a, Q, pr, 0, E, L);
  const b = bModel4(r, th, ph, a);
  const f = pol.polFromField(pUp, u, b, r, th, M, a, Q);
  /* components in the local orthonormal frame (rhat, thetahat, phihat) */
  const sc = [Math.sqrt(Math.abs(g[1][1])), Math.sqrt(Math.abs(g[2][2])), Math.sqrt(Math.abs(g[3][3]))];
  const fth = f[2] * sc[1], fph = f[3] * sc[2];
  return Math.atan2(fth, fph);
}
console.log('r_s     angle(a=+0.86)   angle(a=-0.86)   difference (rad)');
let worst = 0;
for (let rs = 10; rs <= 42; rs += 4) {
  const ap = localAngle(rs, Math.PI / 2, PHI, 0.86);
  const am = localAngle(rs, Math.PI / 2, PHI, -0.86);
  const d = fold(ap - am);
  worst = Math.max(worst, Math.abs(d));
  console.log(rs.toFixed(0).padStart(5) + ap.toFixed(6).padStart(19) + am.toFixed(6).padStart(18) + d.toFixed(6).padStart(16));
}
console.log('');
console.log('worst |difference| = ' + worst.toFixed(6) + ' rad; the paper predicts 3.44/r_s^2, i.e. 0.034 at r_s=10 down to 0.002 at r_s=42.');