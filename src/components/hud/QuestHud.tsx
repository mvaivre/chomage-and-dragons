"use client";

import type { PlayerView } from "@/hooks/useGame";
import { STEPS_PER_LEVEL } from "@/lib/config";
import { characterById } from "@/lib/game/characters";
import { untilNextChest } from "@/lib/game/scoring";
import { biomeAt, worldXFor } from "@/lib/game/world";
import { ChestIcon, CrownIcon } from "./icons";

/**
 * La fiche du joueur, en haut à gauche.
 *
 * Une seule lecture horizontale : qui je suis, où j'en suis, ce qui m'attend.
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
  const remaining = untilNextChest(me.journeySteps);
  const filled = STEPS_PER_LEVEL - remaining;

  return (
    <section className="journey-card pointer-events-auto" aria-label="Ton voyage">
      <div className="journey-card__identity">
        <p className="journey-card__kicker">Ton aventure</p>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate font-display text-2xl text-parchment">{me.name}</h2>
          <span className="shrink-0 rounded-full border border-gold/50 px-2 py-0.5 text-xs font-semibold text-gold-light">
            Niv. {me.level}
          </span>
        </div>
        <p className="journey-card__class">{character.name}</p>
      </div>

      <div className="journey-card__main">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="journey-card__kicker">En ce moment</p>
            <p className="truncate font-display text-xl text-gold-light">{zone.name}</p>
          </div>
          <dl className="journey-card__stats">
            <div>
              <dt>Voyage</dt>
              <dd>{me.journeySteps}</dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd>{me.score}</dd>
            </div>
            <div>
              <dt>Rang</dt>
              <dd>
                {seasonRank === 1 ? (
                  <CrownIcon className="h-4 w-4" />
                ) : seasonRank ? (
                  `${seasonRank}ᵉ`
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="journey-card__chest">
          <span className="flex items-center gap-1.5">
            <ChestIcon className="h-4 w-4" />
            Prochaine farce dans {remaining} pas
          </span>
          <div className="journey-card__meter">
            <div style={{ width: `${(filled / STEPS_PER_LEVEL) * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
