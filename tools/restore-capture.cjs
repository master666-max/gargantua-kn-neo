const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
/* THE CONTROL-TEST CONSTANT WAS NEVER REVERTED.  fPolNlast has read the literal 1.0 since the
   'is the wiring live?' experiment, so view 23's 'zero violation' was true by construction and
   every 'f is preserved' claim rested on it.  Restore the real capture. */
rep('fPolNlast = 1.0;   /* same point as the transport, unlike the final-position read */', 'fPolNlast = knF2(r, th, fPol);   /* the real norm AT the transport point */', 'restore capture');
/* also revert the path test: gA must go back to its own eps-image initialisation */
rep('        gA = fPol;   /* PATH TEST: identical to f */', '        gA = knPolFromB(pCovI, gT * eA, r, th);', 'revert path test');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');