/* Is my ANALYTIC Christoffel reduction right?  Compare the contraction
       -Gamma^mu_{al be} p^al f^be
   computed two ways: (a) through the VALIDATED finite-difference christoffel(), and (b) through
   the analytic derivative matrices plus the reduction A_sig - (1/2) d_sig(p.f) used in the
   shader.  If they disagree, the bug is in my algebra or my analytic derivatives, and it can be
   found here in milliseconds instead of by reading pixels. */
import { metric, christoffel, transportRhs, momentumUp } from '../js/polar.js';

function analyticMetricDR(r, th, M, a, Q) {
  const s = Math.sin(th), c = Math.cos(th);
  const s2 = s * s, c2 = c * c, sc = s * c, r2 = r * r, a2 = a * a;
  const Sig = r2 + a2 * c2;
  const Del = r2 - 2 * M * r + a2 + Q * Q;
  const f = 2 * M * r - Q * Q;
  const A = (r2 + a2) * Sig + f * a2 * s2;
  const Sr = 2 * r, St = -2 * a2 * sc;
  const Dr = 2 * r - 2 * M, Dt = 0;
  const fr = 2 * M, ft = 0;
  const Ar = 2 * r * Sig + (r2 + a2) * Sr + fr * a2 * s2;
  const At = (r2 + a2) * St + f * 2 * a2 * sc;
  const Sig2 = Sig * Sig, Del2 = Del * Del;
  const g = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const gr = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const gt = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const gu = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  g[0][0] = -1 + f / Sig;
  gr[0][0] = (fr * Sig - f * Sr) / Sig2;
  gt[0][0] = (ft * Sig - f * St) / Sig2;
  g[0][3] = g[3][0] = -f * a * s2 / Sig;
  gr[0][3] = gr[3][0] = -a * ((fr * s2) * Sig - f * s2 * Sr) / Sig2;
  gt[0][3] = gt[3][0] = -a * ((ft * s2 + f * 2 * sc) * Sig - f * s2 * St) / Sig2;
  g[1][1] = Sig / Del;
  gr[1][1] = (Sr * Del - Sig * Dr) / Del2;
  gt[1][1] = (St * Del - Sig * Dt) / Del2;
  g[2][2] = Sig; gr[2][2] = Sr; gt[2][2] = St;
  g[3][3] = A * s2 / Sig;
  gr[3][3] = (Ar * s2 * Sig - A * s2 * Sr) / Sig2;
  gt[3][3] = ((At * s2 + A * 2 * sc) * Sig - A * s2 * St) / Sig2;
  const s2n = Math.max(s2, 1e-9);
  gu[0][0] = -A / (Sig * Del);
  gu[0][3] = gu[3][0] = -f * a / (Sig * Del);
  gu[1][1] = Del / Sig;
  gu[2][2] = 1 / Sig;
  gu[3][3] = (Del - a2 * s2n) / (Sig * Del * s2n);
  return { g, gr, gt, gu };
}
function mv(m, v) { const o = [0,0,0,0]; for (let i = 0; i < 4; i++) { let s = 0; for (let j = 0; j < 4; j++) s += m[i][j] * v[j]; o[i] = s; } return o; }
function analyticRhs(r, th, M, a, Q, p, fv) {
  const { gr, gt, gu } = analyticMetricDR(r, th, M, a, Q);
  const grf = mv(gr, fv), gtf = mv(gt, fv), grp = mv(gr, p), gtp = mv(gt, p);
  /* CORRECT reduction (the first one had three separate errors: D was placed where C belongs,
     E was omitted entirely, and the 1/2 was attached to one term instead of the bracket):
         Gamma^mu_{al be} p^al f^be = (1/2) g^{mu sig} [ C_sig + D_sig - E_sig ]
         C_sig = d_al g_{sig be} p^al f^be      (derivative index on p)
         D_sig = d_al g_{sig be} f^al p^be      (derivative index on f; p <-> f swapped)
         E_sig = d_sig g_{al be} p^al f^be      (only sig = r, theta are nonzero)          */
  const C_ = [0,1,2,3].map(i => p[0] * grf[i] + p[1] * gtf[i]);
  const D_ = [0,1,2,3].map(i => fv[0] * grp[i] + fv[1] * gtp[i]);
  const Er = p[0] * grf[0] + p[1] * grf[1] + p[2] * grf[2] + p[3] * grf[3];
  const Et = p[0] * gtf[0] + p[1] * gtf[1] + p[2] * gtf[2] + p[3] * gtf[3];
  const E_ = [Er, Et, 0, 0];
  const q = [0,1,2,3].map(i => C_[i] + D_[i] - E_[i]);
  return mv(gu, q).map(v => -0.5 * v);
}
console.log('  case            max |analytic - FD| / |FD|');
const cases = [[6, 1.2, 1, 0.5, 0.0, [0,0.3,0.4,2.0], [0,0.5,0.7,0.1]],
               [6, 1.5708, 1, 0.86, 0.0, [-1,0.2,0.1,3.0], [0,0.1,0.9,0.0]],
               [12, 0.7, 1, 0.5, 0.6, [-1,0.05,0.2,4.0], [0,0.3,0.5,0.2]],
               [3, 0.3, 1, 0.3, 0.2, [-1,0.9,0.3,1.0], [0,0.4,0.1,0.3]]];
for (const [r, th, M, a, Q, p, fv] of cases) {
  const fd = transportRhs(r, th, M, a, Q, p, fv);
  const an = analyticRhs(r, th, M, a, Q, p, fv);
  let num = 0, den = 0;
  for (let i = 0; i < 4; i++) { num = Math.max(num, Math.abs(an[i] - fd[i])); den = Math.max(den, Math.abs(fd[i])); }
  console.log('  r=' + r + ' th=' + th + '      ' + (num / Math.max(den, 1e-30)).toExponential(3) + '   fd=' + fd.map(v => v.toExponential(2)).join(','));
}