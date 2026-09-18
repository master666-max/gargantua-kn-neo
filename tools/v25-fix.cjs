const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
/* 1. restore the view-23 readout that I accidentally overwrote */
const probe23 = 'mat4 gQ, gQr, gQt, gQu; knMetricDR(6.0, 1.2, gQ, gQr, gQt, gQu);';
const i23 = T.indexOf(probe23);
if (i23 > 0) {
  const e23 = T.indexOf(';', T.indexOf('col = vec3(0.25', i23)) + 1;
  T = T.slice(0, i23) + 'col = vec3(clamp(abs(transportInfo.y - 1.0) / 0.05, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);' + T.slice(e23);
  console.log('restored the view-23 readout');
} else { console.log('no stray probe found (nothing to restore)'); }
/* 2. put the RHS probe where the Sigma/Delta/M probe was, no rp3 dependency */
const sig = 'col = vec3(clamp(abs(SigP) / 100.0, 0.0, 1.0),';
const iSig = T.indexOf(sig);
must(iSig > 0, 'Sigma probe not found');
const eSig = T.indexOf(';', iSig) + 1;
T = T.slice(0, iSig) + [
  'mat4 gR, gRr, gRt, gRu; knMetricDR(6.0, 1.2, gR, gRr, gRt, gRu);',
  'vec4 pCovR = vec4(-1.0, 0.3, 0.2, 3.0);',
  'vec4 pConR = gRu * pCovR;',
  'vec4 fProbeR = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gR[2][2], 1e-12)), 1e-9), 0.0);',
  'vec4 rhsR = knTransportRhs(6.0, 1.2, pConR, fProbeR);',
  'col = vec3(0.25, clamp(0.5 + rhsR.x * 500.0, 0.0, 1.0), 0.75);'
].join('\n') + T.slice(eSig);
console.log('installed the RHS probe at the Sigma probe site');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');