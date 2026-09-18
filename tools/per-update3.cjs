const fs = require('fs');
const f = 'shaders/bufferA.frag';
const L = fs.readFileSync(f, 'utf8').split('\n');
const must = (c, m) => { if (!c) { console.log('ABORT: ' + m); process.exit(1); } };
const iState = L.findIndex(x => x.indexOf('float gAn = 1.0, gBn = 1.0;') >= 0);
must(iState >= 0, 'state anchor');
L[iState] = L[iState] + '\n  float fNPrev = 1.0;';
const iT = L.findIndex(x => x.indexOf('vec4 pT = gNu * vec4(-E, pr, pth, L);') >= 0);
must(iT >= 0, 'pT anchor');
L[iT] = L[iT] + '\n        fNPrev = knF2(r, th, fPol);';
const iD = L.findIndex(x => x.indexOf('evpaDbg = vec4(') >= 0);
must(iD >= 0, 'evpaDbg line');
L[iD] = '  evpaDbg = vec4(fpE, gAn0, fNPrev, fPolNlast);';
const i32 = L.findIndex(x => x.indexOf('uDebug == 32') >= 0 && x.indexOf('{') >= 0);
must(i32 >= 0, 'view 32 line');
let e32 = -1;
for (let i = i32 + 1; i < L.length; i++) { if (L[i].indexOf('} else if (') >= 0) { e32 = i; break; } }
must(e32 > i32, 'view 32 end');
/* keep the ORIGINAL prefix of the branch line, whatever it is, so the chain stays closed */
const orig = L[i32];
const cut = orig.indexOf('uDebug == 32');
const prefix = orig.slice(0, cut);
console.log('branch prefix kept:', JSON.stringify(prefix));
const body = [
  prefix + 'uDebug == 32) {',
  '    float dN = evpaDbg.w - evpaDbg.z;   /* what ONE transport update did to the norm */',
  '    col = vec3(0.25, clamp(0.5 + dN * 1000.0, 0.0, 1.0), 0.75);',
  '',
].join('\n');
const L2 = L.slice(0, i32).concat([body]).concat(L.slice(e32));
const T = L2.join('\n');
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
fs.writeFileSync(f, T); console.log('WROTE');