const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const i = T.indexOf('col = vec3(clamp(abs(SigP) / 100.0, 0.0, 1.0),');
must(i > 0, 'old tail not found');
const e = T.indexOf(';', i) + 1;
const neu = [
'/* NUMERIC PROBE for the in-app assertion: the shader\'s OWN -Gamma p f for a fixed state,',
'   self-contained so it cannot depend on names that may have moved.  Red and blue carry the',
'   calibration constants 0.25 and 0.75 (must read back 64 and 191); green carries rhs.x on a',
'   scale of 500 per unit, putting the expected value near 195. */',
'mat4 gQ, gQr, gQt, gQu; knMetricDR(rp2, thp, gQ, gQr, gQt, gQu);',
'vec4 pCovQ = vec4(-1.0, 0.3, 0.2, 3.0);',
'vec4 pConQ = gQu * pCovQ;',
'vec4 fProbeQ = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gQ[2][2], 1e-12)), 1e-9), 0.0);',
'vec4 rhsQ = knTransportRhs(rp2, thp, pConQ, fProbeQ);',
'col = vec3(0.25, clamp(0.5 + rhsQ.x * 500.0, 0.0, 1.0), 0.75);'
].join('\n');
T = T.slice(0, i) + neu + T.slice(e);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');