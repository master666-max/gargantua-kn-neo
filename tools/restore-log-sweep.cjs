const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldC = '    col = vec3(0.25, clamp((rG - 2.0) / 18.0, 0.0, 1.0), clamp((thG - 0.15) / 2.90, 0.0, 1.0));';
if (T.indexOf(oldC) < 0) { console.log('ABORT: coord line not found'); process.exit(1); }
const newC = [
  '    float q = rhsS.x;',
  '    float mag = clamp((log(max(abs(q), 1e-12)) + 12.0) / 12.0, 0.0, 1.0);',
  '    col = vec3(0.25, mag, q >= 0.0 ? 0.75 : 0.25);'
].join('\n');
T = T.replace(oldC, newC);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');