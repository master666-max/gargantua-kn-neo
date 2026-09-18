const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q, o, c, p, q}; };
const lines = T.split('\n');
const idx = [];
lines.forEach((L, i) => { if (/uDebug == 23/.test(L)) idx.push(i); });
console.log('view-23 branch sites:', idx.map(i => (i+1) + ': ' + lines[i].trim().slice(0, 60)).join(' | '));
if (idx.length < 2) { console.log('only one site; nothing to neutralise'); process.exit(0); }
/* keep the branch that contains my marker (search a window after each site) */
let keep = -1;
for (const i of idx) {
  const win = lines.slice(i, Math.min(lines.length, i + 14)).join('\n');
  if (/transportInfo\.w \/ 1024\.0/.test(win)) keep = i;
}
console.log('keeping site at line', keep + 1);
let n = 0;
for (const i of idx) { if (i !== keep) { lines[i] = lines[i].replace('uDebug == 23', 'uDebug == 123'); n++; } }
let T2 = lines.join('\n');
const after = bal(T2);
console.log('neutralised', n, 'duplicate(s); balance', JSON.stringify(after));
if (!after.ok) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T2);
console.log('WROTE');