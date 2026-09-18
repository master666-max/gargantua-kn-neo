const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
const block = T.match(/  if \(uDebug == 25\) \{[\s\S]*?\n  \} else if/);
must(!!block, 'view 25 block not found');
const neu = [
'  if (uDebug == 25) {',
'    /* SWEEP: each pixel is a different (r, theta) and the SAME p, so the shader-vs-CPU',
'       comparison can be made over a grid instead of at the single state it was tuned on.',
'       Red/green/blue carry rhs.x, rhs.y, rhs.z at 500 units per unit, centred on 0.5. */',
'    float rG  = 2.0 + 18.0 * gl_FragCoord.x / 1280.0;',
'    float thG = 0.15 + 2.90 * gl_FragCoord.y / 720.0;',
'    mat4 gS, gSr, gSt, gSu; knMetricDR(rG, thG, gS, gSr, gSt, gSu);',
'    vec4 pCovS = vec4(-1.0, 0.3, 0.2, 3.0);',
'    vec4 fProbeS = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gS[2][2], 1e-12)), 1e-9), 0.0);',
'    vec4 rhsS = knTransportRhs(rG, thG, gSu * pCovS, fProbeS);',
'    col = vec3(clamp(0.5 + rhsS.x * 500.0, 0.0, 1.0), clamp(0.5 + rhsS.y * 500.0, 0.0, 1.0), clamp(0.5 + rhsS.z * 500.0, 0.0, 1.0));',
'  } else if'
].join('\n');
T = T.replace(block[0], neu);
console.log('ok: view 25 is now a sweep');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');