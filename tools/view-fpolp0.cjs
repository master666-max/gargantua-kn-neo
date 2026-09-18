const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const i30 = L.findIndex(x => x.indexOf('uDebug == 30') >= 0 && x.indexOf('{') >= 0);
if (i30 < 0) { console.log('ABORT: view 30 not found'); process.exit(1); }
let e30 = -1;
for (let i = i30 + 1; i < L.length; i++) { if (L[i].indexOf('} else if (') >= 0) { e30 = i; break; } if (/^  \}\s*$/.test(L[i])) { e30 = i + 1; break; } }
if (e30 < 0) { console.log('ABORT: view 30 end not found'); process.exit(1); }
const orig = L[i30]; const prefix = orig.slice(0, orig.indexOf('uDebug == 30'));
L.forEach((x,i) => { if (i>=i30 && i<e30) console.log('BEFORE ' + (i+1) + ': ' + x.trim()); });
const body = [ prefix + 'uDebug == 30) {',
  '    /* f.p at the FIRST state of the actual ray -- the initialisation the loop really uses. */',
  '    float fp = transportInfo.z;',
  '    col = vec3(0.25, clamp(0.5 + fp * 10.0, 0.0, 1.0), 0.75);',
  '',
].join('\n');
const T = L.slice(0, i30).concat([body]).concat(L.slice(e30)).join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');