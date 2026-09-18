/* gen-audio.mjs -- writes assets/audio/ambient.wav (deterministic, no deps).
   A slow, dark organ-like drone with a filtered wind bed and slow beating --
   the Interstellar-flavoured ambience the shader deserves. 16-bit mono. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 22050, SECONDS = 20, N = SR * SECONDS;

let seed = 1337;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const buf = new Float32Array(N);
const partials = [
  { f: 27.5, a: 0.55, d: 0.0 }, { f: 41.25, a: 0.30, d: 0.7 },
  { f: 55.0, a: 0.34, d: 1.3 }, { f: 82.5, a: 0.16, d: 2.1 },
  { f: 110.0, a: 0.10, d: 3.7 }, { f: 164.8, a: 0.05, d: 5.1 },
];
for (const p of partials) {
  const w = 2 * Math.PI * p.f / SR;
  for (let i = 0; i < N; i++) {
    const beat = 0.55 + 0.45 * Math.sin(2 * Math.PI * (0.017 + p.d * 0.004) * i / SR + p.d);
    buf[i] += p.a * beat * Math.sin(w * i + 0.4 * Math.sin(2 * Math.PI * 0.011 * i / SR));
  }
}
/* filtered noise: two one-pole lowpasses + one highpass */
let lp1 = 0, lp2 = 0, hp = 0;
for (let i = 0; i < N; i++) {
  const n = rnd() * 2 - 1;
  lp1 += 0.0025 * (n - lp1);
  lp2 += 0.03 * (lp1 - lp2);
  hp = lp2 - lp1 * 0.5;
  const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.007 * i / SR + 1.1);
  buf[i] += hp * 22 * env;
}
/* slow global swell + soft clip + fade in/out for a seamless loop */
let peak = 0;
for (let i = 0; i < N; i++) {
  const swell = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.0125 * i / SR);
  buf[i] *= swell;
  buf[i] = Math.tanh(buf[i] * 0.9);
  peak = Math.max(peak, Math.abs(buf[i]));
}
const fade = SR * 1.2;
const out = new Int16Array(N);
for (let i = 0; i < N; i++) {
  let v = buf[i] / (peak || 1) * 0.72;
  if (i < fade) v *= i / fade;
  if (i > N - fade) v *= (N - i) / fade;
  out[i] = Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + out.length * 2, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(out.length * 2, 40);
const dir = join(ROOT, 'assets', 'audio');
mkdirSync(dir, { recursive: true });
const file = join(dir, 'ambient.wav');
writeFileSync(file, Buffer.concat([header, Buffer.from(out.buffer, 0, out.length * 2)]));
console.log('wrote ' + file + '  (' + (44 + out.length * 2) / 1048576 + ' MB, ' + SECONDS + ' s, ' + SR + ' Hz mono)');
