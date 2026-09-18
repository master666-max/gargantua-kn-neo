const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const a = "col = vec3(clamp(transportInfo.y / 64.0, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* fPolNlast itself, 0..64 */";
const b = "col = vec3(clamp(0.5 + (transportInfo.y - 1.0) * 50.0, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* |f|^2 - 1 on +-0.01, centre 127 */";
if (T.split(a).length - 1 !== 1) { console.log('ABORT: not found'); process.exit(1); }
T = T.split(a).join(b);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');