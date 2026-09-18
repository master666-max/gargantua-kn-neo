const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const oldLine = 'col = vec3(clamp(abs(SigP) / 100.0, 0.0, 1.0),';
const iOld = T.indexOf(oldLine);
must(iOld > 0, 'old final assignment not found');
const endOld = T.indexOf(';', iOld) + 1;
console.log('replacing tail:', T.slice(iOld, endOld).replace(/\n/g, ' ').slice(0, 120));
const neu = [
  '/* NUMERIC PROBE for the in-app assertion: the shader\'s own -Gamma p f for a fixed state.',
  '   Red and blue carry the calibration constants 0.25 and 0.75, so the readback can be',
  '   certified before any comparison; green carries rhsProbe.x on a scale of 500 per unit,',
  '   which puts the expected value near 195 of 255. */',
  'vec4 pCov = vec4(-1.0, 0.3, 0.2, 3.0);',
  'vec4 pCon = gu3 * pCov;',
  'vec4 fProbe = vec4(0.0, 0.0, 1.0 / max(sqrt(max(g3[2][2], 1e-12)), 1e-9), 0.0);',
  'vec4 rhsProbe = knTransportRhs(rp3, thp3, pCon, fProbe);',
  'col = vec3(0.25, clamp(0.5 + rhsProbe.x * 500.0, 0.0, 1.0), 0.75);'
].join('\n');
T = T.slice(0, iOld) + neu + T.slice(endOld);
must(T.indexOf('float rp3 = 6.0') > 0, 'rp3 not declared in this branch');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');