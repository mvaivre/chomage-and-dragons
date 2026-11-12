"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import { useEffect, useRef, useState } from "react";
import type { PlayerView } from "@/hooks/useGame";
import type { AvailablePower } from "@/lib/game/powers";
import { POWERS } from "@/lib/game/powers";
import { ChestArtwork, PowerArtwork } from "./Artwork";

interface PowerDeckProps {
  me: PlayerView;
  players: PlayerView[];
  attentionToken: number;
  initiallyOpen?: boolean;
  onCast: (power: AvailablePower, targetId: string) => string | undefined;
}

/** Inventaire des butins gagnés dans les coffres, avec sélection explicite de cible. */
export function PowerDeck({
  me,
  players,
  attentionToken,
  initiallyOpen = false,
  onCast,
}: PowerDeckProps) {
  const uiLocale = useLocale();
  const [open, setOpen] = useState(initiallyOpen);
  const [selected, setSelected] = useState<AvailablePower | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!initiallyOpen) return;
    const frame = requestAnimationFrame(() => {
      trigger.current?.scrollIntoView({ block: "start" });
      trigger.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [initiallyOpen]);
  const targets = players.filter((player) => player.id !== me.id);
  const inventory = new Map<AvailablePower["kind"], { power: AvailablePower; count: number }>();
  for (const power of me.availablePowers) {
    const owned = inventory.get(power.kind);
    inventory.set(power.kind, owned ? { ...owned, count: owned.count + 1 } : { power, count: 1 });
  }

  if (me.availablePowers.length === 0) return null;

  return (
    <div className="power-menu pointer-events-auto">
      <button
        ref={trigger}
        key={attentionToken}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`power-menu__trigger ${
          attentionToken > 0 ? "power-menu__trigger--earned" : ""
        }`} aria-expanded={open}>
        <ChestArtwork className="power-menu__chest-art"/>
        <span>{tr("Butins", undefined, uiLocale)}</span>
        <strong>{me.availablePowers.length}</strong>
      </button>

      {open ? (<div className="power-menu__popover rise">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl text-parchment-ink">{tr("Sac à malices", undefined, uiLocale)}</p>
              <p className="text-sm text-parchment-ink/60">{tr("Un butin, puis une cible.", undefined, uiLocale)}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-xl text-parchment-ink/45 hover:text-parchment-ink" aria-label={tr("Fermer les butins", undefined, uiLocale)}>
              ×
            </button>
          </div>

          <div className="grid gap-2">
            {[...inventory.values()].map(({ power, count }) => {
                const definition = POWERS[power.kind];
                const active = selected?.slot === power.slot;
                return (<button key={power.slot} type="button" onClick={() => { setSelected(active ? null : power); setError(null); }} className={`power-choice ${active ? "power-choice--active" : ""}`} aria-pressed={active}>
                  <span className="power-sigil" aria-hidden>
                    <PowerArtwork kind={power.kind} className="power-sigil__art"/>
                  </span>
                  <span className="min-w-0 text-left">
                    <strong>{tr(definition.name, undefined, uiLocale)}{count > 1 ? ` ×${count}` : ""}</strong>
                    <small>{tr(definition.description, undefined, uiLocale)}</small>
                  </span>
                </button>);
            })}
          </div>

          {selected ? (<div className="mt-3 border-t border-parchment-ink/15 pt-3">
              <p className="text-xs font-bold tracking-[0.14em] text-parchment-ink/50 uppercase">{tr("Lancer sur ", undefined, uiLocale)}</p>
              {targets.length ? (<div className="mt-2 flex flex-wrap gap-2">
                  {targets.map((target) => (<button key={target.id} type="button" onClick={() => {
                            const rejected = onCast(selected, target.id);
                            if (rejected) { setError(rejected); return; }
                            setSelected(null);
                            setOpen(false);
                        }} className="power-target">
                      {target.name}
                    </button>))}
                </div>) : (<p className="mt-2 text-sm text-parchment-ink/55 italic">{tr("Invite un camarade. ", undefined, uiLocale)}</p>)}
              {error ? <p className="meetup-editor__error" role="alert">{tr(error, undefined, uiLocale)}</p> : null}
            </div>) : null}
        </div>) : null}
    </div>);
}
