const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('  float fPolN1 = 1.0;   /* the norm after the FIRST transport update */', '  float fPolN1 = 1.0;\n  float pP0 = 0.0;      /* p.p at the first state: the null-condition test */', 'state');
rep('        fPolP0 = fpInit;', '        fPolP0 = fpInit;\n        { mat4 gz, gzr, gzt, gzu; knMetricDR(r, th, gz, gzr, gzt, gzu);\n          pP0 = dot(vec4(-E, pr, pth, L), gzu * vec4(-E, pr, pth, L)); }', 'capture p.p');
rep('evpaDbg = vec4(fPolN0, fPolN1, fPolNlast, nUpd);', 'evpaDbg = vec4(fPolN0, pP0, fPolNlast, nUpd);', 'payload');
const L2 = T.split('\n');
const i32 = L2.findIndex(x => x.indexOf('uDebug == 32') >= 0 && x.indexOf('{') >= 0);
if (i32 < 0) { console.log('ABORT: view 32 not found'); process.exit(1); }
let e32 = -1;
for (let q = i32 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e32 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e32 = q + 1; break; } }
if (e32 < 0) { console.log('ABORT: view 32 end not found'); process.exit(1); }
const pre = L2[i32].slice(0, L2[i32].indexOf('uDebug == 32'));
const b32 = [ pre + 'uDebug == 32) {', '    float p2 = evpaDbg.y;', '    col = vec3(0.25, clamp(0.5 + p2 * 0.05, 0.0, 1.0), 0.75);', '' ].join('\n');
T = L2.slice(0, i32).concat([b32]).concat(L2.slice(e32)).join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');