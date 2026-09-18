const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const re = /const int NSUB = \d+;/;
if (!re.test(T)) { console.log('ABORT: NSUB line not found'); process.exit(1); }
console.log('was: ' + (T.match(re) || [''])[0]);
T = T.replace(re, 'const int NSUB = 1;');
console.log('now: ' + (T.match(re) || [''])[0]);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');