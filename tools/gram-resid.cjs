const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n + ' occurrences'); T = T.split(a).join(b); console.log('ok: ' + tag); };
/* the 2x2 Gram solve is the only NEW piece in the EVPA block: assert it by reconstructing */
rep('chiEVPA = (chiEVPA > 1.5707963)', 'float cc1 = (r1 * G22 - r2 * G12) / max(detG, 1e-12);\n  float cc2 = (r2 * G11 - r1 * G12) / max(detG, 1e-12);\n  vec4 fRec = cc1 * gA + cc2 * gB;\n  vec4 fDiff = fRec - fSrc;\n  float evpaResid = sqrt(max(abs(dot(fDiff, gE * fDiff)), 0.0));\n  chiEVPA = (chiEVPA > 1.5707963)', 'gram residual');
rep('transportInfo = vec4(chiEVPA, fPolNlast, fPolP0, nUpd);', 'transportInfo = vec4(chiEVPA, fPolNlast, evpaResid, nUpd);', 'expose residual');
/* view 28: calibration + residual (log) + calibration */
rep('  if (uDebug == 27) {', '  if (uDebug == 28) {\n    float rv = abs(transportInfo.z);\n    col = vec3(0.25, clamp((log(max(rv, 1e-6)) + 6.0) / 12.0, 0.0, 1.0), 0.75);\n  } else if (uDebug == 27) {', 'view 28');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');