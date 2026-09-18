/* hud.js -- all DOM: readouts, parameter panel (21 entries), toolbar,
   debug legend, toasts, boot overlay and the fatal-error box.
   The HUD never touches the GPU: it receives a plain object per frame. */
import { VIEWS, PARAMS, GROUPS } from './params.js';

const ROWS = [
  ['FPS', 'fps'], ['FRAME', 'frame'], ['QUALITY', 'quality'], ['BUFFER', 'buffer'],
  ['r (signed)', 'r'], ['\u03b8 / \u03c6', 'ang'], ['UNIVERSE', 'universe'], ['SPEED', 'speed'],
  ['M / a / Q', 'maq'], ['HORIZONS', 'horizons'], ['ERGOSPHERE', 'ergo'], ['ISCO', 'isco'],
  ['CHARGE \u00b7 REALITY CHECK', 'qphys'],
  ['DISK', 'disk'], ['MODE', 'mode'], ['STATE PIXELS', 'statepix'], ['INTEGRATOR', 'integ'],
];

const DEBUG_TEXT = {
  0: '0 \u00b7 FINAL \u2014 ACES tonemap of the HDR composite',
  1: '1 \u00b7 STEPS \u2014 integration iterations per ray (heat)',
  2: '2 \u00b7 CONSERVATION \u2014 max |H|/|H_terms| drift (log heat)',
  3: '3 \u00b7 DISK CROSSINGS \u2014 multiple lensed images per ray',
  4: '4 \u00b7 HORIZON APPROACH \u2014 closest |r| \u2212 r\u208a',
  5: '5 \u00b7 \u7247\u5c42\u7b26\u53f7 \u2014 \u7ea2 = \u6211\u4eec\u7684\u5b87\u5b99 (r \u2265 0) \u00b7 \u7eff = \u53cd\u5b87\u5b99 (r < 0)\u3002\u6574\u5c4f\u7ea2 = \u672c\u53c2\u6570\u4e0b\u6ca1\u6709\u5149\u7ebf\u7ec8\u6b62\u5728 r < 0 \u7247\u5c42',
  6: '6 \u00b7 BUFFER B \u2014 bloom level 1 (1/2 res)',
  7: '7 \u00b7 BUFFER C \u2014 bloom level 2 (1/4 res)',
  8: '8 \u00b7 BUFFER D \u2014 bloom level 3 (1/8 res)',
  9: '9 \u00b7 LINEAR HDR \u2014 before tonemapping',
  10: '10 \u00b7 \u7ec8\u6b62\u539f\u56e0\uff08\u539f\u59cb\u7f16\u7801\uff09\u2014 \u767d = \u9003\u9038\uff0c\u9ed1 = \u88ab\u6355\u83b7\uff1b\u7eaf\u51e0\u4f55\u901a\u9053\uff0c\u4e0d\u542b\u76d8\u53d1\u5c04',
  11: '11 \u00b7 X \u5c04\u7ebf 2\u201310 keV \u2014 \u76d8 + \u5195\u3010\u4ee3\u7406\u3011\uff1a\u6309\u5c40\u90e8\u6e29\u5ea6\u52a0\u6743\u540e\u53d6\u5bf9\u6570\uff1b\u672a\u5efa\u5eb7\u666e\u987f\u5316',
  12: '12 \u00b7 \u5c04\u7535 230 GHz \u2014 EHT \u4f2a\u5f69 / \u5bf9\u6570\u6807\u5c3a\uff1b\u51e0\u4f55\u662f\u771f\u7684\uff0c\u5e26\u6743\u662f\u4ee3\u7406',
  13: '13 \u00b7 \u8fd1\u7ea2\u5916 K \u6ce2\u6bb5 2.2 \u00b5m \u2014 Wien \u5c3e\uff1a\u6700\u70ed\u5904\u6700\u4eae',
  14: '14 \u00b7 \u94c1 K\u03b1 6.4 keV \u7ebf\u5fc3\u4f4d\u79fb \u2014 \u84dd = \u8fce\u9762\uff08\u84dd\u79fb\uff09\u00b7 \u7ea2 = \u8fdc\u79bb',
  15: '15 \u00b7 \u9ad8\u9636\u50cf\u9636\u6570 \u2014 \u6309\u8d64\u9053\u7a7f\u8d8a\u6b21\u6570\u7740\u8272\uff1b\u767d\u7ebf = \u4e34\u754c\u66f2\u7ebf',
  16: '16 \u00b7 \u7ea2\u79fb / \u84dd\u79fb\u573a g \u2212 1 \u2014 \u6709\u7b26\u53f7',
  17: '17 \u00b7 \u5bf9\u6570\u5f3a\u5ea6\u4f2a\u5f69 \u2014 \u5168\u6ce2\u6bb5\uff0cEHT \u98ce\u683c\u538b\u7f29\u52a8\u6001\u8303\u56f4',
  18: '18 \u00b7 \u7ec8\u6b62 + \u7247\u5c42\u5168\u666f \u2014 \u542b r < 0 \u7247\u5c42\uff08\u6d0b\u7ea2\u6df7\u8272\uff09\uff1b\u767d\u7ebf = \u4e34\u754c\u66f2\u7ebf',
  19: '19 \u00b7 \u94c1 K\u03b1 \u7ebf\u5bbd \u2014 \u7ebf\u8f6e\u5ed3\u7684\u4e8c\u9636\u77e9',
  20: '20 \u00b7 \u51e0\u4f55\u89c6\u56fe \u2014 \u6355\u83b7 / \u9003\u9038\u63a9\u6a21 + \u4e34\u754c\u66f2\u7ebf\uff0c\u65e0\u53d1\u5c04',
  21: '21 \u00b7 \u89c2\u6d4b\u504f\u632f\u5ea6 \u2014 \u7eff = \u9000\u504f\u5c0f\uff0c\u7ea2 = \u6cd5\u62c9\u7b2c\u9000\u504f\u91cd',
  22: '22 \u00b7 \u6cd5\u62c9\u7b2c\u6df1\u5ea6 \u03b8_F \u2014 \u6709\u7b26\u53f7\uff08\u84dd\u8d1f / \u7ea2\u6b63\uff09',
  23: '23 \u00b7 \u5f20\u91cf\u65ad\u8a00 1: |f|\u00b2 = 1 \u2014 \u6570\u503c\u8bfb\u51fa\uff1a\u7ea2\u901a\u9053 127 \u5c31\u662f\u504f\u5dee 0\uff08\u00b10.01 \u6ee1\u91cf\u7a0b\uff09',
  25: '25 \u00b7 \u5ea6\u89c4\u5bfc\u6570\u63a2\u9488 \u2014 \u5c4f\u5e55\u6309 (r, \u03b8) \u6805\u683c\u626b\u63cf\uff1aG = (r\u22122)/18\uff0cB = (\u03b8\u22120.15)/2.90',
  26: '26 \u00b7 \u3010\u70b9\u63a2\u9488 \u00b7 \u6574\u5c4f\u5e38\u6570 \u00b7 \u975e\u6545\u969c\u3011\u56fa\u5b9a\u72b6\u6001 (r=6, \u03b8=1.2) \u7684\u504f\u632f\u4e0d\u53d8\u91cf\uff1aB = |f|\u00b2\uff08127 = 1\uff09\uff0cG = log|f\u00b7p|\uff080 = f \u22a5 p\uff09\u3002\u6574\u5c4f\u540c\u8272 = \u65ad\u8a00\u901a\u8fc7',
  27: '27 \u00b7 \u5c4f\u5e55 EVPA\uff08rad\uff09\u2014 \u6298\u5230 \u00b1\u03c0/2\uff1b\u7eff\u901a\u9053\u662f Gram \u6b8b\u5dee',
  28: '28 \u00b7 \u3010\u70b9\u63a2\u9488 \u00b7 \u6574\u5c4f\u5e38\u6570 \u00b7 \u975e\u6545\u969c\u3011\u5ea6\u89c4 + \u5355\u6b65 knTransportStep\uff08\u5206\u91cf 2\uff09\uff1b\u9875\u9762\u7528 JS \u5e93\u7b97\u540c\u4e00\u72b6\u6001\u505a\u5bf9\u7167',
  29: '29 \u00b7 \u3010\u70b9\u63a2\u9488 \u00b7 \u6574\u5c4f\u5e38\u6570 \u00b7 \u975e\u6545\u969c\u3011\u56fa\u5b9a\u72b6\u6001\u4e0b\u7684 f^r, f^\u03b8\uff08b = \u2202\u03c6\uff09',
  30: '30 \u00b7 \u521d\u59cb p^r, p^\u03b8\uff08\u00b12 \u91cf\u7a0b\uff09',
  31: '31 \u00b7 \u3010\u70b9\u63a2\u9488 \u00b7 \u6574\u5c4f\u5e38\u6570 \u00b7 \u975e\u6545\u969c\u3011\u56fa\u5b9a\u72b6\u6001\u4e0b\u7684 f^r, f^\u03c6\uff08b = \u2202r\uff09',
  32: '32 \u00b7 E\uff080\u20264\uff09\u4e0e L\uff08\u00b112\uff09',
  33: '33 \u00b7 \u7ec8\u70b9 r \u2014 16 \u4f4d\uff08\u7c97 + \u7ec6\uff09\uff1b\u7ea2 0.25 \u662f\u8bfb\u51fa\u8bc1\u4e66',
  34: '34 \u00b7 \u7ec8\u70b9 \u03b8 \u2212 \u03c0/2 \u4e0e p^r',
  35: '35 \u00b7 \u7ec8\u70b9 p^\u03b8\uff08\u00b116\uff09',
  36: '36 \u00b7 \u521d\u59cb p^r \u2014 16 \u4f4d',
  37: '37 \u00b7 \u521d\u59cb p^\u03b8 \u2014 16 \u4f4d\uff08\u00b116 \u6ee1\u91cf\u7a0b\uff09',
  38: '38 \u00b7 E \u2014 16 \u4f4d',
  39: '39 \u00b7 L \u2014 16 \u4f4d',
  40: '40 \u00b7 \u89c2\u6d4b\u8005\u5c40\u90e8\u65b9\u5411 nloc = (n_\u03c6, n_\u03b8)\uff0c\u5728\u5c40\u90e8\u6b63\u4ea4\u7cfb\u91cc',
  41: '41 \u00b7 \u7269\u7406\u5c4f\u5e55 EVPA\uff08\u9996\u6b21\u8d64\u9053\u7a7f\u8d8a\uff0c\u6e90 = B\uff09\uff1b\u84dd = \u7a7f\u8d8a\u534a\u5f84 /64',
  42: '42 \u00b7 \u7269\u7406 EVPA \u6709\u6548\u6027 \u2014 \u7eff = \u6709\u8d64\u9053\u7a7f\u8d8a\uff080 = \u7528\u4e0d\u4e0a\uff09',
  43: '43 \u00b7 Gelles +\u03b1\u0302 \u65b9\u5411\uff08\u89c2\u6d4b\u8005\u5c40\u90e8\u6b63\u4ea4\u7cfb\uff09',
  44: '44 \u00b7 Gelles +\u03b2\u0302 \u65b9\u5411\uff08\u540c\u4e00\u7cfb\uff1b\u5e94\u4e0e 43 \u6b63\u4ea4\uff09',
  45: '45 \u00b7 \u7269\u7406 EVPA \u2014 16 \u4f4d\uff0c\u91cf\u5b50 4.8e-5 rad',
  46: '46 \u00b7 \u7a7f\u8d8a\u534a\u5f84 \u2014 16 \u4f4d\uff0c\u91cf\u5b50 1e-3',
  47: '47 \u00b7 \u50cf\u9636 ncross\uff08G = ncross/8\uff09+ rEnd\uff08B = |r|/64\uff09',
  48: '48 \u00b7 Penrose\u2013Walker \u6f02\u79fb \u2014 \u5bf9\u6570\u6807\u5c3a\uff1b\u4e0d\u542b\u57fa\u5e95\u3001\u4e0d\u542b Gram \u77e9\u9635',
  49: '49 \u00b7 \u56fa\u6709\u6e90\u89d2 \u03c7_local \u2014 \u5c40\u90e8\u3001\u672a\u7ecf\u8f93\u8fd0',
  125: '125 \u00b7 rhs \u63a2\u9488 \u2014 \u5c4f\u5e55\u6309 (r, \u03b8) \u6805\u683c\u626b\u63cf shader \u81ea\u5df1\u7684 transport RHS',
  130: '130 \u00b7 \u3010\u70b9\u63a2\u9488\u3011Gram \u76f8\u5173\u91cf\u63a2\u9488\uff08\u975e\u9762\u677f\u89c6\u56fe\uff0c\u4ec5 ?debug=130 \u53ef\u8fbe\uff09',
};

