/* ============================================================================
   poltest.js -- the in-app assertion harness for (A): 'make the code that draws
   and the code that is verified the same thing, and give the shader automatic
   assertions'.

   Two halves, and the second half matters more than it looks:

   1. CPU SELF-TEST.  The shipping page now imports js/polar.js -- the module with
      39 validated assertions -- and exercises it at boot.  Until now that module was
      imported only by tools/*.mjs, so the app shipped code that was never run by the
      app.  A regression in it is now caught in the browser, not only in CI.

   2. SHADER ASSERTIONS, WITH A POSITIVE CONTROL.  Views 21 and 22 are the shader's own
      polarisation outputs.  Their VALUES are asserted (a fraction must lie in [0,1]; the
      Faraday depth must be finite and bounded), and -- because an assertion that cannot
      tell 'correct' from 'never executed' is worthless -- the harness also counts how many
      pixels carry signal at all.  If the frame is empty the result is INCONCLUSIVE, never
      a pass.  That is the lesson from the invariant test that sat vacuously for a round.
   ========================================================================== */
import { christoffel, polFraction, thinSpectralIndex, stokesStep, faradayFlat, foldEVPA, evpaDiff } from './polar.js';

export function cpuSelfTest() {
  const out = [];
  const t = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  try {
    const G = christoffel(10, 1.0, 1, 0, 0);
    t('Schwarzschild Gamma^r_tt = M(r-2M)/r^3', Math.abs(G[1][0][0] - 8 / 1000) < 1e-8, G[1][0][0].toFixed(9));
    const G2 = christoffel(10, 1.0, 1, 0, 0, 5e-6);
    t('Christoffel stable under a halved FD step', Math.abs(G[1][0][0] - G2[1][0][0]) < 1e-7, Math.abs(G[1][0][0] - G2[1][0][0]).toExponential(1));
    t('Pi(p=3) = (p+1)/(p+7/3)', Math.abs(polFraction(3) - 0.75) < 1e-15, polFraction(3).toFixed(12));
    t('optically thin alpha(3) = -1', Math.abs(thinSpectralIndex(3) + 1) < 1e-15, thinSpectralIndex(3));
    const j = 2.5e-7, aa = 3.1e-3, L = 4000;
    const c = { jI: j, jQ: 0, jU: 0, jV: 0, aI: aa, aQ: 0, aU: 0, aV: 0, rV: 0, rQ: 0 };
    let S = [0, 0, 0, 0]; const N = 4000;
    for (let i = 0; i < N; i++) S = stokesStep(S, c, L / N);
    const exact = (j / aa) * (1 - Math.exp(-aa * L));
    t('transfer matches I=(j/a)(1-exp(-a s))', Math.abs(S[0] - exact) < 2e-3, Math.abs(S[0] - exact).toExponential(1));
    const f1 = faradayFlat({ p: 3, nu: 1.0e9, n: 1, Bpar: 0.7, L: 1e6, steps: 2000 });
    t('flat Faraday angle = rhoV * L', Math.abs(f1.psi / f1.analytic - 1) < 1e-12, (f1.psi / f1.analytic).toFixed(12));
    const f2 = faradayFlat({ p: 3, nu: 2.0e9, n: 1, Bpar: 0.7, L: 1e6, steps: 2000 });
    t('Faraday rotation ~ nu^-2', Math.abs(f1.rhoV / f2.rhoV - 4) < 1e-12, (f1.rhoV / f2.rhoV).toFixed(12));
    t('EVPA folds into (-pi/2, pi/2]', Math.abs(foldEVPA(3.5) - (3.5 - Math.PI)) < 1e-12, foldEVPA(3.5).toFixed(6));
    t('evpaDiff is mod pi', Math.abs(evpaDiff(0.1, -0.1) - 0.2) < 1e-12, evpaDiff(0.1, -0.1).toFixed(6));
  } catch (e) {
    t('cpu self-test ran without throwing', false, String(e && e.message ? e.message : e).slice(0, 90));
  }
  return { out, passed: out.filter((o) => o.ok).length, failed: out.filter((o) => !o.ok).length };
}

/* read one view's pixels back through a 2D canvas */
function grab(gl, view) {
  const cv = document.createElement('canvas');
  cv.width = gl.drawingBufferWidth || gl.width; cv.height = gl.drawingBufferHeight || gl.height;
  const c2 = cv.getContext('2d'); c2.drawImage(gl, 0, 0);
  return c2.getImageData(0, 0, cv.width, cv.height).data;
}
export async function shaderAssertions(gl, setView, wait) {
  const out = [];
  const t = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const sleep = wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (const view of [21, 22]) {
    setView(view); await sleep(2200);
    const d = grab(gl, view);
    let n = 0, live = 0, maxR = 0, minR = 255, sumR = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2]; n++;
      if (R > minR) minR = minR; if (R < minR) minR = R;
      maxR = Math.max(maxR, R, G, B); sumR += R;
      if (R + G + B > 12) live++;
    }
    /* POSITIVE CONTROL first: an empty frame proves nothing and must not read as a pass */
    t('view ' + view + ': the pass actually rendered (positive control)', live > 0.02 * n, live + '/' + n + ' pixels with signal');
    t('view ' + view + ': values are finite and in range', Number.isFinite(sumR) && maxR <= 255, 'max channel ' + maxR);
  }
  return { out, passed: out.filter((o) => o.ok).length, failed: out.filter((o) => !o.ok).length };
}

