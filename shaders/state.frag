/* state.frag -- writes the camera state into BUFFER B's bottom-right pixels.
   Rendered with a scissored 4x1 viewport, so exactly four texels are touched.
   Layout (RGBA16F, negatives preserved):
     px0 = (signed r, theta, phi, universe side)      r<0  => antiverse
     px1 = (v_r, v_th, v_ph, |v|)                     ZAMO local-frame velocity
     px2 = (quat.x, quat.y, quat.z, quat.w)           orientation
     px3 = (validFlag, simTime, fov, flags)           1.0 marks a live state
   bufferA.frag reads these pixels back as the authoritative camera for the
   frame; the CPU shadow copy (uBackA..D) only repairs them when they fail the
   finite/plausibility test after a render-target recreation. */
precision highp float;
uniform vec4 uS0;
uniform vec4 uS1;
uniform vec4 uS2;
uniform vec4 uS3;
uniform float uOriginX;
void main(){
  /* gl_FragCoord.x for pixel k is k + 0.5, so subtracting the integer index of
     the first state pixel gives exactly 0,1,2,3 for the four texels. */
  float idx = floor(gl_FragCoord.x - uOriginX);
  vec4 o = uS0;
  if (idx > 0.5) o = uS1;
  if (idx > 1.5) o = uS2;
  if (idx > 2.5) o = uS3;
  gl_FragColor = o;
}
