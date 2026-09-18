const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const old = [
'        fPol = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gT[2][2], 1e-12)), 1e-9), 0.0);',
'        fPolN0 = knF2(r, th, fPol);',
'        fPolP0 = dot(fPol, gT * pNow);'
].join('\n');
must(T.indexOf(old) > 0, 'the loop init block was not found verbatim');
const neu = [
'        /* PHYSICAL initialisation: f from the epsilon construction with the toroidal field,',
'           whose invariants are asserted in-app (|f|^2 = 1 and f.p = 0, both verified',
'           against the CPU module in the page before this was wired in).  The earlier',
'           initialisation was the geometric probe e_theta/sqrt(g_thth): a valid test of the',
'           connection, but not a polarisation. */',
'        float fpInit;',
'        fPol = knPolToroidal(vec4(-E, pr, pth, L), r, th, fpInit);',
'        fPolN0 = knF2(r, th, fPol);',
'        fPolP0 = fpInit;   /* f.p: the plain contraction, since f is built from the covariant p */'
].join('\n');
T = T.replace(old, neu);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
must(T.indexOf('knPolToroidal(vec4(-E, pr, pth, L), r, th, fpInit)') > 0, 'the new init was not installed');
fs.writeFileSync(f, T); console.log('WROTE');