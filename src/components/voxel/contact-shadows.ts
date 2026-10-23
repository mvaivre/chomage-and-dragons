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
  private matrixFirst = Infinity;
  private matrixLast = 0;
  private shadeFirst = Infinity;
  private shadeLast = 0;
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
    this.matrixFirst = this.shadeFirst = Infinity; this.matrixLast = this.shadeLast = 0;
    this.mesh.visible = enabled;
  }
  add({ x, y, z, rx, rz, opacity = 1 }: ContactPatch) {
    if (!this.mesh.visible || this.used >= this.shades.count) return;
    const offset = this.used * 16, values = this.mesh.instanceMatrix.array;
    if (values[offset] !== Math.fround(rx) || values[offset + 10] !== Math.fround(rz) || values[offset + 12] !== Math.fround(x) || values[offset + 13] !== Math.fround(y) || values[offset + 14] !== Math.fround(z)) {
      this.matrix.makeScale(rx, 1, rz).setPosition(x, y, z);
      this.mesh.setMatrixAt(this.used, this.matrix);
      this.matrixFirst = Math.min(this.matrixFirst, offset); this.matrixLast = offset + 16;
    }
    if (this.shades.getX(this.used) !== Math.fround(opacity)) {
      this.shades.setX(this.used, opacity);
      this.shadeFirst = Math.min(this.shadeFirst, this.used); this.shadeLast = this.used + 1;
    }
    this.used++;
  }
  finish() {
    this.mesh.count = this.used;
    if (this.matrixLast) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(this.matrixFirst, this.matrixLast - this.matrixFirst);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.shadeLast) {
      this.shades.clearUpdateRanges();
      this.shades.addUpdateRange(this.shadeFirst, this.shadeLast - this.shadeFirst);
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
