const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
/* the INGREDIENT of the first update: the actual ds handed to knTransportStep */
rep('  float pP0 = 0.0;      /* p.p at the first state: the null-condition test */', '  float pP0 = 0.0;\n  float hSubFirst = 0.0;   /* the ds of the FIRST transport step */', 'state');
rep('float hSub = tLen / float(NSUB);', 'float hSub = tLen / float(NSUB);\n          if (nUpd < 0.5) hSubFirst = hSub;', 'capture ds');
rep('transportInfo = vec4(chiEVPA, fPolNlast, fPolP0, nUpd);   /* z = the real f.p */', 'transportInfo = vec4(hSubFirst, fPolNlast, fPolP0, nUpd);   /* x = the first step ds */', 'payload');
const L2 = T.split('\n');
const i27 = L2.findIndex(x => x.indexOf('uDebug == 27') >= 0 && x.indexOf('{') >= 0);
if (i27 < 0) { console.log('ABORT: view 27 not found'); process.exit(1); }
let e27 = -1;
for (let q = i27 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e27 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e27 = q + 1; break; } }
if (e27 < 0) { console.log('ABORT: view 27 end not found'); process.exit(1); }
const pre = L2[i27].slice(0, L2[i27].indexOf('uDebug == 27'));
const b27 = [ pre + 'uDebug == 27) {', '    float ds = transportInfo.x;', '    col = vec3(0.25, clamp((log(max(ds, 1e-6)) + 6.0) / 10.0, 0.0, 1.0), 0.75);', '' ].join('\n');
T = L2.slice(0, i27).concat([b27]).concat(L2.slice(e27)).join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');