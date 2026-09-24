"use client";

import type { PlayerView } from "@/hooks/useGame";
import type { Cheer, GameEvent } from "@/lib/data/types";
import { ACTION_LABELS_ONE } from "@/lib/game/standings";
import { variantFor } from "@/lib/game/variants";
import { stepsForEvent } from "@/lib/game/scoring";
import { ActionArtwork } from "./Artwork";

export interface NewsItem {
  id: string;
  kind: "event" | "cheer";
  event?: GameEvent;
  cheer?: Cheer;
}

/** A friend just did something: a small card at the side, gone after a few seconds. */
export function NewsToast({ item, players, onOpen }: { item: NewsItem; players: PlayerView[]; onOpen: () => void }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  if (item.kind === "cheer" && item.cheer) {
    const from = byId.get(item.cheer.playerId)?.name ?? "Quelqu’un";
    return <button type="button" className="news-toast" data-kind="cheer" onClick={onOpen}>
      <span className="news-toast__emoji" aria-hidden>{item.cheer.emoji}</span>
      <span><strong>{from}</strong> salue ton action</span>
    </button>;
  }
  const event = item.event!;
  const player = byId.get(event.playerId);
  const variant = variantFor(event.id, event.kind);
  return <button type="button" className="news-toast" data-kind="event" data-rarity={variant.rarity} onClick={onOpen}>
    <ActionArtwork kind={event.kind} className="news-toast__art" />
    <span>
      <strong>{player?.name ?? "Une âme"}</strong> · {ACTION_LABELS_ONE[event.kind]}
      {variant.rarity !== "common" ? <small>{variant.name}</small> : null}
    </span>
  </button>;
}

/** On arrival: what the others did while you were away. */
export function AwayRecap({ events, cheers, players, onClose, onOpen }: {
  events: GameEvent[];
  cheers: Cheer[];
  players: PlayerView[];
  onClose: () => void;
  onOpen: () => void;
}) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const people = [...new Set(events.map((e) => e.playerId))];
  const steps = events.reduce((sum, e) => sum + Math.max(0, stepsForEvent(e)), 0);
  const rare = events.filter((e) => variantFor(e.id, e.kind).rarity !== "common");
  return <div className="recap-overlay" role="dialog" aria-modal="true" aria-labelledby="recap-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <section className="recap">
      <p className="recap__kicker">Pendant ton absence</p>
      <h2 id="recap-title">{events.length === 0 ? "On a pensé à toi" : `${events.length} action${events.length > 1 ? "s" : ""} dans la compagnie`}</h2>
      {events.length > 0 ? <p className="recap__summary">
        {people.map((id) => byId.get(id)?.name ?? "?").join(", ")} {people.length > 1 ? "ont" : "a"} parcouru {steps} pas
        {rare.length ? `, dont ${rare.length} moment${rare.length > 1 ? "s" : ""} rare${rare.length > 1 ? "s" : ""}` : ""}.
      </p> : null}
      <ol className="recap__list">
        {events.slice(-8).reverse().map((event) => {
          const variant = variantFor(event.id, event.kind);
          return <li key={event.id}>
            <ActionArtwork kind={event.kind} className="recap__art" />
            <span><strong>{byId.get(event.playerId)?.name ?? "?"}</strong> · {ACTION_LABELS_ONE[event.kind]}</span>
            {variant.rarity !== "common" ? <small data-rarity={variant.rarity}>{variant.name}</small> : null}
          </li>;
        })}
      </ol>
      {cheers.length ? <p className="recap__cheers">
        On t’a salué·e : {cheers.map((c) => `${c.emoji} ${byId.get(c.playerId)?.name ?? "?"}`).join(" · ")}
      </p> : null}
      <div className="recap__actions">
        <button type="button" className="recap__open" onClick={onOpen}>Voir la chronique</button>
        <button type="button" className="recap__close" onClick={onClose} autoFocus>Reprendre la route</button>
      </div>
    </section>
  </div>;
}
