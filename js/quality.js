/* ============================================================================
   quality.js -- Standard / High / Cinematic presets + the frame-time driven
   adaptive resolution controller required by the brief ("when the frame rate
   is short, drop the resolution automatically", desktop target 60 fps).
   Quality is a *linked* change: render resolution x integration steps x
   adaptive step scale x bloom levels.
   ========================================================================== */

export const QUALITY = {
  standard: {
    id: 'standard', name: 'Standard', key: '1',
    renderScale: 0.55, maxSteps: 160, stepScaleMul: 1.25, bloomLevels: 2,
    targetFps: 60, adaptive: true, dprCap: 1.0,
  },
  high: {
    id: 'high', name: 'High', key: '2',
    renderScale: 0.80, maxSteps: 256, stepScaleMul: 1.00, bloomLevels: 3,
    targetFps: 60, adaptive: true, dprCap: 1.0,
  },
  cinematic: {
    id: 'cinematic', name: 'Cinematic', key: '3',
    renderScale: 1.00, maxSteps: 384, stepScaleMul: 0.78, bloomLevels: 3,
    targetFps: 30, adaptive: false, dprCap: 1.0,
  },
};
export const QUALITY_ORDER = ['standard', 'high', 'cinematic'];

export class AdaptiveQuality {
  constructor(level) {
    this.level = QUALITY[level] || QUALITY.high;
    this.scale = this.level.renderScale;
    this.stepMul = 1.0;
    this.ema = 16.7;
    this.bad = 0;
    this.good = 0;
    this.changed = false;
    this.events = [];
  }
  setLevel(level) {
    this.level = QUALITY[level] || this.level;
    this.scale = this.level.renderScale;
    this.stepMul = 1.0;
    this.bad = 0; this.good = 0;
  }
  /* returns true when the render scale changed and targets must be resized */
  update(dtMs) {
    const lvl = this.level;
    this.ema = this.ema * 0.9 + dtMs * 0.1;
    this.changed = false;
    if (!lvl.adaptive) return false;
    const budget = 1000 / lvl.targetFps;
    const floor = Math.max(0.34, lvl.renderScale * 0.45);
    if (this.ema > budget * 1.28) { this.bad++; this.good = 0; }
    else if (this.ema < budget * 0.62) { this.good++; this.bad = 0; }
    else { this.bad = Math.max(0, this.bad - 1); }

    if (this.bad > 45) {
      this.bad = 0;
      const next = Math.max(floor, this.scale * 0.85);
      if (next < this.scale - 1e-4) {
        this.scale = next;
        this.stepMul = Math.max(0.62, this.stepMul * 0.9);
        this.events.push({ t: performance.now(), what: 'down', scale: this.scale });
        this.changed = true;
      }
    } else if (this.good > 150) {
      this.good = 0;
      const next = Math.min(lvl.renderScale, this.scale * 1.06);
      if (next > this.scale + 1e-4) {
        this.scale = next;
        this.stepMul = Math.min(1.0, this.stepMul * 1.07);
        this.events.push({ t: performance.now(), what: 'up', scale: this.scale });
        this.changed = true;
      }
    }
    if (this.events.length > 32) this.events.splice(0, this.events.length - 32);
    return this.changed;
  }
}
