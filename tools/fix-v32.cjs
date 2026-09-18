const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const i32 = L.findIndex(x => x.indexOf('uDebug == 32') >= 0 && x.indexOf('{') >= 0);
if (i32 < 0) { console.log('ABORT: view 32 not found'); process.exit(1); }
let e32 = -1;
for (let i = i32 + 1; i < L.length; i++) { if (L[i].indexOf('} else if (') >= 0) { e32 = i; break; } if (/^  \}\s*$/.test(L[i])) { e32 = i + 1; break; } }
if (e32 < 0) { console.log('ABORT: view 32 end not found'); process.exit(1); }
const orig = L[i32];
const cut = orig.indexOf('uDebug == 32');
const prefix = orig.slice(0, cut);
console.log('prefix kept: ' + JSON.stringify(prefix));
L.forEach((x,i) => { if (i>=i32 && i<e32) console.log('BEFORE ' + (i+1) + ': ' + x.trim()); });
const body = [
  prefix + 'uDebug == 32) {',
  '    float n0 = evpaDbg.x;   /* the norm of fPol immediately after the epsilon initialisation */',
  '    col = vec3(0.25, clamp(0.5 + (n0 - 1.0) * 20.0, 0.0, 1.0), 0.75);',
  '',
].join('\n');
const L2 = L.slice(0, i32).concat([body]).concat(L.slice(e32));
const T = L2.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');