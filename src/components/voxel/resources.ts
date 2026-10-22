import * as THREE from "three";
import { FOG_NEAR, FOG_FAR } from "./world";
import { OcclusionWindow, OCCLUSION_DECLARATIONS, OCCLUSION_FRAGMENT } from "./occlusion";

/** GPU resources shared across chunks, characters, portraits and interactive arenas. */
export class VoxelResources {
  readonly focus = new THREE.Vector2();
  readonly fogColor = new THREE.Color(0x536f71);
  readonly cutout = new OcclusionWindow();
  private fog: boolean;
  readonly terrainStripWidth: number;
  constructor(fog = false, terrainStripWidth = 0) {
    this.fog = fog;
    this.terrainStripWidth = terrainStripWidth;
  }
  readonly cube = new THREE.BoxGeometry(1, 1, 1);
  readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  readonly geometries = new Set<THREE.BufferGeometry>([this.cube]);
  readonly instances = new Set<THREE.InstancedMesh>();
  readonly lights = new Set<THREE.PointLight>();
  readonly ownedMaterials = new Set<THREE.Material>();
  readonly silhouette = new THREE.MeshBasicMaterial({
    color: 0xf2d18a,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  material = (color: THREE.ColorRepresentation, glow = false) => {
    const key = `${new THREE.Color(color).getHexString()}:${glow}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        flatShading: true,
        ...(glow ? { emissive: color, emissiveIntensity: 2.2 } : {}),
      });
      if (this.fog) this.addFog(mat);
      this.materials.set(key, mat);
    }
    return mat;
  };
  addFog(mat: THREE.MeshStandardMaterial, occluder = false) {
    mat.userData.voxelOccluder = occluder;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.voxelFocus = { value: this.focus };
      shader.uniforms.voxelFog = { value: this.fogColor };
      shader.vertexShader = "varying vec3 vVoxelWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `vec4 voxelPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nvoxelPosition=instanceMatrix*voxelPosition;\n#endif\nvVoxelWorld=(modelMatrix*voxelPosition).xyz;\n#include <project_vertex>`,
      );
      shader.fragmentShader =
        "uniform vec2 voxelFocus; uniform vec3 voxelFog; varying vec3 vVoxelWorld;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>\nfloat vf=smoothstep(${FOG_NEAR.toFixed(1)},${FOG_FAR.toFixed(1)},length(vVoxelWorld.xz-voxelFocus)); gl_FragColor.rgb=mix(gl_FragColor.rgb,voxelFog,vf);`,
      );
      if (occluder) {
        shader.uniforms.voxelWindows = { value: this.cutout.windows };
        shader.uniforms.voxelCutFloors = { value: this.cutout.floors };
        shader.uniforms.voxelCutCount = this.cutout.active;
        shader.uniforms.voxelCutEnabled = this.cutout.enabled;
        shader.vertexShader = "varying float vVoxelViewDepth;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\nvVoxelViewDepth=-mvPosition.z;");
        shader.fragmentShader = OCCLUSION_DECLARATIONS + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n" + OCCLUSION_FRAGMENT);
      }
    };
    mat.customProgramCacheKey = () => `voxel-radial-fog-v2:${occluder}`;
  }
  geometry = <T extends THREE.BufferGeometry>(value: T): T => {
    this.geometries.add(value);
    return value;
  };
  /** A color attribute keeps every shade in one draw, including biome blends. */
  private batchMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private batchMaterial(glow: boolean, foliage: boolean, occluder: boolean) {
    const key = `${glow}:${foliage}:${occluder}`;
    let mat = this.batchMaterials.get(key);
    if (!mat) {
      mat = this.material(0xffffff, glow).clone();
      const fog = this.fog;
      if (fog) this.addFog(mat, occluder);
      const compile = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        compile.call(mat!, shader, renderer);
        // Close UI dioramas use leaf colour patches without the world's fog.
        if (foliage && !fog) {
          shader.vertexShader = "varying vec3 vVoxelWorld;\n" + shader.vertexShader;
          shader.fragmentShader = "varying vec3 vVoxelWorld;\n" + shader.fragmentShader;
          shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>",
            `vec4 leafPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nleafPosition=instanceMatrix*leafPosition;\n#endif\nvVoxelWorld=(modelMatrix*leafPosition).xyz;\n#include <project_vertex>`);
        }
        if (foliage)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            vec3 leafCell = floor(vVoxelWorld * 4.5);
            float leafShade = floor(fract(dot(leafCell, vec3(0.1031, 0.3137, 0.1713))) * 5.0) / 4.0;
            diffuseColor.rgb *= 0.79 + leafShade * 0.43;`,
          );
        if (glow)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.xyz;\n#endif",
          );
      };
      mat.customProgramCacheKey = () => `voxel-batch-v5:${fog}:${glow}:${foliage}:${occluder}`;
      this.batchMaterials.set(key, mat);
    }
    return mat;
  }
  pointLight(color: THREE.ColorRepresentation, power: number, distance: number, decay = 2) {
    const light = new THREE.PointLight(color, power, distance, decay);
    // Sources are sampled into a fixed light pool by the world renderer. A changing
    // source count must never change the shader's NUM_POINT_LIGHTS and recompile it.
    light.visible = false;
    this.lights.add(light);
    return light;
  }
  batch(root: THREE.Object3D, foliage = false, stripWidth = 0, occluder = false) {
    const batches = new Map<string, { glow: boolean; matrices: THREE.Matrix4[]; colors: THREE.Color[] }>();
    const object = new THREE.Object3D();
    const box = (
      color: THREE.ColorRepresentation,
      x: number, y: number, z: number,
      w: number, h = w, d = w, rz = 0, glow = false,
    ) => {
      const key = `${glow}:${stripWidth ? Math.floor(x / stripWidth) : 0}`;
      const bucket = batches.get(key) ?? { glow, matrices: [], colors: [] };
      object.position.set(x, y, z);
      object.scale.set(w, h, d);
      object.rotation.set(0, 0, rz);
      object.updateMatrix();
      bucket.matrices.push(object.matrix.clone());
      bucket.colors.push(new THREE.Color(color));
      batches.set(key, bucket);
    };
    const finish = () => {
      for (const { glow, matrices, colors } of batches.values()) {
        const mesh = new THREE.InstancedMesh(this.cube, this.batchMaterial(glow, foliage, occluder), matrices.length);
        matrices.forEach((m, i) => {
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, colors[i]);
        });
        mesh.computeBoundingSphere();
        mesh.castShadow = !glow;
        mesh.receiveShadow = !glow;
        root.add(mesh);
        this.instances.add(mesh);
      }
      return root;
    };
    return { box, finish };
  }
  release(root: THREE.Object3D) {
    root.traverse((object) => {
      object.userData.disposeTexture?.();
      if (object instanceof THREE.PointLight) this.lights.delete(object);
      const ownedGeometry = object.userData.ownedGeometry as
        THREE.BufferGeometry | undefined;
      if (ownedGeometry) {
        ownedGeometry.dispose();
        this.geometries.delete(ownedGeometry);
      }
      const owned = object.userData.ownedMaterial as THREE.Material | undefined;
      if (owned) {
        owned.dispose();
        this.ownedMaterials.delete(owned);
      }
      if (object instanceof THREE.InstancedMesh) {
        object.dispose();
        this.instances.delete(object);
      }
    });
    root.removeFromParent();
  }
  dispose() {
    for (const mat of this.ownedMaterials) mat.dispose();
    this.ownedMaterials.clear();
    for (const mesh of this.instances) mesh.dispose();
    this.instances.clear();
    for (const mat of this.materials.values()) mat.dispose();
    for (const mat of this.batchMaterials.values()) mat.dispose();
    this.batchMaterials.clear();
    this.lights.clear();
    for (const geo of this.geometries) geo.dispose();
    this.silhouette.dispose();
  }
}
