"use client";

import { useEffect, useRef } from "react";
import type { ActionKind, MiniGameKind } from "@/lib/data/types";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS } from "@/lib/game/scores";
import { sfx } from "@/lib/client/sound";

/** What winning brings, in the words of the reward. */
function stake(kind: MiniGameKind, action: ActionKind | "chest"): string {
  if (action === "chest") return "Un butin de plus";
  if (action === "candidature") return `×2 · +${JOURNEY_STEPS.candidature + MINI_GAME_BONUS.candidature} pas`;
  if (action === "entretien") return `${JOURNEY_STEPS.entretien + MINI_GAME_BONUS.entretien} pas au lieu de ${JOURNEY_STEPS.entretien}`;
  return `+${MINI_GAME_BONUS[action]} pas bonus`;
}

/**
 * The challenge arrives once the action's moment has played out, as a card:
 * the moment is never cut short, and the player chooses when to dive in.
 * Enter or Space plays, Escape passes.
 */
export function MiniGameInvite({ kind, action, record, onPlay, onPass }: {
  kind: MiniGameKind;
  action: ActionKind | "chest";
  record?: { score: number; holder: string } | null;
  onPlay: () => void;
  onPass: () => void;
}) {
  const play = useRef<HTMLButtonElement>(null);
  const copy = MINI_GAMES[kind];
  useEffect(() => {
    sfx.invite();
    play.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onPass(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPass]);
  return <section className="mini-game-invite" role="dialog" aria-modal="false" aria-labelledby="mini-game-invite-title">
    <p className="mini-game-invite__kicker">{action === "chest" ? "Le coffre a un double fond" : "Défi facultatif"} · {copy.misery}</p>
    <h2 id="mini-game-invite-title">{copy.title}</h2>
    <p className="mini-game-invite__stake">{stake(kind, action)}</p>
    {record ? <p className="mini-game-invite__record">Record à battre : {record.score} {SCORE_UNITS[kind]} · {record.holder}</p> : null}
    <div className="mini-game-invite__actions">
      <button ref={play} type="button" className="mini-game-invite__play" onClick={onPlay}>Relever le défi</button>
      <button type="button" className="mini-game-invite__pass" onClick={onPass}>Passer</button>
    </div>
  </section>;
}
