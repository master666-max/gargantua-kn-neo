const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const a = "      yn = y + (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);";
const n = T.split(a).length - 1;
if (n !== 1) { console.log('ABORT: anchor found ' + n); process.exit(1); }
console.log('BEFORE: ' + a.trim());
T = T.split(a).join("      yn = y + (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);\n      /* ---- COUPLED PARALLEL TRANSPORT (6h) ------------------------------\n         f is advanced by the SAME four stages as the geodesic, so x, p and f\n         move together.  Evaluating the connection at one frozen point instead\n         makes the transport first order per unit affine parameter, which no\n         amount of sub-stepping fixes.  Flat-space exact test: coupled keeps\n         r*f^theta = 1 to 12 digits at every step; frozen drifts linearly.\n         This lives INSIDE the retry loop so a rejected step redoes it. */\n      {\n        vec4 ys[4];\n        ys[0] = y;\n        ys[1] = y + (0.5 * h) * k1;\n        ys[2] = y + (0.5 * h) * k2;\n        ys[3] = y + h * k3;\n        vec4 F[4];\n        vec4 D[4];\n        F[0] = fPol;\n        for (int st = 0; st < 4; st++) {\n          if (st > 0) { F[st] = fPol + ((st == 3) ? h : 0.5 * h) * D[st-1]; }\n          mat4 gm, gmr, gmt, gmu; knMetricDR(ys[st].x, ys[st].y, gm, gmr, gmt, gmu);\n          vec4 pc = vec4(-E, ys[st].z, ys[st].w, L);\n          D[st] = knTransportRhs(ys[st].x, ys[st].y, gmu * pc, F[st]);\n        }\n        fPol = fPol + (h / 6.0) * (D[0] + 2.0 * D[1] + 2.0 * D[2] + D[3]);\n      }");
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');