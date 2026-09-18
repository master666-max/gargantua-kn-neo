const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q, o, c, p, q}; };
const A = 'uDebug == 123 || uDebug == 24';
const B = 'uDebug == 23 || uDebug == 24';
const C = 'uDebug == 123';
const D = 'uDebug == 23';
let n1 = T.split(A).length - 1;
T = T.split(A).join(B);
let n2 = T.split(C).length - 1;
T = T.split(C).join(D);
const b = bal(T);
console.log('restored gate sites:', n1, ' other sites:', n2, ' balance:', JSON.stringify(b));
if (!b.ok) { console.log('ABORT'); process.exit(1); }
fs.writeFileSync(f, T);
console.log('WROTE');