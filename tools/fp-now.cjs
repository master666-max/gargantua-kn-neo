const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('  float pNullNow = 0.0;', '  float pNullNow = 0.0;\n  float fPNow = 0.0;      /* f.p at the LAST transport point -- the one invariant never measured there */', 'state');
rep('          pNullNow = dot(vec4(-E, pr, pth, L), pT);', '          pNullNow = dot(vec4(-E, pr, pth, L), pT);\n          fPNow = dot(fPol, vec4(-E, pr, pth, L));', 'capture f.p');
rep('transportInfo = vec4(pNullNow, fPolNlast, fPolP0, nUpd);', 'transportInfo = vec4(pNullNow, fPolNlast, fPNow, nUpd);', 'payload');
const L2 = T.split('\n');
const i30 = L2.findIndex(x => x.indexOf('uDebug == 30') >= 0 && x.indexOf('{') >= 0);
if (i30 < 0) { console.log('ABORT: view 30 not found'); process.exit(1); }
let e30 = -1;
for (let q = i30 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e30 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e30 = q + 1; break; } }
const pre = L2[i30].slice(0, L2[i30].indexOf('uDebug == 30'));
const b30 = [ pre + 'uDebug == 30) {', '    float fp = transportInfo.z;   /* f.p at the transport point */', '    col = vec3(0.25, clamp(0.5 + fp * 0.5, 0.0, 1.0), 0.75);', '' ].join('\n');
T = L2.slice(0, i30).concat([b30]).concat(L2.slice(e30)).join('\n');
console.log('ok view 30 -> f.p');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');