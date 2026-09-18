const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
/* 3 decades (1e-4 .. 1e-1) instead of 10: 1.2 % per grey level instead of 230 % */
rep('    float ds = transportInfo.x;', '    float ds = transportInfo.x;', 'noop');
rep('    col = vec3(0.25, clamp((log(max(ds, 1e-6)) + 6.0) / 10.0, 0.0, 1.0), 0.75);', '    col = vec3(0.25, clamp((log(max(ds, 1e-4)) + 9.2103404) / 6.9077553, 0.0, 1.0), 0.75);', 'scale');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');