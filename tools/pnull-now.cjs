const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('  float hSubFirst = 0.0;', '  float hSubFirst = 0.0;\n  float pNullNow = 0.0;   /* p.p at the LAST transport point */', 'state');
rep('vec4 pT = gNu * vec4(-E, pr, pth, L);', 'vec4 pT = gNu * vec4(-E, pr, pth, L);\n          pNullNow = dot(vec4(-E, pr, pth, L), pT);   /* is the momentum still null here? */', 'capture p.p');
rep('transportInfo = vec4(rhsFirst, fPolNlast, fPolP0, nUpd);', 'transportInfo = vec4(pNullNow, fPolNlast, fPolP0, nUpd);', 'payload');
/* view 27 currently reads transportInfo.x with a log scale; make it linear around zero */
const i27 = T.split('\n').findIndex(x => x.indexOf('uDebug == 27') >= 0 && x.indexOf('{') >= 0);
const L2 = T.split('\n');
let e27 = -1;
for (let q = i27 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e27 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e27 = q + 1; break; } }
const pre = L2[i27].slice(0, L2[i27].indexOf('uDebug == 27'));
const b27 = [ pre + 'uDebug == 27) {', '    float pp = transportInfo.x;   /* p.p at the last transport point */', '    col = vec3(0.25, clamp(0.5 + pp * 5.0, 0.0, 1.0), 0.75);', '' ].join('\n');
T = L2.slice(0, i27).concat([b27]).concat(L2.slice(e27)).join('\n');
console.log('ok view 27');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');