const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
/* restore the screen EVPA on the wire: chiEVPA takes slot x back from pNullNow, and the Gram
   residual moves into evpaDbg.x so the reconstruction can still be checked. */
rep('transportInfo = vec4(pNullNow, fPolNlast, fPNow, nUpd);', 'transportInfo = vec4(chiEVPA, fPolNlast, fPNow, nUpd);   /* x = the screen EVPA (rad) */', 'payload x = chi');
rep('evpaDbg = vec4(fPolN0, pP0, fPolNlast, nUpd);', 'evpaDbg = vec4(evpaResid, pP0, fPolNlast, nUpd);   /* x = the Gram reconstruction residual */', 'evpaDbg x = residual');
/* view 27: the EVPA, +-pi/2, on a signed ramp about 0.5 */
const L2 = T.split('\n');
const i27 = L2.findIndex(x => x.indexOf('uDebug == 27') >= 0 && x.indexOf('{') >= 0);
if (i27 < 0) { console.log('ABORT: view 27 not found'); process.exit(1); }
let e27 = -1;
for (let q = i27 + 1; q < L2.length; q++) { if (L2[q].indexOf('} else if (') >= 0) { e27 = q; break; } if (/^  \}\s*$/.test(L2[q])) { e27 = q + 1; break; } }
const pre = L2[i27].slice(0, L2[i27].indexOf('uDebug == 27'));
const b27 = [ pre + 'uDebug == 27) {', '    float chi = transportInfo.x;   /* screen EVPA in radians, folded to +-pi/2 */', '    col = vec3(0.5 + chi / 3.14159265, clamp(0.5 + evpaDbg.x * 1000.0, 0.0, 1.0), 0.5);', '' ].join('\n');
T = L2.slice(0, i27).concat([b27]).concat(L2.slice(e27)).join('\n');
console.log('ok view 27 = chi, green = Gram residual');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');