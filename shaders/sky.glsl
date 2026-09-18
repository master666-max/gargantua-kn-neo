/* ============================================================================
   sky.glsl -- procedural celestial sphere, sampled ONLY through the lensed
   escape direction of the integrated geodesic (no static background texture,
   therefore every star is gravitationally displaced).
   r > 0 escape  -> starfield + Milky-Way band        (our universe)
   r < 0 escape  -> Matrix digital rain (antiverse)   (homage to the original)
   ========================================================================== */

#ifndef KN_SKY
#define KN_SKY

uniform float uStarDensity;
uniform float uGalaxy;

/* one layer of point stars on the sphere of directions */
float starLayer(vec3 d, float scale, float thresh, float seed){
  vec3 p = d * scale + vec3(seed * 13.17, seed * 7.31, seed * 3.77);
  vec3 cell = floor(p);
  vec3 f = p - cell - 0.5;
  vec3 rnd = hash33(cell + seed * 5.0);
  vec3 pos = (rnd - 0.5) * 0.62;
  float d2 = dot(f - pos, f - pos);
  float mag = hash13(cell * 1.73 + seed * 2.9);
  float ok = step(thresh, mag);
  /* The PSF must be expressed in ANGLE, not in lattice units.  The old fixed
     exp(-d2*300) gave a core radius of 0.058 lattice cells, i.e. 0.9 px at
     scale 42 but only 0.4 px and 0.2 px at scales 96 and 191 -- sub-pixel for
     two of the three layers.  A ~30k-star field then collapsed to a handful of
     specks, because a sub-pixel Gaussian is missed by almost every ray (measured
     first-hand: 5 specks in a 400x300 sky patch, no Milky Way band).  Anchor the
     core at STAR_PSF_RAD radians so every layer resolves to >= ~1.5 px at the
     62 deg vertical fov / 720 px output. */
  /* 1.6 mrad ~ 1.1 px at 720p.  Kept deliberately close to one pixel: a larger
     core makes every star a resolvable blob, and the post chromatic aberration
     then splits each one into a coloured streak (seen first-hand at 2.1 mrad).
     The gain is likewise kept low so a bright sub-pixel core cannot fringe. */
  const float STAR_PSF_RAD = 0.0016;
  float K = 1.0 / (STAR_PSF_RAD * STAR_PSF_RAD * scale * scale);
  float b = exp(-d2 * K);
  return ok * b * pow(mag, 5.0) * 3.2;
}

vec3 knStars(vec3 d, float density, float seed){
  if (density <= 0.001) return vec3(0.0);
  float th1 = mix(0.9985, 0.86, density);
  float th2 = mix(0.9995, 0.93, density);
  float th3 = mix(0.9998, 0.97, density);
  float s1 = starLayer(d, 42.0,  th1, seed + 1.0);
  float s2 = starLayer(d, 96.0,  th2, seed + 17.0);
  float s3 = starLayer(d, 191.0, th3, seed + 41.0);
  vec3 col = vec3(0.0);
  /* stellar colour classes from the cell hashes */
  float c1 = hash13(floor(d * 42.0 + seed) * 3.1);
  vec3 t1 = mix(vec3(1.00, 0.72, 0.45), vec3(0.72, 0.84, 1.00), c1);
  float c2 = hash13(floor(d * 96.0 + seed) * 5.7);
  vec3 t2 = mix(vec3(1.00, 0.80, 0.58), vec3(0.80, 0.90, 1.00), c2);
  float c3 = hash13(floor(d * 191.0 + seed) * 7.3);
  vec3 t3 = mix(vec3(1.00, 0.86, 0.70), vec3(0.86, 0.94, 1.00), c3);
  col += t1 * s1 * 1.05 + t2 * s2 * 0.72 + t3 * s3 * 0.42;
  /* faint unresolved star haze so the sky never looks empty */
  float haze = fbm3(d * 21.0 + seed, 3);
  col += vec3(0.30, 0.36, 0.52) * pow(haze, 7.0) * 0.55 * density;
  return col;
}

vec3 knGalaxy(vec3 d, float inten, float seed){
  if (inten <= 0.001) return vec3(0.0);
  vec3 pole = normalize(vec3(0.42, 0.78, -0.46));
  float b = dot(d, pole);
  float band = exp(-b * b * 26.0);
  float wide = exp(-b * b * 5.0);
  float cl1 = fbm3(d * 3.4 + seed * 11.0, 5);
  float cl2 = fbm3(d * 9.1 - seed * 4.0, 4);
  float dust = fbm3(d * 5.7 + seed, 4);
  vec3 core = normalize(vec3(-0.86, 0.12, 0.49));
  float bulge = exp(-pow(max(length(d - core), 0.0) * 2.9, 2.0));
  vec3 cCloud = mix(vec3(0.30, 0.42, 0.86), vec3(1.00, 0.84, 0.62), cl1);
  float dens = band * (0.24 + 1.35 * cl1) + wide * 0.10 * cl2;
  dens *= mix(1.0, 0.28, smoothstep(0.42, 0.78, dust));
  vec3 col = cCloud * dens;
  col += vec3(1.00, 0.90, 0.74) * bulge * 0.85;
  return col * inten * 0.52;
}

/* antiverse: green digital rain on the celestial sphere of the r < 0 sheet */
vec3 knMatrix(vec3 d, float t){
  float u = atan(d.z, d.x) * 0.15915494 + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) * 0.31830989;
  float cols = 118.0;
  float ci = floor(u * cols);
  float rnd = hash11(ci * 0.7311);
  float speed = 0.22 + rnd * 1.15;
  float head = fract(v * 2.6 - t * speed + rnd * 7.0);
  float glyph = hash11(ci * 13.7 + floor(v * 220.0) * 0.031);
  float glow  = exp(-head * 8.0);
  float trail = exp(-head * 1.45) * 0.20;
  float ch = 0.35 + 0.65 * step(0.42, glyph);
  float lum = (glow * 1.35 + trail) * ch;
  vec3 col = vec3(0.10, 1.00, 0.34) * lum;
  col += vec3(0.00, 0.055, 0.022) * (0.6 + 0.8 * fbm3(d * 8.0, 3));
  float scan = 0.86 + 0.14 * sin(v * 900.0);
  return col * scan * 0.62;
}

vec3 skyShade(vec3 d, float side, float density, float galaxy, float t, float seed){
  vec3 col = vec3(0.0);
  if (side < 0.0) col = knMatrix(d, t);
  else            col = knStars(d, density, seed) + knGalaxy(d, galaxy, seed);
  return col;
}

#endif
