const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const re = /col = vec3\(clamp\(abs\(transportInfo\.x - 1\.0\) \* 1000\.0[^\n]*/;
const m = T.match(re);
if (!m) { console.log('ABORT: body not found'); process.exit(1); }
console.log('replacing:', m[0].slice(0, 80));
const neu = 'col = vec3(clamp(abs(transportInfo.x - 1.0) / 0.05, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);   /* linear 5% full scale; blue is a 0.5 calibration constant */';
T = T.replace(m[0], neu);
const b = bal(T); console.log('balance', JSON.stringify(b));
if (!b.ok) { console.log('ABORT'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');