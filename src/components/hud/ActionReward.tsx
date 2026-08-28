"use client";

import { useEffect } from "react";
import type { ActionKind } from "@/lib/data/types";

export interface RewardMoment {
  id: string;
  kind: ActionKind;
  steps: number;
  points: number;
  progress: number;
  place: string;
  discoveredPlace: boolean;
}

const COPY: Record<
  ActionKind,
  { eyebrow: string; title: string; body: string }
> = {
  candidature: {
    eyebrow: "Candidature envoyée",
    title: "Tu as osé. Le chemin répond.",
    body: "Une tentative de plus, un morceau de monde qui t’appartient.",
  },
  refus: {
    eyebrow: "Refus transformé",
    title: "Leur non devient ton chemin.",
    body: "Ils ferment une porte. Toi, tu avances quand même.",
  },
  entretien: {
    eyebrow: "Entretien traversé",
    title: "Trois pas derrière. Toujours debout.",
    body: "Le donjon t’a repoussé. Au prochain refus, tu traverseras une frontière.",
  },
  rejetApresEntretien: {
    eyebrow: "Rejet légendaire",
    title: "Dix pas. Une frontière tombe.",
    body: "Ce refus-là mérite au minimum un nouveau pays.",
  },
  embauche: {
    eyebrow: "Quête accomplie",
    title: "La taverne allume ses feux.",
    body: "Tes points restent. Ta place à table aussi.",
  },
};

export function ActionReward({
  moment,
  onDone,
}: {
  moment: RewardMoment;
  onDone: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(timeout);
  }, [moment.id, onDone]);

  const copy = COPY[moment.kind];

  return (
    <aside className="journey-reward pointer-events-none absolute z-20">
      <div className="journey-reward__glow" />
      <p className="journey-reward__eyebrow">{copy.eyebrow}</p>
      <p className="journey-reward__title">{copy.title}</p>
      <p className="journey-reward__body">{copy.body}</p>

      <div className="journey-reward__gain">
        {moment.kind === "embauche" ? (
          <span>Arrivée triomphale</span>
        ) : (
          <>
            <strong>{moment.steps > 0 ? "+" : ""}{moment.steps}</strong>
            <span>pas de voyage</span>
            <i>·</i>
            <span>
              {moment.points > 0 ? "+" : ""}
              {moment.points} pt{Math.abs(moment.points) === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>

      <div className="journey-reward__route" aria-hidden>
        <div style={{ width: `${moment.progress * 100}%` }} />
      </div>
      <p className="journey-reward__place">
        {moment.discoveredPlace ? "Nouvelle contrée · " : "En route vers · "}
        <strong>{moment.place}</strong>
      </p>
    </aside>
  );
}
