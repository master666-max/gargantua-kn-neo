const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const n = T.split("    col = vec3(0.25, clamp(gM[1][1] / 0.6, 0.0, 1.0), clamp(gM[3][3] / 10.0, 0.0, 1.0));").length - 1;
if (n !== 1) { console.log('ABORT: found ' + n); process.exit(1); }
T = T.split("    col = vec3(0.25, clamp(gM[1][1] / 0.6, 0.0, 1.0), clamp(gM[3][3] / 10.0, 0.0, 1.0));").join("    col = vec3(0.25, clamp(gM[1][1] / 2.0, 0.0, 1.0), clamp(gM[3][3] / 40.0, 0.0, 1.0));");
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
fs.writeFileSync(f, T); console.log('WROTE');