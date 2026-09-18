const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const real = 'fPolNlast = knF2(r, th, fPol);';
const fake = 'fPolNlast = 1.0;';
if (T.indexOf(real) < 0) { console.log('ABORT: capture line not found'); process.exit(1); }
T = T.replace(real, fake);
if (!bal(T).ok) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T + '\n/* control test active */');
console.log('SET FAKE');