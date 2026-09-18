const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldC = '    col = vec3(0.25, mag, q >= 0.0 ? 0.75 : 0.25);';
if (T.indexOf(oldC) < 0) { console.log('ABORT: log encoding line not found'); process.exit(1); }
/* diagnostic: put rG and thG themselves on the wire, so the grid coordinates the shader uses can
   be compared with the ones assumed in the page.  rG in 2..20 -> (rG-2)/18; thG in 0.15..3.05 -> (thG-0.15)/2.9 */
const newC = [
  '    col = vec3(0.25, clamp((rG - 2.0) / 18.0, 0.0, 1.0), clamp((thG - 0.15) / 2.90, 0.0, 1.0));'
].join('\n');
T = T.replace(oldC, newC);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');