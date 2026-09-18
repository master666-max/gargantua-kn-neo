const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const must = (c, m) => { if (!c) { console.log('ABORT: ' + m); process.exit(1); } };
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
/* The vector is transported with the MIDPOINT geometry but its invariant was read with the geometry
   of the interval's END.  Metric compatibility is exact (checked on the CPU at six states, 0.00e+0 %),
   so the transport cannot produce a step-independent norm error -- which leaves the mismatch between
   where the vector was advanced and where it was measured.  Measure it at the midpoint. */
must(T.indexOf('fPolNlast = knF2(r, th, fPol);') > 0, 'capture anchor');
T = T.replace('fPolNlast = knF2(r, th, fPol);', 'fPolNlast = knF2(rMid, thMid, fPol);   /* same geometry the last transport used */');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');