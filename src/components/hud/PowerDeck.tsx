"use client";

import { useState } from "react";
import type { PlayerView } from "@/hooks/useGame";
import type { AvailablePower } from "@/lib/game/powers";
import { POWERS } from "@/lib/game/powers";
import { ChestIcon } from "./icons";

interface PowerDeckProps {
  me: PlayerView;
  players: PlayerView[];
  onCast: (power: AvailablePower, targetId: string) => void;
}

/** Inventaire des farces gagnées dans les coffres, avec sélection explicite de cible. */
export function PowerDeck({ me, players, onCast }: PowerDeckProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AvailablePower | null>(null);
  const targets = players.filter((player) => player.id !== me.id);

  if (me.availablePowers.length === 0) return null;

  return (
    <div className="power-menu pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="power-menu__trigger"
        aria-expanded={open}
      >
        <ChestIcon className="h-5 w-5" />
        <span>Farces</span>
        <strong>{me.availablePowers.length}</strong>
      </button>

      {open ? (
        <div className="power-menu__popover rise">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl text-parchment-ink">Sac à malices</p>
              <p className="text-sm text-parchment-ink/60">Choisis un sort, puis une victime.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xl text-parchment-ink/45 hover:text-parchment-ink"
              aria-label="Fermer les farces"
            >
              ×
            </button>
          </div>

          <div className="grid gap-2">
            {me.availablePowers.map((power) => {
              const definition = POWERS[power.kind];
              const active = selected?.slot === power.slot;
              return (
                <button
                  key={power.slot}
                  type="button"
                  onClick={() => setSelected(active ? null : power)}
                  className={`power-choice ${active ? "power-choice--active" : ""}`}
                  aria-pressed={active}
                >
                  <span className="power-sigil" aria-hidden>{definition.glyph}</span>
                  <span className="min-w-0 text-left">
                    <strong>{definition.name}</strong>
                    <small>{definition.description}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="mt-3 border-t border-parchment-ink/15 pt-3">
              <p className="text-xs font-bold tracking-[0.14em] text-parchment-ink/50 uppercase">
                Lancer sur
              </p>
              {targets.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {targets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => {
                        onCast(selected, target.id);
                        setSelected(null);
                        setOpen(false);
                      }}
                      className="power-target"
                    >
                      {target.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-parchment-ink/55 italic">
                  Enrôle un camarade pour pouvoir le tourmenter.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
