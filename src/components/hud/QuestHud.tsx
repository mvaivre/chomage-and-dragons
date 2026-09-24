"use client";

import type { PlayerView } from "@/hooks/useGame";
import { STEPS_PER_LEVEL } from "@/lib/config";
import { characterById } from "@/lib/game/characters";
import { untilNextChest } from "@/lib/game/scoring";
import { biomeAt, worldXFor } from "@/lib/game/world";
import { useEffect, useState } from "react";
import { sfx } from "@/lib/client/sound";
import { ChestArtwork, CrownArtwork } from "./Artwork";
import { LANDED_EVENT, useTween } from "./Moment";

/** When the counters climb during an action's moment; null updates at once. */
export interface HudTiming {
  steps: { delay: number; duration: number };
  points: { delay: number; duration: number };
}

/**
 * La fiche du joueur, en haut à gauche.
 *
 * Une seule lecture horizontale : qui je suis, où j'en suis, ce qui m'attend.
 */

interface QuestHudProps {
  me: PlayerView | null;
  /** Rang dans la saison, 1 pour le/la meneur·euse. */
  seasonRank: number | null;
  timing?: HudTiming | null;
  /** Weeks in a row with at least one action. */
  streak?: number;
}

export function QuestHud({ me, seasonRank, timing = null, streak = 0 }: QuestHudProps) {
  if (!me) return null;
  return <QuestCard me={me} seasonRank={seasonRank} timing={timing} streak={streak} />;
}

function QuestCard({ me, seasonRank, timing, streak }: { me: PlayerView; seasonRank: number | null; timing: HudTiming | null; streak: number }) {
  // Steps climb while the hero walks; points when the flying number lands.
  const steps = useTween(me.journeySteps, timing?.steps ?? null, sfx.tick);
  const points = useTween(me.score, timing?.points ?? null);
  const [landed, setLanded] = useState(0);
  useEffect(() => {
    const onLanded = () => setLanded((count) => count + 1);
    window.addEventListener(LANDED_EVENT, onLanded);
    return () => window.removeEventListener(LANDED_EVENT, onLanded);
  }, []);

  const character = characterById(me.characterId);
  const zone = biomeAt(worldXFor(me.position));
  const remaining = untilNextChest(me.journeySteps, me.earnedChests);
  const filled = Math.max(0, STEPS_PER_LEVEL - remaining);

  return (
    <section className="journey-card pointer-events-auto" aria-label="Ton voyage">
      <div className="journey-card__identity">
        <p className="journey-card__kicker">Ton aventure</p>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate font-display text-2xl text-parchment">{me.name}</h2>
          <span className="journey-card__level">
            Niv. {me.level}
          </span>
          {streak >= 2 ? <span className="journey-card__streak" title={`${streak} semaines d’affilée avec au moins une action`}>🔥 {streak}</span> : null}
        </div>
        <span className="journey-card__mobile-score" data-hud-target="points" data-bump={(points.bump + landed) % 2}>{points.shown} pts</span>
        <p className="journey-card__class">{character.name}</p>
      </div>

      <div className="journey-card__main">
        <div className="journey-card__summary">
          <div className="min-w-0">
            <p className="journey-card__kicker">En ce moment</p>
            <p className="journey-card__place font-display text-xl text-gold-light">{zone.name}</p>
          </div>
          <dl className="journey-card__stats">
            <div>
              <dt>Voyage</dt>
              <dd data-bump={steps.bump % 2}>{steps.shown}</dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd data-hud-target="points" data-bump={(points.bump + landed) % 2}>{points.shown}</dd>
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
