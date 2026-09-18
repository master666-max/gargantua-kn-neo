const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const i28 = L.findIndex(x => x.indexOf('uDebug == 28') >= 0 && x.indexOf('{') >= 0);
if (i28 < 0) { console.log('ABORT: view 28 not found'); process.exit(1); }
let e28 = -1;
for (let i = i28 + 1; i < L.length; i++) { if (L[i].indexOf('} else if (') >= 0) { e28 = i; break; } if (/^  \}\s*$/.test(L[i])) { e28 = i + 1; break; } }
if (e28 < 0) { console.log('ABORT: view 28 end not found'); process.exit(1); }
const orig = L[i28]; const prefix = orig.slice(0, orig.indexOf('uDebug == 28'));
L.forEach((x,i) => { if (i>=i28 && i<e28) console.log('BEFORE ' + (i+1) + ': ' + x.trim().slice(0,90)); });
const body = [ prefix + 'uDebug == 28) {',
  '    /* THE METRIC ITSELF, which knF2 uses and which has never been checked directly. */',
  '    mat4 gM, gMr, gMt, gMu; knMetricDR(6.0, 1.2, gM, gMr, gMt, gMu);',
  '    col = vec3(0.25, clamp(gM[1][1] / 0.6, 0.0, 1.0), clamp(gM[3][3] / 10.0, 0.0, 1.0));',
  '',
].join('\n');
const T = L.slice(0, i28).concat([body]).concat(L.slice(e28)).join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');