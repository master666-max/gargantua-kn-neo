const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const anchor = 'col = vec3(clamp(abs(transportInfo.y - transportInfo.z) * 1000.0, 0.0, 1.0));';
must(T.indexOf(anchor) > 0, 'view-24 readout not found');
const neu = [
  '/* NUMERIC PROBE (view 24): the shader\'s OWN -Gamma p f at a fixed, NON-degenerate state,',
  '   with the calibration constants 0.25 and 0.75 in red and blue so the readback can be',
  '   certified before any comparison is believed. */',
  'mat4 gV, gVr, gVt, gVu; knMetricDR(6.0, 1.2, gV, gVr, gVt, gVu);',
  'vec4 pCovV = vec4(-1.0, 0.3, 0.2, 3.0);',
  'vec4 fProbeV = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gV[2][2], 1e-12)), 1e-9), 0.0);',
  'vec4 rhsV = knTransportRhs(6.0, 1.2, gVu * pCovV, fProbeV);',
  'col = vec3(0.25, clamp(0.5 + rhsV.x * 500.0, 0.0, 1.0), 0.75);'
].join('\n');
T = T.replace(anchor, neu);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');