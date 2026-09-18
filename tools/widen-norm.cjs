const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldL = "col = vec3(clamp(transportInfo.y / 4.0, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* fPolNlast itself, 0..4 */";
if (T.split(oldL).length - 1 !== 1) { console.log('ABORT: old line not found'); process.exit(1); }
T = T.split(oldL).join("col = vec3(clamp(transportInfo.y / 64.0, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* fPolNlast itself, 0..64 */");
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
fs.writeFileSync(f, T); console.log('WROTE');