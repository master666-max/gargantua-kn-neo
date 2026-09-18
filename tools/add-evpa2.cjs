const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': expected 1 occurrence, found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
rep('  vec4 fPol = vec4(0.0);', '  vec4 fPol = vec4(0.0);\n  vec4 gA = vec4(0.0), gB = vec4(0.0);   /* observer screen basis, transported INWARD */', 'state');
rep('        fPolP0 = fpInit;', '        fPolP0 = fpInit;\n        gA = vec4(0.0, 0.0, 0.0, 1.0 / max(sqrt(max(gT[3][3], 1e-12)), 1e-9));\n        gB = vec4(0.0, 0.0, -1.0 / max(sqrt(max(gT[2][2], 1e-12)), 1e-9), 0.0);', 'basis init');
rep('fPol = knTransportStep(r, th, gNu * vec4(-E, pr, pth, L), fPol, tLen);', 'vec4 pT = gNu * vec4(-E, pr, pth, L);\n          fPol = knTransportStep(r, th, pT, fPol, tLen);\n          gA   = knTransportStep(r, th, pT, gA, tLen);\n          gB   = knTransportStep(r, th, pT, gB, tLen);', 'transport three');
const evpa = [
  'mat4 gE, gEr, gEt, gEu; knMetricDR(r, th, gE, gEr, gEt, gEu);',
  'vec4 pCovE = vec4(-E, pr, pth, L);',
  'float fpE;',
  'vec4 fSrc = knPolToroidal(pCovE, r, th, fpE);',
  'float G11 = dot(gA, gE * gA), G12 = dot(gA, gE * gB), G22 = dot(gB, gE * gB);',
  'float r1 = dot(fSrc, gE * gA), r2 = dot(fSrc, gE * gB);',
  'float detG = G11 * G22 - G12 * G12;',
  'float chiEVPA = (abs(detG) > 1e-12) ? atan((r2 * G11 - r1 * G12), (r1 * G22 - r2 * G12)) : 0.0;',
  'chiEVPA = (chiEVPA > 1.5707963) ? chiEVPA - 3.14159265 : ((chiEVPA <= -1.5707963) ? chiEVPA + 3.14159265 : chiEVPA);',
  'transportInfo = vec4(chiEVPA, fPolNlast, fPolP0, nUpd);'
].join('\n');
rep('transportInfo = vec4(knF2(r, th, fPol), fPolNlast, fPolP0, nUpd);', evpa, 'evpa');
rep('  if (uDebug == 26) {', '  if (uDebug == 27) {\n    float chi = transportInfo.x;\n    col = vec3(clamp(0.5 + chi / 3.14159265, 0.0, 1.0), clamp(abs(chi) * 2.0, 0.0, 1.0), 0.5);\n  } else if (uDebug == 26) {', 'view 27');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
must(T.indexOf('chiEVPA') > 0, 'evpa missing');
fs.writeFileSync(f, T); console.log('WROTE');