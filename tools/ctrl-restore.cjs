const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
T = T.replace('fPolNlast = 1.0;', 'fPolNlast = knF2(r, th, fPol);');
T = T.replace('\n/* control test active */', '');
const o=(T.match(/{/g)||[]).length, c=(T.match(/}/g)||[]).length;
console.log('revert balance', o===c, 'capture restored:', /fPolNlast = knF2/.test(T), 'fake gone:', T.indexOf('fPolNlast = 1.0;')<0);
fs.writeFileSync(f, T);