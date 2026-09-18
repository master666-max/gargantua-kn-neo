const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const at = (s) => { const i = L.findIndex(x => x.indexOf(s) >= 0); if (i < 0) { console.log('ABORT: not found: ' + s); process.exit(1); } return i; };
let i = at('float gAn = 1.0, gBn = 1.0;');
if (L[i].indexOf('fPolN1') < 0) { L[i] = L[i] + '\n  float fPolN1 = 1.0;   /* the norm after the FIRST transport update */'; console.log('ok: fPolN1 declared'); }
i = at('gB   = knTransportStep(r, th, pT, gB,   hSub);');
console.log('transport loop ends at line ' + (i+1));
/* capture after the whole sub-step loop, i.e. after the first completed update */
i = at('          }');
const j = L.findIndex((x, k) => k > i && x.indexOf('gAn = dot(gA') >= 0);
if (j < 0) { console.log('ABORT: gAn capture not found'); process.exit(1); }
console.log('BEFORE ' + (j+1) + ': ' + L[j].trim());
L.splice(j, 0, '          if (nUpd < 0.5) fPolN1 = knF2(r, th, fPol);   /* after the FIRST update */');
console.log('inserted the first-update capture before line ' + (j+1));
let T = L.join('\n');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('evpaDbg = vec4(fPolN0, gAn0, fNPrev, fPolNlast);', 'evpaDbg = vec4(fPolN0, fPolN1, fPolNlast, nUpd);', 'payload = initial / after-1 / final');
/* view 32: the norm after ONE update; view 30: initial and final side by side */
const i32 = T.split('\n').findIndex(x => x.indexOf('uDebug == 32') >= 0 && x.indexOf('{') >= 0);
const L2 = T.split('\n');
let e32 = -1;
for (let q = i32 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e32 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e32 = q + 1; break; } }
const pre32 = L2[i32].slice(0, L2[i32].indexOf('uDebug == 32'));
const b32 = [ pre32 + 'uDebug == 32) {', '    float n1 = evpaDbg.y;   /* norm after ONE transport update */', '    col = vec3(0.25, clamp(0.5 + (n1 - 1.0) * 50.0, 0.0, 1.0), 0.75);', '' ].join('\n');
T = L2.slice(0, i32).concat([b32]).concat(L2.slice(e32)).join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');