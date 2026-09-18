const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldL = '    col = vec3(0.25, clamp(0.5 + dN * 1000.0, 0.0, 1.0), 0.75);';
if (T.indexOf(oldL) < 0) { console.log('ABORT: view 32 scale line not found'); process.exit(1); }
/* the previous scale (+-5e-4) was saturated by the very quantity it measured: widen it to +-2e-3 */
T = T.replace(oldL, '    col = vec3(0.25, clamp(0.5 + dN * 250.0, 0.0, 1.0), 0.75);');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');