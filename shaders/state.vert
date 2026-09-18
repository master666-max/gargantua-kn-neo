/* state.vert -- plain transformed quad: this one is rasterised into exactly
   four destination texels, so it must honour the model matrix (the fullscreen
   triangle deliberately does not). */
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
