const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const oldL = '    vec4 rhsS = knTransportRhs(rG, thG, gSu * pCovS, fProbeS);';
const oldC = '    col = vec3(clamp(0.5 + rhsS.x * 500.0, 0.0, 1.0), clamp(0.5 + rhsS.y * 500.0, 0.0, 1.0), clamp(0.5 + rhsS.z * 500.0, 0.0, 1.0));';
const i1 = T.indexOf(oldL);
if (i1 < 0) { console.log('ABORT: rhs line not found'); process.exit(1); }
const i2 = T.indexOf(oldC);
if (i2 < 0) { console.log('ABORT: col line not found'); process.exit(1); }
T = T.replace(oldC, '    col = vec3(clamp(gSu[1][1] / 2.0, 0.0, 1.0), clamp(gSu[3][3] / 25.0, 0.0, 1.0), clamp((gS[2][2] - 100.0) / 200.0, 0.0, 1.0));');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');