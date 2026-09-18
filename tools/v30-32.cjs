const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
rep('evpaDbg = vec4(chiEVPA, detG, G11, G22);', 'evpaDbg = vec4(fpE, detG, G11, G22);   /* fpE = f_src . p; G11, G22 are the transported basis norms */', 'dbg payload');
rep('  if (uDebug == 31) {', '  if (uDebug == 30) {\n    col = vec3(0.25, clamp(0.5 + (evpaDbg.z - 1.0) * 2.0, 0.0, 1.0), clamp(0.5 + (evpaDbg.w - 1.0) * 2.0, 0.0, 1.0));\n  } else if (uDebug == 32) {\n    col = vec3(0.25, clamp((log(max(abs(evpaDbg.x), 1e-9)) + 9.0) / 12.0, 0.0, 1.0), 0.75);\n  } else if (uDebug == 31) {', 'views 30+32');
/* remove the now-superseded older view 30 branch (it used evpaDbg.y as a cosine) */
const old30 = T.indexOf('  if (uDebug == 30) {');
const second30 = T.indexOf('  if (uDebug == 30) {', old30 + 10);
if (second30 > 0) { const end30 = T.indexOf('  } else if (', second30); must(end30 > second30, 'old view 30 end not found'); T = T.slice(0, second30) + T.slice(end30 + '  } else '.length); console.log('ok: removed the superseded view 30'); }
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');