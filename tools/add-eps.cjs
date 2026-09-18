const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
must(T.indexOf('knPolToroidal') < 0, 'already present');
const i = T.indexOf('/* |f|^2 and f.p, the two invariants of parallel transport, so the shader can be checked */');
must(i > 0, 'anchor not found');
const block = "\n/* ---- the physical polarisation, in closed form ------------------------------\n   f^mu ~ eps^{mu nu rho sigma} p_nu u_rho b_sigma with u the ZAMO and b = d_phi.\n   For the ZAMO, u_rho is proportional to (1,0,0,0) because g_tphi + omega g_phiphi = 0\n   identically; and b_sigma = g_{sigma phi} = (g_tphi, 0, 0, g_phiphi).  The contraction\n   therefore has only two non-zero components and reduces to this closed form -- no permutation\n   loop, which is what blew the GLSL compile up to 50 s when an array version was tried.\n   The CPU version (polFromField in js/polar.js) agrees and has f.p = 0 exactly. */\nvec4 knPolToroidal(vec4 pCov, float r, float th, out float fp) {\n  mat4 g, gr, gt, gu; knMetricDR(r, th, g, gr, gt, gu);\n  float om = -g[0][3] / max(g[3][3], 1e-12);\n  float nrm = -(g[0][0] + 2.0 * om * g[0][3] + om * om * g[3][3]);\n  float N = 1.0 / sqrt(max(nrm, 1e-12));\n  float ut  = g[0][0] * N + g[0][3] * N * om;      /* u_t, covariant */\n  float bph = g[3][3];                              /* b_phi, covariant, b = d_phi */\n  float s = max(sin(th), 1e-6);\n  float detg = max(g[2][2], 1e-12) * s;             /* sqrt(-g) = Sigma sin(theta) in BL */\n  float c = ut * bph / max(detg, 1e-12);\n  vec4 f = vec4(0.0, pCov.z * c, -pCov.y * c, 0.0);\n  float n2 = dot(f, g * f);\n  f = f / sqrt(max(abs(n2), 1e-20));\n  fp = dot(f, g * pCov);\n  return f;\n}\n";
T = T.slice(0, i) + block + T.slice(i);
/* NEW view 26: the physical polarisation's two invariants, with a certification constant */
must(T.indexOf('uDebug == 26') < 0, 'view 26 already exists');
const vi = T.indexOf('  if (uDebug == 25) {');
must(vi > 0, 'view 25 branch not found');
const v26 = [
'  if (uDebug == 26) {',
'    /* THE PHYSICAL POLARISATION from the epsilon construction (closed form): its two',
'       invariants must be f.p = 0 and |f|^2 = 1.  Red carries the constant 0.25 so the',
'       readback is certified; green is f.p and blue is |f|^2 - 1, both centred on 127. */',
'    mat4 gW, gWr, gWt, gWu; knMetricDR(6.0, 1.2, gW, gWr, gWt, gWu);',
'    vec4 pCovW = vec4(-1.0, 0.3, 0.2, 3.0);',
'    float fpW;',
'    vec4 fW = knPolToroidal(pCovW, 6.0, 1.2, fpW);',
'    float nW = dot(fW, gW * fW);',
'    col = vec3(0.25, clamp(0.5 + fpW * 10.0, 0.0, 1.0), clamp(0.5 + (nW - 1.0) * 10.0, 0.0, 1.0));',
'  } else if (uDebug == 25) {'
].join('\n');
T = T.slice(0, vi) + v26 + T.slice(vi + '  if (uDebug == 25) {'.length);
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');