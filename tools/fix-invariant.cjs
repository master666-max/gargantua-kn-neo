const fs = require('fs');
const f = 'shaders/bufferA.frag';
let T = fs.readFileSync(f, 'utf8');
const bal = (s) => { const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length, p=(s.match(/\(/g)||[]).length, q=(s.match(/\)/g)||[]).length; return {ok:o===c&&p===q}; };
const must = (c,m) => { if(!c){console.log('ABORT: '+m);process.exit(1);} };
must(T.indexOf('float fPolN0') > 0, 'fPolN0 missing');
T = T.replace('float fPolN0', 'float fPolNlast = 1.0;   /* the norm AT THE POINT of the last update: the ONLY correct place to check */\n  float fPolN0');
must(T.indexOf('nUpd += 1.0; tLen = 0.0;') > 0, 'update line missing');
T = T.replace('nUpd += 1.0; tLen = 0.0;', 'fPolNlast = knF2(r, th, fPol);   /* same point as the transport, unlike the final-position read */\n        nUpd += 1.0; tLen = 0.0;');
/* the view-23 readout must show fPolNlast, not knF2 at the final position */
const m = T.match(/col = vec3\(clamp\(abs\(transportInfo\.x - 1\.0\) \/ 0\.05[^\n]*/);
must(!!m, 'readout line missing');
T = T.replace(m[0], 'col = vec3(clamp(abs(transportInfo.y - 1.0) / 0.05, 0.0, 1.0), clamp(transportInfo.w / 1024.0, 0.0, 1.0), 0.5);');
/* transportInfo.y must now carry fPolNlast */
const m2 = T.match(/transportInfo = vec4\([^\n]*/);
must(!!m2, 'transportInfo assignment missing');
T = T.replace(m2[0], 'transportInfo = vec4(knF2(r, th, fPol), fPolNlast, fPolP0, nUpd);');
const b = bal(T); console.log('balance', JSON.stringify(b));
must(b.ok, 'unbalanced');
fs.writeFileSync(f, T); console.log('WROTE');