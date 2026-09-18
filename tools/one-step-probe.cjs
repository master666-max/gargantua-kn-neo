const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const n = T.split("    col = vec3(0.25, clamp(gM[1][1] / 2.0, 0.0, 1.0), clamp(gM[3][3] / 40.0, 0.0, 1.0));").length - 1;
if (n !== 1) { console.log('ABORT: view 28 body not found (' + n + ')'); process.exit(1); }
T = T.split("    col = vec3(0.25, clamp(gM[1][1] / 2.0, 0.0, 1.0), clamp(gM[3][3] / 40.0, 0.0, 1.0));").join("    /* ONE STEP of the shader's own knTransportStep, component 2, on a scale of 2 per unit;\n       the library's value for the same state and ds is computed in the page. */\n    mat4 gT2, gT2r, gT2t, gT2u; knMetricDR(6.0, 1.2, gT2, gT2r, gT2t, gT2u);\n    vec4 pC2 = vec4(-1.0, 0.3, 0.2, 3.0);\n    vec4 fC2 = vec4(0.0, 0.0, 1.0 / max(sqrt(max(gT2[2][2], 1e-12)), 1e-9), 0.0);\n    vec4 fStep2 = knTransportStep(6.0, 1.2, gT2u * pC2, fC2, 0.05);\n    col = vec3(0.25, clamp(0.5 + fStep2.z * 2.0, 0.0, 1.0), clamp(0.5 + fStep2.y * 2.0, 0.0, 1.0));");
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');