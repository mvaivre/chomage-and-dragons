"use client";

import type { PlayerView } from "@/hooks/useGame";
import { APPLICATIONS_PER_LEVEL } from "@/lib/config";
import { characterById } from "@/lib/game/characters";
import { untilNextChest } from "@/lib/game/scoring";
import { daysUntilDeadline } from "@/lib/game/season";
import { biomeAt, worldXFor } from "@/lib/game/world";
import { ChestIcon, CrownIcon } from "./icons";

/**
 * La fiche du joueur, en haut à gauche.
 *
 * Elle répond aux trois questions qu'on se pose en jouant : qui suis-je, où suis-je,
 * et combien de candidatures avant le prochain coffre.
 */

interface QuestHudProps {
  me: PlayerView | null;
  /** Rang dans la saison, 1 pour le/la meneur·euse. */
  seasonRank: number | null;
}

export function QuestHud({ me, seasonRank }: QuestHudProps) {
  if (!me) return null;

  const character = characterById(me.characterId);
  const zone = biomeAt(worldXFor(me.position));
  const remaining = untilNextChest(me.applications);
  const filled = APPLICATIONS_PER_LEVEL - remaining;
  const days = daysUntilDeadline();

  return (
    <div className="frame riveted pointer-events-auto w-60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-display text-lg tracking-wide text-parchment">
          {me.name}
        </span>
        <span className="shrink-0 font-display text-xs text-gold-light">
          Nv {me.level}
        </span>
      </div>
      <p className="truncate text-[0.68rem] text-gold-light/65">{character.name}</p>

      <div className="gold-rule my-2" />

      <dl className="flex flex-col gap-1 text-[0.7rem]">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-parchment/50">Contrée</dt>
          <dd className="min-w-0 truncate text-parchment/85">{zone.short}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-parchment/50">Points de saison</dt>
          <dd className="font-display text-sm text-gold-light">
            {me.score}
            {seasonRank ? (
              <span className="ml-1.5 text-[0.62rem] text-parchment/45">
                {seasonRank === 1 ? (
                  <CrownIcon className="inline h-3 w-3 text-gold-light" />
                ) : (
                  `${seasonRank}ᵉ`
                )}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-parchment/50">Ce mois</dt>
          <dd className="text-parchment/85">{me.monthScore}</dd>
        </div>
      </dl>

      <div className="mt-2.5">
        <div className="flex items-center gap-1.5 text-[0.64rem] text-parchment/55">
          <ChestIcon className="h-3.5 w-3.5 text-gold-light/70" />
          <span>
            Coffre dans {remaining} candidature{remaining === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden border border-gold-dim/60 bg-black/50">
          <div
            className="h-full bg-gold-light/80"
            style={{ width: `${(filled / APPLICATIONS_PER_LEVEL) * 100}%` }}
          />
        </div>
      </div>

      <p className="mt-2.5 text-[0.6rem] text-parchment/35">
        {days} jour{days === 1 ? "" : "s"} avant la Légende du Chômage
      </p>
    </div>
  );
}
