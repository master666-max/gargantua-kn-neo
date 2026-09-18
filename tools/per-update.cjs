const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const must = (c, m) => { if (!c) { console.log('ABORT: ' + m); process.exit(1); } };
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
must(T.indexOf('float gAn = 1.0, gBn = 1.0;') > 0, 'state anchor missing');
T = T.replace('float gAn = 1.0, gBn = 1.0;', 'float gAn = 1.0, gBn = 1.0;\n  float fNPrev = 1.0;   /* the norm BEFORE the last transport update */');
must(T.indexOf('  vec4 pT = gNu * vec4(-E, pr, pth, L);') > 0, 'pT anchor missing');
T = T.replace('  vec4 pT = gNu * vec4(-E, pr, pth, L);', '  vec4 pT = gNu * vec4(-E, pr, pth, L);\n        fNPrev = knF2(r, th, fPol);   /* before this update */');
must(T.indexOf('evpaDbg = vec4(fpE, gAn0, gAn, tTargetLast);') > 0, 'evpaDbg anchor missing');
T = T.replace('evpaDbg = vec4(fpE, gAn0, gAn, tTargetLast);', 'evpaDbg = vec4(fpE, gAn0, fNPrev, fPolNlast);');
/* view 32: the per-update change in the norm, on a scale that resolves 1e-4 */
const v32 = T.match(/  if \(uDebug == 32\) \{[\s\S]*?\n  \} else if/);
must(!!v32, 'view 32 not found');
const neu32 = [
  '  if (uDebug == 32) {',
  '    /* per-update change in the transported norm: (after - before) on a scale of 1e-3, */',
  '    /* centred so that zero reads 127.  Calibration constant 0.25 in red. */',
  '    float dN = evpaDbg.w - evpaDbg.z;',
  '    col = vec3(0.25, clamp(0.5 + dN * 1000.0, 0.0, 1.0), 0.75);',
  '  } else if',
].join('\n');
T = T.replace(v32[0], neu32);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');