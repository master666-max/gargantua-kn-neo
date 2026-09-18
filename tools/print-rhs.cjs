const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const rep = (a, b, tag) => { const n = T.split(a).length - 1; if (n !== 1) { console.log('ABORT: ' + tag + ' found ' + n); process.exit(1); } T = T.split(a).join(b); console.log('ok ' + tag); };
rep('  float hSubFirst = 0.0;   /* the ds of the FIRST transport step */', '  float hSubFirst = 0.0;\n  float rhsFirst = 0.0;    /* |df/dlambda| at the first transport state */', 'state');
rep('          if (nUpd < 0.5) hSubFirst = hSub;', '          if (nUpd < 0.5) { hSubFirst = hSub; rhsFirst = length(knTransportRhs(r, th, pT, fPol)); }', 'capture rhs');
rep('transportInfo = vec4(hSubFirst, fPolNlast, fPolP0, nUpd);   /* x = the first step ds */', 'transportInfo = vec4(rhsFirst, fPolNlast, fPolP0, nUpd);', 'payload');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');