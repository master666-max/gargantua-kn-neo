const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const rep = (a, b, tag) => { const n = T.split(a).length - 1; must(n === 1, tag + ': found ' + n); T = T.split(a).join(b); console.log('ok: ' + tag); };
rep('  float gAn = 1.0, gBn = 1.0;', '  float gAn = 1.0, gBn = 1.0;\n  float tTargetLast = 0.0;   /* what the shader ACTUALLY used, so the interval can be certified */', 'state');
rep('float tTarget = float(uTransportEvery) * 0.01;', 'float tTarget = float(uTransportEvery) * 0.01;\n      tTargetLast = tTarget;', 'capture target');
rep('evpaDbg = vec4(fpE, gAn0, gAn, gBn);', 'evpaDbg = vec4(nUpd, gAn0, gAn, tTargetLast);', 'payload');
/* view 30: target on green (0.5 + x*5), update count on blue (x/1024) */
const old30 = T.match(/  if \(uDebug == 30\) \{[\s\S]*?\n  \} else if/);
must(!!old30, 'view 30 block not found');
const new30 = '  if (uDebug == 30) {\n    /* INSTRUMENT SELF-CERTIFICATION: the interval the shader actually used (green) and the\n       update count it actually accumulated (blue), in the SAME pixel, with the calibration\n       constant in red. */\n    col = vec3(0.25, clamp(0.5 + evpaDbg.w * 5.0, 0.0, 1.0), clamp(evpaDbg.x / 1024.0, 0.0, 1.0));\n  } else if';
T = T.replace(old30[0], new30);
console.log('ok: view 30 rewritten');
/* view 32: the transport-point basis norm */
const old32 = T.match(/  if \(uDebug == 32\) \{[\s\S]*?\n  \} else if/);
if (old32) { T = T.replace(old32[0], '  if (uDebug == 32) {\n    col = vec3(0.25, clamp(0.5 + (evpaDbg.z - 1.0) * 20.0, 0.0, 1.0), 0.75);\n  } else if'); console.log('ok: view 32 rewritten'); }
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');