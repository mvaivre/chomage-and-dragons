import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function miniatureDefocus(depth: number, focus: number) { return smooth((Math.abs(depth - focus) - 2.8) / 8.2); }
const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const depthFunctions = `
 uniform sampler2D tDepth;
 uniform float nearPlane, farPlane, focusDepth;
 varying vec2 vUv;
 float blurAt(vec2 uv){float depth=mix(nearPlane,farPlane,texture2D(tDepth,uv).x);return smoothstep(2.8,11.0,abs(depth-focusDepth));}
`;
/** Depth-based miniature focus. Two half-resolution filters and one full-resolution
 * composite; the sharp source and depth are read-only throughout. Desktop only. */
export class MiniaturePass extends Pass {
  readonly blurSize = new THREE.Vector2(1, 1);
  private a = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private b = this.a.clone();
  private filter = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader,
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, direction: { value: new THREE.Vector2() }, nearPlane: { value: .1 }, farPlane: { value: 170 }, focusDepth: { value: 38 } },
    fragmentShader: depthFunctions + `
    uniform sampler2D tDiffuse; uniform vec2 direction;
    void main(){
      float coc=blurAt(vUv);vec3 sum=texture2D(tDiffuse,vUv).rgb;float total=1.0;
      for(int i=1;i<=4;i++){
        float f=float(i),weight=exp(-f*f/8.0);
        for(int side=-1;side<=1;side+=2){
          vec2 uv=clamp(vUv+direction*f*float(side)*coc,vec2(.001),vec2(.999));
          float w=weight*mix(1.0,smoothstep(.02,.2,blurAt(uv)),smoothstep(.02,.2,coc));
          sum+=texture2D(tDiffuse,uv).rgb*w;total+=w;
        }
      }
      gl_FragColor=vec4(sum/total,1.0);
    }`,
  });
  private composite = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader,
    uniforms: { tDiffuse: { value: null }, tBlur: { value: null }, tDepth: { value: null }, nearPlane: { value: .1 }, farPlane: { value: 170 }, focusDepth: { value: 38 } },
    fragmentShader: depthFunctions + `uniform sampler2D tDiffuse,tBlur;void main(){vec4 sharp=texture2D(tDiffuse,vUv);gl_FragColor=vec4(mix(sharp.rgb,texture2D(tBlur,vUv).rgb,blurAt(vUv)),sharp.a);}`,
  });
  private quad = new FullScreenQuad(this.filter);
  setFocus(depth: number, near: number, far: number) {
    for (const material of [this.filter, this.composite]) { material.uniforms.focusDepth.value = depth; material.uniforms.nearPlane.value = near; material.uniforms.farPlane.value = far; }
  }
  setSize(width: number, height: number) {
    this.blurSize.set(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
    this.a.setSize(this.blurSize.x, this.blurSize.y); this.b.setSize(this.blurSize.x, this.blurSize.y);
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    this.filter.uniforms.tDepth.value = read.depthTexture; this.composite.uniforms.tDepth.value = read.depthTexture;
    this.quad.material = this.filter;
    this.filter.uniforms.tDiffuse.value = read.texture;
    this.filter.uniforms.direction.value.set(2 / this.blurSize.x, 0);
    renderer.setRenderTarget(this.a); this.quad.render(renderer);
    this.filter.uniforms.tDiffuse.value = this.a.texture;
    this.filter.uniforms.direction.value.set(0, 2 / this.blurSize.y);
    renderer.setRenderTarget(this.b); this.quad.render(renderer);
    this.composite.uniforms.tDiffuse.value = read.texture; this.composite.uniforms.tBlur.value = this.b.texture;
    this.quad.material = this.composite;
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer);
  }
  dispose() { this.a.dispose(); this.b.dispose(); this.filter.dispose(); this.composite.dispose(); this.quad.dispose(); }
}
