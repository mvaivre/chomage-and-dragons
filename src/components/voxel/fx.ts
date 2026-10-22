export interface VoxelBurst {
  preset: string;
  x: number;
  y: number;
  count?: number;
  colors?: number[];
  delay?: number;
  [key: string]: unknown;
}
export const bursts: VoxelBurst[] = [];
export const fx = {
  burst(value: VoxelBurst) {
    bursts.push(value);
  },
  bolt(value: { x: number; y: number; top?: number }) {
    bursts.push({ ...value, preset: "lightning" });
  },
};
