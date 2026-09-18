const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const a = "    col = vec3(0.5 + chi / 3.14159265, clamp(0.5 + evpaDbg.x * 1000.0, 0.0, 1.0), 0.5);";
if (T.split(a).length - 1 !== 1) { console.log('ABORT: view 27 line not found'); process.exit(1); }
T = T.split(a).join("    col = vec3(0.5 + chi / 3.14159265, clamp((log(max(abs(evpaDbg.x), 1e-8)) + 18.420681) / 18.420681, 0.0, 1.0), 0.5);   /* Gram residual, 1e-8..1, natural log */");
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');