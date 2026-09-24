"use client";

import { useMemo } from "react";
import type { PlayerView } from "@/hooks/useGame";
import type { Cheer, CheerEmoji, GameEvent } from "@/lib/data/types";
import { CHEER_EMOJIS } from "@/lib/game/reducer";
import { ACTION_LABELS_ONE } from "@/lib/game/standings";
import { stepsForEvent } from "@/lib/game/scoring";
import { variantFor } from "@/lib/game/variants";
import { characterById } from "@/lib/game/characters";
import { ActionArtwork } from "./Artwork";
import { taleFor } from "@/lib/game/tales";

const TIME = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function relativeTime(at: string, now = Date.now()): string {
  const seconds = (new Date(at).getTime() - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return "à l’instant";
  if (abs < 3600) return TIME.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return TIME.format(Math.round(seconds / 3600), "hour");
  return TIME.format(Math.round(seconds / 86400), "day");
}

/**
 * The group's chronicle: every friend's latest actions, their stagings, and the
 * cheers they received. Cheering someone is one tap on an emoji.
 */
export function Chronicle({ events, players, cheers, meId, onCheer, onClose, daily }: {
  events: GameEvent[];
  players: PlayerView[];
  cheers: Cheer[];
  meId: string | null;
  onCheer: (eventId: string, emoji: CheerEmoji) => void;
  onClose: () => void;
  /** Today's challenge, shown first. */
  daily?: React.ReactNode;
}) {
  const byPlayer = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const recent = useMemo(() => [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40), [events]);
  const cheersByEvent = useMemo(() => {
    const map = new Map<string, Cheer[]>();
    for (const c of cheers) map.set(c.eventId, [...(map.get(c.eventId) ?? []), c]);
    return map;
  }, [cheers]);

  return <div className="chronicle-overlay" role="dialog" aria-modal="true" aria-labelledby="chronicle-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <section className="chronicle">
      <header className="chronicle__header">
        <div>
          <p className="chronicle__kicker">La compagnie</p>
          <h2 id="chronicle-title">Chronique</h2>
        </div>
        <button type="button" className="chronicle__close" onClick={onClose} autoFocus>Fermer</button>
      </header>
      {daily}
      {recent.length === 0 ? <p className="chronicle__empty">Rien encore. La première candidature ouvrira la chronique.</p> : null}
      <ol className="chronicle__list">
        {recent.map((event) => {
          const player = byPlayer.get(event.playerId);
          const variant = variantFor(event.id, event.kind);
          const steps = stepsForEvent(event);
          const received = cheersByEvent.get(event.id) ?? [];
          const mine = received.find((c) => c.playerId === meId)?.emoji;
          const counts = CHEER_EMOJIS.map((emoji) => [emoji, received.filter((c) => c.emoji === emoji)] as const).filter(([, list]) => list.length);
          const own = event.playerId === meId;
          return <li key={event.id} className="chronicle__item" data-own={own}>
            <ActionArtwork kind={event.kind} className="chronicle__art" />
            <div className="chronicle__body">
              <p className="chronicle__line">
                <strong>{player?.name ?? "Une âme partie"}</strong> · {ACTION_LABELS_ONE[event.kind]}
                {steps !== 0 ? <span className="chronicle__steps">{steps > 0 ? "+" : ""}{steps} pas</span> : null}
              </p>
              <p className="chronicle__meta">
                {variant.rarity !== "common" ? <span className="chronicle__variant" data-rarity={variant.rarity}>{variant.name}</span> : null}
                <span>{relativeTime(event.at)}</span>
                {player ? <span className="chronicle__class">{characterById(player.characterId).name}</span> : null}
              </p>
              {(() => { const tale = taleFor(event); return tale ? <p className="chronicle__tale" data-kind={tale.kind}><b>{tale.title}.</b> {tale.text}</p> : null; })()}
              <div className="chronicle__cheers">
                {counts.map(([emoji, list]) => <span key={emoji} className="chronicle__count" title={list.map((c) => byPlayer.get(c.playerId)?.name ?? "?").join(", ")}>{emoji} {list.length}</span>)}
                {!own && meId ? <span className="chronicle__react" role="group" aria-label={`Réagir à l’action de ${player?.name ?? "cette personne"}`}>
                  {CHEER_EMOJIS.map((emoji) => <button key={emoji} type="button" aria-pressed={mine === emoji} onClick={() => onCheer(event.id, emoji)}>{emoji}</button>)}
                </span> : null}
              </div>
            </div>
          </li>;
        })}
      </ol>
    </section>
  </div>;
}
