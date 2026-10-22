import * as THREE from "three";

const smooth = (a: number, b: number, n: number) => { const t = Math.max(0, Math.min(1, (n - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Four small, feathered windows in the existing opaque pass. No transparent sorting,
 * render target, scene copy, texture, per-object raycasting or camera-side deletion. */
export class OcclusionWindow {
  readonly windows = Array.from({ length: 4 }, () => new THREE.Vector4());
  readonly floors = new THREE.Vector4();
  readonly active = { value: 0 };
  readonly enabled = { value: 1 };
  private width = 1;
  private height = 1;
  private point = new THREE.Vector3();
  private top = new THREE.Vector3();
  get count() { return this.active.value; }
  begin(width: number, height: number) { this.width = width; this.height = height; this.active.value = 0; }
  add(camera: THREE.Camera, center: THREE.Vector3, height: number, floor: number) {
    if (this.count === 4) return;
    const depth = -this.point.copy(center).applyMatrix4(camera.matrixWorldInverse).z;
    this.point.copy(center).project(camera);
    if (depth <= 0 || Math.abs(this.point.x) > 1.4 || Math.abs(this.point.y) > 1.4) return;
    this.top.copy(center); this.top.y += height * 0.85; this.top.project(camera);
    const radius = Math.max(this.height * 0.035, Math.abs(this.top.y - this.point.y) * this.height * 0.5);
    this.windows[this.count].set((this.point.x + 1) * this.width * 0.5, (this.point.y + 1) * this.height * 0.5, depth, radius);
    this.floors.setComponent(this.count, floor); this.active.value++;
  }
  coverage(x: number, y: number, depth: number, worldY: number) {
    let result = 0;
    for (let i = 0; i < this.count; i++) {
      const w = this.windows[i];
      const radial = 1 - smooth(0.65, 1, Math.hypot(x - w.x, y - w.y) / w.w);
      result = Math.max(result, radial * smooth(0.15, 0.8, w.z - depth) * smooth(0.12, 0.4, worldY - this.floors.getComponent(i)));
    }
    return result * this.enabled.value;
  }
}

export const OCCLUSION_DECLARATIONS = `
uniform vec4 voxelWindows[4];
uniform vec4 voxelCutFloors;
uniform int voxelCutCount;
uniform float voxelCutEnabled;
varying float vVoxelViewDepth;
float voxelBayer2(vec2 p) { p=mod(p,2.0); return 2.0*p.x+3.0*p.y-4.0*p.x*p.y; }
`;
export const OCCLUSION_FRAGMENT = `
float voxelCut=0.0;
for(int i=0;i<4;i++) {
  if(i>=voxelCutCount) break;
  vec4 win=voxelWindows[i];
  float radial=1.0-smoothstep(0.65,1.0,length(gl_FragCoord.xy-win.xy)/max(1.0,win.w));
  float ahead=smoothstep(0.15,0.8,win.z-vVoxelViewDepth);
  float aboveFloor=smoothstep(0.12,0.4,vVoxelWorld.y-voxelCutFloors[i]);
  voxelCut=max(voxelCut,radial*ahead*aboveFloor);
}
if(voxelCut*voxelCutEnabled>0.0) {
  vec2 px=floor(gl_FragCoord.xy);
  float threshold=(4.0*voxelBayer2(px)+voxelBayer2(floor(px/2.0))+0.5)/16.0;
  if(voxelCut*voxelCutEnabled>threshold) discard;
}
`;
