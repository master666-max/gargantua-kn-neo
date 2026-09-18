const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
/* put the REAL f.p on the wire: the payload slot z carried the Gram residual, and fPolP0 was */
/* never exposed at all -- which is why the 'f.p is not zero' reading was a misreading.      */
rep('transportInfo = vec4(chiEVPA, fPolNlast, evpaResid, nUpd);', 'transportInfo = vec4(chiEVPA, fPolNlast, fPolP0, nUpd);   /* z = the real f.p */', 'payload');
rep('float fp = fPolP0;   /* the actual f.p, not the Gram residual */', 'float fp = transportInfo.z;   /* the real f.p, now that the payload carries it */', 'view reads z');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');