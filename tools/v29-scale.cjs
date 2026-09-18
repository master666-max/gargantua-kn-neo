const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
rep('col = vec3(0.25, clamp(0.5 + fX.y, 0.0, 1.0), clamp(0.5 + fX.z, 0.0, 1.0));', 'col = vec3(0.25, clamp(0.5 + fX.y * 3.0, 0.0, 1.0), clamp(0.5 + fX.z * 3.0, 0.0, 1.0));', 'finer scale');
const b = bal(T); must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');