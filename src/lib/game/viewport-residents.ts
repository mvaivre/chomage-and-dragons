export interface ResidentCandidate {
  id: string; kind: string; left: number; right: number; top: number; bottom: number;
  depth: number; reacting: boolean;
}

/** Hold the same individual until it leaves, including across parallax planes. */
export function chooseViewportResidents(candidates: readonly ResidentCandidate[], previous: ReadonlyMap<string, string>, width: number, top: number, bottom: number): Map<string, string> {
  const winners = new Map<string, ResidentCandidate>();
  for (const candidate of candidates) {
    if (candidate.right <= 0 || candidate.left >= width || candidate.bottom <= top || candidate.top >= bottom) continue;
    const before = winners.get(candidate.kind);
    const priority = (item: ResidentCandidate) => (item.reacting ? 4 : 0) + (previous.get(item.kind) === item.id ? 2 : 0);
    if (!before || priority(candidate) > priority(before) || priority(candidate) === priority(before) && (
      candidate.depth > before.depth || candidate.depth === before.depth && Math.abs((candidate.left + candidate.right) / 2 - width / 2) < Math.abs((before.left + before.right) / 2 - width / 2)
    )) winners.set(candidate.kind, candidate);
  }
  return new Map([...winners].map(([kind, candidate]) => [kind, candidate.id]));
}
