const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
/* 1. view 25: evaluate at a NON-degenerate point (6.0, 1.2) instead of (rp2, thp) = (6, pi/2) */
const a1 = 'mat4 gQ, gQr, gQt, gQu; knMetricDR(rp2, thp, gQ, gQr, gQt, gQu);';
must(T.indexOf(a1) > 0, 'view25 metric line not found');
T = T.replace(a1, 'mat4 gQ, gQr, gQt, gQu; knMetricDR(6.0, 1.2, gQ, gQr, gQt, gQu);');
const a2 = 'vec4 rhsQ = knTransportRhs(rp2, thp, pConQ, fProbeQ);';
must(T.indexOf(a2) > 0, 'view25 rhs line not found');
T = T.replace(a2, 'vec4 rhsQ = knTransportRhs(6.0, 1.2, pConQ, fProbeQ);');
/* 2. view 23: restore the invariant readout that my probe overwrote */
const a3 = 'vec4 rhsQ = knTransportRhs(6.0, 1.2, pConQ, fProbeQ);\ncol = vec3(0.25, clamp(0.5 + rhsQ.x * 500.0, 0.0, 1.0), 0.75);';
const i3 = T.lastIndexOf(a3);
must(i3 > 0, 'view23 probe block not found');
T = T.slice(0, i3) + 'col = vec3(clamp(abs(transportInfo.y - 1.0) / 0.05, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);' + T.slice(i3 + a3.length);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
must((T.match(/col = vec3\(0\.25, clamp\(0\.5 \+ rhsQ/g)||[]).length === 1, 'exactly one RHS probe expected');
fs.writeFileSync(f, T); console.log('WROTE');