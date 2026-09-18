const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
/* f.p inside knPolToroidal was dot(f, g*pCov): one metric too many, the SAME mistake I fixed in the
   view-26 probe and forgot to fix in the function.  The correct f.p = f^mu p_mu is the plain contraction. */
const bad = '  fp = dot(f, g * pCov);';
must(T.indexOf(bad) > 0, 'the bad out-param line was not found');
T = T.replace(bad, '  fp = dot(f, pCov);   /* f^mu p_mu: plain contraction, no metric matrix */');
const b = bal(T); must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');