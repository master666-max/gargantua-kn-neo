const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldL = '    col = vec3(0.25, clamp(0.5 + dN * 250.0, 0.0, 1.0), 0.75);';
if (T.indexOf(oldL) < 0) { console.log('ABORT: view 32 line not found'); process.exit(1); }
/* LOG magnitude in green (GLSL log() is NATURAL log -- decode with exp, not log10, which cost three
   rounds earlier), sign in blue, calibration constant 0.25 in red.  Range 1e-12..1e0. */
const newL = [
  '    float a0 = abs(dN);',
  '    col = vec3(0.25, clamp((log(max(a0, 1e-12)) + 12.0) / 12.0, 0.0, 1.0), dN >= 0.0 ? 0.75 : 0.25);'
].join('\n');
T = T.replace(oldL, newL);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');