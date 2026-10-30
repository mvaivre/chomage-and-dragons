import type * as THREE from "three";
import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";

// Patch contrast, half-metre grain, small inclusions, sand/ash striation.
const PROFILES: Record<string, number[]> = {
  plaine: [.20, .22, .14, 0], foret: [.25, .20, .25, 0],
  marais: [.25, .17, .12, 0], lac: [.15, .24, .20, 0],
  cascade: [.20, .22, .18, 0], montagne: [.10, .15, .16, 0],
  desert: [.14, .16, .14, 1], volcan: [.26, .25, .20, .3],
  taverne: [.20, .22, .18, 0],
};
const vector = (values: number[]) => `vec4(${values.map(v => v.toFixed(3)).join(",")})`;
const profiles = BIOMES.map((b, i) => {
  const next = BIOMES[(i + 1) % BIOMES.length];
  return `if(p<${b.to.toFixed(4)}) return mix(${vector(PROFILES[b.id])},${vector(PROFILES[next.id])},smoothstep(${(b.to - 12 / (WORLD_LENGTH / 50)).toFixed(8)},${b.to.toFixed(4)},p));`;
}).join("\n");
export const TERRAIN_GRAIN_GLSL = `
varying float vTerrainSurface;
varying vec3 vTerrainNormal;
uniform float terrainEnabled;
float terrainHash(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
vec4 terrainProfile(float x) {
  float p=x<0.0?0.0:mod(x,${(WORLD_LENGTH / 50).toFixed(4)})/${(WORLD_LENGTH / 50).toFixed(4)};
  ${profiles}
  return ${vector(PROFILES.taverne)};
}
float voxelGroundGrain(vec3 world, vec3 n) {
  vec3 axis=abs(n);
  vec2 p=axis.y>=max(axis.x,axis.z)?world.xz:(axis.z>axis.x?world.xy:world.zy);
  vec4 profile=terrainProfile(world.x);
  float mottling=terrainHash(floor(p*.65));
  float grain=floor(terrainHash(floor(p*2.0))*5.0)/4.0;
  float footprint=max(fwidth(p.x),fwidth(p.y));
  float micro=(step(.86,terrainHash(floor(p*8.0)))-.14)*(1.0-smoothstep(.08,.25,footprint));
  float strata=(floor(sin(p.x*.8+p.y*3.0+mottling)*2.0)/2.0)*profile.w*.05;
  return 1.0+(mottling-.5)*profile.x+(grain-.5)*profile.y+micro*profile.z+strata;
}
`;

/** World coordinates, not mesh UVs: coarse shoulders and fine core share exactly
 * the same grain. Water opts out. No bitmap, sampling loop or additional draw. */
export function addTerrainGrain(material: THREE.MeshStandardMaterial, enabled = true) {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.userData.terrainEnabled = { value: enabled ? 1 : 0 };
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.terrainEnabled = material.userData.terrainEnabled;
    shader.vertexShader = "attribute float terrainSurface; varying float vTerrainSurface; varying vec3 vTerrainNormal;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", "vTerrainSurface=terrainSurface; vTerrainNormal=normalize(mat3(modelMatrix)*normal);\n#include <project_vertex>");
    shader.fragmentShader = TERRAIN_GRAIN_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\nif(terrainEnabled*vTerrainSurface>.5) diffuseColor.rgb*=voxelGroundGrain(vVoxelWorld,vTerrainNormal);");
  };
  material.customProgramCacheKey = () => `${key}:terrain-grain-v1`;
}
