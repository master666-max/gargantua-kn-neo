const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
function replaceBranch(L, cond) {
  const start = L.findIndex(x => x.indexOf(cond) >= 0 && x.indexOf('{') >= 0);
  if (start < 0) return null;
  let end = -1;
  for (let i = start + 1; i < L.length; i++) {
    if (L[i].indexOf('} else if (') >= 0) { end = i; break; }
    if (/^  \}\s*$/.test(L[i])) { end = i + 1; break; }
  }
  if (end < 0) return null;
  return { start, end };
}
const a = replaceBranch(L, 'uDebug == 25');
if (!a) { console.log('ABORT: view 25 not found'); process.exit(1); }
const b25 = [
  '  } else if (uDebug == 25) {',
  '    float rC  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;',
  '    float thC = 0.15 + 2.90 * gl_FragCoord.y / 720.0;',
  '    col = vec3(0.25, clamp((rC - 2.0) / 18.0, 0.0, 1.0), clamp((thC - 0.15) / 2.90, 0.0, 1.0));',
  '',
].join('\n');
let L2 = L.slice(0, a.start).concat([b25]).concat(L.slice(a.end));
console.log('ok: view 25 carries coordinates (replaced', a.start + 1, '..', a.end, ')');
const c = replaceBranch(L2, 'uDebug == 125');
if (!c) { console.log('ABORT: the 125 slot not found'); process.exit(1); }
const b125 = [
  '  if (uDebug == 125) {',
  '    float rH  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;',
  '    float thH = 0.15 + 2.90 * gl_FragCoord.y / 720.0;',
  '    mat4 gH, gHr, gHt, gHu; knMetricDR(rH, thH, gH, gHr, gHt, gHu);',
  '    vec4 pH = gHu * vec4(-1.0, 0.3, 0.2, 3.0);',
  '    vec4 fH = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gH[2][2], 1e-12)), 1e-9), 0.0);',
  '    float qH = knTransportRhs(rH, thH, pH, fH).x;',
  '    col = vec3(0.25, clamp((log(max(abs(qH), 1e-12)) + 12.0) / 12.0, 0.0, 1.0), qH >= 0.0 ? 0.75 : 0.25);',
  '  }',
].join('\n');
L2 = L2.slice(0, c.start).concat([b125]).concat(L2.slice(c.end));
console.log('ok: view 125 carries the contraction (replaced', c.start + 1, '..', c.end, ')');
const T = L2.join('\n');
const o = (T.match(/{/g)||[]).length, cc = (T.match(/}/g)||[]).length;
console.log('balance', o === cc, o, cc);
if (o !== cc) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');