export class HUD {
  constructor(cb) {
    this.cb = cb;
    this.el = {
      boot: document.getElementById('boot'),
      bootFill: document.getElementById('boot-fill'),
      bootStatus: document.getElementById('boot-status'),
      bootLog: document.getElementById('boot-log'),
      fatal: document.getElementById('fatal'),
      fatalMsg: document.getElementById('fatal-msg'),
      hud: document.getElementById('hud'),
      readout: document.getElementById('readout'),
      metrics: document.getElementById('metrics'),
      toolbar: document.getElementById('toolbar'),
      legend: document.getElementById('debug-legend'),
      hints: document.getElementById('hud-hints'),
      toast: document.getElementById('toast'),
      panel: document.getElementById('panel'),
      groups: document.getElementById('param-groups'),
      note: document.getElementById('panel-note'),
      crosshair: document.getElementById('crosshair'),
      fab: document.getElementById('btn-open-panel'),
      paramCount: document.getElementById('param-count'),
    };
    this.rowEls = {};
    this.sliders = {};
    this.logLines = [];
    this.buildReadout();
    this.buildPanel();
    this.buildToolbar();
    this.setLegend(0);
    if (this.el.paramCount) this.el.paramCount.textContent = String(PARAMS.length);

    document.getElementById('btn-close-panel').onclick = () => this.togglePanel(false);
    document.getElementById('btn-open-panel').onclick = () => this.togglePanel(true);
    document.getElementById('btn-reset-params').onclick = () => this.cb.onResetParams && this.cb.onResetParams();
    document.getElementById('btn-copy-params').onclick = () => this.cb.onCopyLink && this.cb.onCopyLink();
    this.log('renderer starting');
  }

