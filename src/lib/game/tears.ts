/** One roadside monument in the lake; source coordinates are 1024 × 1536. */
export const TEARS_MONUMENT_X = 13600;
export const TEARS_BASE_OFFSET = 12;
export const TEAR_STREAMS = [
  {start:[391,281],control:[245,680],end:[351,1353],width:[24,85]},
  {start:[500,267],control:[640,670],end:[535,1353],width:[28,108]},
] as const;
export const TEARS_POOL = {x:473,y:1356,rx:211,ry:21} as const;

/** Water stays attached to the carved outlets and accelerates into the same basin. */
export function tearPoint(index:number,progress:number,seconds=0) {
  const stream=TEAR_STREAMS[index];
  const t=Math.max(0,Math.min(1,progress)),u=1-t;
  const sway=Math.sin(t*Math.PI)*Math.sin(seconds*1.8+t*7+index)*5;
  return {
    x:u*u*stream.start[0]+2*u*t*stream.control[0]+t*t*stream.end[0]+sway,
    y:u*u*stream.start[1]+2*u*t*stream.control[1]+t*t*stream.end[1],
    width:stream.width[0]+(stream.width[1]-stream.width[0])*t,
  };
}
