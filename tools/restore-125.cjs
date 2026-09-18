const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const a1 = '    float rH  = 6.0;   /* LITERAL TEST: the same state the tuned probe used */';
const a2 = '    float thH = 1.2;';
if (T.indexOf(a1) < 0 || T.indexOf(a2) < 0) { console.log('ABORT: literal lines not found'); process.exit(1); }
T = T.replace(a1, '    float rH  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;');
T = T.replace(a2, '    float thH = 0.15 + 2.90 * gl_FragCoord.y / 720.0;');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');