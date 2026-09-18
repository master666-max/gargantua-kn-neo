const fs = require('fs');
const live = 'shaders/bufferA.frag', broken = 'shaders/bufferA.frag.broken-round21';
let T = fs.readFileSync(live, 'utf8');
const B = fs.readFileSync(broken, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {o,c,p,q,ok:o===c&&p===q}; };
/* 1. extract the verified machinery from the broken file (functions only -- its imbalance is inside main) */
const a = B.indexOf('void knMetricDR(float r, float th, out mat4 g');
const bMark = 'float knFP(float r, float th, vec4 fv, vec4 pp)';
const b = B.indexOf(bMark);
if (a < 0 || b < 0) { console.log('EXTRACT FAILED', a, b); process.exit(1); }
const end = B.indexOf('}', B.indexOf('{', b)) + 1;   /* end of knFP */
const block = B.slice(a, end);
const bb = bal(block);
console.log('extracted bytes', block.length, 'balance', JSON.stringify(bb));
if (!bb.ok) { console.log('ABORT: extracted block is not balanced'); process.exit(1); }
/* 2. replace the stub block in the live file */
const s0 = T.indexOf('vec4 knTransportRhs(float r, float th, vec4 p, vec4 fv) { return vec4(0.0); }');
const s1mark = 'float knFP(float r, float th, vec4 fv, vec4 p) { return 0.0; }';
const s1 = T.indexOf(s1mark);
if (s0 < 0 || s1 < 0) { console.log('STUB ANCHORS FAILED', s0, s1); process.exit(1); }
const live2 = T.slice(0, s0) + block + T.slice(s1 + s1mark.length);
const lb = bal(live2);
console.log('live after splice: balance', JSON.stringify(lb), 'delta vs before', (lb.o-lb.c) - ((T.match(/{/g)||[]).length - (T.match(/}/g)||[]).length));
if (!lb.ok) { console.log('ABORT: live file would be unbalanced, not written'); process.exit(1); }
fs.writeFileSync(live, live2);
console.log('WROTE functions only; no loop or view changes yet');