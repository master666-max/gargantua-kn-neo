/* ============================================================================
   pipeline.js -- the multi-pass render pipeline.

       state.frag -> BUFFER B bottom-right 4 pixels  (camera persistence)
       bufferA.frag -> BUFFER A                      (geodesic integration, HDR)
       bloom.frag   -> BUFFER B (1/2) -> C (1/4) -> D (1/8)
       image.frag   -> canvas                        (bicubic up-sample, ACES)

   Everything is driven through explicit render-target switches; the renderer
   keeps autoClear=false so the BUFFER B state row survives every frame (the
   bloom pass discards it).  Nothing is ever cleared, every pass covers its
   own texels, so there is no frame-to-frame ghosting either.
   ========================================================================== */
import * as THREE from 'three';

const HALF = THREE.HalfFloatType;

function makeRT(w, h) {
  const rt = new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
    type: HALF,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

const BASE_OPTS = { depthTest: false, depthWrite: false, blending: THREE.NoBlending, transparent: false };

export class Pipeline {
  constructor(renderer, shaders) {
    this.renderer = renderer;
    this.shaders = shaders;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.stateQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), null);
    this.stateQuad.frustumCulled = false;
    this.stateQuad.visible = false;
    this.scene.add(this.stateQuad);

    const V = shaders['fullscreen.vert'];

    this.matA = new THREE.ShaderMaterial({ ...BASE_OPTS, vertexShader: V, fragmentShader: shaders['bufferA.frag'], uniforms: {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: 1.777 },
      uTanHalfFov: { value: Math.tan((60 * Math.PI / 180) / 2) },
      uStateTex: { value: null },
      uStateUV0: { value: new THREE.Vector2(0, 0) },
      uStateUVStep: { value: new THREE.Vector2(0, 0) },
      uBackA: { value: new THREE.Vector4(1, 0.2, 0.3, 1) },
      uBackB: { value: new THREE.Vector4(0, 0, 0, 1) },
      uBackC: { value: new THREE.Vector4(0, 0, 0, 1) },
      uBackD: { value: new THREE.Vector4(1, 0, 1.0, 1) },
    uForceState: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: 1.0 },
      uMaxSteps: { value: 256 },
      uStepScale: { value: 0.28 },
      uTol: { value: 1e-5 },
      uInterior: { value: 0 },
      uDebug: { value: 0 },
      uQuality: { value: 1 },
      uM: { value: 1 }, uA: { value: 0.86 }, uQ: { value: 0 },
    uBCritPro: { value: 0 }, uBCritRet: { value: 0 }, uMarkUnresolved: { value: 1 }, uBModel: { value: 1 }, uTransportEvery: { value: 8 },
      uStarDensity: { value: 0.66 }, uGalaxy: { value: 1.05 },
      uDiskTemp: { value: 13000 }, uDiskThick: { value: 0.075 }, uDiskTurb: { value: 0.85 },
      uDiskGain: { value: 2.4 }, uDiskDoppler: { value: 1 }, uDiskRedshift: { value: 1 },
      uDiskInner: { value: 1.24 }, uDiskOuter: { value: 30 }, uOmegaScale: { value: 1 },
      /* L2: peak of the relativistic dissipation flux and L(r_in); they
         peak-normalise T ~ F^(1/4) so the gain calibration is untouched */
      uFluxPeak: { value: 1 }, uFluxLin: { value: 0 },
    } });

    this.matBloom = new THREE.ShaderMaterial({ ...BASE_OPTS, vertexShader: V, fragmentShader: shaders['bloom.frag'], uniforms: {
      uSource: { value: null },
      uSourceTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
      uThreshold: { value: 0 },
      uKnee: { value: 0.6 },
      uHasStateRow: { value: 0 },
      uStateRowY: { value: 0 },
    } });

    this.matState = new THREE.ShaderMaterial({ ...BASE_OPTS, vertexShader: shaders['state.vert'], fragmentShader: shaders['state.frag'], uniforms: {
      uS0: { value: new THREE.Vector4(20, 1.4, 0, 1) },
      uS1: { value: new THREE.Vector4(0, 0, 0, 0.06) },
      uS2: { value: new THREE.Vector4(0, 0, 0, 1) },
      uS3: { value: new THREE.Vector4(1, 0, 60, 0) },
      uOriginX: { value: 0 },
    } });

    this.matImage = new THREE.ShaderMaterial({ ...BASE_OPTS, vertexShader: V, fragmentShader: shaders['image.frag'], uniforms: {
      tA: { value: null }, tB: { value: null }, tC: { value: null }, tD: { value: null },
      uTexelA: { value: new THREE.Vector2() }, uTexelB: { value: new THREE.Vector2() },
      uTexelC: { value: new THREE.Vector2() }, uTexelD: { value: new THREE.Vector2() },
      uBloomStrength: { value: 0.9 }, uBloomRadius: { value: 1.25 },
      uExposure: { value: 1.15 }, uVignette: { value: 0.55 }, uGrain: { value: 0.22 },
      uAberration: { value: 0.3 }, uTime: { value: 0 }, uDebug: { value: 0 }, uUseD: { value: 1 },
    } });

    this.rtA = this.rtB = this.rtC = this.rtD = null;
    this.size = { cw: 1, ch: 1, aw: 1, ah: 1, bw: 1, bh: 1 };
    this.bloomLevels = 3;
    this._txA = new THREE.Vector2(1, 1);
    this._txB = new THREE.Vector2(1, 1);
    this._txC = new THREE.Vector2(1, 1);
  }

  resize(cssW, cssH, dpr, scale, bloomLevels) {
    const r = this.renderer;
    r.setPixelRatio(dpr);
    r.setSize(cssW, cssH, false);
    const cw = Math.max(2, Math.floor(cssW * dpr));
    const ch = Math.max(2, Math.floor(cssH * dpr));
    const aw = Math.max(8, Math.floor(cw * scale));
    const ah = Math.max(8, Math.floor(ch * scale));
    const bw = Math.max(16, Math.ceil(aw / 2));
    const bh = Math.max(8, Math.ceil(ah / 2)) + 1;   /* +1 = state row */
    const cwid = Math.max(8, Math.ceil(aw / 4));
    const chei = Math.max(8, Math.ceil(ah / 4));
    const dw = Math.max(6, Math.ceil(aw / 8));
    const dh = Math.max(6, Math.ceil(ah / 8));

    [this.rtA, this.rtB, this.rtC, this.rtD].forEach(t => t && t.dispose());
    this.rtA = makeRT(aw, ah);
    this.rtB = makeRT(bw, bh);
    this.rtC = makeRT(cwid, chei);
    this.rtD = makeRT(dw, dh);
    this.bloomLevels = bloomLevels || 3;
    this.size = { cw, ch, aw, ah, bw, bh, cw2: cwid, ch2: chei, dw, dh };

    const uA = this.matA.uniforms;
    uA.uResolution.value.set(aw, ah);
    uA.uAspect.value = aw / ah;
    uA.uStateTex.value = this.rtB.texture;
    uA.uStateUV0.value.set((bw - 3.5) / bw, 0.5 / bh);
    uA.uStateUVStep.value.set(1 / bw, 0);

    const s = this.matState.uniforms;
    s.uOriginX.value = bw - 4;
    /* clip space spans [-1,1] = 2 units across bw texels, so one texel is
       2/bw wide and four of them are 8/bw.  The plane is 1x1 in local space,
       hence scale == the wanted size in NDC coordinates. */
    this.stateQuad.position.set(1 - 4 / bw, 1 / bh - 1, 0);
    this.stateQuad.scale.set(8 / bw, 2 / bh, 1);

    const i = this.matImage.uniforms;
    i.tA.value = this.rtA.texture;
    i.tB.value = this.rtB.texture;
    i.tC.value = this.rtC.texture;
    i.tD.value = this.rtD.texture;
    i.uTexelA.value.set(1 / aw, 1 / ah);
    i.uTexelB.value.set(1 / bw, 1 / bh);
    i.uTexelC.value.set(1 / cwid, 1 / chei);
    i.uTexelD.value.set(1 / dw, 1 / dh);
    i.uUseD.value = this.bloomLevels >= 3 ? 1 : 0;

    const b = this.matBloom.uniforms;
    b.uStateRowY.value = 1.0;
    return this.size;
  }

  /* ---- the frame ---------------------------------------------------------- */
  renderState() {
    const r = this.renderer;
    this.quad.visible = false;
    this.stateQuad.visible = true;
    this.stateQuad.material = this.matState;
    r.setRenderTarget(this.rtB);
    r.render(this.scene, this.cam);
    this.stateQuad.visible = false;
    this.quad.visible = true;
  }
  blit(target, material, sourceTex, texel, hasStateRow) {
    const r = this.renderer;
    const u = material.uniforms;
    if (sourceTex) u.uSource.value = sourceTex;
    if (texel) u.uSourceTexel.value.copy(texel);
    if (u.uHasStateRow) u.uHasStateRow.value = hasStateRow ? 1 : 0;
    this.quad.material = material;
    r.setRenderTarget(target);
    r.render(this.scene, this.cam);
  }
  renderFrame() {
    const r = this.renderer;
    const sz = this.size;
    this.renderState();
    this.blit(this.rtA, this.matA, null, null, false);
    this.matBloom.uniforms.uThreshold.value = 1.05;
    this.matBloom.uniforms.uKnee.value = 0.7;
    this.blit(this.rtB, this.matBloom, this.rtA.texture, this._txA.set(1 / sz.aw, 1 / sz.ah), true);
    this.matBloom.uniforms.uThreshold.value = 0;
    this.blit(this.rtC, this.matBloom, this.rtB.texture, this._txB.set(1 / sz.bw, 1 / sz.bh), false);
    if (this.bloomLevels >= 3) this.blit(this.rtD, this.matBloom, this.rtC.texture, this._txC.set(1 / sz.cw2, 1 / sz.ch2), false);
    this.quad.material = this.matImage;
    r.setRenderTarget(null);
    r.setViewport(0, 0, sz.cw, sz.ch);
    r.render(this.scene, this.cam);
  }

  /* ---- read the persisted camera pixels back (verification / repair) ------ */
  readStateRow() {
    const sz = this.size;
    const buf = new Uint16Array(4 * 4);
    try {
      this.renderer.readRenderTargetPixels(this.rtB, sz.bw - 4, 0, 4, 1, buf);
    } catch (e) {
      return null;
    }
    const out = new Array(16);
    for (let i = 0; i < 16; i++) out[i] = halfToFloat(buf[i]);
    return out;
  }

  dispose() {
    const guard = (o) => { try { o && o.dispose && o.dispose(); } catch (e) { /* context already gone */ } };
    [this.rtA, this.rtB, this.rtC, this.rtD].forEach(guard);
    [this.matA, this.matBloom, this.matState, this.matImage].forEach(guard);
    guard(this.quad.geometry);
    guard(this.stateQuad.geometry);
  }
}

function halfToFloat(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7C00) >> 10;
  const f = h & 0x03FF;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1F) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}
