import { trace, equatorialPhotonOrbits } from '../js/kn.js';

/* A/B of defect B16 at the SHADER'S DEFAULT budget:
   maxSteps = 320, stepScale = 0.5, tol = 1e-4  (params.js defaults)
   and at the default camera radius r0 = 24M. */
const M = 1, a = 0, Q = 0, R0 = 24;
const o = equatorialPhotonOrbits(M, a, Q);
const n = 81;
const xs = [];
for (let i = 0; i < n; i++) xs.push(Math.exp(Math.log(1e-2) + (Math.log(1e-10) - Math.log(1e-2)) * i / (n - 1)));
const run = (legacyScale) => xs.map((x) => {
  const t = trace({ M, a, Q, r0: R0, th0: Math.PI / 2, ph0: 0, bEquator: o.bPro * (1 + x),
    maxSteps: 320, stepScale: 0.5, tol: 1e-4, rFar: 46, interior: false, legacyScale });
  return { esc: t.escaped, steps: t.steps, phi: Math.abs(t.ph) };
});
const nn = run(false), old = run(true);
const lost = [], gained = [];
for (let i = 0; i < n; i++) {
  if (old[i].esc && !nn[i].esc) lost.push(xs[i].toExponential(2));
  if (!old[i].esc && nn[i].esc) gained.push({ x: xs[i].toExponential(2), phi: +nn[i].phi.toFixed(3), steps: nn[i].steps });
}
const cnt = (r) => r.filter((v) => v.esc).length;
console.log(JSON.stringify({
  budget: 'maxSteps=320 stepScale=0.5 tol=1e-4 r0=24M (all shader/param defaults)',
  rays: n, escapedLegacy: cnt(old), escapedFixed: cnt(nn),
  raysLostByFix: lost, raysGainedByFix: gained,
  identicalWinding: xs.filter((x, i) => Math.abs(old[i].phi - nn[i].phi) < 1e-9).length,
  meanPhiLegacy: +(old.reduce((p, c) => p + c.phi, 0) / n).toFixed(3),
  meanPhiFixed: +(nn.reduce((p, c) => p + c.phi, 0) / n).toFixed(3),
  meanStepsLegacy: +(old.reduce((p, c) => p + c.steps, 0) / n).toFixed(1),
  meanStepsFixed: +(nn.reduce((p, c) => p + c.steps, 0) / n).toFixed(1)
}, null, 1));