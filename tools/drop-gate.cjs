const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const gate = 'if (uDebug == 23 || uDebug == 24) {';
const k = T.indexOf(gate);
must(k > 0, 'loop gate not found');
/* the transport now runs for EVERY ray: the fps cost is measured, not assumed (the 60 -> 22
   fps regression in round 9 came from the finite-difference Christoffels, which are gone). */
T = T.slice(0, k) + '{' + T.slice(k + gate.length);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE gate removed');