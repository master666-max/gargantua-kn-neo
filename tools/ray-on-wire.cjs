const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
/* carry the ray's own initial data so the CPU can trace the SAME ray */
rep('evpaDbg = vec4(evpaResid, pP0, fPolNlast, nUpd);   /* x = the Gram reconstruction residual */', 'evpaDbg = vec4(r0, th0, pr0, pth0);   /* the ray itself, so the CPU can reproduce it */', 'payload');
/* view 30 shows r0 and th0 and pr0 and pth0 across two views; use view 30 for (r0, th0) and view 32 for (pr0, pth0) */
const L2 = T.split('\n');
const i30 = L2.findIndex(x => x.indexOf('uDebug == 30') >= 0 && x.indexOf('{') >= 0);
if (i30 < 0) { console.log('ABORT: view 30 not found'); process.exit(1); }
let e30 = -1;
for (let q = i30 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e30 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e30 = q + 1; break; } }
const pre30 = L2[i30].slice(0, L2[i30].indexOf('uDebug == 30'));
const b30 = [ pre30 + 'uDebug == 30) {', '    col = vec3(0.25, clamp(evpaDbg.x / 4000.0, 0.0, 1.0), clamp(evpaDbg.y / 3.2, 0.0, 1.0));   /* r0 (0..4000), th0 (0..3.2) */', '' ].join('\n');
T = L2.slice(0, i30).concat([b30]).concat(L2.slice(e30)).join('\n');
console.log('ok view 30 = (r0, th0)');
const L3 = T.split('\n');
const i32 = L3.findIndex(x => x.indexOf('uDebug == 32') >= 0 && x.indexOf('{') >= 0);
if (i32 < 0) { console.log('ABORT: view 32 not found'); process.exit(1); }
let e32 = -1;
for (let q = i32 + 1; q < L3.length; q++) { if (L3[q].indexOf('} else if (') >= 0) { e32 = q; break; } if (/^  \}\s*$/.test(L3[q])) { e32 = q + 1; break; } }
const pre32 = L3[i32].slice(0, L3[i32].indexOf('uDebug == 32'));
const b32 = [ pre32 + 'uDebug == 32) {', '    col = vec3(0.25, clamp(0.5 + evpaDbg.z, 0.0, 1.0), clamp(0.5 + evpaDbg.w, 0.0, 1.0));   /* pr0, pth0 on +-0.5 */', '' ].join('\n');
T = L3.slice(0, i32).concat([b32]).concat(L3.slice(e32)).join('\n');
console.log('ok view 32 = (pr0, pth0)');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');