const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
/* PATH TEST: give gA exactly f's initial value.  If it still drifts, the defect is in the code
   path (the interaction of three transports); if it stops drifting, the defect is the output of
   knPolFromB.  Decisive and cheap.  Reverted after the measurement. */
rep('        gA = knPolFromB(pCovI, gT * eA, r, th);', '        gA = fPol;   /* PATH TEST: identical to f */\n        /* gA = knPolFromB(pCovI, gT * eA, r, th); */', 'path test');
const b = bal(T); must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');