  buildReadout() {
    const mk = (container) => {
      for (const [label, id] of ROWS) {
        const k = document.createElement('div'); k.className = 'k'; k.textContent = label;
        const v = document.createElement('div'); v.className = 'v'; v.id = 'ro-' + id; v.textContent = '--';
        container.appendChild(k); container.appendChild(v);
        this.rowEls[id] = v;
      }
    };
    mk(this.el.readout);
  }

  buildPanel() {
    for (const g of GROUPS) {
      const wrap = document.createElement('div'); wrap.className = 'pgroup';
      const h = document.createElement('div'); h.className = 'pgroup-title'; h.textContent = g.title;
      wrap.appendChild(h);
      for (const p of PARAMS) {
        if (p.g !== g.id) continue;
        if (p.type === 'group') {
          const row = document.createElement('div'); row.className = 'prow';
          const head = document.createElement('div'); head.className = 'prow-head';
          const lab = document.createElement('div'); lab.className = 'prow-label'; lab.textContent = p.label;
          lab.appendChild(Object.assign(document.createElement('small'), { textContent: p.sub }));
          head.appendChild(lab); row.appendChild(head);
          const sub = document.createElement('div'); sub.className = 'pgroup-sub';
          for (const c of p.children) sub.appendChild(this.buildSlider(c));
          row.appendChild(sub); wrap.appendChild(row);
        } else if (p.type === 'toggle') {
          const row = document.createElement('div'); row.className = 'prow';
          const t = document.createElement('label'); t.className = 'ptoggle';
          const inp = document.createElement('input'); inp.type = 'checkbox';
          inp.checked = !!p.def;
          const sp = document.createElement('span');
          sp.textContent = p.label + '  ' + p.sub;
          inp.onchange = () => this.cb.onParam(p.id, inp.checked ? 1 : 0);
          t.appendChild(inp); t.appendChild(sp); row.appendChild(t);
          wrap.appendChild(row);
          this.sliders[p.id] = { input: inp, kind: 'toggle', def: p };
        } else {
          wrap.appendChild(this.buildSlider(p));
        }
      }
      this.el.groups.appendChild(wrap);
    }
    if (this.el.note) {
      this.el.note.innerHTML =
        'Camera state is persisted in the bottom-right 4 pixels of BUFFER B; ' +
        'a CPU shadow copy repairs them after a resize or a context loss. ' +
        '&nbsp;Shortcuts: <b>Tab</b> panel, <b>H</b> HUD, <b>0-9</b> debug, <b>F1-F4</b> presets.' +
        '<br><b>Charge Q (L4).</b> The slider explores the Kerr-Newman family -- a spacetime, ' +
        'not a model of an astrophysical hole. A real hole sits in a conducting plasma and is ' +
        'screened: the Wald charge from the ambient field gives |Q|/M ~ 2e-13 for 10 M&#9737; in ' +
        '10<sup>4</sup> G, and the plasma bound is |Q|/M &lt; 9e-19. The slider therefore sits ' +
        'about <b>12 orders of magnitude</b> above anything astrophysical. ' +
        'Requesting a<sup>2</sup>+Q<sup>2</sup> &gt; M<sup>2</sup> (a naked singularity) is ' +
        'clamped back into the black-hole regime and the clamp is reported in the HUD.';
    }
  }

