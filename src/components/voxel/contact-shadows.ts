import * as THREE from "three";
import { FOG_NEAR, FOG_FAR } from "./world";

export interface ContactPatch {
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  opacity?: number;
}

/** One unlit, instanced ground pass; no shadow maps, textures or extra scene render.
 * Static footprints are baked into chunk/prop data. Moving feet reuse the same batch. */
export class ContactShadows {
  readonly mesh: THREE.InstancedMesh;
  private geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  private shades: THREE.InstancedBufferAttribute;
  private material: THREE.ShaderMaterial;
  private matrix = new THREE.Matrix4();
  private used = 0;
  constructor(world: THREE.Scene, focus: THREE.Vector2, capacity = 256) {
    this.shades = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.geometry.setAttribute("contactOpacity", this.shades);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      uniforms: { focus: { value: focus } },
      vertexShader: `
        attribute float contactOpacity;
        varying vec2 patchUv;
        varying vec2 patchWorld;
        varying float patchOpacity;
        void main() {
          patchUv = uv;
          patchOpacity = contactOpacity;
          vec4 point = modelMatrix * instanceMatrix * vec4(position, 1.0);
          patchWorld = point.xz;
          gl_Position = projectionMatrix * viewMatrix * point;
        }`,
      fragmentShader: `
        uniform vec2 focus;
        varying vec2 patchUv;
        varying vec2 patchWorld;
        varying float patchOpacity;
        void main() {
          float edge = 1.0 - smoothstep(0.12, 0.5, length(patchUv - 0.5));
          float fog = 1.0 - smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, length(patchWorld - focus));
          gl_FragColor = vec4(0.055, 0.06, 0.045, edge * patchOpacity * fog * 0.28);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.name = "mobile-contact-shadows";
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shades.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    world.add(this.mesh);
  }
  begin(enabled: boolean) {
    this.used = 0;
    this.mesh.visible = enabled;
  }
  add({ x, y, z, rx, rz, opacity = 1 }: ContactPatch) {
    if (!this.mesh.visible || this.used >= this.shades.count) return;
    this.matrix.makeScale(rx, 1, rz).setPosition(x, y, z);
    this.mesh.setMatrixAt(this.used, this.matrix);
    this.shades.setX(this.used++, opacity);
  }
  finish() {
    this.mesh.count = this.used;
    if (this.used) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.shades.needsUpdate = true;
    }
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
