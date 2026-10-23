import * as THREE from "three";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { CopyShader } from "three/addons/shaders/CopyShader.js";
import { MiniaturePass } from "./miniature";

/** HDR color and packed depth/stencil must support the same sample count. */
export function sceneSamples(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (!gl.getInternalformatParameter) return 0;
  const color: Int32Array = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
  const depth: Int32Array = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, gl.SAMPLES);
  return Math.max(0, ...Array.from(color).filter(n => n >= 2 && n <= 4 && depth.includes(n)));
}

/** Only the scene uses MSAA. Resolve its color and depth before focus; subsequent
 * full-screen effects stay single-sampled and never smooth the focused image. */
export class ScenePass extends Pass {
  readonly target: THREE.WebGLRenderTarget;
  private scene: RenderPass;
  private miniature: MiniaturePass;
  private copy = new ShaderPass(CopyShader);
  constructor(scene: THREE.Scene, camera: THREE.Camera, miniature: MiniaturePass, samples: number) {
    super();
    this.miniature = miniature;
    const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type);
    depth.format = THREE.DepthStencilFormat;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, samples, stencilBuffer: true, depthTexture: depth,
      resolveDepthBuffer: true, resolveStencilBuffer: false,
    });
    this.target.texture.name = "VoxelScene.msaa";
    this.scene = new RenderPass(scene, camera);
    this.copy.material.depthTest = false;
    this.copy.material.depthWrite = false;
    this.copy.material.blending = THREE.NoBlending;
  }
  setSize(width: number, height: number) {
    this.target.setSize(width, height);
    this.miniature.setSize(width, height);
  }
  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget) {
    this.scene.render(renderer, write, this.target, 0, false);
    if (this.miniature.enabled) {
      this.miniature.renderToScreen = this.renderToScreen;
      this.miniature.render(renderer, write, this.target);
    } else {
      this.copy.renderToScreen = this.renderToScreen;
      this.copy.render(renderer, write, this.target, 0, false);
    }
  }
  dispose() {
    this.target.dispose(); this.miniature.dispose(); this.copy.dispose();
  }
}
