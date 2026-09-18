const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const old = [
'        vec4 eTh = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gT[2][2], 1e-12)), 1e-9), 0.0);',
'        fPol = eTh;   /* already metric-unit: an extra Euclidean normalize would give it norm Sigma */',
'        fPolN0 = knF2(r, th, fPol);',
'        fPolP0 = dot(fPol, gT * pNow);'
].join('\n');
must(T.indexOf(old) > 0, 'init block not found verbatim');
const neu = [
'        /* PHYSICAL initialisation: f from the epsilon construction with the toroidal field.',
'           Its two invariants are permanent in-app assertions (|f|^2 = 1, f.p = 0), each',
'           checked against the CPU module in the page, so this wiring is verified, not',
'           assumed.  The previous version initialised the geometric probe e_theta/sqrt(g_thth),',
'           which tests the connection but is not a polarisation. */',
'        float fpInit;',
'        fPol = knPolToroidal(vec4(-E, pr, pth, L), r, th, fpInit);',
'        fPolN0 = knF2(r, th, fPol);',
'        fPolP0 = fpInit;   /* f.p is the plain contraction: f is built from the covariant p */'
].join('\n');
T = T.replace(old, neu);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
must(T.indexOf('knPolToroidal(vec4(-E, pr, pth, L), r, th, fpInit)') > 0, 'new init missing');
fs.writeFileSync(f, T); console.log('WROTE');