"use client";

import { useEffect } from "react";
import { JOURNEY_STEPS, POINTS } from "@/lib/config";
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
    <div className="action-dock pointer-events-auto">
      <p className="action-dock__prompt">
        {hired
          ? "Quête accomplie — ta place à la taverne est réservée."
          : lastActionLabel
            ? `Dernier exploit : ${lastActionLabel}`
            : "Transforme ta recherche en voyage"}
      </p>

      <div className="action-dock__bar">
        {SLOTS.map(({ kind, label, hint, Icon, grave }, index) => (
          <button
            key={kind}
            type="button"
            onClick={() => onAction(kind)}
            disabled={hired}
            title={`${label} — ${hint}`}
            className={`action-button action-button--${kind}`}
          >
            <span className="keycap">{index + 1}</span>
            <Icon
              className={`action-button__icon ${grave ? "text-coral" : "text-gold-light"}`}
            />
            <span className="action-button__label">
              {label}
            </span>
            <span className="action-button__reward">
              {JOURNEY_STEPS[kind] === 0
                ? "Arrivée"
                : `${JOURNEY_STEPS[kind] > 0 ? "+" : ""}${JOURNEY_STEPS[kind]} pas`}
            </span>
            <span className={POINTS[kind] < 0 ? "text-coral" : "text-parchment/55"}>
              {formatPoints(kind)} pt{Math.abs(POINTS[kind]) === 1 ? "" : "s"}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler ma dernière action (Z)"
          className="action-undo"
        >
          <span className="keycap">Z</span>
          <UndoIcon className="h-5 w-5" />
          <span>Annuler</span>
        </button>
      </div>
    </div>
  );
}
