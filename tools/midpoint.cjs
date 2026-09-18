const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const must = (c, m) => { if (!c) { console.log('ABORT: ' + m); process.exit(1); } };
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
/* 1. remember the pre-step state so the MIDPOINT geometry can be formed */
must(T.indexOf('float rPrev = r;') > 0, 'rPrev anchor');
T = T.replace('float rPrev = r;', 'float rPrev = r, thPrev = th, prPrev = pr, pthPrev = pth;');
/* 2. evaluate the transport at the interval MIDPOINT instead of at its end.  The frozen-geometry
   error is what makes the drift first order: within one update the geodesic advances across the
   whole interval while the transport sees only one end of it.  Midpoint halves that mismatch. */
const oldG = '        mat4 gN, gNr, gNt, gNu; knMetricDR(r, th, gN, gNr, gNt, gNu);';
must(T.indexOf(oldG) > 0, 'metric anchor in the update');
T = T.replace(oldG, [
  '        float rMid = 0.5 * (rPrev + r), thMid = 0.5 * (thPrev + th);',
  '        mat4 gN, gNr, gNt, gNu; knMetricDR(rMid, thMid, gN, gNr, gNt, gNu);'
].join('\n'));
const oldP = '        vec4 pT = gNu * vec4(-E, pr, pth, L);';
must(T.indexOf(oldP) > 0, 'momentum anchor');
T = T.replace(oldP, '        vec4 pT = gNu * 0.5 * ((vec4(-E, prPrev, pthPrev, L)) + (vec4(-E, pr, pth, L)));');
/* 3. the transport itself must also run at the midpoint state */
const oldT = '          fPol = knTransportStep(r, th, pT, fPol, tLen);';
must(T.indexOf(oldT) > 0, 'transport call anchor');
T = T.replace(oldT, '          fPol = knTransportStep(rMid, thMid, pT, fPol, tLen);');
const oldA = '          gA   = knTransportStep(r, th, pT, gA, tLen);';
must(T.indexOf(oldA) > 0, 'gA anchor');
T = T.replace(oldA, '          gA   = knTransportStep(rMid, thMid, pT, gA, tLen);');
const oldB = '          gB   = knTransportStep(r, th, pT, gB, tLen);';
must(T.indexOf(oldB) > 0, 'gB anchor');
T = T.replace(oldB, '          gB   = knTransportStep(rMid, thMid, pT, gB, tLen);');
/* 4. the invariant capture must stay at the CURRENT state, where the vector now lives */
must(T.indexOf('fNPrev = knF2(r, th, fPol);') > 0, 'fNPrev anchor');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
must(T.indexOf('knTransportStep(rMid, thMid, pT, fPol, tLen)') > 0, 'midpoint call missing');
fs.writeFileSync(f, T); console.log('WROTE');