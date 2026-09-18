const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const pairs = [["knMetricDR(rMid, thMid, gN, gNr, gNt, gNu);","knMetricDR(r, th, gN, gNr, gNt, gNu);"],["vec4 pT = gNu * 0.5 * ((vec4(-E, prPrev, pthPrev, L)) + (vec4(-E, pr, pth, L)));","vec4 pT = gNu * vec4(-E, pr, pth, L);"],["fPol = knTransportStep(rMid, thMid, pT, fPol, hSub);","fPol = knTransportStep(r, th, pT, fPol, hSub);"],["gA   = knTransportStep(rMid, thMid, pT, gA,   hSub);","gA   = knTransportStep(r, th, pT, gA,   hSub);"],["gB   = knTransportStep(rMid, thMid, pT, gB,   hSub);","gB   = knTransportStep(r, th, pT, gB,   hSub);"],["fPolNlast = knF2(rMid, thMid, fPol);","fPolNlast = knF2(r, th, fPol);"]];
for (const p of pairs) {
  const n = T.split(p[0]).length - 1;
  if (n !== 1) { console.log('ABORT: ' + n + ' matches for ' + p[0].slice(0, 50)); process.exit(1); }
  T = T.split(p[0]).join(p[1]);
  console.log('ok -> ' + p[1].slice(0, 62));
}
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');