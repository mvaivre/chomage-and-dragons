"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import type { PlayerView } from "@/hooks/useGame";
import type { PowerCast } from "@/lib/data/types";
import { PowerArtwork } from "./Artwork";
interface ShotInboxProps {
    casts: PowerCast[];
    players: PlayerView[];
    onLater: () => void;
    onSettle: () => void;
}
export function ShotInbox({ casts, players, onLater, onSettle, }: ShotInboxProps) {
    const uiLocale = useLocale();
    const names = [
        ...new Set(casts.map((cast) => players.find((player) => player.id === cast.playerId)?.name ??
            "Une âme anonyme")),
    ];
    const count = casts.length;
    return (<div className="reward-overlay shot-inbox-overlay">
      <section className="reward-modal shot-inbox-modal" role="dialog" aria-modal="true" aria-labelledby="shot-inbox-title">
        <div className="reward-modal__corners" aria-hidden/>
        <div className="reward-modal__visual" aria-hidden>
          <div className="reward-modal__rays"/>
          <PowerArtwork kind="shot" className="reward-modal__art shot-inbox-art" priority/>
        </div>

        <div className="reward-modal__copy">
          <p className="reward-modal__eyebrow">{tr("Courrier de la taverne", undefined, uiLocale)}</p>
          <h2 id="shot-inbox-title" className="reward-modal__title">
            {count}{tr(" shot", undefined, uiLocale)}{tr(count > 1 ? "s" : "", undefined, uiLocale)}{tr(" t’attend", undefined, uiLocale)}{tr(count > 1 ? "ent" : "", undefined, uiLocale)}.
          </h2>
          <p className="reward-modal__body">
            {names.join(", ")} {names.length > 1 ? "t’ont offert" : "t’a offert"}{" "}
            {tr(count > 1 ? "ces verres" : "ce verre", undefined, uiLocale)}{tr(" pendant ton absence. ", undefined, uiLocale)}</p>
          <p className="shot-inbox-note">{tr("Avec ou sans alcool. À marquer une fois bu. ", undefined, uiLocale)}</p>
        </div>

        <div className="shot-inbox-actions">
          <button type="button" onClick={onLater} className="shot-inbox-later">{tr("Plus tard ", undefined, uiLocale)}</button>
          <button type="button" onClick={onSettle} className="reward-modal__close">{tr("Shot honoré ", undefined, uiLocale)}<span aria-hidden>›</span>
          </button>
        </div>
      </section>
    </div>);
}
