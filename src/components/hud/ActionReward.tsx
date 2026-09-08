"use client";

import { useEffect, useRef } from "react";
import type { ActionKind, PowerKind } from "@/lib/data/types";
import { POWERS } from "@/lib/game/powers";
import { ActionArtwork, ChestArtwork, PowerArtwork } from "./Artwork";

interface ActionMoment {
  id: string;
  type: "action";
  kind: ActionKind;
  steps: number;
  points: number;
  progress: number;
  place: string;
  discoveredPlace: boolean;
}

interface ChestMoment {
  id: string;
  type: "chest";
  powerKind: PowerKind;
}

export type RewardMoment = ActionMoment | ChestMoment;

const COPY: Record<
  ActionKind,
  { eyebrow: string; title: string; body: string }
> = {
  candidature: {
    eyebrow: "Candidature envoyée",
    title: "Le pigeon est parti.",
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
    body: "Une occasion se rapproche : trois pas vers la sortie du chômage.",
  },
  rejetApresEntretien: {
    eyebrow: "Rejet légendaire",
    title: "Un refus. La quête continue.",
    body: "Ce refus-là méritait au minimum un nouveau pays.",
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
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    return () => { requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".action-button:not(:disabled), .action-undo:not(:disabled)")?.focus()); };
  }, []);
  const chest = moment.type === "chest";

  return (
    <div className={`reward-overlay ${chest ? "reward-overlay--chest" : ""}`}>
      <section
        className={`reward-modal ${chest ? "reward-modal--chest" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`reward-title-${moment.id}`}
      >
        <div className="reward-modal__corners" aria-hidden />
        <div className="reward-modal__visual" aria-hidden>
          <div className="reward-modal__rays" />
          {chest ? (
            <ChestArtwork className="reward-modal__art reward-modal__art--chest" priority />
          ) : (
            <ActionArtwork kind={moment.kind} className="reward-modal__art" priority />
          )}
        </div>

        {chest ? (
          <ChestCopy moment={moment} titleId={`reward-title-${moment.id}`} />
        ) : (
          <ActionCopy moment={moment} titleId={`reward-title-${moment.id}`} />
        )}

        <button ref={close} type="button" onClick={onDone} className="reward-modal__close">
          {chest ? "Ranger le butin" : "Continuer l’aventure"}
          <span aria-hidden>›</span>
        </button>
      </section>
    </div>
  );
}

function ActionCopy({ moment, titleId }: { moment: ActionMoment; titleId: string }) {
  const copy = COPY[moment.kind];

  return (
    <div className="reward-modal__copy">
      <p className="reward-modal__eyebrow">{copy.eyebrow}</p>
      <h2 id={titleId} className="reward-modal__title">{copy.title}</h2>
      <p className="reward-modal__body">{copy.body}</p>

      <div className="reward-modal__gain">
        {moment.kind === "embauche" ? (
          <strong>Arrivée triomphale</strong>
        ) : (
          <>
            <strong>{moment.steps > 0 ? "+" : ""}{moment.steps}</strong>
            <span>pas de voyage</span>
            <i aria-hidden>◆</i>
            <b>{moment.points > 0 ? "+" : ""}{moment.points} pts</b>
          </>
        )}
      </div>

      <div className="reward-modal__route" aria-hidden>
        <div style={{ width: `${moment.progress * 100}%` }} />
      </div>
      <p className="reward-modal__place">
        {moment.discoveredPlace ? "Nouvelle contrée · " : "En route vers · "}
        <strong>{moment.place}</strong>
      </p>
    </div>
  );
}

function ChestCopy({ moment, titleId }: { moment: ChestMoment; titleId: string }) {
  const power = POWERS[moment.powerKind];

  return (
    <div className="reward-modal__copy reward-modal__copy--chest">
      <p className="reward-modal__eyebrow">Coffre de malheur ouvert</p>
      <h2 id={titleId} className="reward-modal__title">{power.name}</h2>
      <p className="reward-modal__loot-label">Butin débloqué</p>
      <p className="reward-modal__body">{power.description}</p>
      <div className="reward-modal__loot">
        <span aria-hidden>
          <PowerArtwork kind={moment.powerKind} className="reward-modal__power-art" />
        </span>
        <div>
          <small>Dans ton sac à malices</small>
          <strong>{power.short}</strong>
        </div>
      </div>
    </div>
  );
}
