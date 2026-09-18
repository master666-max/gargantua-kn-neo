const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const a = '    col = vec3(0.25, clamp(0.5 + evpaDbg.x * 0.5, 0.0, 1.0), clamp(0.5 + evpaDbg.y * 0.5, 0.0, 1.0));   /* prInit, pthInit on +-1 */';
const b = '    col = vec3(0.25, clamp(0.5 + evpaDbg.x * 0.25, 0.0, 1.0), clamp(0.5 + evpaDbg.y * 0.25, 0.0, 1.0));   /* prInit, pthInit on +-2 */';
if (T.split(a).length - 1 !== 1) { console.log('ABORT: view 30 not found'); process.exit(1); }
T = T.split(a).join(b);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');