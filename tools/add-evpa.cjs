const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const i = T.indexOf(a); must(i > 0, tag + ' anchor not found'); T = T.slice(0, i) + b + T.slice(i + a.length); console.log('ok: ' + tag); };
/* 1. state for the transported screen basis */
rep('  vec4 fPol = vec4(0.0);', '  vec4 fPol = vec4(0.0);\n  vec4 gA = vec4(0.0), gB = vec4(0.0);   /* the observer screen basis, transported INWARD */', 'state');
/* 2. initialise them at the camera (the first step IS the observer) */
rep('        fPolP0 = fpInit;', '        fPolP0 = fpInit;\n        /* the observer screen basis: e_alpha = d_phi/sqrt(g_phiphi), e_beta = -d_theta/sqrt(g_thth) */\n        gA = vec4(0.0, 0.0, 0.0, 1.0 / max(sqrt(max(gT[3][3], 1e-12)), 1e-9));\n        gB = vec4(0.0, 0.0, -1.0 / max(sqrt(max(gT[2][2], 1e-12)), 1e-9), 0.0);', 'basis init');
/* 3. transport all three on the same interval */
rep('          fPol = knTransportStep(r, th, gNu * vec4(-E, pr, pth, L), fPol, tLen);', '          vec4 pT = gNu * vec4(-E, pr, pth, L);\n          fPol = knTransportStep(r, th, pT, fPol, tLen);\n          gA   = knTransportStep(r, th, pT, gA, tLen);\n          gB   = knTransportStep(r, th, pT, gB, tLen);', 'transport three');
/* 4. at the source, expand the EMITTED polarisation in the transported screen basis and take atan2 */
rep('  transportInfo = vec4(knF2(r, th, fPol), fPolNlast, fPolP0, nUpd);', [
  '  /* SCREEN EVPA: f_src is the polarisation emitted at the source (the epsilon construction at',
  '     THIS point); gA and gB are the observer screen axes transported inward to here.  Solving',
  '     the 2x2 Gram system gives the coefficients of f_src in those axes DIRECTLY, so the EVPA is',
  '     atan2(c2, c1) with no further projection. */',
  '  mat4 gE, gEr, gEt, gEu; knMetricDR(r, th, gE, gEr, gEt, gEu);',
  '  vec4 pCovE = vec4(-E, pr, pth, L);',
  '  float fpE;',
  '  vec4 fSrc = knPolToroidal(pCovE, r, th, fpE);',
  '  float G11 = dot(gA, gE * gA), G12 = dot(gA, gE * gB), G22 = dot(gB, gE * gB);',
  '  float r1 = dot(fSrc, gE * gA), r2 = dot(fSrc, gE * gB);',
  '  float detG = G11 * G22 - G12 * G12;',
  '  float chiEVPA = (abs(detG) > 1e-12) ? atan((r2 * G11 - r1 * G12), (r1 * G22 - r2 * G12)) : 0.0;',
  '  chiEVPA = (chiEVPA > 1.5707963) ? chiEVPA - 3.14159265 : ((chiEVPA <= -1.5707963) ? chiEVPA + 3.14159265 : chiEVPA);',
  '  transportInfo = vec4(chiEVPA, fPolNlast, fPolP0, nUpd);',
].join('\n'), 'evpa');
/* 5. a view for it */
const vi = T.indexOf('  if (uDebug == 26) {');
must(vi > 0, 'view 26 not found');
T = T.slice(0, vi) + '  if (uDebug == 27) {\n    /* SCREEN EVPA in radians, +-pi/2, as a signed ramp: 0.5 is zero. */\n    float chi = transportInfo.x;\n    col = vec3(clamp(0.5 + chi / 3.14159265, 0.0, 1.0), clamp(abs(chi) * 2.0, 0.0, 1.0), 0.5);\n  } else ' + T.slice(vi + '  '.length);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');