  buildSlider(p) {
    const row = document.createElement('div'); row.className = 'prow';
    const head = document.createElement('div'); head.className = 'prow-head';
    const lab = document.createElement('div'); lab.className = 'prow-label';
    lab.textContent = p.label;
    if (p.sub) lab.appendChild(Object.assign(document.createElement('small'), { textContent: p.sub }));
    const val = document.createElement('div'); val.className = 'prow-val'; val.textContent = p.fmt(p.def);
    head.appendChild(lab); head.appendChild(val); row.appendChild(head);
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = String(p.min); inp.max = String(p.max);
    inp.step = String(p.step); inp.value = String(p.def);
    inp.id = 'sl_' + p.id;
    inp.oninput = () => {
      const v = Number(inp.value);
      val.textContent = p.fmt(v);
      this.cb.onParam(p.id, v);
    };
    row.appendChild(inp);
    /* DIRECT NUMERIC ENTRY (params with num:true).  A slider cannot be landed on an exact
       value -- a = -1 or Q = 0.6 by dragging is luck -- and the extended domain is full of
       exact values worth typing.  Committed on change (Enter or blur), not per keystroke, so
       intermediate text like a lone '-' is never sent through sanitize(). */
    let numInp = null;
    if (p.num) {
      numInp = document.createElement('input');
      numInp.type = 'number'; numInp.className = 'prow-num';
      numInp.id = 'num_' + p.id;
      numInp.min = String(p.min); numInp.max = String(p.max); numInp.step = String(p.step);
      numInp.value = String(p.def);
      numInp.onchange = () => {
        let v = Number(numInp.value);
        if (!Number.isFinite(v)) { numInp.value = String(Number(inp.value)); return; }
        v = Math.min(p.max, Math.max(p.min, v));
        inp.value = String(v);
        val.textContent = p.fmt(v);
        this.cb.onParam(p.id, v);
        numInp.value = String(Number(inp.value));   /* show what sanitize() actually applied */
      };
      head.insertBefore(numInp, val);
    }
    this.sliders[p.id] = { input: inp, num: numInp, val, fmt: p.fmt, kind: 'slider' };
    return row;
  }

