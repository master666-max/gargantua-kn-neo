const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const b0 = T.indexOf('if (uDebug == 25) {');
must(b0 > 0, 'branch start not found');
const b1 = T.indexOf('} else if (uDebug == 24) {', b0);
must(b1 > b0, 'branch end not found');
const seg = T.slice(b0, b1);
const cols = [...seg.matchAll(/col = [^;]*;/g)];
console.log('col assignments inside the view-25 branch:', cols.length);
must(cols.length > 0, 'no col assignment in branch');
const last = cols[cols.length - 1];
const absStart = b0 + last.index;
console.log('replacing the LAST one at char', absStart, ':', last[0].replace(/\n/g,' ').slice(0, 90));
const neu = [
'mat4 gQ, gQr, gQt, gQu; knMetricDR(6.0, 1.2, gQ, gQr, gQt, gQu);',
'vec4 pCovQ = vec4(-1.0, 0.3, 0.2, 3.0);',
'vec4 pConQ = gQu * pCovQ;',
'vec4 fProbeQ = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gQ[2][2], 1e-12)), 1e-9), 0.0);',
'vec4 rhsQ = knTransportRhs(6.0, 1.2, pConQ, fProbeQ);',
'col = vec3(0.25, clamp(0.5 + rhsQ.x * 500.0, 0.0, 1.0), 0.75);'
].join('\n');
T = T.slice(0, absStart) + neu + T.slice(absStart + last[0].length);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');