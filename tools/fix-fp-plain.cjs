const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const bad = 'vec4 pUpW = gW * pCovW;';
must(T.indexOf(bad) > 0, 'the pUpW line is not there');
/* f.p = f^mu p_mu is the PLAIN contraction against the covariant p -- no metric matrix at all.
   The first version applied G once and the second applied it twice, which is where the 5.5e3
   came from: my probe was wrong, not the epsilon construction. */
T = T.replace(bad + '\n    float fpTrue = dot(fW, gW * pUpW);', 'float fpTrue = dot(fW, pCovW);   /* f^mu p_mu: plain contraction, no metric */');
must(T.indexOf('dot(fW, pCovW)') > 0, 'the plain contraction was not installed');
must(T.indexOf('gW * pUpW') < 0, 'the old expression survives');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');