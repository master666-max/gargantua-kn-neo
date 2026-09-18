const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
function replaceBranch(L, cond, body) {
  const start = L.findIndex(x => x.indexOf(cond) >= 0 && x.indexOf('{') >= 0);
  if (start < 0) { console.log('ABORT: branch ' + cond + ' not found'); process.exit(1); }
  let end = -1;
  for (let i = start + 1; i < L.length; i++) { if (L[i].indexOf('} else if (') >= 0) { end = i; break; } }
  if (end < 0) { console.log('ABORT: end of ' + cond + ' not found'); process.exit(1); }
  return L.slice(0, start).concat([body]).concat(L.slice(end));
}
/* view 25: carry the coordinates on the wire.  view 125 (the neutralised duplicate slot) carries
   the contraction.  Both derive from gl_FragCoord, so the same pixel is the same state in both. */
const b25 = [
  '  } else if (uDebug == 25) {',
  '    float rC  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;',
  '    float thC = 0.15 + 2.90 * gl_FragCoord.y / 720.0;',
  '    col = vec3(0.25, clamp((rC - 2.0) / 18.0, 0.0, 1.0), clamp((thC - 0.15) / 2.90, 0.0, 1.0));',
  '',
].join('\n');
let L2 = replaceBranch(L, 'uDebug == 25', b25);
console.log('ok: view 25 carries coordinates');
const b125 = [
  '  if (uDebug == 125) {',
  '    float rH  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;',
  '    float thH = 0.15 + 2.90 * gl_FragCoord.y / 720.0;',
  '    mat4 gH, gHr, gHt, gHu; knMetricDR(rH, thH, gH, gHr, gHt, gHu);',
  '    vec4 pH = gHu * vec4(-1.0, 0.3, 0.2, 3.0);',
  '    vec4 fH = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gH[2][2], 1e-12)), 1e-9), 0.0);',
  '    float qH = knTransportRhs(rH, thH, pH, fH).x;',
  '    col = vec3(0.25, clamp((log(max(abs(qH), 1e-12)) + 12.0) / 12.0, 0.0, 1.0), qH >= 0.0 ? 0.75 : 0.25);',
  '  } else if (uDebug == 25) {',
].join('\n');
const i125 = L2.findIndex(x => x.indexOf('uDebug == 125') >= 0);
if (i125 < 0) { console.log('ABORT: the 125 slot vanished'); process.exit(1); }
let e125 = -1;
for (let i = i125 + 1; i < L2.length; i++) { if (L2[i].indexOf('} else if (') >= 0) { e125 = i; break; } }
if (e125 < 0) { console.log('ABORT: end of 125 not found'); process.exit(1); }
L2 = L2.slice(0, i125).concat([b125]).concat(L2.slice(e125));
console.log('ok: view 125 carries the contraction');
const T = L2.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');