const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const start = L.findIndex(x => /^\s*if \(uDebug == 25\) \{/.test(x));
if (start < 0) { console.log('ABORT: view 25 line not found'); process.exit(1); }
let end = -1;
for (let i = start + 1; i < L.length; i++) { if (/^\s*\} else if \(/.test(L[i])) { end = i; break; } }
if (end < 0) { console.log('ABORT: end of view 25 not found'); process.exit(1); }
console.log('replacing lines', start + 1, 'to', end, '(exclusive)', '::', L[start].trim());
const body = [
  '  if (uDebug == 25) {',
  '    /* SWEEP: each pixel is a different (r, theta) with the SAME p, so the shader-vs-CPU',
  '       comparison runs over a grid instead of at the single state it was tuned on.',
  '       Red/green/blue carry rhs.x, rhs.y, rhs.z at 500 units per unit, centred on 0.5. */',
  '    float rG  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;',
  '    float thG = 0.15 + 2.90 * gl_FragCoord.y / 720.0;',
  '    mat4 gS, gSr, gSt, gSu; knMetricDR(rG, thG, gS, gSr, gSt, gSu);',
  '    vec4 pCovS = vec4(-1.0, 0.3, 0.2, 3.0);',
  '    vec4 fProbeS = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gS[2][2], 1e-12)), 1e-9), 0.0);',
  '    vec4 rhsS = knTransportRhs(rG, thG, gSu * pCovS, fProbeS);',
  '    col = vec3(clamp(0.5 + rhsS.x * 500.0, 0.0, 1.0), clamp(0.5 + rhsS.y * 500.0, 0.0, 1.0), clamp(0.5 + rhsS.z * 500.0, 0.0, 1.0));',
  '',
].join('\n');
const out = L.slice(0, start).concat([body]).concat(L.slice(end));
const T = out.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');