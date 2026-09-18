const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const pairs = [["float tTarget = float(uTransportEvery) * 0.01;","float tTarget = 0.0;   /* fire on EVERY accepted step -- see 5x in README */"],["float hSub = tLen / float(NSUB);","float hSub = h;   /* THIS step's own accepted length, not an accumulated interval */"],["const int NSUB = 4;","const int NSUB = 1;"]];
for (const p of pairs) {
  const n = T.split(p[0]).length - 1;
  if (n !== 1) { console.log('ABORT: ' + n + ' matches for ' + JSON.stringify(p[0])); process.exit(1); }
  T = T.split(p[0]).join(p[1]);
  console.log('ok: ' + p[1].slice(0, 70));
}
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');