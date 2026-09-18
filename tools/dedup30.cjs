const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const L = T.split('\n');
const idx = [];
L.forEach((x,i) => { if (x.indexOf('uDebug == 30') >= 0 && x.indexOf('{') >= 0) idx.push(i); });
console.log('view-30 sites:', idx.map(i => i+1).join(', '));
if (idx.length !== 2) { console.log('ABORT: expected two sites'); process.exit(1); }
/* keep the EARLIER one (798, the one carrying my f.p readout), neutralise the LATER */
console.log('neutralising line ' + (idx[1]+1) + ': ' + L[idx[1]].trim());
L[idx[1]] = L[idx[1]].replace('uDebug == 30', 'uDebug == 130');
let T2 = L.join('\n');
/* now put the ACTUAL f.p readout into the surviving branch, and make it read fPolP0 directly */
const rep = (a, b, tag) => { const n = T2.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T2 = T2.split(a).join(b); console.log('ok ' + tag); };
rep('float fp = transportInfo.z;', 'float fp = fPolP0;   /* the actual f.p, not the Gram residual */', 'read fPolP0');
const o = (T2.match(/{/g)||[]).length, c = (T2.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T2); console.log('WROTE');