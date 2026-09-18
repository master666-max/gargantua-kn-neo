const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const bad = 'transportInfo = vec4(knF2(r, th, fPol), fPolNlast, fPolP0, nUpd);';
if (T.indexOf(bad) < 0) { console.log('ABORT: misplaced line not found'); process.exit(1); }
T = T.replace(bad, 'transportInfo = vec4(0.0);');
/* now patch the LAST transportInfo assignment (the one at the end of knTrace) */
const k = T.lastIndexOf('transportInfo = vec4(');
const eol = T.indexOf(';', k);
const cur = T.slice(k, eol + 1);
console.log('final assignment was:', cur.slice(0, 90));
T = T.slice(0, k) + 'transportInfo = vec4(knF2(r, th, fPol), fPolNlast, fPolP0, nUpd);' + T.slice(eol + 1);
const b = bal(T); console.log('balance', JSON.stringify(b), 'fPolNlast occurrences', (T.match(/fPolNlast/g)||[]).length);
if (!b.ok) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');