const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('  if (!knZamoInit(r0, th0, n, pr, pth, E, L)){\n    return;\n  }', '  if (!knZamoInit(r0, th0, n, pr, pth, E, L)){\n    return;\n  }\n  float prInit = pr, pthInit = pth;   /* the ray\'s initial momenta, for the CPU cross-check */', 'capture init');
rep('evpaDbg = vec4(r0, th0, pr0, pth0);   /* the ray itself, so the CPU can reproduce it */', 'evpaDbg = vec4(prInit, pthInit, E, L);   /* the ray\'s own data, so the CPU can reproduce it */', 'payload');
const L2 = T.split('\n');
const i30 = L2.findIndex(x => x.indexOf('uDebug == 30') >= 0 && x.indexOf('{') >= 0);
let e30 = -1;
for (let q = i30 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e30 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e30 = q + 1; break; } }
const pre30 = L2[i30].slice(0, L2[i30].indexOf('uDebug == 30'));
const b30 = [ pre30 + 'uDebug == 30) {', '    col = vec3(0.25, clamp(0.5 + evpaDbg.x * 2.0, 0.0, 1.0), clamp(0.5 + evpaDbg.y * 2.0, 0.0, 1.0));   /* prInit, pthInit on +-0.25 */', '' ].join('\n');
T = L2.slice(0, i30).concat([b30]).concat(L2.slice(e30)).join('\n');
console.log('ok view 30 = prInit, pthInit');
const L3 = T.split('\n');
const i32 = L3.findIndex(x => x.indexOf('uDebug == 32') >= 0 && x.indexOf('{') >= 0);
let e32 = -1;
for (let q = i32 + 1; q < L3.length; q++) { if (L3[q].indexOf('} else if (') >= 0) { e32 = q; break; } if (/^  \}\s*$/.test(L3[q])) { e32 = q + 1; break; } }
const pre32 = L3[i32].slice(0, L3[i32].indexOf('uDebug == 32'));
const b32 = [ pre32 + 'uDebug == 32) {', '    col = vec3(0.25, clamp(evpaDbg.z / 4.0, 0.0, 1.0), clamp(evpaDbg.w / 12.0, 0.0, 1.0));   /* E (0..4), L (0..12) */', '' ].join('\n');
T = L3.slice(0, i32).concat([b32]).concat(L3.slice(e32)).join('\n');
console.log('ok view 32 = E, L');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');