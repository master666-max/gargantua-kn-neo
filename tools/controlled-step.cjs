const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const oldBlock = [
  '      tLen += (abs(drd0) > 1e-9) ? (abs(r - rPrev) / abs(drd0)) : 0.0;',
  '      tSkip++;',
  '      if (tSkip >= uTransportEvery) {',
  '        mat4 gN, gNr, gNt, gNu; knMetricDR(r, th, gN, gNr, gNt, gNu);',
  '        fPol = knTransportStep(r, th, gNu * vec4(-E, pr, pth, L), fPol, tLen);',
  '        nUpd += 1.0; tSkip = 0; tLen = 0.0;',
  '      }'
].join('\n');
if (T.indexOf(oldBlock) < 0) { console.log('ABORT: block not found verbatim'); process.exit(1); }
const newBlock = [
  '      tLen += (abs(drd0) > 1e-9) ? (abs(r - rPrev) / abs(drd0)) : 0.0;',
  '      /* CONTROLLED STEP SIZE: transport over a FIXED dlambda, independent of how the',
  '         geodesic chooses to step.  uTransportEvery is reused as the target in units of',
  '         0.01 (5 -> 0.05).  Without this the transport step follows the geodesic and any',
  '         comparison across step scales silently compares different rays, as happened when',
  '         halving stepScale gave 48 updates instead of 157. */',
  '      float tTarget = float(uTransportEvery) * 0.01;',
  '      if (tLen >= tTarget) {',
  '        mat4 gN, gNr, gNt, gNu; knMetricDR(r, th, gN, gNr, gNt, gNu);',
  '        fPol = knTransportStep(r, th, gNu * vec4(-E, pr, pth, L), fPol, tLen);',
  '        nUpd += 1.0; tLen = 0.0;',
  '      }'
].join('\n');
T = T.replace(oldBlock, newBlock);
const b = bal(T); console.log('balance', JSON.stringify(b));
if (!b.ok) { console.log('ABORT'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE fixed-dlambda transport');