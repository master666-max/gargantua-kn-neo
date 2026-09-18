const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const must = (c, m) => { if (!c) { console.log('ABORT: ' + m); process.exit(1); } };
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const declBad = '  float fPolNlast = knF2(rMid, thMid, fPol);   /* same geometry the last transport used */';
must(T.indexOf(declBad) > 0, 'the broken declaration was not found');
T = T.replace(declBad, '  float fPolNlast = knF2(r, th, fPol);');
const inBlock = '          fPolNlast = knF2(r, th, fPol);   /* the real norm AT the transport point */';
if (T.indexOf(inBlock) > 0) {
  T = T.replace(inBlock, '          fPolNlast = knF2(rMid, thMid, fPol);   /* same geometry the last transport used */');
  console.log('ok: in-block capture now uses the midpoint geometry');
} else {
  console.log('WARN: in-block capture not matched; leaving the declaration-only fix');
}
console.log('declarations left:', (T.match(/float fPolNlast/g)||[]).length);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');