const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const L = T.split('\n');
const sites = [];
L.forEach((x,i) => { if (/^\s*if \(uDebug == 25\) \{/.test(x)) sites.push(i); });
console.log('view-25 sites at lines:', sites.map(i => i+1).join(', '));
must(sites.length === 2, 'expected exactly two sites');
const kill = sites[1];   /* the LATER one overrides the earlier: neutralise it */
console.log('neutralising line', kill + 1, ':', L[kill].trim());
L[kill] = L[kill].replace('uDebug == 25', 'uDebug == 125');
T = L.join('\n');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');