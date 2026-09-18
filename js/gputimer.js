/* ============================================================================
   gputimer.js -- real GPU time per frame, for the adaptive quality controller.
   ----------------------------------------------------------------------------
   Why: the adaptive resolution controller used to read the frame INTERVAL, which
   a frame cap pins to 1/fpsCap no matter how idle the GPU is.  Feeding it that
   makes it chase a phantom (at a 30 fps cap it sees 33 ms and spirals the render
   scale down on a healthy GPU), so the controller had to be frozen while capped.
   With a real GPU timer it can run at any cap.

   How: EXT_disjoint_timer_query_webgl2 (WebGL2) or EXT_disjoint_timer_query
   (WebGL1), wrapped around one frame's draws.  Results arrive a few frames later,
   so a small ring of queries is kept in flight and the newest RESOLVED sample is
   returned.  The disjoint flag is honoured: a GPU reset/power change invalidates
   the sample instead of reporting nonsense.

   If the extension is absent (Chrome exposes it only under some conditions),
   available stays false and the caller must fall back to the frame interval --
   and must then only drive the controller while UNCAPPED.  No fake numbers.
   ========================================================================== */

export class GpuTimer {
  constructor(gl, ring = 4) {
    this.gl = gl;
    this.ok = false;
    this.mode = 'none';
    this.ring = [];
    this.head = 0;
    this.ema = null;
    this.last = null;
    this.samples = 0;
    this.active = null;
    if (!gl) return;
    const ext2 = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (ext2 && typeof gl.createQuery === 'function') {
      this.ext = ext2; this.mode = 'webgl2'; this.ok = true;
    } else {
      const ext1 = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query');
      if (ext1 && typeof ext1.createQueryEXT === 'function') {
        this.ext = ext1; this.mode = 'webgl1'; this.ok = true;
      }
    }
    if (!this.ok) return;
    for (let i = 0; i < ring; i++) {
      const q = this.mode === 'webgl2' ? gl.createQuery() : this.ext.createQueryEXT();
      if (!q) { this.ok = false; this.mode = 'none'; return; }
      this.ring.push({ q, inFlight: false });
    }
  }

  _isDisjoint() {
    const gl = this.gl, ext = this.ext;
    const bit = ext.GPU_DISJOINT_EXT;
    return bit !== undefined && !!gl.getParameter(bit);
  }

  begin() {
    if (!this.ok || this.active) return;
    const slot = this.ring[this.head];
    if (slot.inFlight) return;                 /* ring saturated: skip this frame */
    try {
      if (this.mode === 'webgl2') this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, slot.q);
      else this.ext.beginQueryEXT(this.ext.TIME_ELAPSED_EXT, slot.q);
      this.active = slot;
    } catch (e) { this.ok = false; this.active = null; this.mode = 'none'; }
  }

  end() {
    if (!this.ok || !this.active) return;
    try {
      if (this.mode === 'webgl2') this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      else this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
      this.active.inFlight = true;
      this.head = (this.head + 1) % this.ring.length;
    } catch (e) { this.ok = false; this.mode = 'none'; }
    this.active = null;
  }

  /* returns the newest resolved sample in milliseconds, or null */
  poll() {
    if (!this.ok) return null;
    let got = null;
    for (const slot of this.ring) {
      if (!slot.inFlight) continue;
      let done = false, ns = 0;
      try {
        if (this.mode === 'webgl2') {
          done = !!this.gl.getQueryParameter(slot.q, this.gl.QUERY_RESULT_AVAILABLE);
          if (done) ns = this.gl.getQueryParameter(slot.q, this.gl.QUERY_RESULT);
        } else {
          done = !!this.ext.getQueryObjectEXT(slot.q, this.ext.QUERY_RESULT_AVAILABLE_EXT);
          if (done) ns = this.ext.getQueryObjectEXT(slot.q, this.ext.QUERY_RESULT_EXT);
        }
      } catch (e) { this.ok = false; this.mode = 'none'; return null; }
      if (done) {
        const disjoint = this._isDisjoint();
        slot.inFlight = false;
        if (!disjoint && Number.isFinite(ns) && ns >= 0) got = ns / 1e6;
      }
    }
    if (got !== null) {
      this.last = got;
      this.samples++;
      this.ema = this.ema === null ? got : this.ema * 0.9 + got * 0.1;
    }
    return got;
  }

  status() {
    return { mode: this.mode, available: this.ok, lastMs: this.last, emaMs: this.ema, samples: this.samples };
  }
}
