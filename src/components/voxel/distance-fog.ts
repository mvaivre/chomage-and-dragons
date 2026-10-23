export const FOG_NEAR = 18;
export const FOG_FAR = 31;

/** Broad, world-anchored falloff: no straight cutoff, moving noise or extra pass.
 * The modulation vanishes at both ends so streamed edges remain fully hidden. */
export const DISTANCE_FOG_GLSL = `
float voxelDistanceFog(vec2 position) {
  float t=clamp((length(position-voxelFocus)-${FOG_NEAR.toFixed(1)})/${(FOG_FAR - FOG_NEAR).toFixed(1)},0.0,1.0);
  float drift=0.55*sin(position.x*0.19+sin(position.y*0.11))+0.45*sin(position.y*0.27-position.x*0.08);
  t+=0.36*drift*t*(1.0-t);
  return t*t*(3.0-2.0*t);
}
`;
