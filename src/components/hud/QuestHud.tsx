"use client";

import type { PlayerView } from "@/hooks/useGame";
import { STEPS_PER_LEVEL } from "@/lib/config";
import { CharacterPortrait } from "./CharacterPortrait";
import { characterById } from "@/lib/game/characters";
import { untilNextChest } from "@/lib/game/scoring";
import { interiorAt } from "@/lib/game/decor";
import { biomeAt, worldXFor } from "@/lib/game/world";
import { sfx } from "@/lib/client/sound";
import { VoxelIcon } from "./VoxelIcon";
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
  onOpenMenu: () => void;
  menuOpen?: boolean;
  menuDisabled?: boolean;
  /** Rang dans la saison, 1 pour le/la meneur·euse. */
  seasonRank: number | null;
  timing?: HudTiming | null;
  /** Weeks in a row with at least one action. */
  streak?: number;
}

export function QuestHud({
  me,
  seasonRank,
  timing = null,
  streak = 0,
  onOpenMenu,
  menuOpen,
  menuDisabled,
}: QuestHudProps) {
  if (!me) return null;
  return (
    <QuestCard
      me={me}
      seasonRank={seasonRank}
      timing={timing}
      streak={streak}
      onOpenMenu={onOpenMenu}
      menuOpen={menuOpen}
      menuDisabled={menuDisabled}
    />
  );
}

function QuestCard({
  me,
  seasonRank,
  timing,
  streak,
  onOpenMenu,
  menuOpen,
  menuDisabled,
}: Omit<QuestHudProps, "me" | "timing" | "streak"> & {
  me: PlayerView;
  timing: HudTiming | null;
  streak: number;
}) {
  // One counter follows the journey.
  const steps = useTween(me.journeySteps, timing?.steps ?? null, sfx.tick);
  const character = characterById(me.characterId);
  const zone =
    interiorAt(worldXFor(me.position)) ?? biomeAt(worldXFor(me.position));
  const remaining = untilNextChest(me.journeySteps, me.earnedChests);
  const filled = Math.max(0, STEPS_PER_LEVEL - remaining);

  return (
    <section
      className="journey-card pointer-events-auto"
      aria-label="Ton voyage"
    >
      <div className="journey-card__identity">
        <button
          type="button"
          className="journey-card__menu"
          onClick={onOpenMenu}
          disabled={menuDisabled}
          aria-label={`Ouvrir le carnet de ${me.name}`}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          title="Carnet · quêtes, butins et réglages"
        >
          <CharacterPortrait character={characterById(me.characterId)} framing="bust" className="journey-card__portrait" />
          <VoxelIcon name="menu" />
          {me.availablePowers.length ? (
            <b
              className="journey-card__loot"
              title={`${me.availablePowers.length} butins dans le carnet`}
            >
              {me.availablePowers.length}
            </b>
          ) : null}
        </button>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2
            className="truncate font-display text-2xl text-parchment"
            title={character.name}
          >
            {me.name}
          </h2>
          <span className="journey-card__level">Niv. {me.level}</span>
          {streak >= 2 ? (
            <span
              className="journey-card__streak"
              title={`${streak} semaines d’affilée avec au moins une action`}
            >
              <VoxelIcon name="fire" /> {streak}
            </span>
          ) : null}
        </div>
      </div>

      <div className="journey-card__main">
        <div className="journey-card__summary">
          <div className="min-w-0">
            <p className="journey-card__place font-display text-xl text-gold-light">
              {zone.name}
            </p>
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
          <div
            className="journey-card__meter"
            role="progressbar"
            aria-label="Vers le prochain butin"
            aria-valuemin={0}
            aria-valuemax={STEPS_PER_LEVEL}
            aria-valuenow={filled}
            aria-valuetext={`Prochain butin dans ${remaining} pas`}
            title={`Prochain butin dans ${remaining} pas`}
          >
            <div
              style={{
                width: `${(filled / STEPS_PER_LEVEL) * 100}%`,
                transition: timing
                  ? `width ${timing.steps.duration}ms linear ${timing.steps.delay}ms`
                  : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
