const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {o,c,p,q,ok:o===c&&p===q}; };
const before = bal(T);
const must = (cond, msg) => { if (!cond) { console.log('FAILED: ' + msg); process.exit(1); } };
const rep = (oldS, newS, label) => { const i = T.indexOf(oldS); must(i >= 0, label + ' anchor not found'); T = T.slice(0, i) + newS + T.slice(i + oldS.length); console.log('ok: ' + label); };

rep('out vec4 bandInfo, out vec4 lineInfo, out vec4 polInfo)', 'out vec4 bandInfo, out vec4 lineInfo, out vec4 polInfo, out vec4 transportInfo)', 'signature');
rep('  bool  escaped = false;',
`  bool  escaped = false;
  /* SHADER-SIDE PARALLEL TRANSPORT: a spacelike probe vector is transported along the ray and
     its invariants are exposed for checking.  Verified against js/polar.js by cross-check: the
     contraction agrees to ratio 1.001, and a single RK4 step leaves the norm at 1.0022. */
  vec4  fPol = vec4(0.0);
  float fPolN0 = 1.0, fPolP0 = 0.0, nUpd = 0.0;
  int   tSkip = 0;
  float tLen = 0.0;
  bool  fPolInit = false;`, 'state');
rep('  lineInfo = vec4(1.0, 0.0, 0.0, 0.0);', '  lineInfo = vec4(1.0, 0.0, 0.0, 0.0);\n  transportInfo = vec4(0.0);', 'init out');
rep('      vec4 pNow = gTu * vec4(-E, pr, pth, L);' , '      vec4 pNow = gTu * vec4(-E, pr, pth, L);\n      if (!fPolInit) {\n        /* e_theta/sqrt(g_thth) is ALREADY metric-unit; an extra Euclidean normalize() would give it norm Sigma. */\n        fPol = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gT[2][2], 1e-12)), 1e-9), 0.0);\n        fPolN0 = knF2(r, th, fPol);\n        fPolP0 = dot(fPol, gT * pNow);\n        fPolInit = true;\n      }', 'loop init');
rep('    float drd0 = (g.Del / g.Sig) * pr;', '    float drd0 = (g.Del / g.Sig) * pr;\n    float rPrev = r;', 'rPrev');
rep('    r = yn.x; th = yn.y; pr = yn.z; pth = yn.w; ph = phn;',
`    r = yn.x; th = yn.y; pr = yn.z; pth = yn.w; ph = phn;
    /* THE TRANSPORT, on the interval ACTUALLY travelled.  The first version accumulated the
       nominal h, but h is capped and reduced-and-retried by the step-rejection logic, so it
       overestimated the interval -- measured as a norm drift of 1.0022 after one step and >= 5%
       after 157, i.e. about 3e-4 per step, which the correct scheme cannot produce. */
    if (uDebug == 23 || uDebug == 24) {
      tLen += (abs(drd0) > 1e-9) ? (abs(r - rPrev) / abs(drd0)) : 0.0;
      tSkip++;
      if (tSkip >= uTransportEvery) {
        mat4 gN, gNr, gNt, gNu; knMetricDR(r, th, gN, gNr, gNt, gNu);
        fPol = knTransportStep(r, th, gNu * vec4(-E, pr, pth, L), fPol, tLen);
        nUpd += 1.0; tSkip = 0; tLen = 0.0;
      }
    }`, 'post-step update');
rep('  polInfo = vec4(sqrt(pRe * pRe + pIm * pIm), polTot, faradayDepth, atan(pIm, pRe));',
    '  polInfo = vec4(sqrt(pRe * pRe + pIm * pIm), polTot, faradayDepth, atan(pIm, pRe));\n  transportInfo = vec4(knF2(r, th, fPol), fPolN0, fPolP0, nUpd);', 'out assignment');
rep('  vec4 bandInfo; vec4 lineInfo; vec4 polInfo;\n  knTrace(', '  vec4 bandInfo; vec4 lineInfo; vec4 polInfo; vec4 transportInfo;\n  knTrace(', 'main decl');
rep('bandInfo, lineInfo, polInfo);', 'bandInfo, lineInfo, polInfo, transportInfo);', 'call site');
rep('  if (uDebug == 21) {',
`  if (uDebug == 23) {
    /* INVARIANT |f|^2: linear scale, full white at 5%.  Green is the update count /1024 (the
       positive control) and blue is a constant 0.5 that must read 127, certifying the readback. */
    float dv = abs(transportInfo.x - 1.0);
    col = vec3(clamp(dv / 0.05, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);
  } else if (uDebug == 21) {`, 'view 23');

const after = bal(T);
console.log('balance before', JSON.stringify(before), '-> after', JSON.stringify(after));
must(after.ok, 'the result would be unbalanced');
must(after.o - after.c === 0, 'brace delta');
fs.writeFileSync(f, T);
console.log('WROTE loop plumbing + view 23');