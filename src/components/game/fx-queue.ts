import type { BurstRequest, BoltRequest } from "./fx";
export const fxQueue = { bursts: [] as BurstRequest[], bolts: [] as BoltRequest[] };
let sink: ((value: BurstRequest) => void) | null = null;
export function setEffectSink(value: typeof sink) { sink = value; fxQueue.bursts.length = 0; fxQueue.bolts.length = 0; }
export const fx = {
  burst(request: BurstRequest) { if (sink) sink(request); else fxQueue.bursts.push(request); },
  bolt(request: BoltRequest) { if (!sink) fxQueue.bolts.push(request); },
};