  buildToolbar() {
    const mk = (text, title, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (cls || '');
      b.textContent = text; b.title = title || '';
      b.onclick = fn; this.el.toolbar.appendChild(b); return b;
    };
    this.btns = {};
    for (let i = 1; i <= 4; i++) {
      this.btns['preset' + i] = mk('P' + i, 'preset ' + i, '', () => this.cb.onPreset(i - 1));
    }
    this.btns.cine = mk('\u25b6 CINE', 'cinematic loop (C)', '', () => this.cb.onCinematic());
    this.btns.orbit = mk('ORBIT', 'orbit mode', 'on', () => this.cb.onMode('orbit'));
    this.btns.flight = mk('FLY', 'pointer-lock flight (F)', '', () => this.cb.onMode('flight'));
    for (const q of ['standard', 'high', 'cinematic']) {
      this.btns['q_' + q] = mk(q.slice(0, 3).toUpperCase(), 'quality: ' + q, q === 'high' ? 'on' : '', () => this.cb.onQuality(q));
    }
    this.btns.music = mk('\u266b OFF', 'ambient music (M)', '', () => this.cb.onMusic());
    this.btns.shot = mk('PNG', 'screenshot (S)', '', () => this.cb.onScreenshot());
    this.btns.hud = mk('HUD', 'toggle HUD (H)', '', () => this.cb.onToggleHud());
    /* VIEW SELECTOR: the band and special views are codes 11-18, not reachable from the
       number keys (0-9 only) -- and memorising codes is not a user interface. */
    const sel = document.createElement('select');
    sel.id = 'viewSel'; sel.className = 'viewsel';
    for (const v of VIEWS) {
      const o = document.createElement('option');
      o.value = String(v.n); o.textContent = v.n + '  ' + v.label;
      sel.appendChild(o);
    }
    sel.value = '0';
    sel.onchange = () => this.cb.onDebug(Number(sel.value));
    this.el.toolbar.appendChild(sel);
    this.viewSel = sel;
    /* VIEW STEP BUTTONS + the current view name.  A dropdown alone means the view is only
       discoverable if you happen to notice it; the buttons cycle the list (wrapping) and the
       name says where you are. */
    const vPrev = mk('\u25c0 \u89c6\u56fe', 'previous view  (,)', '', () => this.cb.onViewStep(-1));
    const vName = document.createElement('span');
    vName.className = 'viewname'; vName.textContent = '0  成品图 ACES';
    const vNext = mk('\u89c6\u56fe \u25b6', 'next view  (.)', '', () => this.cb.onViewStep(1));
    this.el.toolbar.appendChild(vPrev);
    this.el.toolbar.appendChild(vName);
    this.el.toolbar.appendChild(vNext);
    this.viewName = vName;
  }

