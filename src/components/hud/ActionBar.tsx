"use client";

import { useEffect } from "react";
import { POINTS } from "@/lib/config";
import type { ActionKind } from "@/lib/data/types";
import {
  BoltIcon,
  GobletIcon,
  PigeonIcon,
  SkullIcon,
  TrophyIcon,
  UndoIcon,
} from "./icons";

/**
 * La barre d'action, en bas de l'écran.
 *
 * Cinq emplacements pour les cinq actions officielles, et rien d'autre : tout ce qui
 * relève de la consultation vit ailleurs. Les raccourcis 1 à 5 sont là pour les
 * soirées où l'on saisit une semaine de refus d'un coup.
 */

interface Slot {
  kind: ActionKind;
  label: string;
  hint: string;
  Icon: (props: { className?: string }) => React.ReactElement;
  /** Accentué en rouge : les actions qui coûtent ou qui font sortir de la course. */
  grave?: boolean;
}

const SLOTS: Slot[] = [
  {
    kind: "candidature",
    label: "Candidature",
    hint: "Le pigeon part",
    Icon: PigeonIcon,
  },
  { kind: "refus", label: "Refus", hint: "La foudre tombe", Icon: BoltIcon },
  {
    kind: "entretien",
    label: "Entretien",
    hint: "On trinque quand même",
    Icon: GobletIcon,
    grave: true,
  },
  {
    kind: "rejetApresEntretien",
    label: "Rejet post-entretien",
    hint: "Legendary rejection",
    Icon: SkullIcon,
  },
  {
    kind: "embauche",
    label: "Engagé·e",
    hint: "Fin de la course",
    Icon: TrophyIcon,
    grave: true,
  },
];

const formatPoints = (kind: ActionKind) => {
  const value = POINTS[kind];
  if (value === 0) return "±0";
  return value > 0 ? `+${value}` : `${value}`;
};

interface ActionBarProps {
  onAction: (kind: ActionKind) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Un personnage engagé a quitté la course : plus rien à déclarer. */
  hired: boolean;
  lastActionLabel: string | null;
}

export function ActionBar({
  onAction,
  onUndo,
  canUndo,
  hired,
  lastActionLabel,
}: ActionBarProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const index = Number(event.key) - 1;
      if (!hired && index >= 0 && index < SLOTS.length) {
        event.preventDefault();
        onAction(SLOTS[index].kind);
        return;
      }

      if ((event.key === "z" || event.key === "Backspace") && canUndo) {
        event.preventDefault();
        onUndo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAction, onUndo, canUndo, hired]);

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5">
      <p className="h-4 text-[0.7rem] text-parchment/50">
        {hired
          ? "Tu as été engagé·e. Tes points restent acquis."
          : lastActionLabel
            ? `Dernière action : ${lastActionLabel}`
            : ""}
      </p>

      <div className="frame riveted flex items-stretch gap-1.5 p-2">
        {SLOTS.map(({ kind, label, hint, Icon, grave }, index) => (
          <button
            key={kind}
            type="button"
            onClick={() => onAction(kind)}
            disabled={hired}
            title={`${label} — ${hint}`}
            className="slot w-[5.6rem] px-1 py-2 sm:w-[6.4rem]"
          >
            <span className="keycap">{index + 1}</span>
            <Icon
              className={`h-6 w-6 ${grave ? "text-blood" : "text-gold-light"}`}
            />
            <span className="mt-0.5 text-center text-[0.66rem] leading-tight text-parchment/85">
              {label}
            </span>
            <span
              className={`font-display text-xs ${
                POINTS[kind] < 0 ? "text-blood" : "text-gold-light"
              }`}
            >
              {formatPoints(kind)}
            </span>
          </button>
        ))}

        <div className="mx-0.5 w-px self-stretch bg-gold-dim/50" />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler ma dernière action (Z)"
          className="slot w-14 px-1 py-2"
        >
          <span className="keycap">Z</span>
          <UndoIcon className="h-5 w-5 text-parchment/70" />
          <span className="text-[0.62rem] text-parchment/60">Annuler</span>
        </button>
      </div>
    </div>
  );
}
