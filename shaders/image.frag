/* ============================================================================
   image.frag -- final composite ("Image" pass of the reference architecture)
   1. BUFFER A (HDR scene) + bicubic-tent up-sampled BUFFER B, C and D
   2. radial chromatic aberration (3 taps of the composite)
   3. exposure -> ACES filmic tonemap
   4. vignette -> film grain
   Debug routing: 1..5 come straight out of BUFFER A already coloured,
   6..8 show the raw bloom levels, 9 shows linear HDR before the tonemap.
   ========================================================================== */
precision highp float;
varying vec2 vUv;

uniform sampler2D tA;
uniform sampler2D tB;
uniform sampler2D tC;
uniform sampler2D tD;
uniform vec2  uTexelA;
uniform vec2  uTexelB;
uniform vec2  uTexelC;
uniform vec2  uTexelD;
uniform float uBloomStrength;
uniform float uBloomRadius;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;
uniform int   uDebug;
uniform float uUseD;

#include "common.glsl"

vec3 bloomAt(vec2 uv){
  vec3 b = bicubicTent(tB, uv, uTexelB, uBloomRadius)         * 1.00;
  vec3 c = bicubicTent(tC, uv, uTexelC, uBloomRadius * 1.25)  * 1.35;
  vec3 d = bicubicTent(tD, uv, uTexelD, uBloomRadius * 1.60)  * 1.85 * uUseD;
  return (b + c + d) * (uBloomStrength / 3.0);
}

vec3 composite(vec2 uv){
  return texture2D(tA, uv).rgb + bloomAt(uv);
}

void main(){
  vec2 uv = vUv;

  if (uDebug >= 6 && uDebug <= 8){
    vec3 c;
    if (uDebug == 6) c = texture2D(tB, uv).rgb;
    else if (uDebug == 7) c = texture2D(tC, uv).rgb;
    else c = texture2D(tD, uv).rgb;
    c = max(c, vec3(0.0));
    gl_FragColor = vec4(pow(clamp(c * 6.0, 0.0, 1.0), vec3(0.4545)), 1.0);
    return;
  }
  /* 1-5 and 10-18 are diagnostic channels: display them RAW (no tonemap, no bloom) */
  /* raw diagnostic path: 1-5, 10-18, and 23/24 whose VALUES are the assertion readout */
  if ((uDebug >= 1 && uDebug <= 5 || uDebug == 125) || (uDebug >= 10 && uDebug <= 18) || (uDebug >= 23 && uDebug <= 49)){
    gl_FragColor = vec4(clamp(texture2D(tA, uv).rgb, 0.0, 1.0), 1.0);
    return;
  }
  if (uDebug == 9){
    gl_FragColor = vec4(clamp(texture2D(tA, uv).rgb, 0.0, 1.0), 1.0);
    return;
  }

  vec3 col;
  if (uAberration > 0.001){
    vec2 dc = uv - 0.5;
    vec2 off = dc * dot(dc, dc) * uAberration * 0.11;
    col.r = composite(uv + off).r;
    col.g = composite(uv).g;
    col.b = composite(uv - off).b;
  } else {
    col = composite(uv);
  }

  col = max(col, vec3(0.0)) * uExposure;
  col = acesFilm(col);

  vec2 q = uv - 0.5;
  float vig = smoothstep(1.05, 0.18, length(q) * 1.42);
  col *= mix(1.0, vig, uVignette);

  float g = hash12(uv * vec2(1920.0, 1080.0) + fract(uTime) * 137.0) - 0.5;
  col += g * uGrain * 0.055;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}