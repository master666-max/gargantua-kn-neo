/* ============================================================================
   common.glsl  --  hashing, value noise, fBm, colour science, filters
   Shared by every pass.  No uniforms are declared here (pass the seed in).
   ========================================================================== */

#ifndef KN_COMMON
#define KN_COMMON

float hash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
vec2 hash23(vec3 p){
  vec3 q = fract(p * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

/* ---- value noise, 3-D and 2-D -------------------------------------------- */
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float vnoise2(vec2 x){
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm3(vec3 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    n += a;
    p *= 2.03;
    p += vec3(11.7, 5.3, 7.9);
    a *= 0.5;
  }
  return s / max(n, 1e-4);
}
float fbm2(vec2 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * vnoise2(p);
    n += a;
    p = p * 2.04 + vec2(13.7, 7.3);
    a *= 0.5;
  }
  return s / max(n, 1e-4);
}
/* ridged variant, good for filamentary disk turbulence */
float ridge2(vec2 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float v = 1.0 - abs(vnoise2(p) * 2.0 - 1.0);
    s += a * v * v;
    n += a;
    p = p * 2.11 + vec2(5.1, 19.3);
    a *= 0.5;
  }
  return s / max(n, 1e-4);
}

/* ---- debug/heat ramps ---------------------------------------------------- */
vec3 heat(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 c = vec3(0.0);
  c = mix(vec3(0.02, 0.02, 0.09), vec3(0.10, 0.28, 0.72), smoothstep(0.00, 0.28, t));
  c = mix(c, vec3(0.10, 0.78, 0.66), smoothstep(0.26, 0.52, t));
  c = mix(c, vec3(0.95, 0.86, 0.20), smoothstep(0.50, 0.74, t));
  c = mix(c, vec3(0.98, 0.36, 0.10), smoothstep(0.72, 0.90, t));
  c = mix(c, vec3(1.00, 0.98, 0.94), smoothstep(0.90, 1.00, t));
  return c;
}
vec3 divergent(float t){
  /* signed error map: blue = negative, black = 0, red = positive */
  t = clamp(t, -1.0, 1.0);
  vec3 neg = vec3(0.15, 0.45, 1.00);
  vec3 pos = vec3(1.00, 0.35, 0.12);
  return t < 0.0 ? neg * (-t) : pos * t;
}

/* ---- colour science ------------------------------------------------------ */
vec3 acesFilm(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

/* Planckian locus approximation (Tanner Helland fit), chroma normalised. */
vec3 blackbodyRGB(float T){
  T = clamp(T, 700.0, 42000.0);
  float t = T * 0.01;
  float r, g, b;
  if (t <= 66.0) r = 255.0;
  else r = 329.698727446 * pow(max(t - 60.0, 1e-3), -0.1332047592);
  if (t <= 66.0) g = 99.4708025861 * log(max(t, 1.0)) - 161.1195681661;
  else g = 288.1221695283 * pow(max(t - 60.0, 1e-3), -0.0755148492);
  if (t >= 66.0) b = 255.0;
  else if (t <= 19.0) b = 0.0;
  else b = 138.5177312231 * log(max(t - 10.0, 1e-3)) - 305.0447927307;
  vec3 c = clamp(vec3(r, g, b) / 255.0, 0.0, 1.0);
  c = pow(c, vec3(0.92));
  return c / max(max(c.r, max(c.g, c.b)), 1e-3);
}

/* ---- filters ------------------------------------------------------------- */
/* 3x3 tent / B-spline bicubic re-construction used for bloom up-sampling. */
vec3 bicubicTent(sampler2D tex, vec2 uv, vec2 texel, float radius){
  vec2 o = texel * radius;
  vec3 c = texture2D(tex, uv).rgb;
  vec3 l = texture2D(tex, uv - vec2(o.x, 0.0)).rgb;
  vec3 r = texture2D(tex, uv + vec2(o.x, 0.0)).rgb;
  vec3 t = texture2D(tex, uv + vec2(0.0, o.y)).rgb;
  vec3 b = texture2D(tex, uv - vec2(0.0, o.y)).rgb;
  vec3 tl = texture2D(tex, uv + vec2(-o.x,  o.y)).rgb;
  vec3 tr = texture2D(tex, uv + vec2( o.x,  o.y)).rgb;
  vec3 bl = texture2D(tex, uv + vec2(-o.x, -o.y)).rgb;
  vec3 br = texture2D(tex, uv + vec2( o.x, -o.y)).rgb;
  return (c * 4.0 + (l + r + t + b) * 2.0 + (tl + tr + bl + br)) / 16.0;
}

/* 13-tap downsample (Jimenez, SIGGRAPH 2014) : stable, no flicker. */
vec3 downsample13(sampler2D tex, vec2 uv, vec2 texel){
  vec2 t = texel;
  vec3 a = texture2D(tex, uv + vec2(-2.0, -2.0) * t).rgb;
  vec3 b = texture2D(tex, uv + vec2( 0.0, -2.0) * t).rgb;
  vec3 c = texture2D(tex, uv + vec2( 2.0, -2.0) * t).rgb;
  vec3 d = texture2D(tex, uv + vec2(-2.0,  0.0) * t).rgb;
  vec3 e = texture2D(tex, uv).rgb;
  vec3 f = texture2D(tex, uv + vec2( 2.0,  0.0) * t).rgb;
  vec3 g = texture2D(tex, uv + vec2(-2.0,  2.0) * t).rgb;
  vec3 h = texture2D(tex, uv + vec2( 0.0,  2.0) * t).rgb;
  vec3 i = texture2D(tex, uv + vec2( 2.0,  2.0) * t).rgb;
  vec3 j = texture2D(tex, uv + vec2(-1.0, -1.0) * t).rgb;
  vec3 k = texture2D(tex, uv + vec2( 1.0, -1.0) * t).rgb;
  vec3 l = texture2D(tex, uv + vec2(-1.0,  1.0) * t).rgb;
  vec3 m = texture2D(tex, uv + vec2( 1.0,  1.0) * t).rgb;
  vec3 o = e * 0.125;
  o += (a + c + g + i) * 0.03125;
  o += (b + d + f + h) * 0.0625;
  o += (j + k + l + m) * 0.125;
  return o;
}

/* soft-knee bright extraction (Unity/CoD style) */
vec3 prefilter(vec3 c, float threshold, float knee){
  if (knee <= 1e-5) return max(c - threshold, 0.0);
  float br = max(max(c.r, c.g), c.b);
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  return c * contrib;
}

#endif
