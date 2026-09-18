const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
rep('  if (uDebug == 30) {', '  if (uDebug == 31) {\n    mat4 gY, gYr, gYt, gYu; knMetricDR(6.0, 1.2, gY, gYr, gYt, gYu);\n    vec4 pCovY = vec4(-1.0, 0.3, 0.2, 3.0);\n    vec4 bR = gY * vec4(0.0, 1.0, 0.0, 0.0);      /* b = d_r: exercises the four terms that vanish for b = d_phi */\n    vec4 fY = knPolFromB(pCovY, bR, 6.0, 1.2);\n    col = vec3(0.25, clamp(0.5 + fY.y * 3.0, 0.0, 1.0), clamp(0.5 + fY.w * 3.0, 0.0, 1.0));\n  } else if (uDebug == 30) {', 'view 31');
const b = bal(T); must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');