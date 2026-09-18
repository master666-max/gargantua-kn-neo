const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q, o, c, p, q}; };
const must = (c, m) => { if (!c) { console.log('FAILED: ' + m); process.exit(1); } };
/* 1. the real metric at the top of the loop (the stub left mat4(1.0)) */
must(T.indexOf('mat4 gT = mat4(1.0);') > 0, 'stub metric line not found');
T = T.replace('mat4 gT = mat4(1.0);   /* transport removed: see the stub block above */', 'mat4 gT, gTr, gTt, gTu; knMetricDR(r, th, gT, gTr, gTt, gTu);');
/* 2. the initial vector must NOT go through a Euclidean normalize */
T = T.replace('        fPol = normalize(eTh);', '        fPol = eTh;   /* already metric-unit: an extra Euclidean normalize would give it norm Sigma */\n        fPolN0 = knF2(r, th, fPol);');
must(T.indexOf('fPol = normalize(eTh);') < 0, 'normalize still present');
must(T.indexOf('float fPolN0') > 0 || T.indexOf('fPolN0 = knF2') > 0, 'fPolN0 not present (state may need declaring)');
if (T.indexOf('float fPolN0') < 0) {
  T = T.replace('  bool fPolInit = false;', '  float fPolN0 = 1.0;\n  bool fPolInit = false;');
}
const after = bal(T);
console.log('balance', JSON.stringify(after));
must(after.ok, 'unbalanced');
fs.writeFileSync(f, T);
console.log('WROTE');