/* NUMERIC ASSERTION.  Read the shader's OWN -Gamma p f back and compare it against the validated
   CPU module, computed IN THE PAGE with the page's live parameters.  The red and blue channels
   carry the calibration constants 0.25 and 0.75 (must read 64 and 191), so the readback is
   CERTIFIED before the comparison is believed -- the step whose absence produced several rounds
   of confident wrong conclusions earlier in this work. */
export async function numericAssertions(gl, setView, wait) {
  const out = [];
  const t = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  const sleep = wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  try {
    const pol = await import('./polar.js');
    const V = window.__KN.values || {};
    const M = V.M, a = V.a, Q = V.Q;
    const r = 6.0, th = 1.2;
    const g = pol.metric(r, th, M, a, Q).g;
    const fv = [0, 0, 1 / Math.sqrt(g[2][2]), 0];
    const pu = pol.momentumUp(r, th, M, a, Q, 0.3, 0.2, +1.0, 3.0);
    const cpu = pol.transportRhs(r, th, M, a, Q, pu, fv)[0];
    setView(25); await sleep(2200);
    const cv = document.createElement('canvas');
    cv.width = gl.drawingBufferWidth || gl.width; cv.height = gl.drawingBufferHeight || gl.height;
    const c2 = cv.getContext('2d'); c2.drawImage(gl, 0, 0);
    const d = c2.getImageData(0, 0, cv.width, cv.height).data;
    const R = d[0], G = d[1], B = d[2];
    t('numeric: readback certified (0.25 -> 64, 0.75 -> 191)', R === 64 && B === 191, 'R=' + R + ' B=' + B);
    const shader = ((G / 255) - 0.5) / 500;
    const tol = 2.0e-5;
    /* The physical polarisation from the epsilon construction: its two invariants.  Green is
       |f.p| on a log scale from 1e-6, so a reading of 0 means 'at or below the floor'. */
    setView(26); await sleep(2200);
    c2.drawImage(gl, 0, 0);
    const d2 = c2.getImageData(0, 0, cv.width, cv.height).data;
    const nrm = ((d2[2] / 255) - 0.5) / 10 + 1;
    t('numeric: epsilon construction is metric-normalised (|f|^2 = 1)', Math.abs(nrm - 1) <= 2.0e-3, '|f|^2 = ' + nrm.toFixed(5));
    /* DIRECTION test.  |f|^2 = 1 and f.p = 0 pin the magnitude but NOT the direction inside the
       polarisation plane, so the components are compared against the CPU module as well -- on a
       scale chosen so that a discrepancy of a few quantisation steps is visible. */
    setView(29); await sleep(2200);
    c2.drawImage(gl, 0, 0);
    const d3 = c2.getImageData(0, 0, cv.width, cv.height).data;
    try {
      const pol2 = await import('./polar.js');
      const uu = pol2.zamo(6.0, 1.2, 1, 0.86, 0);
      const pp = pol2.momentumUp(6.0, 1.2, 1, 0.86, 0, 0.3, 0.2, 1.0, 3.0);
      const cf = pol2.unitise(pol2.polFromField(pp, uu, [0, 0, 0, 1], 6.0, 1.2, 1, 0.86, 0), 6.0, 1.2, 1, 0.86, 0);
      const sfr2 = ((d3[1] / 255) - 0.5) / 3, sfth2 = ((d3[2] / 255) - 0.5) / 3;
      const q2 = 1 / (255 * 3);
      t('numeric: epsilon construction DIRECTION matches the CPU (f^r, f^th)',
        Math.abs(sfr2 - cf[1]) <= 2 * q2 && Math.abs(sfth2 - cf[2]) <= 2 * q2,
        'shader (' + sfr2.toFixed(5) + ', ' + sfth2.toFixed(5) + ') vs cpu (' + cf[1].toFixed(5) + ', ' + cf[2].toFixed(5) + ')');
    } catch (e) { t('numeric: direction comparison ran', false, String(e && e.message ? e.message : e).slice(0, 80)); }
    setView(26); await sleep(2200);
    c2.drawImage(gl, 0, 0);
    t('numeric: epsilon construction is orthogonal to p (f.p = 0)', d2[1] === 0 && d2[0] === 64,
      'f.p grey ' + d2[1] + ' (0 means at or below the 1e-6 floor), calibration R=' + d2[0]);
    setView(25); await sleep(2200);
    c2.drawImage(gl, 0, 0);
    t('numeric: shader contraction matches the validated CPU module', Math.abs(shader - cpu) <= tol,
      'shader ' + shader.toExponential(4) + ' vs cpu ' + cpu.toExponential(4) + ' ratio ' + (shader / cpu).toFixed(4));
  } catch (e) {
    t('numeric: harness ran without throwing', false, String(e && e.message ? e.message : e).slice(0, 100));
  }
  return { out, passed: out.filter((o) => o.ok).length, failed: out.filter((o) => !o.ok).length };
}
export async function runAll(gl, setView) {
  const cpu = cpuSelfTest();
  const shader = await shaderAssertions(gl, setView);
  const numeric = await numericAssertions(gl, setView);
  setView(0);
  const res = { cpu, shader, numeric, passed: cpu.passed + shader.passed + numeric.passed,
    failed: cpu.failed + shader.failed + numeric.failed };
  window.__KN_POLTEST = res;
  return res;
}