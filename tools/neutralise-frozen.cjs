const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const a = 'float hSub = h;   /* THIS step\'s own accepted length, not an accumulated interval */';
const b = 'float hSub = 0.0;   /* the transport is now COUPLED into the geodesic RK4 (6h); this frozen block must not advance it. Captures below still run. */';
const n = T.split(a).length - 1;
if (n !== 1) { console.log('ABORT: anchor found ' + n); process.exit(1); }
T = T.split(a).join(b);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');