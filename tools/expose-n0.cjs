const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
/* expose fPolN0 (the norm right after the CURRENT initialisation), which has never been measured */
rep('evpaDbg = vec4(fpE, gAn0, fNPrev, fPolNlast);', 'evpaDbg = vec4(fPolN0, gAn0, fNPrev, fPolNlast);', 'payload -> fPolN0');
const old32 = '    float dN = evpaDbg.w - evpaDbg.z;   /* what ONE transport update did to the norm */';
rep(old32, '    float n0 = evpaDbg.x;   /* the norm of fPol immediately after its own initialisation */', 'view 32 body');
const oldCol = '    col = vec3(0.25, clamp(0.5 + dN * 250.0, 0.0, 1.0), 0.75);';
if (T.split(oldCol).length - 1 !== 1) { console.log('WARN: old col line not found (may already be the log version)'); }
T = T.split(oldCol).join('    col = vec3(0.25, clamp(0.5 + (n0 - 1.0) * 20.0, 0.0, 1.0), 0.75);');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');