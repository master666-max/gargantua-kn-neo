const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const find = (s) => { const i = L.findIndex(x => x.indexOf(s) >= 0); return i; };
const iF = find('fPol = knTransportStep(rMid, thMid, pT, fPol, tLen);');
const iA = find('gA   = knTransportStep(rMid, thMid, pT, gA, tLen);');
const iB = find('gB   = knTransportStep(rMid, thMid, pT, gB, tLen);');
if (iF < 0 || iA < 0 || iB < 0) { console.log('ABORT: calls not found', iF, iA, iB); process.exit(1); }
if (!(iF < iA && iA < iB)) { console.log('ABORT: calls not in the expected order'); process.exit(1); }
console.log('replacing lines', iF+1, '..', iB+1);
L.forEach((x,i) => { if (i>=iF && i<=iB) console.log('BEFORE ' + (i+1) + ': ' + x.trim()); });
const body = [
  '          /* SUB-STEPPING: divide the geodesic step into NSUB transport steps.  The truncation of */',
  '          /* an RK4 over a frozen geometry falls as the fifth power of the sub-step count, so even */',
  '          /* two sub-steps cut it by a factor of 32. */',
  '          const int NSUB = 2;',
  '          float hSub = tLen / float(NSUB);',
  '          for (int s = 0; s < NSUB; s++) {',
  '            fPol = knTransportStep(rMid, thMid, pT, fPol, hSub);',
  '            gA   = knTransportStep(rMid, thMid, pT, gA,   hSub);',
  '            gB   = knTransportStep(rMid, thMid, pT, gB,   hSub);',
  '          }'
].join('\n');
const L2 = L.slice(0, iF).concat([body]).concat(L.slice(iB + 1));
const T = L2.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');