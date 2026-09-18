const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const idx = [];
L.forEach((x, i) => { if (x.indexOf('tLen += (abs(drd0) > 1e-9)') >= 0) idx.push(i); });
if (idx.length !== 1) { console.log('ABORT: expected one interval-accumulation line, found ' + idx.length); process.exit(1); }
const i = idx[0];
console.log('BEFORE: ' + L[i].trim());
/* The affine advance is not something to estimate from the displacement: the geodesic's own RK4
   advances the parameter by exactly the accepted step h, and this block runs AFTER the advance, so h
   is the accepted value (the rejection loop has already settled it).  The displacement estimate was
   first order, which is precisely the order the settled measurements showed per update. */
L[i] = '      tLen += h;   /* the ACTUAL accepted affine step -- see 5d in README */';
console.log('AFTER : ' + L[i].trim());
const T = L.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
if (T.indexOf('abs(r - rPrev) / abs(drd0)') >= 0) { console.log('ABORT: the old estimate survives'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');