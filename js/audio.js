/* ============================================================================
   audio.js -- optional ambient bed.
   Plays assets/audio/ambient.wav when it is reachable and layers a WebAudio
   drone (detuned sines + filtered noise + generated impulse reverb) so the
   site also works when the asset is missing.  Starts only on a user gesture,
   as every browser requires.
   ========================================================================== */
export class Ambient {
  constructor() {
    this.ctx = null; this.on = false; this.master = null;
    this.buffer = null; this.src = null; this.nodes = [];
    this.ready = false;
  }
  async init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    const rev = this.ctx.createConvolver();
    rev.buffer = this.impulse(3.4, 2.6);
    const wet = this.ctx.createGain(); wet.gain.value = 0.45;
    rev.connect(wet); wet.connect(this.master);
    this.rev = rev;
    try {
      const res = await fetch(new URL('assets/audio/ambient.wav', document.baseURI).href);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(ab);
      }
    } catch (e) { /* synthesised bed only */ }
    this.buildSynth();
    this.ready = true;
  }
  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }
  buildSynth() {
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(this.rev); bus.connect(this.master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7; lp.connect(bus);
    const base = [27.5, 41.2, 55.0, 82.5, 110.0];
    for (let i = 0; i < base.length; i++) {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = base[i];
      o.detune.value = (i - 2) * 7;
      const g = ctx.createGain(); g.gain.value = 0.16 / (1 + i * 0.55);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + i * 0.017;
      const lg = ctx.createGain(); lg.gain.value = 0.09 / (1 + i * 0.5);
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(lp);
      o.start(); lfo.start();
      this.nodes.push(o, lfo);
    }
    /* noise wind */
    const len = ctx.sampleRate * 4;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * 0.4;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 180; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.10;
    const nlfo = ctx.createOscillator(); nlfo.frequency.value = 0.021;
    const nlg = ctx.createGain(); nlg.gain.value = 0.05;
    nlfo.connect(nlg); nlg.connect(ng.gain);
    ns.connect(nf); nf.connect(ng); ng.connect(lp);
    ns.start(); nlfo.start();
    this.nodes.push(ns, nlfo);
    if (this.buffer) {
      const s = ctx.createBufferSource(); s.buffer = this.buffer; s.loop = true;
      const g = ctx.createGain(); g.gain.value = 0.35;
      s.connect(g); g.connect(this.master);
      s.start();
      this.src = s;
    }
  }
  async setEnabled(v) {
    await this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) {} }
    this.on = !!v;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.on ? 0.20 : 0.0, t, this.on ? 1.6 : 0.6);
    return this.on;
  }
  toggle() { return this.setEnabled(!this.on); }
}
