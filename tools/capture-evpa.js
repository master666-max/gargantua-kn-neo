/* ============================================================================
   CAPTURE SNIPPET for tools/dbg-evpa-physical.mjs  --  deliverable (7).

   This file is the MEASUREMENT half of the assertion, kept in the repository so that the numbers
   the tool compares against are produced by a script rather than pasted in by hand.  It is written
   to be executed inside the running page (the browser tool wraps it in an async IIFE, so a bare
   return at the end works).

   It records the app parameters it ran under, scans view 42 for pixels whose crossing flag is
   EXACTLY 255 (every sample in that pixel had an equatorial crossing -- fractional values are
   boundary blends and are excluded, which is what the flag was added for), picks a spread of
   crossing radii, and reads the four 16-bit ray channels plus the physical EVPA at each.
   ========================================================================== */
const P = window.__KN.pipeline, gl = P.renderer.getContext();
const sel = document.getElementById('viewSel');
const V = window.__KN.values;
const W = 1280, H = 720;
async function setView(v){ sel.value = String(v); sel.dispatchEvent(new Event('change'));
  await new Promise(function(q){ setTimeout(q, 2300); }); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
async function readAt(v, pts){ await setView(v);
  return pts.map(function(p){ const c = new Uint8Array(4);
    gl.readPixels(p[0], p[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, c); return [c[0], c[1], c[2]]; }); }
/* view 42 first: find clean crossings and a spread of radii */
await setView(42);
const b42 = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b42);
/* FIXED PIXEL LIST, chosen once and then recorded HERE so that a re-capture measures the SAME rays.
   The previous version picked by scan order, and the picks moved when the candidate count moved, so
   before/after comparisons were impossible.  The flag is still checked per pixel on every capture,
   so a pixel that turns into a boundary blend is detected rather than trusted. */
const pts = [[25,25],[337,187],[625,172],[742,220],[616,505],[715,550],
             [160,120],[480,120],[800,120],[1120,120],[480,360],[800,360],[480,600],[800,600]];
let nCand = 0;
for (let y = 25; y < H - 25; y += 3) for (let x = 25; x < W - 25; x += 3) {
  const i = (y * W + x) * 4;
  if (b42[i + 1] === 255) { const rc = b42[i + 2] / 255 * 64; if (rc > 3.5 && rc < 45) nCand++; }
}
const r41 = await readAt(41, pts);
const r36 = await readAt(36, pts);
const r37 = await readAt(37, pts);
const r38 = await readAt(38, pts);
const r39 = await readAt(39, pts);
const r42 = await readAt(42, pts);
const r46 = await readAt(46, pts);   /* the crossing radius on 16 bits */
await setView(0);
const d16 = function(r, lo, hi){ return lo + (hi - lo) * (r[0] / 255 + r[1] / 65025); };
/* p^theta is encoded on -16..16 since round 23; the -8..8 range silently clipped five of fourteen pixels */
const PI = 3.14159265358979;
return {
  provenance: 'tools/capture-evpa.js, executed in the page on port 8241',
  app: { M: V.M, a: V.a, Q: V.Q, camR: V.camR, camTheta: V.camTheta, bfield: V.bfield, stepScale: V.stepScale, maxSteps: V.maxSteps },
  views: { chi: 41, pr: 36, pth: 37, E: 38, L: 39, valid: 42, rCross16: 46 },
  decoders: { chi41: 'pi*((x/255)-0.5)', pr36: '-4+8*u16', pth37: '-16+32*u16', E38: '4*u16', L39: '-32+64*u16', valid: 'green/255' },
  nCandidates: nCand,
  cases: pts.map(function(p, i){ return {
    tag: '(' + p[0] + ',' + p[1] + ')', px: p,
    rCrossShader: +(((r46[i][0] / 255) + (r46[i][1] / 65025)) * 64).toFixed(4),
    rCrossCoarse: +(r42[i][2] / 255 * 64).toFixed(2),
    flag: r42[i][1] / 255,
    chiShader: +(PI * ((r41[i][0] / 255) - 0.5)).toFixed(6),
    pr: +d16(r36[i], -4, 4).toFixed(6),
    pth: +d16(r37[i], -16, 16).toFixed(6),
    E: +d16(r38[i], 0, 4).toFixed(6),
    L: +d16(r39[i], -32, 32).toFixed(6)
  }; })
};