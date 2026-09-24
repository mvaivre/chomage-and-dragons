"use client";

import { useMemo } from "react";
import type { PlayerView } from "@/hooks/useGame";
import type { GameEvent, MiniGameAttempt } from "@/lib/data/types";
import { RARITY_LABELS, VARIANTS, variantFor } from "@/lib/game/variants";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS, personalBest } from "@/lib/game/scores";
import { TALES, taleFor } from "@/lib/game/tales";
import { BIOMES, biomeAt, worldXFor } from "@/lib/game/world";
import { racePosition } from "@/lib/game/progress";
import { journeyProgress } from "@/lib/game/scoring";
import type { MiniGameKind } from "@/lib/data/types";

/**
 * The collection of one player: which stagings they have seen, which tales they
 * have lived, which lands they have crossed, and their best scores. Everything
 * is recomputed from the journal: nothing to store, nothing to lose.
 */
export function Album({ me, events, miniGames }: { me: PlayerView; events: GameEvent[]; miniGames: MiniGameAttempt[] }) {
  const mine = useMemo(() => events.filter((e) => e.playerId === me.id), [events, me.id]);
  const seen = useMemo(() => new Set(mine.map((e) => variantFor(e.id, e.kind).id)), [mine]);
  const tales = useMemo(() => new Set(mine.map((e) => taleFor(e)?.id).filter(Boolean)), [mine]);
  const lands = useMemo(() => {
    // Every land the journey has crossed, replaying the journal step by step.
    const reached = new Set<string>();
    for (let i = 0; i < mine.length; i++) {
      const { steps } = journeyProgress(mine.slice(0, i + 1));
      reached.add(biomeAt(worldXFor(racePosition(steps))).id);
    }
    reached.add(biomeAt(worldXFor(me.position)).id);
    return reached;
  }, [mine, me.position]);
  const all = Object.values(VARIANTS).flat();
  return <section className="album" aria-labelledby="album-title">
    <h3 id="album-title">Ton album</h3>
    <p className="album__summary">{seen.size} mises en scène sur {all.length} · {tales.size} récits sur {TALES.length} · {lands.size} contrées sur {BIOMES.length}</p>
    <div className="album__grid">
      {Object.entries(VARIANTS).map(([action, variants]) => <div key={action} className="album__column">
        {variants.map((variant) => <span key={variant.id} className="album__card" data-seen={seen.has(variant.id)} data-rarity={variant.rarity} title={RARITY_LABELS[variant.rarity]}>
          {seen.has(variant.id) ? variant.name : "???"}
        </span>)}
      </div>)}
    </div>
    <div className="album__lands">
      {BIOMES.map((biome) => <span key={biome.id} data-seen={lands.has(biome.id)}>{lands.has(biome.id) ? biome.short : "…"}</span>)}
    </div>
    <div className="album__bests">
      {(Object.keys(MINI_GAMES) as MiniGameKind[]).map((kind) => {
        const best = personalBest(miniGames, kind, me.id);
        return <span key={kind}>{MINI_GAMES[kind].title} · <b>{best === null ? "—" : `${best} ${SCORE_UNITS[kind]}`}</b></span>;
      })}
    </div>
  </section>;
}
