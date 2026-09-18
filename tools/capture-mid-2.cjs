const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const idx = [];
L.forEach((x, i) => { if (x.indexOf('fPolNlast = ') >= 0 && x.indexOf('float fPolNlast') < 0) idx.push(i); });
console.log('assignment lines found:', idx.map(i => i + 1).join(', '));
if (idx.length !== 1) { console.log('ABORT: expected exactly one assignment, found ' + idx.length); process.exit(1); }
const i = idx[0];
console.log('BEFORE: ' + L[i]);
L[i] = '          fPolNlast = knF2(rMid, thMid, fPol);   /* the SAME geometry the last transport used */';
console.log('AFTER : ' + L[i]);
const T = L.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');