  setView(n) {
    if (this.viewSel) this.viewSel.value = String(n);
    if (this.viewName) {
      const v = VIEWS.find((x) => x.n === Number(n));
      this.viewName.textContent = v ? (v.n + '  ' + v.label) : ('VIEW ' + n);
    }
  }

  setActive(which, id) {
    const b = this.btns[which + id];
    if (!b) return;
    if (which === 'q_') { for (const q of ['standard', 'high', 'cinematic']) { const x = this.btns['q_' + q]; if (x) x.classList.toggle('on', q === id); } return; }
    if (which === 'preset') { for (let i = 1; i <= 4; i++) { const x = this.btns['preset' + i]; if (x) x.classList.toggle('on', i === id); } return; }
    b.classList.toggle('on');
  }
  markButtons(mode, level) {
    this.btns.orbit.classList.toggle('on', mode === 'orbit');
    this.btns.flight.classList.toggle('on', mode === 'flight');
    this.btns.cine.classList.toggle('on', mode === 'cinematic');
    for (const q of ['standard', 'high', 'cinematic']) { const x = this.btns['q_' + q]; if (x) x.classList.toggle('on', q === level); }
  }

  syncValues(v) {
    for (const id in this.sliders) {
      const s = this.sliders[id];
      if (s.kind === 'toggle') s.input.checked = !!v[id];
      else {
        s.input.value = String(v[id]);
        s.val.textContent = s.fmt(Number(v[id]));
        if (s.num) s.num.value = String(Number(v[id]));
      }
    }
  }

  setReadout(o) {
    for (const [, id] of ROWS) {
      const el = this.rowEls[id];
      if (!el) continue;
      const val = o[id];
      if (val === undefined) continue;
      const text = typeof val === 'string' ? val : String(val);
      if (el.textContent !== text) el.textContent = text;
      if (o['cls_' + id]) el.className = 'v ' + o['cls_' + id];
    }
  }

  setLegend(n) {
    if (this.el.legend) this.el.legend.innerHTML = '<b>DEBUG</b> ' + (DEBUG_TEXT[n] || '');
  }

  toast(text, ms) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms || 2400);
  }
  log(line) {
    this.logLines.push(line);
    if (this.logLines.length > 8) this.logLines.shift();
    if (this.el.bootLog) this.el.bootLog.textContent = this.logLines.join('\n');
  }
  boot(frac, status) {
    if (this.el.bootFill) this.el.bootFill.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    if (status && this.el.bootStatus) this.el.bootStatus.textContent = status;
  }
  hideBoot() {
    this.el.boot.classList.add('gone');
    setTimeout(() => { this.el.boot.style.display = 'none'; }, 800);
  }
  fatal(msg) {
    this.el.fatal.classList.remove('hidden');
    this.el.fatalMsg.textContent = msg;
  }
  togglePanel(on) {
    const closed = on === undefined ? !this.el.panel.classList.contains('closed') : !on;
    this.el.panel.classList.toggle('closed', closed);
    this.el.fab.classList.toggle('hidden', !closed);
  }
  toggleHud() {
    this.el.hud.classList.toggle('hud-off');
    const off = this.el.hud.classList.contains('hud-off');
    this.el.panel.style.display = off ? 'none' : '';
    this.el.fab.style.display = off ? 'none' : '';
    return !off;
  }
  setCrosshair(v) { this.el.crosshair.classList.toggle('hidden', !v); }
  bootTip(t) { if (this.el.bootStatus) this.el.bootStatus.textContent = t; }
}
