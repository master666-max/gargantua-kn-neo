const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('    col = vec3(0.25, clamp(0.5 + evpaDbg.x * 2.0, 0.0, 1.0), clamp(0.5 + evpaDbg.y * 2.0, 0.0, 1.0));   /* prInit, pthInit on +-0.25 */', '    col = vec3(0.25, clamp(0.5 + evpaDbg.x * 0.5, 0.0, 1.0), clamp(0.5 + evpaDbg.y * 0.5, 0.0, 1.0));   /* prInit, pthInit on +-1 */', 'view 30 scale');
rep('    col = vec3(0.25, clamp(evpaDbg.z / 4.0, 0.0, 1.0), clamp(evpaDbg.w / 12.0, 0.0, 1.0));   /* E (0..4), L (0..12) */', '    col = vec3(0.25, clamp(evpaDbg.z / 4.0, 0.0, 1.0), clamp(0.5 + evpaDbg.w / 24.0, 0.0, 1.0));   /* E (0..4), L (-12..+12) */', 'view 32 scale');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');