const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {o,c,p,q,ok:o===c&&p===q}; };
const before = bal(T);
const must = (c, m) => { if (!c) { console.log('FAILED: ' + m); process.exit(1); } };
console.log('before', JSON.stringify(before));
/* 1. the transport gate inside the loop: locate it by marker and replace the whole block */
const gate = T.indexOf('if (uDebug == 23 || uDebug == 24) {');
must(gate > 0, 'transport gate not found in the loop');
const blockEnd = T.indexOf('\n      }\n', gate);
must(blockEnd > gate, 'could not find the gate block end');
const oldBlock = T.slice(gate, blockEnd + 9);
console.log('old gate block bytes', oldBlock.length, 'balance', JSON.stringify(bal(oldBlock)));
const newBlock = 'if (uDebug == 23 || uDebug == 24) {\n' +
  '        tLen += (abs(drd0) > 1e-9) ? (abs(r - rPrev) / abs(drd0)) : 0.0;\n' +
  '        tSkip++;\n' +
  '        if (tSkip >= uTransportEvery) {\n' +
  '          mat4 gN, gNr, gNt, gNu; knMetricDR(r, th, gN, gNr, gNt, gNu);\n' +
  '          fPol = knTransportStep(r, th, gNu * vec4(-E, pr, pth, L), fPol, tLen);\n' +
  '          nUpd += 1.0; tSkip = 0; tLen = 0.0;\n' +
  '        }\n' +
  '      }';
console.log('new block balance', JSON.stringify(bal(newBlock)));
/* the gate must now run AFTER the state advance, so cut it out and re-insert after line 575's anchor */
T = T.slice(0, gate) + '/* transport update moved below, to the post-step position */' + T.slice(blockEnd + 9);
const adv = T.indexOf('    r = yn.x; th = yn.y; pr = yn.z; pth = yn.w; ph = phn;');
must(adv > 0, 'state advance anchor not found');
const advEnd = adv + '    r = yn.x; th = yn.y; pr = yn.z; pth = yn.w; ph = phn;'.length;
T = T.slice(0, advEnd) + '\n' + newBlock.replace(/^if/, '    if').replace(/\n        /g, '\n      ').replace(/\n          /g, '\n        ').replace(/\n        }/g, '\n      }') + T.slice(advEnd);
/* 2. rPrev next to drd0 */
T = T.replace('    float drd0 = (g.Del / g.Sig) * pr;', '    float drd0 = (g.Del / g.Sig) * pr;\n    float rPrev = r;');
/* 3. the contravariant momentum for the loop init */
T = T.replace('vec4 pNow = vec4(-E, pr, pth, L);', 'vec4 pNow = gTu * vec4(-E, pr, pth, L);');
/* 4. view 23 */
if (T.indexOf('if (uDebug == 23)') < 0) {
  T = T.replace('  if (uDebug == 21) {', '  if (uDebug == 23) {\n    float dv = abs(transportInfo.x - 1.0);\n    col = vec3(clamp(dv / 0.05, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);\n  } else if (uDebug == 21) {');
}
const after = bal(T);
console.log('after', JSON.stringify(after));
must(after.ok, 'result would be unbalanced');
fs.writeFileSync(f, T);
console.log('WROTE');