"use client";

import type { PlayerView } from "@/hooks/useGame";
import type { PowerCast } from "@/lib/data/types";
import { PowerArtwork } from "./Artwork";

interface ShotInboxProps {
  casts: PowerCast[];
  players: PlayerView[];
  onLater: () => void;
  onSettle: () => void;
}

export function ShotInbox({
  casts,
  players,
  onLater,
  onSettle,
}: ShotInboxProps) {
  const names = [
    ...new Set(
      casts.map(
        (cast) =>
          players.find((player) => player.id === cast.playerId)?.name ??
          "Une âme anonyme",
      ),
    ),
  ];
  const count = casts.length;

  return (
    <div className="reward-overlay shot-inbox-overlay">
      <section
        className="reward-modal shot-inbox-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shot-inbox-title"
      >
        <div className="reward-modal__corners" aria-hidden />
        <div className="reward-modal__visual" aria-hidden>
          <div className="reward-modal__rays" />
          <PowerArtwork kind="shot" className="reward-modal__art shot-inbox-art" priority />
        </div>

        <div className="reward-modal__copy">
          <p className="reward-modal__eyebrow">Courrier de la taverne</p>
          <h2 id="shot-inbox-title" className="reward-modal__title">
            {count} shot{count > 1 ? "s" : ""} t’attend{count > 1 ? "ent" : ""}.
          </h2>
          <p className="reward-modal__body">
            {names.join(", ")} {names.length > 1 ? "t’ont offert" : "t’a offert"}{" "}
            {count > 1 ? "ces verres" : "ce verre"} pendant ton absence.
          </p>
          <p className="shot-inbox-note">
            Alcoolisé ou non : seule la tournée compte. La dette reste visible dans
            le classement tant qu’elle n’est pas honorée.
          </p>
        </div>

        <div className="shot-inbox-actions">
          <button type="button" onClick={onLater} className="shot-inbox-later">
            Plus tard
          </button>
          <button type="button" onClick={onSettle} className="reward-modal__close">
            Shot honoré <span aria-hidden>›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
