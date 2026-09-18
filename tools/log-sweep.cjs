const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldC = '    col = vec3(clamp(gSu[1][1] / 2.0, 0.0, 1.0), clamp(gSu[3][3] / 25.0, 0.0, 1.0), clamp((gS[2][2] - 100.0) / 200.0, 0.0, 1.0));';
if (T.indexOf(oldC) < 0) { console.log('ABORT: the previous encoding line was not found'); process.exit(1); }
/* LOG magnitude in green so the quantisation is RELATIVE (one step ~ 4.7 %), sign in blue,
   and the calibration constant 0.25 in red.  Nothing here is chosen by eye from the values:
   the range 1e-12..1e0 covers the whole expected spread. */
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