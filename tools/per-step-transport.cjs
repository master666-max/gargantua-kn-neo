const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const startM = T.indexOf('      tLen += h;');
if (startM < 0) { console.log('ABORT: the interval accumulator was not found'); process.exit(1); }
const endM = T.indexOf('tLen = 0.0;', startM);
if (endM < 0) { console.log('ABORT: the end of the block was not found'); process.exit(1); }
const endLine = T.indexOf('\n', endM) + 1;
console.log('replacing', (T.slice(0, startM).split('\n').length), '..', (T.slice(0, endLine).split('\n').length));
console.log('BEFORE: ' + T.slice(startM, Math.min(startM + 160, endLine)).replace(/\n/g, ' | '));
const neu = [
      '      /* TRANSPORT ON EVERY ACCEPTED STEP, with THAT STEP\'s geometry.  The previous version',
      '         accumulated an interval and transported once with a single frozen geometry; the',
      '         flat-space exact test (5x) shows that to be 25 % wrong where this is 1e-4, because the',
      '         connection varies along the step and a frozen evaluation makes the scheme first order. */',
      '      {',
      '        mat4 gN, gNr, gNt, gNu; knMetricDR(r, th, gN, gNr, gNt, gNu);',
      '        vec4 pT = gNu * vec4(-E, pr, pth, L);',
      '        fNPrev = knF2(r, th, fPol);',
      '        fPol = knTransportStep(r, th, pT, fPol, h);',
      '        gA   = knTransportStep(r, th, pT, gA,   h);',
      '        gB   = knTransportStep(r, th, pT, gB,   h);',
      '        if (nUpd < 0.5) fPolN1 = knF2(r, th, fPol);',
      '        gAn = dot(gA, gNu * gA);',
      '        gBn = dot(gB, gNu * gB);',
      '        fPolNlast = knF2(r, th, fPol);',
      '        nUpd += 1.0;',
      '      }',
    ].join('\n');
T = T.slice(0, startM) + neu + T.slice(endLine);
const o = (T.match(/{/g)||[]).length, c = (T.match(/}/g)||[]).length;
console.log('balance', o === c, o, c);
if (o !== c) { console.log('ABORT unbalanced'); process.exit(1); }
if (T.indexOf('tTarget') >= 0) { console.log('WARN: tTarget still referenced'); }
fs.writeFileSync(f, T); console.log('WROTE');