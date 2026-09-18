const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldL = "col = vec3(clamp((log(max(abs(transportInfo.y - 1.0), 1e-6)) + 13.81551) / 13.81551, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* LOG drift, 1e-6..1e0 */";
const newL = "col = vec3(clamp(transportInfo.y / 4.0, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* fPolNlast itself, 0..4 */";
if (T.split(oldL).length - 1 !== 1) { console.log('ABORT: old line not unique'); process.exit(1); }
T = T.split(oldL).join(newL);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');