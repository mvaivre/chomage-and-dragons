"use client";

import type { PlayerView } from "@/hooks/useGame";
import { STEPS_PER_LEVEL } from "@/lib/config";
import { characterArt, characterById } from "@/lib/game/characters";
import { untilNextChest } from "@/lib/game/scoring";
import { interiorAt } from "@/lib/game/decor";
import { biomeAt, worldXFor } from "@/lib/game/world";
import { sfx } from "@/lib/client/sound";
import { ChestArtwork, CrownArtwork } from "./Artwork";
import { useTween } from "./Moment";

/** When the counters climb during an action's moment; null updates at once. */
export interface HudTiming {
  steps: { delay: number; duration: number };
}

/**
 * La fiche du joueur, en haut à gauche.
 *
 * Une seule lecture horizontale : qui je suis, où j'en suis, ce qui m'attend.
 */

interface QuestHudProps {
  me: PlayerView | null;
  laneOffset?: number;
  /** Rang dans la saison, 1 pour le/la meneur·euse. */
  seasonRank: number | null;
  timing?: HudTiming | null;
  /** Weeks in a row with at least one action. */
  streak?: number;
}

export function QuestHud({ me, seasonRank, timing = null, streak = 0, laneOffset = -80 }: QuestHudProps) {
  if (!me) return null;
  return <QuestCard me={me} seasonRank={seasonRank} timing={timing} streak={streak} laneOffset={laneOffset} />;
}

function QuestCard({ me, seasonRank, timing, streak, laneOffset }: { laneOffset: number; me: PlayerView; seasonRank: number | null; timing: HudTiming | null; streak: number }) {
  // One counter follows the journey.
  const steps = useTween(me.journeySteps, timing?.steps ?? null, sfx.tick);
  const character = characterById(me.characterId);
  const zone = interiorAt(worldXFor(me.position) + laneOffset) ?? biomeAt(worldXFor(me.position));
  const remaining = untilNextChest(me.journeySteps, me.earnedChests);
  const filled = Math.max(0, STEPS_PER_LEVEL - remaining);

  return (
    <section className="journey-card pointer-events-auto" aria-label="Ton voyage">
      <div className="journey-card__identity">
        {/* eslint-disable-next-line @next/next/no-img-element -- small local alpha WebP, already optimized */}
        <img className="journey-card__portrait" src={characterArt(me.characterId)} alt="" width={208} height={293} />
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate font-display text-2xl text-parchment" title={character.name}>{me.name}</h2>
          <span className="journey-card__level">
            Niv. {me.level}
          </span>
          {streak >= 2 ? <span className="journey-card__streak" title={`${streak} semaines d’affilée avec au moins une action`}>🔥 {streak}</span> : null}
        </div>
      </div>

      <div className="journey-card__main">
        <div className="journey-card__summary">
          <div className="min-w-0">
            <p className="journey-card__place font-display text-xl text-gold-light">{zone.name}</p>
          </div>
          <dl className="journey-card__stats">
            <div>
              <dt>Pas</dt>
              <dd data-bump={steps.bump % 2}>{steps.shown}</dd>
            </div>
            <div>
              <dt>Rang</dt>
              <dd>
                {seasonRank === 1 ? (
                  <CrownArtwork className="hud-crown-art" />
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
            <ChestArtwork className="journey-card__chest-art" />
            Prochain butin dans {remaining} pas
          </span>
          <div className="journey-card__meter">
            <div style={{
              width: `${(filled / STEPS_PER_LEVEL) * 100}%`,
              transition: timing ? `width ${timing.steps.duration}ms linear ${timing.steps.delay}ms` : undefined,
            }} />
          </div>
        </div>
      </div>
    </section>
  );
}
