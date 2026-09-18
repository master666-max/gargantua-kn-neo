/* bloom.frag -- progressive downsample used by BUFFER B, C and D.
   * 13-tap Jimenez filter (stable under camera motion, no fireflies)
   * the first level additionally applies a soft-knee bright extraction
   * the BUFFER B write discards the bottom state row so the persisted camera
     pixels survive untouched (that row is written by state.frag).            */
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2  uSourceTexel;
uniform float uThreshold;
uniform float uKnee;
uniform int   uHasStateRow;
uniform float uStateRowY;
#include "common.glsl"
void main(){
  if (uHasStateRow == 1 && gl_FragCoord.y < uStateRowY) discard;
  vec3 c = downsample13(uSource, vUv, uSourceTexel);
  if (uThreshold > 0.0) c = prefilter(c, uThreshold, uKnee);
  gl_FragColor = vec4(c, 1.0);
}
