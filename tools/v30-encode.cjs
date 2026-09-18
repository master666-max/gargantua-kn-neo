const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
const oldL = "    col = vec3(0.25, clamp(0.5 + (evpaDbg.z - 1.0) * 2.0, 0.0, 1.0), clamp(0.5 + (evpaDbg.w - 1.0) * 2.0, 0.0, 1.0));";
const newL = "    col = vec3(0.25, clamp(0.5 + (evpaDbg.y - 1.0) * 20.0, 0.0, 1.0), clamp(0.5 + (evpaDbg.z - 1.0) * 20.0, 0.0, 1.0));";
const n = T.split(oldL).length - 1;
if (n !== 1) { console.log('ABORT: found ' + n); process.exit(1); }
T = T.split(oldL).join(newL);
const o2 = (T.match(/{/g)||[]).length, c2 = (T.match(/}/g)||[]).length;
console.log('balance', o2 === c2);
if (o2 !== c2) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');