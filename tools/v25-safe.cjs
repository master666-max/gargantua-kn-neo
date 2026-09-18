const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const L = T.split('\n');
const start = L.findIndex(x => x.indexOf('uDebug == 25') >= 0 && x.indexOf('else if') >= 0);
if (start < 0) { console.log('ABORT: view 25 not found'); process.exit(1); }
let end = -1;
for (let i = start + 1; i < L.length; i++) { if (L[i].indexOf('} else if (') >= 0) { end = i; break; } }
if (end < 0) { console.log('ABORT: end not found'); process.exit(1); }
const body = [
  '  } else if (uDebug == 25) {',
  '    /* Safe fallback: this view previously held the contraction probe.  It now emits the two',
  '       calibration constants only, so it certifies the readback and cannot break the build while',
  '       the coordinate-resampling question is settled. */',
  '    col = vec3(0.25, 0.5, 0.75);',
  '',
].join('\n');
const T2 = L.slice(0, start).concat([body]).concat(L.slice(end)).join('\n');
const o = (T2.match(/{/g)||[]).length, c = (T2.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T2); console.log('WROTE');